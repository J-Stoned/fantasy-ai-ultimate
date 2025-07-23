/**
 * Authentication Manager for Fantasy Platform APIs
 * Handles OAuth2 flows, credential storage, and token management
 */

import {
  AuthCredentials,
  OAuthConfig,
  FantasyPlatform,
  ApiError,
  ApiResponse
} from './types';
import { createHash, randomBytes } from 'crypto';

export class AuthManager {
  private credentials: Map<string, AuthCredentials> = new Map();
  private oauthConfigs: Map<FantasyPlatform, OAuthConfig> = new Map();
  private tokenRefreshTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeOAuthConfigs();
  }

  private initializeOAuthConfigs(): void {
    // Yahoo OAuth2 Config
    this.oauthConfigs.set('yahoo', {
      clientId: process.env.YAHOO_CLIENT_ID || '',
      clientSecret: process.env.YAHOO_CLIENT_SECRET || '',
      redirectUri: process.env.YAHOO_REDIRECT_URI || 'http://localhost:3000/auth/yahoo/callback',
      scope: ['fspt-r', 'fspt-w'], // Fantasy Sports read/write
      authorizationUrl: 'https://api.login.yahoo.com/oauth2/request_auth',
      tokenUrl: 'https://api.login.yahoo.com/oauth2/get_token'
    });

    // ESPN doesn't use OAuth2 but cookies/session
    this.oauthConfigs.set('espn', {
      clientId: 'espn-web',
      clientSecret: '',
      redirectUri: '',
      scope: [],
      authorizationUrl: 'https://registerdisney.go.com/jgc/v6/client/ESPN-OneID.WEB-PROD',
      tokenUrl: ''
    });

    // CBS Sports OAuth Config
    this.oauthConfigs.set('cbs', {
      clientId: process.env.CBS_CLIENT_ID || '',
      clientSecret: process.env.CBS_CLIENT_SECRET || '',
      redirectUri: process.env.CBS_REDIRECT_URI || 'http://localhost:3000/auth/cbs/callback',
      scope: ['fantasy_read', 'fantasy_write'],
      authorizationUrl: 'https://www.cbssports.com/api/oauth/authorize',
      tokenUrl: 'https://www.cbssports.com/api/oauth/token'
    });

    // Sleeper doesn't require OAuth - uses simple API
    this.oauthConfigs.set('sleeper', {
      clientId: '',
      clientSecret: '',
      redirectUri: '',
      scope: [],
      authorizationUrl: '',
      tokenUrl: ''
    });
  }

  /**
   * Generate OAuth2 authorization URL
   */
  public getAuthorizationUrl(platform: FantasyPlatform, state?: string): string {
    const config = this.oauthConfigs.get(platform);
    if (!config || !config.authorizationUrl) {
      throw new Error(`OAuth not supported for platform: ${platform}`);
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scope.join(' '),
      state: state || this.generateState()
    });

    // Platform-specific params
    if (platform === 'yahoo') {
      params.append('language', 'en-us');
    }

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  public async exchangeCodeForToken(
    platform: FantasyPlatform,
    code: string
  ): Promise<ApiResponse<AuthCredentials>> {
    try {
      const config = this.oauthConfigs.get(platform);
      if (!config || !config.tokenUrl) {
        throw new Error(`OAuth not supported for platform: ${platform}`);
      }

      const params = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code'
      });

      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: {
            code: 'AUTH_TOKEN_EXCHANGE_FAILED',
            message: error.error_description || 'Failed to exchange code for token',
            details: error
          }
        };
      }

      const data = await response.json();
      const credentials: AuthCredentials = {
        platform,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + (data.expires_in * 1000)),
        userId: data.xoauth_yahoo_guid || data.user_id
      };

      // Store credentials
      this.storeCredentials(credentials);

      // Schedule token refresh
      if (credentials.refreshToken && credentials.expiresAt) {
        this.scheduleTokenRefresh(credentials);
      }

      return {
        success: true,
        data: credentials
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'AUTH_TOKEN_EXCHANGE_ERROR',
          message: 'Failed to exchange authorization code',
          details: error
        }
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshAccessToken(
    credentials: AuthCredentials
  ): Promise<ApiResponse<AuthCredentials>> {
    try {
      const config = this.oauthConfigs.get(credentials.platform);
      if (!config || !config.tokenUrl || !credentials.refreshToken) {
        throw new Error('Token refresh not supported');
      }

      const params = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: credentials.refreshToken,
        grant_type: 'refresh_token'
      });

      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: {
            code: 'AUTH_TOKEN_REFRESH_FAILED',
            message: error.error_description || 'Failed to refresh token',
            details: error,
            retryable: true
          }
        };
      }

      const data = await response.json();
      const newCredentials: AuthCredentials = {
        ...credentials,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || credentials.refreshToken,
        expiresAt: new Date(Date.now() + (data.expires_in * 1000))
      };

      // Update stored credentials
      this.storeCredentials(newCredentials);

      // Reschedule token refresh
      this.scheduleTokenRefresh(newCredentials);

      return {
        success: true,
        data: newCredentials
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'AUTH_TOKEN_REFRESH_ERROR',
          message: 'Failed to refresh access token',
          details: error,
          retryable: true
        }
      };
    }
  }

  /**
   * Store credentials securely
   */
  public storeCredentials(credentials: AuthCredentials): void {
    const key = this.getCredentialKey(credentials.platform, credentials.userId || '');
    this.credentials.set(key, credentials);

    // In production, encrypt and store in secure storage
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implement secure storage (e.g., encrypted database, key vault)
      console.log('Storing credentials securely...');
    }
  }

  /**
   * Retrieve stored credentials
   */
  public getCredentials(platform: FantasyPlatform, userId: string): AuthCredentials | null {
    const key = this.getCredentialKey(platform, userId);
    const credentials = this.credentials.get(key);

    if (!credentials) {
      // Try to load from secure storage
      // TODO: Implement secure storage retrieval
      return null;
    }

    // Check if token is expired
    if (credentials.expiresAt && new Date() >= credentials.expiresAt) {
      // Token expired, needs refresh
      return { ...credentials, accessToken: undefined };
    }

    return credentials;
  }

  /**
   * Remove stored credentials
   */
  public removeCredentials(platform: FantasyPlatform, userId: string): void {
    const key = this.getCredentialKey(platform, userId);
    this.credentials.delete(key);

    // Cancel any scheduled token refresh
    const timer = this.tokenRefreshTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.tokenRefreshTimers.delete(key);
    }

    // Remove from secure storage
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implement secure storage removal
      console.log('Removing credentials from secure storage...');
    }
  }

  /**
   * Validate credentials
   */
  public validateCredentials(credentials: AuthCredentials): boolean {
    // Check required fields based on platform
    switch (credentials.platform) {
      case 'yahoo':
      case 'cbs':
        return !!(credentials.accessToken && credentials.userId);
      
      case 'espn':
        return !!(credentials.apiKey || credentials.accessToken);
      
      case 'sleeper':
        // Sleeper doesn't require authentication for most endpoints
        return true;
      
      default:
        return false;
    }
  }

  /**
   * Get authorization headers for API requests
   */
  public getAuthHeaders(credentials: AuthCredentials): Record<string, string> {
    const headers: Record<string, string> = {};

    switch (credentials.platform) {
      case 'yahoo':
        if (credentials.accessToken) {
          headers['Authorization'] = `Bearer ${credentials.accessToken}`;
        }
        break;
      
      case 'espn':
        if (credentials.apiKey) {
          headers['X-Fantasy-Filter'] = JSON.stringify({ 
            players: { filterStatsForCurrentSeasonScoringPeriodId: { value: true } } 
          });
          // ESPN uses cookies for auth
          headers['Cookie'] = `espn_s2=${credentials.apiKey}; SWID=${credentials.userId}`;
        }
        break;
      
      case 'cbs':
        if (credentials.accessToken) {
          headers['Authorization'] = `Bearer ${credentials.accessToken}`;
        }
        break;
      
      case 'sleeper':
        // Sleeper doesn't require auth headers for most endpoints
        break;
    }

    return headers;
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(credentials: AuthCredentials): void {
    if (!credentials.expiresAt || !credentials.refreshToken) {
      return;
    }

    const key = this.getCredentialKey(credentials.platform, credentials.userId || '');
    
    // Cancel existing timer
    const existingTimer = this.tokenRefreshTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Calculate refresh time (5 minutes before expiry)
    const refreshTime = credentials.expiresAt.getTime() - Date.now() - (5 * 60 * 1000);
    
    if (refreshTime > 0) {
      const timer = setTimeout(async () => {
        console.log(`Refreshing token for ${credentials.platform} user ${credentials.userId}`);
        await this.refreshAccessToken(credentials);
      }, refreshTime);

      this.tokenRefreshTimers.set(key, timer);
    }
  }

  /**
   * Generate secure state parameter for OAuth
   */
  private generateState(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Generate credential storage key
   */
  private getCredentialKey(platform: FantasyPlatform, userId: string): string {
    return `${platform}:${userId}`;
  }

  /**
   * Clear all stored credentials and timers
   */
  public clearAll(): void {
    // Clear all refresh timers
    this.tokenRefreshTimers.forEach(timer => clearTimeout(timer));
    this.tokenRefreshTimers.clear();

    // Clear all credentials
    this.credentials.clear();
  }

  /**
   * Handle platform-specific authentication
   */
  public async authenticatePlatform(
    platform: FantasyPlatform,
    authData: any
  ): Promise<ApiResponse<AuthCredentials>> {
    switch (platform) {
      case 'espn':
        return this.authenticateESPN(authData);
      
      case 'sleeper':
        return this.authenticateSleeper(authData);
      
      default:
        return {
          success: false,
          error: {
            code: 'AUTH_PLATFORM_NOT_SUPPORTED',
            message: `Authentication not implemented for platform: ${platform}`
          }
        };
    }
  }

  /**
   * ESPN authentication (uses cookies)
   */
  private async authenticateESPN(authData: {
    espn_s2: string;
    swid: string;
  }): Promise<ApiResponse<AuthCredentials>> {
    try {
      const credentials: AuthCredentials = {
        platform: 'espn',
        apiKey: authData.espn_s2,
        userId: authData.swid,
        // ESPN cookies don't expire for a long time
        expiresAt: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000))
      };

      this.storeCredentials(credentials);

      return {
        success: true,
        data: credentials
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'AUTH_ESPN_FAILED',
          message: 'Failed to authenticate with ESPN',
          details: error
        }
      };
    }
  }

  /**
   * Sleeper authentication (uses username lookup)
   */
  private async authenticateSleeper(authData: {
    username: string;
  }): Promise<ApiResponse<AuthCredentials>> {
    try {
      // Get user ID from username
      const response = await fetch(`https://api.sleeper.app/v1/user/${authData.username}`);
      
      if (!response.ok) {
        throw new Error('User not found');
      }

      const userData = await response.json();
      
      const credentials: AuthCredentials = {
        platform: 'sleeper',
        userId: userData.user_id,
        // Sleeper doesn't use tokens
        expiresAt: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000))
      };

      this.storeCredentials(credentials);

      return {
        success: true,
        data: credentials
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'AUTH_SLEEPER_FAILED',
          message: 'Failed to authenticate with Sleeper',
          details: error
        }
      };
    }
  }
}
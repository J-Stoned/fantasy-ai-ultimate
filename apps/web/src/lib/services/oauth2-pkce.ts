import crypto from 'crypto';
import { supabase } from './database';

interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}

interface OAuthProvider {
  name: string;
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  redirectUri: string;
  scope: string;
}

// OAuth provider configurations
const providers: Record<string, OAuthProvider> = {
  yahoo: {
    name: 'Yahoo',
    authUrl: 'https://api.login.yahoo.com/oauth2/request_auth',
    tokenUrl: 'https://api.login.yahoo.com/oauth2/get_token',
    clientId: process.env.YAHOO_CLIENT_ID!,
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/yahoo`,
    scope: 'fspt-r',
  },
  espn: {
    name: 'ESPN',
    authUrl: 'https://espn.com/oauth2/authorize',
    tokenUrl: 'https://espn.com/oauth2/token',
    clientId: process.env.ESPN_CLIENT_ID!,
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/espn`,
    scope: 'fantasy.read',
  },
  sleeper: {
    name: 'Sleeper',
    authUrl: 'https://sleeper.app/oauth/authorize',
    tokenUrl: 'https://sleeper.app/oauth/token',
    clientId: process.env.SLEEPER_CLIENT_ID!,
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/sleeper`,
    scope: 'read',
  },
};

export class OAuth2PKCEService {
  /**
   * Generate PKCE challenge components
   */
  static generatePKCEChallenge(): PKCEChallenge {
    // Generate code verifier (43-128 characters)
    const codeVerifier = crypto
      .randomBytes(32)
      .toString('base64url')
      .replace(/[^a-zA-Z0-9-._~]/g, '');

    // Generate code challenge using SHA256
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url')
      .replace(/[^a-zA-Z0-9-._~]/g, '');

    // Generate state for CSRF protection
    const state = crypto.randomBytes(16).toString('base64url');

    return {
      codeVerifier,
      codeChallenge,
      state,
    };
  }

  /**
   * Store PKCE challenge in database
   */
  static async storePKCEChallenge(
    userId: string,
    provider: string,
    challenge: PKCEChallenge
  ): Promise<void> {
    const { error } = await supabase.from('oauth_sessions').insert({
      user_id: userId,
      provider,
      state: challenge.state,
      code_verifier: challenge.codeVerifier,
      code_challenge: challenge.codeChallenge,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    });

    if (error) {
      throw new Error(`Failed to store PKCE challenge: ${error.message}`);
    }
  }

  /**
   * Retrieve PKCE challenge from database
   */
  static async retrievePKCEChallenge(
    state: string
  ): Promise<{ userId: string; codeVerifier: string; provider: string } | null> {
    const { data, error } = await supabase
      .from('oauth_sessions')
      .select('user_id, code_verifier, provider')
      .eq('state', state)
      .single();

    if (error || !data) {
      return null;
    }

    // Clean up the session
    await supabase.from('oauth_sessions').delete().eq('state', state);

    return {
      userId: data.user_id,
      codeVerifier: data.code_verifier,
      provider: data.provider,
    };
  }

  /**
   * Generate authorization URL
   */
  static async generateAuthUrl(userId: string, providerName: string): Promise<string> {
    const provider = providers[providerName];
    if (!provider) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    const challenge = this.generatePKCEChallenge();
    await this.storePKCEChallenge(userId, providerName, challenge);

    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      response_type: 'code',
      scope: provider.scope,
      state: challenge.state,
      code_challenge: challenge.codeChallenge,
      code_challenge_method: 'S256',
    });

    return `${provider.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  static async exchangeCodeForTokens(
    code: string,
    state: string
  ): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
    const session = await this.retrievePKCEChallenge(state);
    if (!session) {
      throw new Error('Invalid or expired state');
    }

    const provider = providers[session.provider];
    if (!provider) {
      throw new Error(`Unknown provider: ${session.provider}`);
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: provider.redirectUri,
      client_id: provider.clientId,
      code_verifier: session.codeVerifier,
    });

    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();

    // Store tokens in database
    await this.storeTokens(session.userId, session.provider, data);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * Store OAuth tokens
   */
  static async storeTokens(
    userId: string,
    provider: string,
    tokenData: any
  ): Promise<void> {
    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString(); // Default 1 hour

    const { error } = await supabase.from('platform_connections').upsert({
      user_id: userId,
      platform: provider,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      token_expires_at: expiresAt, // Fixed: use token_expires_at instead of expires_at
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`Failed to store tokens for ${provider}:`, error);
      throw new Error(`Failed to store tokens: ${error.message}`);
    }

    console.log(`Successfully stored tokens for ${provider} user ${userId}`);
  }

  /**
   * Refresh access token
   */
  static async refreshAccessToken(
    userId: string,
    providerName: string
  ): Promise<string> {
    const provider = providers[providerName];
    if (!provider) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    // Get refresh token from database
    const { data: tokenData, error } = await supabase
      .from('platform_connections')
      .select('refresh_token, access_token')
      .eq('user_id', userId)
      .eq('platform', providerName)
      .single();

    if (error) {
      console.error(`Database error fetching refresh token for ${providerName}:`, error);
      throw new Error(`Database error: ${error.message}`);
    }

    if (!tokenData?.refresh_token) {
      console.error(`No refresh token available for ${providerName} user ${userId}`);
      throw new Error('No refresh token available - user needs to re-authenticate');
    }

    console.log(`Refreshing ${providerName} token for user ${userId}`);

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenData.refresh_token,
      client_id: provider.clientId,
    });

    // Add client secret for Yahoo (required)
    if (providerName === 'yahoo') {
      params.append('client_secret', process.env.YAHOO_CLIENT_SECRET || '');
    }

    try {
      const response = await fetch(provider.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          ...(providerName === 'yahoo' ? {
            'Authorization': `Basic ${Buffer.from(`${provider.clientId}:${process.env.YAHOO_CLIENT_SECRET}`).toString('base64')}`
          } : {})
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Token refresh failed for ${providerName}:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        
        // If refresh token is invalid, user needs to re-authenticate
        if (response.status === 400 || response.status === 401) {
          // Mark connection as inactive
          await supabase
            .from('platform_connections')
            .update({ 
              is_active: false,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('platform', providerName);
            
          throw new Error('Refresh token expired - user needs to re-authenticate');
        }
        
        throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Successfully refreshed ${providerName} token for user ${userId}`);

      // Update tokens in database
      await this.storeTokens(userId, providerName, data);

      return data.access_token;
    } catch (fetchError: any) {
      console.error(`Network error during token refresh for ${providerName}:`, fetchError);
      throw new Error(`Token refresh failed: ${fetchError.message}`);
    }
  }

  /**
   * Get valid access token (refresh if needed)
   */
  static async getValidAccessToken(
    userId: string,
    provider: string
  ): Promise<string> {
    const { data: tokenData, error } = await supabase
      .from('platform_connections')
      .select('access_token, token_expires_at, refresh_token, is_active') // Fixed: use token_expires_at
      .eq('user_id', userId)
      .eq('platform', provider)
      .single();

    if (error || !tokenData) {
      console.error(`No tokens found for ${provider} user ${userId}:`, error);
      throw new Error('No tokens found - user needs to authenticate');
    }

    if (!tokenData.is_active) {
      console.error(`Connection inactive for ${provider} user ${userId}`);
      throw new Error('Connection is inactive - user needs to re-authenticate');
    }

    // Check if token is expired
    const expiresAt = new Date(tokenData.token_expires_at); // Fixed: use token_expires_at
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

    if (expiresAt.getTime() - now.getTime() < bufferTime) {
      console.log(`Token expired for ${provider} user ${userId}, attempting refresh...`);
      // Token is expired or about to expire, refresh it
      try {
        return await this.refreshAccessToken(userId, provider);
      } catch (refreshError) {
        console.error(`Token refresh failed for ${provider} user ${userId}:`, refreshError);
        throw refreshError;
      }
    }

    console.log(`Using valid token for ${provider} user ${userId}`);
    return tokenData.access_token;
  }

  /**
   * Revoke tokens
   */
  static async revokeTokens(userId: string, provider: string): Promise<void> {
    // Mark connection as inactive instead of deleting
    const { error } = await supabase
      .from('platform_connections')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('platform', provider);

    if (error) {
      console.error(`Failed to revoke tokens for ${provider}:`, error);
      throw new Error(`Failed to revoke tokens: ${error.message}`);
    }

    console.log(`Successfully revoked tokens for ${provider} user ${userId}`);

    // Note: Some providers have specific revocation endpoints
    // This would need to be implemented per-provider
  }
}
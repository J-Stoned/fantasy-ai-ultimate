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
    const { error } = await supabase.from('oauth_tokens').upsert({
      user_id: userId,
      provider,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Failed to store tokens: ${error.message}`);
    }
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
      .from('oauth_tokens')
      .select('refresh_token')
      .eq('user_id', userId)
      .eq('provider', providerName)
      .single();

    if (error || !tokenData?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenData.refresh_token,
      client_id: provider.clientId,
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
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json();

    // Update tokens in database
    await this.storeTokens(userId, providerName, data);

    return data.access_token;
  }

  /**
   * Get valid access token (refresh if needed)
   */
  static async getValidAccessToken(
    userId: string,
    provider: string
  ): Promise<string> {
    const { data: tokenData, error } = await supabase
      .from('oauth_tokens')
      .select('access_token, expires_at')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();

    if (error || !tokenData) {
      throw new Error('No tokens found');
    }

    // Check if token is expired
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

    if (expiresAt.getTime() - now.getTime() < bufferTime) {
      // Token is expired or about to expire, refresh it
      return await this.refreshAccessToken(userId, provider);
    }

    return tokenData.access_token;
  }

  /**
   * Revoke tokens
   */
  static async revokeTokens(userId: string, provider: string): Promise<void> {
    // Delete tokens from database
    const { error } = await supabase
      .from('oauth_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider);

    if (error) {
      throw new Error(`Failed to revoke tokens: ${error.message}`);
    }

    // Note: Some providers have specific revocation endpoints
    // This would need to be implemented per-provider
  }
}
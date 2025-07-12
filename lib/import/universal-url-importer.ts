interface LeagueUrlInfo {
  platform: 'yahoo' | 'espn' | 'sleeper' | 'cbs' | 'draftkings' | 'fanduel';
  leagueId: string;
  sport?: string;
  season?: string;
  additionalParams?: Record<string, string>;
}

export class UniversalUrlImporter {
  // URL patterns for each platform
  private static patterns = {
    yahoo: [
      /football\.fantasysports\.yahoo\.com\/f1\/(\d+)/,
      /baseball\.fantasysports\.yahoo\.com\/b1\/(\d+)/,
      /basketball\.fantasysports\.yahoo\.com\/nba\/(\d+)/,
      /hockey\.fantasysports\.yahoo\.com\/hockey\/(\d+)/,
    ],
    espn: [
      /fantasy\.espn\.com\/football\/league\?leagueId=(\d+)/,
      /fantasy\.espn\.com\/baseball\/league\?leagueId=(\d+)/,
      /fantasy\.espn\.com\/basketball\/league\?leagueId=(\d+)/,
      /fantasy\.espn\.com\/hockey\/league\?leagueId=(\d+)/,
    ],
    sleeper: [
      /sleeper\.com\/leagues\/(\d+)\//, // New URL format
      /sleeper\.app\/leagues\/(\d+)\//, // Old URL format
    ],
    cbs: [
      /cbssports\.com\/fantasy\/football\/leagues\/(\w+)/,
      /cbssports\.com\/fantasy\/baseball\/leagues\/(\w+)/,
      /cbssports\.com\/fantasy\/basketball\/leagues\/(\w+)/,
    ],
    draftkings: [
      /draftkings\.com\/fantasy\/league\/(\d+)/,
      /draftkings\.com\/contest\/(\d+)/,
    ],
    fanduel: [
      /fanduel\.com\/contests\/(\d+)/,
      /fanduel\.com\/leagues\/(\d+)/,
    ],
  };

  /**
   * Parse any fantasy league URL and extract platform + league info
   */
  static parseUrl(url: string): LeagueUrlInfo | null {
    try {
      const urlObj = new URL(url);
      
      // Check each platform's patterns
      for (const [platform, patterns] of Object.entries(this.patterns)) {
        for (const pattern of patterns) {
          const match = url.match(pattern);
          if (match) {
            const leagueId = match[1];
            
            // Extract sport from URL
            let sport = 'football'; // default
            if (url.includes('baseball') || url.includes('/b1/')) sport = 'baseball';
            if (url.includes('basketball') || url.includes('/nba/')) sport = 'basketball';
            if (url.includes('hockey')) sport = 'hockey';
            
            // Extract season from query params
            const season = urlObj.searchParams.get('season') || 
                          urlObj.searchParams.get('year') || 
                          new Date().getFullYear().toString();
            
            return {
              platform: platform as LeagueUrlInfo['platform'],
              leagueId,
              sport,
              season,
              additionalParams: Object.fromEntries(urlObj.searchParams),
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to parse URL:', error);
      return null;
    }
  }

  /**
   * Import league from URL with platform-specific handling
   */
  static async importFromUrl(url: string, userId: string): Promise<{
    success: boolean;
    platform?: string;
    leagueId?: string;
    message: string;
    requiresAuth?: boolean;
    authUrl?: string;
  }> {
    const leagueInfo = this.parseUrl(url);
    
    if (!leagueInfo) {
      return {
        success: false,
        message: 'Unrecognized league URL. Please check the URL and try again.',
      };
    }

    const { platform, leagueId, sport, season } = leagueInfo;

    // Check if user has auth for this platform
    const hasAuth = await this.checkPlatformAuth(userId, platform);

    if (!hasAuth) {
      // Return auth URL for platforms that need it
      const authUrl = await this.getAuthUrl(platform, url);
      return {
        success: false,
        platform,
        leagueId,
        message: `Authentication required for ${platform}`,
        requiresAuth: true,
        authUrl,
      };
    }

    // Attempt to import the league
    try {
      const result = await this.performImport(userId, platform, leagueId, sport, season);
      return {
        success: true,
        platform,
        leagueId,
        message: `Successfully imported league from ${platform}!`,
      };
    } catch (error: any) {
      return {
        success: false,
        platform,
        leagueId,
        message: error.message || `Failed to import from ${platform}`,
      };
    }
  }

  private static async checkPlatformAuth(userId: string, platform: string): Promise<boolean> {
    // Check if user has valid auth tokens for the platform
    const response = await fetch('/api/auth/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, platform }),
    });
    
    const result = await response.json();
    return result.hasAuth;
  }

  private static async getAuthUrl(platform: string, returnUrl: string): Promise<string> {
    // Generate platform-specific auth URL
    const baseAuthUrls: Record<string, string> = {
      yahoo: '/api/auth/yahoo',
      espn: '/api/auth/espn', // Will need custom solution
      sleeper: '', // No auth needed, just username
      cbs: '/api/auth/cbs',
      draftkings: '/api/auth/draftkings',
      fanduel: '/api/auth/fanduel',
    };

    const authUrl = baseAuthUrls[platform];
    if (!authUrl) return '';

    return `${authUrl}?returnUrl=${encodeURIComponent(returnUrl)}&autoImport=true`;
  }

  private static async performImport(
    userId: string, 
    platform: string, 
    leagueId: string,
    sport?: string,
    season?: string
  ): Promise<boolean> {
    const response = await fetch(`/api/import/${platform}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        leagueId,
        sport,
        season,
        autoImport: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Import failed');
    }

    return true;
  }

  /**
   * Batch import multiple URLs at once
   */
  static async batchImport(urls: string[], userId: string): Promise<{
    successful: string[];
    failed: Array<{ url: string; reason: string }>;
    requiresAuth: Array<{ platform: string; authUrl: string }>;
  }> {
    const successful: string[] = [];
    const failed: Array<{ url: string; reason: string }> = [];
    const requiresAuth: Array<{ platform: string; authUrl: string }> = [];

    for (const url of urls) {
      const result = await this.importFromUrl(url, userId);
      
      if (result.success) {
        successful.push(url);
      } else if (result.requiresAuth && result.authUrl) {
        requiresAuth.push({
          platform: result.platform!,
          authUrl: result.authUrl,
        });
      } else {
        failed.push({
          url,
          reason: result.message,
        });
      }
    }

    return { successful, failed, requiresAuth };
  }
}
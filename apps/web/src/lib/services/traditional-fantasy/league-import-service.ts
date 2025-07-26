/**
 * Universal Fantasy League Import Service
 * Main orchestrator for importing leagues from Yahoo, ESPN, CBS Sports, and Sleeper
 */

import {
  FantasyPlatform,
  League,
  ImportConfig,
  ImportOptions,
  ApiResponse,
  AuthCredentials,
  SyncConfig,
  SyncStatus,
  SyncType,
  ExportConfig,
  ApiError
} from './types';
import { AuthManager } from './auth-manager';
import { YahooApiClient } from './yahoo-api-client';
import { ESPNApiClient } from './espn-api-client';
import { CBSApiClient } from './cbs-api-client';
import { SleeperApiClient } from './sleeper-api-client';
import { DataNormalizer } from './data-normalizer';
import { SyncScheduler } from './sync-scheduler';
import { logger } from '../../logging/logger';
import { playerDataService } from '../../database/player-data-service';
import { gameStatsService } from '../../database/game-stats-service';

export class LeagueImportService {
  private authManager: AuthManager;
  private platformClients: Map<FantasyPlatform, any>;
  private dataNormalizer: DataNormalizer;
  private syncScheduler: SyncScheduler;
  private importProgress: Map<string, ImportProgress> = new Map();

  constructor() {
    this.authManager = new AuthManager();
    this.dataNormalizer = new DataNormalizer();
    this.syncScheduler = new SyncScheduler();
    
    // Initialize platform clients
    this.platformClients = new Map([
      ['yahoo', new YahooApiClient(this.authManager)],
      ['espn', new ESPNApiClient(this.authManager)],
      ['cbs', new CBSApiClient(this.authManager)],
      ['sleeper', new SleeperApiClient(this.authManager)]
    ]);

    // Set up sync scheduler callbacks
    this.syncScheduler.on('sync:complete', this.handleSyncComplete.bind(this));
    this.syncScheduler.on('sync:error', this.handleSyncError.bind(this));
  }

  /**
   * One-click import from any platform
   */
  public async importLeague(config: ImportConfig): Promise<ApiResponse<ImportResult>> {
    const importId = this.generateImportId();
    
    try {
      // Initialize import progress
      this.initializeImportProgress(importId, config);

      // Validate credentials
      const authResult = await this.validateAuthentication(config.credentials);
      if (!authResult.success) {
        return authResult;
      }

      // Get platform client
      const client = this.platformClients.get(config.platform);
      if (!client) {
        return {
          success: false,
          error: {
            code: 'PLATFORM_NOT_SUPPORTED',
            message: `Platform ${config.platform} is not supported`
          }
        };
      }

      // Import leagues
      const leagues = await this.importLeagues(client, config, importId);
      
      // Set up automatic sync if requested
      if (config.importOptions.enableAutoSync) {
        await this.setupAutoSync(leagues, config);
      }

      // Generate import result
      const result: ImportResult = {
        importId,
        platform: config.platform,
        leaguesImported: leagues.length,
        leagues: leagues.map(l => ({
          id: l.id,
          name: l.name,
          platform: l.platform,
          season: l.season
        })),
        importDate: new Date(),
        duration: Date.now() - this.importProgress.get(importId)!.startTime.getTime()
      };

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'IMPORT_FAILED',
          message: 'Failed to import league',
          details: error
        }
      };
    } finally {
      // Clean up import progress
      this.importProgress.delete(importId);
    }
  }

  /**
   * Import multiple leagues with progress tracking
   */
  private async importLeagues(
    client: any,
    config: ImportConfig,
    importId: string
  ): Promise<League[]> {
    const importedLeagues: League[] = [];
    const progress = this.importProgress.get(importId)!;

    try {
      // Get user's leagues
      progress.status = 'fetching_leagues';
      const leagues = await client.getLeagues(config.credentials.userId);
      
      // Filter leagues if specific IDs provided
      const leaguesToImport = config.leagueIds 
        ? leagues.filter((l: League) => config.leagueIds!.includes(l.platformLeagueId))
        : leagues;

      progress.totalLeagues = leaguesToImport.length;

      // Import each league
      for (const league of leaguesToImport) {
        progress.currentLeague = league.name;
        
        try {
          const importedLeague = await this.importSingleLeague(
            client,
            league,
            config.importOptions,
            progress
          );
          
          importedLeagues.push(importedLeague);
          progress.leaguesProcessed++;
          
          // Update progress
          this.updateImportProgress(importId, progress);
        } catch (error) {
          logger.error('Failed to import league ${league.name}:', { error: error });
          progress.errors.push({
            leagueId: league.platformLeagueId,
            leagueName: league.name,
            error: error as Error
          });
        }
      }

      return importedLeagues;
    } catch (error) {
      throw new Error(`Failed to fetch leagues: ${error}`);
    }
  }

  /**
   * Import a single league with all its data
   */
  private async importSingleLeague(
    client: any,
    league: League,
    options: ImportOptions,
    progress: ImportProgress
  ): Promise<League> {
    const normalizedLeague = await this.dataNormalizer.normalizeLeague(league, league.platform);

    // Import teams and rosters
    progress.status = 'importing_teams';
    const teams = await client.getTeams(league.platformLeagueId);
    normalizedLeague.teams = await Promise.all(
      teams.map((team: any) => this.dataNormalizer.normalizeTeam(team, league.platform))
    );

    // Import rosters
    progress.status = 'importing_rosters';
    const rosters = await client.getRosters(league.platformLeagueId);
    for (let i = 0; i < normalizedLeague.teams.length; i++) {
      const roster = rosters.find((r: any) => r.teamId === teams[i].platformTeamId);
      if (roster) {
        normalizedLeague.teams[i].roster = await this.dataNormalizer.normalizeRoster(
          roster,
          league.platform
        );
        
        // ELITE ENHANCEMENT: Enrich roster with real performance data from 1.57M game stats! 🔥
        await this.enrichRosterWithRealData(normalizedLeague.teams[i].roster, league.sport);
      }
    }

    // Import draft data if requested
    if (options.includeDraftData) {
      progress.status = 'importing_draft';
      try {
        const draftData = await client.getDraftData(league.platformLeagueId);
        normalizedLeague.draftInfo = await this.dataNormalizer.normalizeDraftInfo(
          draftData,
          league.platform
        );
      } catch (error) {
        logger.warn('Draft data not available:'error);
      }
    }

    // Import transactions if requested
    if (options.includeTransactions) {
      progress.status = 'importing_transactions';
      try {
        const transactions = await client.getTransactions(league.platformLeagueId);
        // Store transactions separately as they can be numerous
        await this.storeTransactions(normalizedLeague.id, transactions);
      } catch (error) {
        logger.warn('Transactions not available:'error);
      }
    }

    // Import historical data if requested
    if (options.includeHistory && options.historicalSeasons) {
      progress.status = 'importing_history';
      await this.importHistoricalData(
        client,
        league.platformLeagueId,
        options.historicalSeasons,
        normalizedLeague.id
      );
    }

    // Store the normalized league
    await this.storeLeague(normalizedLeague);

    return normalizedLeague;
  }

  /**
   * Import historical season data
   */
  private async importHistoricalData(
    client: any,
    leagueId: string,
    seasons: number[],
    normalizedLeagueId: string
  ): Promise<void> {
    for (const season of seasons) {
      try {
        // Import historical league data
        const historicalLeague = await client.getLeague(leagueId, { season });
        const normalizedHistorical = await this.dataNormalizer.normalizeLeague(
          historicalLeague,
          client.platform
        );
        
        // Store as historical data linked to main league
        await this.storeHistoricalLeague(normalizedLeagueId, season, normalizedHistorical);
      } catch (error) {
        logger.warn('Failed to import season ${season}:'error);
      }
    }
  }

  /**
   * Set up automatic sync for imported leagues
   */
  private async setupAutoSync(leagues: League[], config: ImportConfig): Promise<void> {
    for (const league of leagues) {
      const syncConfig: SyncConfig = {
        platform: config.platform,
        leagueId: league.id,
        syncInterval: this.getSyncInterval(league),
        syncTypes: ['roster', 'standings', 'matchups', 'transactions'],
        priority: 'medium',
        retryConfig: {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 60000,
          backoffMultiplier: 2
        }
      };

      await this.syncScheduler.scheduleSync(syncConfig);
    }
  }

  /**
   * Export league data to different formats
   */
  public async exportLeague(config: ExportConfig): Promise<ApiResponse<ExportResult>> {
    try {
      // Load league data
      const league = await this.loadLeague(config.leagueId);
      if (!league) {
        return {
          success: false,
          error: {
            code: 'LEAGUE_NOT_FOUND',
            message: 'League not found'
          }
        };
      }

      // Prepare export data
      const exportData = await this.prepareExportData(league, config);

      // Generate export based on format
      let exportResult: ExportResult;
      switch (config.exportFormat) {
        case 'json':
          exportResult = await this.exportToJSON(exportData);
          break;
        case 'csv':
          exportResult = await this.exportToCSV(exportData);
          break;
        case 'xlsx':
          exportResult = await this.exportToExcel(exportData);
          break;
        default:
          throw new Error(`Unsupported export format: ${config.exportFormat}`);
      }

      return {
        success: true,
        data: exportResult
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXPORT_FAILED',
          message: 'Failed to export league',
          details: error
        }
      };
    }
  }

  /**
   * Get import progress
   */
  public getImportProgress(importId: string): ImportProgress | null {
    return this.importProgress.get(importId) || null;
  }

  /**
   * Get sync status for a league
   */
  public async getSyncStatus(leagueId: string): Promise<SyncStatus | null> {
    return this.syncScheduler.getSyncStatus(leagueId);
  }

  /**
   * Manually trigger sync for a league
   */
  public async triggerSync(
    leagueId: string,
    syncTypes?: SyncType[]
  ): Promise<ApiResponse<void>> {
    try {
      await this.syncScheduler.triggerSync(leagueId, syncTypes);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SYNC_FAILED',
          message: 'Failed to trigger sync',
          details: error
        }
      };
    }
  }

  /**
   * Validate authentication credentials
   */
  private async validateAuthentication(
    credentials: AuthCredentials
  ): Promise<ApiResponse<void>> {
    if (!this.authManager.validateCredentials(credentials)) {
      return {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid or missing credentials'
        }
      };
    }

    // Test connection
    const client = this.platformClients.get(credentials.platform);
    if (!client) {
      return {
        success: false,
        error: {
          code: 'PLATFORM_NOT_SUPPORTED',
          message: `Platform ${credentials.platform} is not supported`
        }
      };
    }

    const isConnected = await client.testConnection();
    if (!isConnected) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_FAILED',
          message: 'Failed to connect to platform API'
        }
      };
    }

    return { success: true };
  }

  /**
   * Initialize import progress tracking
   */
  private initializeImportProgress(importId: string, config: ImportConfig): void {
    this.importProgress.set(importId, {
      importId,
      platform: config.platform,
      status: 'initializing',
      startTime: new Date(),
      totalLeagues: 0,
      leaguesProcessed: 0,
      currentLeague: '',
      errors: []
    });
  }

  /**
   * Update import progress
   */
  private updateImportProgress(importId: string, progress: ImportProgress): void {
    this.importProgress.set(importId, {
      ...progress,
      lastUpdate: new Date()
    });

    // Emit progress event
    this.emitProgressEvent(progress);
  }

  /**
   * Generate unique import ID
   */
  private generateImportId(): string {
    return `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get appropriate sync interval based on league activity
   */
  private getSyncInterval(league: League): number {
    // Active season gets more frequent updates
    if (league.isActive) {
      // During games: 1 minute
      if (this.isGameDay(league)) {
        return 60 * 1000;
      }
      // Regular season: 5 minutes
      return 5 * 60 * 1000;
    }
    // Off-season: 1 hour
    return 60 * 60 * 1000;
  }

  /**
   * Check if it's a game day for the league
   */
  private isGameDay(league: League): boolean {
    // Implementation depends on sport and schedule
    // This is a simplified example
    const today = new Date().getDay();
    
    switch (league.sport) {
      case 'nfl':
        return today === 0 || today === 1 || today === 4; // Sun, Mon, Thu
      case 'nba':
      case 'nhl':
        return true; // Games most days
      case 'mlb':
        return true; // Games daily during season
      default:
        return false;
    }
  }

  /**
   * Handle sync completion
   */
  private handleSyncComplete(event: SyncCompleteEvent): void {
    logger.info('Sync completed for league ${event.leagueId}');
    // Update league data with synced information
    this.updateLeagueData(event.leagueId, event.syncedData);
  }

  /**
   * Handle sync errors
   */
  private handleSyncError(event: SyncErrorEvent): void {
    logger.error('Sync error for league ${event.leagueId}:', { error: event.error });
    // Implement error recovery logic
  }

  /**
   * Emit progress events for real-time updates
   */
  private emitProgressEvent(progress: ImportProgress): void {
    // Emit to WebSocket or event system
    // This would integrate with your real-time update system
  }

  // Storage methods (would integrate with your database)
  private async storeLeague(league: League): Promise<void> {
    // Store in database
    logger.info('Storing league:', { data: league.id });
  }

  private async storeTransactions(leagueId: string, transactions: any[]): Promise<void> {
    // Store transactions
    logger.info('Storing ${transactions.length} transactions for league ${leagueId}');
  }

  private async storeHistoricalLeague(
    leagueId: string,
    season: number,
    data: any
  ): Promise<void> {
    // Store historical data
    logger.info('Storing historical data for league ${leagueId}, season ${season}');
  }

  private async loadLeague(leagueId: string): Promise<League | null> {
    // Load from database
    logger.info('Loading league:', { data: leagueId });
    return null;
  }

  private async updateLeagueData(leagueId: string, data: any): Promise<void> {
    // Update league data
    logger.info('Updating league data:', { data: leagueId });
  }

  private async prepareExportData(league: League, config: ExportConfig): Promise<any> {
    // Prepare data for export
    return league;
  }

  private async exportToJSON(data: any): Promise<ExportResult> {
    // Export to JSON
    return {
      format: 'json',
      data: JSON.stringify(data, null, 2),
      filename: `league_export_${Date.now()}.json`,
      size: 0
    };
  }

  private async exportToCSV(data: any): Promise<ExportResult> {
    // Export to CSV
    return {
      format: 'csv',
      data: '',
      filename: `league_export_${Date.now()}.csv`,
      size: 0
    };
  }

  private async exportToExcel(data: any): Promise<ExportResult> {
    // Export to Excel
    return {
      format: 'xlsx',
      data: null,
      filename: `league_export_${Date.now()}.xlsx`,
      size: 0
    };
  }

  /**
   * ELITE: Enrich roster with real performance data from 1.57M game stats! 🔥
   */
  private async enrichRosterWithRealData(roster: Roster, sport: SportType): Promise<void> {
    logger.info('🔥 Enriching imported roster with REAL performance data from 1.57M game stats', {
      playerCount: roster.players.length,
      sport,
      dataSource: '1.57M game stats dataset'
    });

    try {
      // Match each imported player to our real database
      const enrichedPlayers = await Promise.all(
        roster.players.map(async (importedPlayer) => {
          try {
            // Find matching player in our Elite database
            const realPlayer = await this.findMatchingPlayer(importedPlayer, sport);
            
            if (realPlayer) {
              // Enrich imported player with real performance data
              importedPlayer.realPlayerId = realPlayer.id;
              importedPlayer.realPerformanceData = {
                seasonStats: realPlayer.season_stats,
                recentGames: realPlayer.recent_games,
                overallRating: realPlayer.overall_rating,
                injuryHistory: realPlayer.injury_history,
                consistencyScore: realPlayer.season_stats?.consistency_score || 50,
                avgFantasyPoints: realPlayer.season_stats?.avg_fantasy_points || 0,
                gamesPlayed: realPlayer.season_stats?.games_played || 0,
                lastUpdated: new Date()
              };

              // Update injury status with real data if available
              if (realPlayer.injury_status) {
                importedPlayer.injuryStatus = {
                  status: this.mapInjuryStatus(realPlayer.injury_status),
                  description: realPlayer.injury_notes || importedPlayer.injuryStatus?.description
                };
              }

              logger.info(`✅ Matched ${importedPlayer.name} to real player ID ${realPlayer.id}`, {
                avgPoints: realPlayer.season_stats?.avg_fantasy_points,
                gamesPlayed: realPlayer.season_stats?.games_played,
                overallRating: realPlayer.overall_rating
              });
            } else {
              logger.warn(`❌ No match found for ${importedPlayer.name} (${importedPlayer.team})`);
            }
          } catch (error) {
            logger.error(`Failed to enrich player ${importedPlayer.name}:`, error);
          }

          return importedPlayer;
        })
      );

      // Calculate team analytics based on real data
      const teamStats = this.calculateTeamStatsFromRealData(enrichedPlayers);
      roster.teamAnalytics = teamStats;

      logger.info('🚀 Roster enrichment complete', {
        totalPlayers: roster.players.length,
        matchedPlayers: enrichedPlayers.filter(p => p.realPlayerId).length,
        avgTeamRating: teamStats.avgOverallRating,
        projectedTeamPoints: teamStats.projectedWeeklyPoints
      });

    } catch (error) {
      logger.error('Error enriching roster with real data:', error);
    }
  }

  /**
   * Find matching player in our Elite database using fuzzy matching
   */
  private async findMatchingPlayer(importedPlayer: RosterPlayer, sport: SportType): Promise<any> {
    // Clean player name for better matching
    const cleanName = importedPlayer.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+jr$/i, '') // Remove Jr suffix
      .replace(/\s+sr$/i, '') // Remove Sr suffix
      .replace(/\s+ii+$/i, ''); // Remove II, III suffixes

    // Try exact match first
    let matches = await playerDataService.searchPlayers({
      name: cleanName,
      sport: sport.toUpperCase(),
      team: importedPlayer.team,
      position: importedPlayer.position,
      limit: 5
    });

    if (!matches || matches.length === 0) {
      // Try without team (player might have been traded)
      matches = await playerDataService.searchPlayers({
        name: cleanName,
        sport: sport.toUpperCase(),
        position: importedPlayer.position,
        limit: 10
      });
    }

    if (!matches || matches.length === 0) {
      // Try last name only match
      const nameParts = importedPlayer.name.split(' ');
      if (nameParts.length > 1) {
        const lastName = nameParts[nameParts.length - 1];
        matches = await playerDataService.searchPlayers({
          name: lastName.toLowerCase(),
          sport: sport.toUpperCase(),
          position: importedPlayer.position,
          limit: 15
        });
      }
    }

    // Score matches and pick best one
    if (matches && matches.length > 0) {
      const scoredMatches = matches.map(match => {
        let score = 0;
        
        // Name similarity
        const matchName = match.name.toLowerCase().replace(/[^a-z0-9\s]/g, '');
        if (matchName === cleanName) {
          score += 100;
        } else if (matchName.includes(cleanName) || cleanName.includes(matchName)) {
          score += 50;
        } else {
          // Calculate Levenshtein distance for fuzzy matching
          score += Math.max(0, 30 - this.levenshteinDistance(cleanName, matchName));
        }

        // Team match
        if (match.team === importedPlayer.team || match.team_abbreviation === importedPlayer.team) {
          score += 30;
        }

        // Position match
        if (match.position === importedPlayer.position) {
          score += 20;
        }

        // Active player bonus
        if (match.is_active) {
          score += 10;
        }

        return { match, score };
      });

      // Sort by score and return best match if score is high enough
      scoredMatches.sort((a, b) => b.score - a.score);
      
      if (scoredMatches[0].score >= 50) {
        const bestMatch = scoredMatches[0].match;
        
        // Get full player data with stats
        const { data: fullPlayer } = await playerDataService.getPlayerById(bestMatch.id, {
          include_stats: true,
          include_recent_games: true
        });

        return fullPlayer;
      }
    }

    return null;
  }

  /**
   * Calculate Levenshtein distance for fuzzy string matching
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate team statistics from real player data
   */
  private calculateTeamStatsFromRealData(players: RosterPlayer[]): any {
    const playersWithRealData = players.filter(p => p.realPerformanceData);
    
    if (playersWithRealData.length === 0) {
      return {
        avgOverallRating: 0,
        projectedWeeklyPoints: 0,
        avgConsistency: 0,
        injuryRisk: 0,
        strengthOfRoster: 0
      };
    }

    // Calculate averages and projections
    const totalRating = playersWithRealData.reduce((sum, p) => sum + (p.realPerformanceData!.overallRating || 65), 0);
    const totalPoints = playersWithRealData.reduce((sum, p) => sum + (p.realPerformanceData!.avgFantasyPoints || 0), 0);
    const totalConsistency = playersWithRealData.reduce((sum, p) => sum + (p.realPerformanceData!.consistencyScore || 50), 0);
    
    // Calculate injury risk based on games missed
    const totalGamesPlayed = playersWithRealData.reduce((sum, p) => sum + (p.realPerformanceData!.gamesPlayed || 0), 0);
    const totalPossibleGames = playersWithRealData.length * 17; // Assuming 17 game season
    const injuryRisk = 100 - (totalGamesPlayed / totalPossibleGames * 100);

    // Calculate strength of roster (0-100 scale)
    const avgRating = totalRating / playersWithRealData.length;
    const strengthOfRoster = Math.min(100, Math.max(0, (avgRating - 50) * 2));

    return {
      avgOverallRating: Math.round(avgRating),
      projectedWeeklyPoints: Math.round(totalPoints * 10) / 10,
      avgConsistency: Math.round(totalConsistency / playersWithRealData.length),
      injuryRisk: Math.round(injuryRisk),
      strengthOfRoster: Math.round(strengthOfRoster),
      matchedPlayerCount: playersWithRealData.length,
      totalPlayerCount: players.length
    };
  }

  /**
   * Map injury status to our standard format
   */
  private mapInjuryStatus(status: string): 'healthy' | 'questionable' | 'doubtful' | 'out' | 'ir' {
    const normalized = status.toLowerCase();
    
    if (normalized.includes('question') || normalized === 'q') {
      return 'questionable';
    } else if (normalized.includes('doubt') || normalized === 'd') {
      return 'doubtful';
    } else if (normalized.includes('out') || normalized === 'o') {
      return 'out';
    } else if (normalized.includes('ir') || normalized.includes('injured')) {
      return 'ir';
    }
    
    return 'healthy';
  }
}

// Additional types for the service
interface ImportProgress {
  importId: string;
  platform: FantasyPlatform;
  status: ImportStatus;
  startTime: Date;
  lastUpdate?: Date;
  totalLeagues: number;
  leaguesProcessed: number;
  currentLeague: string;
  errors: ImportError[];
}

interface ImportError {
  leagueId: string;
  leagueName: string;
  error: Error;
}

interface ImportResult {
  importId: string;
  platform: FantasyPlatform;
  leaguesImported: number;
  leagues: {
    id: string;
    name: string;
    platform: FantasyPlatform;
    season: number;
  }[];
  importDate: Date;
  duration: number;
}

interface ExportResult {
  format: 'json' | 'csv' | 'xlsx';
  data: any;
  filename: string;
  size: number;
}

interface SyncCompleteEvent {
  leagueId: string;
  syncedData: any;
  syncTypes: SyncType[];
  timestamp: Date;
}

interface SyncErrorEvent {
  leagueId: string;
  error: Error;
  syncType?: SyncType;
  timestamp: Date;
}

type ImportStatus =
  | 'initializing'
  | 'fetching_leagues'
  | 'importing_teams'
  | 'importing_rosters'
  | 'importing_draft'
  | 'importing_transactions'
  | 'importing_history'
  | 'complete'
  | 'error';

// Update ImportOptions in types.ts to include enableAutoSync
declare module './types' {
  interface ImportOptions {
    enableAutoSync?: boolean;
  }
}
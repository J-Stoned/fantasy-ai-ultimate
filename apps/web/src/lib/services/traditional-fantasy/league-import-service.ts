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
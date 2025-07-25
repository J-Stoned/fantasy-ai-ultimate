/**
 * Yahoo Fantasy Sports API Client
 * Handles all interactions with Yahoo Fantasy API
 */

import {
  PlatformApiClient,
  League,
  Team,
  Roster,
  DraftInfo,
  Transaction,
  Matchup,
  PlayerStats,
  AuthCredentials,
  TransactionOptions,
  StatsOptions,
  ApiResponse,
  ApiError,
  RateLimitInfo,
  SportType,
  DraftPick,
  RosterPlayer,
  TransactionPlayer,
  TeamStanding
} from './types';
import { AuthManager } from './auth-manager';
import { logger } from '../../logging/logger';

export class YahooApiClient implements PlatformApiClient {
  private readonly baseUrl = 'https://fantasysports.yahooapis.com/fantasy/v2';
  private readonly platform = 'yahoo' as const;
  private authManager: AuthManager;
  private rateLimitInfo: RateLimitInfo | null = null;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
  }

  /**
   * Authenticate with Yahoo OAuth2
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthCredentials> {
    // Yahoo uses OAuth2 flow handled by AuthManager
    return credentials;
  }

  /**
   * Refresh Yahoo access token
   */
  async refreshToken(credentials: AuthCredentials): Promise<AuthCredentials> {
    const result = await this.authManager.refreshAccessToken(credentials);
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to refresh token');
    }
    return result.data!;
  }

  /**
   * Get user's fantasy leagues
   */
  async getLeagues(userId: string): Promise<League[]> {
    const credentials = this.authManager.getCredentials(this.platform, userId);
    if (!credentials) {
      throw new Error('No credentials found for user');
    }

    try {
      // Get current year leagues
      const currentYear = new Date().getFullYear();
      const leagues: League[] = [];

      // Fetch leagues for each sport
      const sports: SportType[] = ['nfl', 'nba', 'mlb', 'nhl'];
      
      for (const sport of sports) {
        try {
          const sportLeagues = await this.getLeaguesForSport(credentials, sport, currentYear);
          leagues.push(...sportLeagues);
        } catch (error) {
          logger.warn('Failed to fetch ${sport} leagues:'error);
        }
      }

      return leagues;
    } catch (error) {
      throw new Error(`Failed to fetch leagues: ${error}`);
    }
  }

  /**
   * Get leagues for a specific sport
   */
  private async getLeaguesForSport(
    credentials: AuthCredentials,
    sport: SportType,
    season: number
  ): Promise<League[]> {
    const gameKey = this.getGameKey(sport, season);
    const url = `${this.baseUrl}/users;use_login=1/games;game_keys=${gameKey}/leagues`;

    const response = await this.makeRequest(url, credentials);
    const data = await response.json();

    return this.parseLeagues(data.fantasy_content.users[0].user[1].games, sport);
  }

  /**
   * Get a specific league
   */
  async getLeague(leagueId: string): Promise<League> {
    const [sport, credentials] = await this.getLeagueContext(leagueId);
    
    const url = `${this.baseUrl}/league/${leagueId}`;
    const response = await this.makeRequest(url, credentials);
    const data = await response.json();

    return this.parseLeague(data.fantasy_content.league[0], sport);
  }

  /**
   * Get teams in a league
   */
  async getTeams(leagueId: string): Promise<Team[]> {
    const [sport, credentials] = await this.getLeagueContext(leagueId);
    
    const url = `${this.baseUrl}/league/${leagueId}/teams;out=standings`;
    const response = await this.makeRequest(url, credentials);
    const data = await response.json();

    return this.parseTeams(data.fantasy_content.league[1].teams);
  }

  /**
   * Get rosters for all teams
   */
  async getRosters(leagueId: string): Promise<Roster[]> {
    const [sport, credentials] = await this.getLeagueContext(leagueId);
    
    const url = `${this.baseUrl}/league/${leagueId}/teams/roster;out=players`;
    const response = await this.makeRequest(url, credentials);
    const data = await response.json();

    return this.parseRosters(data.fantasy_content.league[1].teams);
  }

  /**
   * Get draft results
   */
  async getDraftData(leagueId: string): Promise<DraftInfo> {
    const [sport, credentials] = await this.getLeagueContext(leagueId);
    
    const url = `${this.baseUrl}/league/${leagueId}/draftresults`;
    const response = await this.makeRequest(url, credentials);
    const data = await response.json();

    return this.parseDraftData(data.fantasy_content.league[1].draft_results, leagueId);
  }

  /**
   * Get transactions
   */
  async getTransactions(
    leagueId: string,
    options?: TransactionOptions
  ): Promise<Transaction[]> {
    const [sport, credentials] = await this.getLeagueContext(leagueId);
    
    let url = `${this.baseUrl}/league/${leagueId}/transactions`;
    
    // Add filters if provided
    const filters: string[] = [];
    if (options?.types) {
      filters.push(`types=${options.types.join(',')}`);
    }
    if (options?.teamId) {
      filters.push(`team_key=${leagueId}.t.${options.teamId}`);
    }
    
    if (filters.length > 0) {
      url += `;${filters.join(';')}`;
    }

    const response = await this.makeRequest(url, credentials);
    const data = await response.json();

    return this.parseTransactions(data.fantasy_content.league[1].transactions, leagueId);
  }

  /**
   * Get matchups for a week
   */
  async getMatchups(leagueId: string, week?: number): Promise<Matchup[]> {
    const [sport, credentials] = await this.getLeagueContext(leagueId);
    
    let url = `${this.baseUrl}/league/${leagueId}/scoreboard`;
    if (week) {
      url += `;week=${week}`;
    }

    const response = await this.makeRequest(url, credentials);
    const data = await response.json();

    return this.parseMatchups(data.fantasy_content.league[1].scoreboard, leagueId);
  }

  /**
   * Get player stats
   */
  async getPlayerStats(playerId: string, options?: StatsOptions): Promise<PlayerStats> {
    // Yahoo player stats require league context
    throw new Error('Player stats must be retrieved through league context in Yahoo API');
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to get user info
      const credentials = Array.from(this.authManager['credentials'].values())
        .find(c => c.platform === this.platform);
      
      if (!credentials) {
        return false;
      }

      const url = `${this.baseUrl}/users;use_login=1`;
      const response = await this.makeRequest(url, credentials);
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Make authenticated request to Yahoo API
   */
  private async makeRequest(url: string, credentials: AuthCredentials): Promise<Response> {
    const headers = this.authManager.getAuthHeaders(credentials);
    headers['Accept'] = 'application/json';

    const response = await fetch(url, { headers });

    // Update rate limit info
    this.updateRateLimitInfo(response);

    if (response.status === 401) {
      // Try to refresh token
      const newCredentials = await this.refreshToken(credentials);
      // Retry with new token
      const newHeaders = this.authManager.getAuthHeaders(newCredentials);
      newHeaders['Accept'] = 'application/json';
      return fetch(url, { headers: newHeaders });
    }

    if (!response.ok) {
      throw new Error(`Yahoo API error: ${response.status} ${response.statusText}`);
    }

    return response;
  }

  /**
   * Update rate limit information from response headers
   */
  private updateRateLimitInfo(response: Response): void {
    const limit = response.headers.get('X-RateLimit-Limit');
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');

    if (limit && remaining && reset) {
      this.rateLimitInfo = {
        limit: parseInt(limit),
        remaining: parseInt(remaining),
        reset: new Date(parseInt(reset) * 1000)
      };
    }
  }

  /**
   * Get league context (sport and credentials)
   */
  private async getLeagueContext(leagueId: string): Promise<[SportType, AuthCredentials]> {
    // Extract sport from league ID (e.g., "414.l.12345" where 414 is NFL 2023)
    const gameId = parseInt(leagueId.split('.')[0]);
    const sport = this.getSportFromGameId(gameId);
    
    // Get credentials - in real implementation, would need to track user per league
    const credentials = Array.from(this.authManager['credentials'].values())
      .find(c => c.platform === this.platform);
    
    if (!credentials) {
      throw new Error('No credentials found');
    }

    return [sport, credentials];
  }

  /**
   * Get game key for sport and season
   */
  private getGameKey(sport: SportType, season: number): string {
    // Yahoo game IDs - these would be fetched dynamically in production
    const gameIds: Record<string, Record<number, number>> = {
      nfl: { 2023: 414, 2024: 423 },
      nba: { 2023: 418, 2024: 428 },
      mlb: { 2023: 412, 2024: 422 },
      nhl: { 2023: 419, 2024: 427 }
    };

    return String(gameIds[sport]?.[season] || gameIds[sport][2024]);
  }

  /**
   * Get sport from game ID
   */
  private getSportFromGameId(gameId: number): SportType {
    // Map game IDs to sports
    const sportMap: Record<number, SportType> = {
      414: 'nfl', 423: 'nfl',
      418: 'nba', 428: 'nba',
      412: 'mlb', 422: 'mlb',
      419: 'nhl', 427: 'nhl'
    };

    return sportMap[gameId] || 'nfl';
  }

  /**
   * Parse leagues from Yahoo response
   */
  private parseLeagues(gamesData: any, sport: SportType): League[] {
    const leagues: League[] = [];
    
    if (!gamesData || !Array.isArray(gamesData)) {
      return leagues;
    }

    for (const game of gamesData) {
      if (game.game && game.game[1] && game.game[1].leagues) {
        const leaguesList = game.game[1].leagues;
        
        for (let i = 0; i < leaguesList.count; i++) {
          const leagueData = leaguesList[i].league;
          leagues.push(this.parseLeague(leagueData[0], sport));
        }
      }
    }

    return leagues;
  }

  /**
   * Parse single league data
   */
  private parseLeague(leagueData: any, sport: SportType): League {
    return {
      id: `yahoo_${leagueData.league_key}`,
      platform: 'yahoo',
      platformLeagueId: leagueData.league_key,
      name: leagueData.name,
      season: parseInt(leagueData.season),
      sport,
      isActive: leagueData.is_finished === '0',
      settings: {
        scoringSystem: {
          type: leagueData.scoring_type === 'head' ? 'h2h_points' : 'points',
          scoringItems: [] // Would need separate call to get scoring settings
        },
        rosterPositions: this.parseRosterPositions(leagueData.roster_positions),
        waiverType: this.parseWaiverType(leagueData.waiver_type),
        tradeDeadline: leagueData.trade_end_date ? new Date(leagueData.trade_end_date) : undefined,
        playoffStartWeek: parseInt(leagueData.start_week),
        maxTeams: parseInt(leagueData.num_teams),
        draftType: leagueData.draft_type === 'live' ? 'snake' : 'auction',
        scoringPeriod: 'weekly'
      },
      teams: [],
      currentWeek: parseInt(leagueData.current_week || '1'),
      totalWeeks: parseInt(leagueData.end_week || '17'),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Parse roster positions
   */
  private parseRosterPositions(positionsData: any): any[] {
    if (!positionsData || !Array.isArray(positionsData)) {
      return [];
    }

    return positionsData.map(pos => ({
      position: pos.roster_position.position,
      abbreviation: pos.roster_position.position_type,
      count: parseInt(pos.roster_position.count),
      isActive: true,
      isFlex: pos.roster_position.position === 'W/R/T' || pos.roster_position.position === 'W/T'
    }));
  }

  /**
   * Parse waiver type
   */
  private parseWaiverType(waiverType: string): any {
    const typeMap: Record<string, any> = {
      'continual': 'continuous',
      'weekly': 'standard',
      'fab': 'faab'
    };

    return typeMap[waiverType] || 'standard';
  }

  /**
   * Parse teams data
   */
  private parseTeams(teamsData: any): Team[] {
    const teams: Team[] = [];
    
    if (!teamsData) {
      return teams;
    }

    const teamCount = parseInt(teamsData.count || '0');
    for (let i = 0; i < teamCount; i++) {
      const teamData = teamsData[i].team;
      const teamInfo = teamData[0][0];
      const standingsData = teamData[1]?.team_standings;

      teams.push({
        id: `yahoo_${teamInfo.team_key}`,
        platformTeamId: teamInfo.team_key,
        leagueId: teamInfo.team_key.split('.t.')[0],
        name: teamInfo.name,
        abbreviation: teamInfo.team_logos?.[0]?.team_logo?.url,
        logoUrl: teamInfo.team_logos?.[0]?.team_logo?.url,
        ownerId: teamInfo.managers?.[0]?.manager?.guid || '',
        ownerName: teamInfo.managers?.[0]?.manager?.nickname || '',
        standing: standingsData ? this.parseStanding(standingsData) : undefined,
        roster: { teamId: `yahoo_${teamInfo.team_key}`, players: [] }
      });
    }

    return teams;
  }

  /**
   * Parse team standing
   */
  private parseStanding(standingsData: any): TeamStanding {
    return {
      rank: parseInt(standingsData.rank),
      wins: parseInt(standingsData.outcome_totals?.wins || '0'),
      losses: parseInt(standingsData.outcome_totals?.losses || '0'),
      ties: parseInt(standingsData.outcome_totals?.ties || '0'),
      points: parseFloat(standingsData.points_for || '0'),
      pointsAgainst: parseFloat(standingsData.points_against || '0'),
      streakType: standingsData.streak?.type as 'W' | 'L' | 'T',
      streakLength: parseInt(standingsData.streak?.value || '0')
    };
  }

  /**
   * Parse rosters data
   */
  private parseRosters(teamsData: any): Roster[] {
    const rosters: Roster[] = [];
    
    if (!teamsData) {
      return rosters;
    }

    const teamCount = parseInt(teamsData.count || '0');
    for (let i = 0; i < teamCount; i++) {
      const teamData = teamsData[i].team;
      const teamKey = teamData[0][0].team_key;
      const playersData = teamData[1]?.roster?.[0]?.players;

      const roster: Roster = {
        teamId: teamKey,
        players: [],
        startingLineup: [],
        benchPlayers: []
      };

      if (playersData) {
        const playerCount = parseInt(playersData.count || '0');
        for (let j = 0; j < playerCount; j++) {
          const playerData = playersData[j].player;
          const player = this.parsePlayer(playerData);
          
          roster.players.push(player);
          
          if (player.status.isStarting) {
            roster.startingLineup!.push(player.id);
          } else {
            roster.benchPlayers!.push(player.id);
          }
        }
      }

      rosters.push(roster);
    }

    return rosters;
  }

  /**
   * Parse player data
   */
  private parsePlayer(playerData: any): RosterPlayer {
    const playerInfo = playerData[0];
    
    return {
      id: `yahoo_${playerInfo.player_key}`,
      platformPlayerId: playerInfo.player_key,
      name: playerInfo.name?.full || '',
      position: playerInfo.display_position || '',
      eligiblePositions: playerInfo.eligible_positions?.map((p: any) => p.position) || [],
      team: playerInfo.editorial_team_abbr || '',
      status: {
        isActive: playerInfo.status !== 'IR' && playerInfo.status !== 'O',
        isStarting: playerInfo.selected_position?.position !== 'BN',
        positionType: this.getPositionType(playerInfo.selected_position?.position)
      },
      injuryStatus: playerInfo.status ? {
        status: this.mapInjuryStatus(playerInfo.status),
        description: playerInfo.status_full
      } : undefined,
      imageUrl: playerInfo.image_url
    };
  }

  /**
   * Get position type from Yahoo position
   */
  private getPositionType(position: string): 'starter' | 'bench' | 'ir' | 'na' {
    if (!position || position === 'BN') return 'bench';
    if (position === 'IR' || position === 'IR+') return 'ir';
    if (position === 'NA') return 'na';
    return 'starter';
  }

  /**
   * Map Yahoo injury status to our format
   */
  private mapInjuryStatus(status: string): 'healthy' | 'questionable' | 'doubtful' | 'out' | 'ir' {
    const statusMap: Record<string, any> = {
      'Q': 'questionable',
      'D': 'doubtful',
      'O': 'out',
      'IR': 'ir',
      'SUSP': 'out',
      'PUP': 'ir'
    };

    return statusMap[status] || 'healthy';
  }

  /**
   * Parse draft data
   */
  private parseDraftData(draftResults: any, leagueId: string): DraftInfo {
    const picks: DraftPick[] = [];
    
    if (draftResults && Array.isArray(draftResults)) {
      for (const result of draftResults) {
        const pick = result.draft_result;
        picks.push({
          round: parseInt(pick.round),
          pick: parseInt(pick.pick),
          overallPick: (parseInt(pick.round) - 1) * 10 + parseInt(pick.pick), // Assuming 10 teams
          teamId: pick.team_key,
          playerId: pick.player_key,
          playerName: '', // Would need player lookup
          position: '', // Would need player lookup
          timestamp: new Date()
        });
      }
    }

    return {
      id: `yahoo_draft_${leagueId}`,
      leagueId,
      type: 'snake', // Would need to determine from league settings
      status: 'post_draft',
      startTime: new Date(), // Would need actual draft time
      picks,
      rounds: Math.max(...picks.map(p => p.round), 1)
    };
  }

  /**
   * Parse transactions
   */
  private parseTransactions(transactionsData: any, leagueId: string): Transaction[] {
    const transactions: Transaction[] = [];
    
    if (!transactionsData) {
      return transactions;
    }

    const count = parseInt(transactionsData.count || '0');
    for (let i = 0; i < count; i++) {
      const transData = transactionsData[i].transaction;
      const transInfo = transData[0];
      const players = transData[1]?.players;

      const transaction: Transaction = {
        id: `yahoo_${transInfo.transaction_key}`,
        leagueId,
        type: this.mapTransactionType(transInfo.type),
        status: transInfo.status === 'successful' ? 'executed' : 'pending',
        teams: [], // Will be filled from players
        players: [],
        proposedDate: new Date(parseInt(transInfo.timestamp) * 1000),
        processedDate: transInfo.status === 'successful' ? new Date(parseInt(transInfo.timestamp) * 1000) : undefined
      };

      // Parse players involved
      if (players) {
        const playerCount = parseInt(players.count || '0');
        for (let j = 0; j < playerCount; j++) {
          const playerData = players[j].player;
          const playerInfo = playerData[0];
          const transDetail = playerData[1].transaction_data;

          const transPlayer: TransactionPlayer = {
            playerId: playerInfo.player_key,
            playerName: playerInfo.name?.full || '',
            action: transDetail.type === 'add' ? 'add' : transDetail.type === 'drop' ? 'drop' : 'trade',
            fromTeamId: transDetail.source_team_key,
            toTeamId: transDetail.destination_team_key
          };

          transaction.players.push(transPlayer);

          // Add teams to transaction
          if (transDetail.source_team_key && !transaction.teams.includes(transDetail.source_team_key)) {
            transaction.teams.push(transDetail.source_team_key);
          }
          if (transDetail.destination_team_key && !transaction.teams.includes(transDetail.destination_team_key)) {
            transaction.teams.push(transDetail.destination_team_key);
          }
        }
      }

      // Set bid amount for waiver claims
      if (transInfo.waiver_bid) {
        transaction.bidAmount = parseInt(transInfo.waiver_bid);
      }

      transactions.push(transaction);
    }

    return transactions;
  }

  /**
   * Map Yahoo transaction type to our format
   */
  private mapTransactionType(type: string): 'waiver' | 'trade' | 'freeagent' | 'drop' {
    const typeMap: Record<string, any> = {
      'add/drop': 'waiver',
      'trade': 'trade',
      'add': 'freeagent',
      'drop': 'drop'
    };

    return typeMap[type] || 'freeagent';
  }

  /**
   * Parse matchups
   */
  private parseMatchups(scoreboardData: any, leagueId: string): Matchup[] {
    const matchups: Matchup[] = [];
    
    if (!scoreboardData || !scoreboardData.matchups) {
      return matchups;
    }

    const matchupCount = parseInt(scoreboardData.matchups.count || '0');
    const week = parseInt(scoreboardData.week || '1');

    for (let i = 0; i < matchupCount; i++) {
      const matchupData = scoreboardData.matchups[i].matchup;
      const teams = matchupData.teams;

      if (teams && teams.count === '2') {
        const team1 = teams[0].team;
        const team2 = teams[1].team;

        const matchup: Matchup = {
          id: `yahoo_${leagueId}_w${week}_m${i}`,
          leagueId,
          week,
          team1Id: team1[0].team_key,
          team2Id: team2[0].team_key,
          team1Score: parseFloat(team1[1]?.team_points?.total || '0'),
          team2Score: parseFloat(team2[1]?.team_points?.total || '0'),
          team1Projection: parseFloat(team1[1]?.team_projected_points?.total || '0'),
          team2Projection: parseFloat(team2[1]?.team_projected_points?.total || '0'),
          winnerId: matchupData.winner_team_key,
          status: matchupData.status === 'postevent' ? 'final' : 'in_progress',
          startDate: new Date(), // Would need actual date
          endDate: new Date(), // Would need actual date
          isPlayoffs: matchupData.is_playoffs === '1',
          isConsolation: matchupData.is_consolation === '1'
        };

        matchups.push(matchup);
      }
    }

    return matchups;
  }
}
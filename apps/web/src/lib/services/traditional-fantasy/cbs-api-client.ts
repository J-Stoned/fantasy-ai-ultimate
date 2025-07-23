/**
 * CBS Sports Fantasy API Client
 * Handles all interactions with CBS Sports Fantasy API
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
  SportType,
  DraftPick,
  RosterPlayer,
  TransactionPlayer,
  TeamStanding,
  ScoringItem,
  RosterPosition,
  WaiverType
} from './types';
import { AuthManager } from './auth-manager';

export class CBSApiClient implements PlatformApiClient {
  private readonly baseUrl = 'https://api.cbssports.com/fantasy';
  private readonly platform = 'cbs' as const;
  private authManager: AuthManager;
  
  // CBS sport endpoints
  private readonly sportEndpoints: Record<SportType, string> = {
    nfl: 'football',
    nba: 'basketball',
    mlb: 'baseball',
    nhl: 'hockey'
  };

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
  }

  /**
   * Authenticate with CBS Sports OAuth2
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthCredentials> {
    // CBS uses OAuth2 flow handled by AuthManager
    return credentials;
  }

  /**
   * Refresh CBS access token
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

    const leagues: League[] = [];
    const currentYear = new Date().getFullYear();

    // Fetch leagues for each sport
    for (const [sport, endpoint] of Object.entries(this.sportEndpoints)) {
      try {
        const url = `${this.baseUrl}/${endpoint}/leagues?user_id=${userId}&season=${currentYear}`;
        const response = await this.makeRequest(url, credentials);
        
        if (response.ok) {
          const data = await response.json();
          const sportLeagues = this.parseLeagues(data.body?.leagues || [], sport as SportType);
          leagues.push(...sportLeagues);
        }
      } catch (error) {
        console.warn(`Failed to fetch ${sport} leagues:`, error);
      }
    }

    return leagues;
  }

  /**
   * Get a specific league
   */
  async getLeague(leagueId: string): Promise<League> {
    const [sport, numericId, credentials] = await this.getLeagueContext(leagueId);
    
    const endpoint = this.sportEndpoints[sport];
    const url = `${this.baseUrl}/${endpoint}/leagues/${numericId}`;
    
    const response = await this.makeRequest(url, credentials);
    const data = await response.json();

    return this.parseLeague(data.body.league, sport);
  }

  /**
   * Get teams in a league
   */
  async getTeams(leagueId: string): Promise<Team[]> {
    const [sport, numericId, credentials] = await this.getLeagueContext(leagueId);
    
    const endpoint = this.sportEndpoints[sport];
    const url = `${this.baseUrl}/${endpoint}/leagues/${numericId}/teams`;
    
    const response = await this.makeRequest(url, credentials);
    const data = await response.json();

    return this.parseTeams(data.body.teams || [], leagueId);
  }

  /**
   * Get rosters for all teams
   */
  async getRosters(leagueId: string): Promise<Roster[]> {
    const [sport, numericId, credentials] = await this.getLeagueContext(leagueId);
    
    const endpoint = this.sportEndpoints[sport];
    const teams = await this.getTeams(leagueId);
    const rosters: Roster[] = [];

    // CBS requires fetching rosters per team
    for (const team of teams) {
      try {
        const url = `${this.baseUrl}/${endpoint}/leagues/${numericId}/teams/${team.platformTeamId}/roster`;
        const response = await this.makeRequest(url, credentials);
        const data = await response.json();
        
        const roster = this.parseRoster(data.body.roster, team.platformTeamId);
        rosters.push(roster);
      } catch (error) {
        console.warn(`Failed to fetch roster for team ${team.id}:`, error);
      }
    }

    return rosters;
  }

  /**
   * Get draft results
   */
  async getDraftData(leagueId: string): Promise<DraftInfo> {
    const [sport, numericId, credentials] = await this.getLeagueContext(leagueId);
    
    const endpoint = this.sportEndpoints[sport];
    const url = `${this.baseUrl}/${endpoint}/leagues/${numericId}/draft`;
    
    const response = await this.makeRequest(url, credentials);
    const data = await response.json();

    return this.parseDraftData(data.body.draft, leagueId);
  }

  /**
   * Get transactions
   */
  async getTransactions(
    leagueId: string,
    options?: TransactionOptions
  ): Promise<Transaction[]> {
    const [sport, numericId, credentials] = await this.getLeagueContext(leagueId);
    
    const endpoint = this.sportEndpoints[sport];
    let url = `${this.baseUrl}/${endpoint}/leagues/${numericId}/transactions`;
    
    // Add query parameters
    const params = new URLSearchParams();
    if (options?.types) {
      params.append('types', options.types.join(','));
    }
    if (options?.startDate) {
      params.append('start_date', options.startDate.toISOString());
    }
    if (options?.endDate) {
      params.append('end_date', options.endDate.toISOString());
    }
    if (options?.teamId) {
      params.append('team_id', options.teamId);
    }
    if (options?.limit) {
      params.append('limit', String(options.limit));
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await this.makeRequest(url, credentials);
    const data = await response.json();

    return this.parseTransactions(data.body.transactions || [], leagueId);
  }

  /**
   * Get matchups for a week
   */
  async getMatchups(leagueId: string, week?: number): Promise<Matchup[]> {
    const [sport, numericId, credentials] = await this.getLeagueContext(leagueId);
    
    const endpoint = this.sportEndpoints[sport];
    const period = week || await this.getCurrentPeriod(sport, numericId, credentials);
    
    const url = `${this.baseUrl}/${endpoint}/leagues/${numericId}/schedule?period=${period}`;
    
    const response = await this.makeRequest(url, credentials);
    const data = await response.json();

    return this.parseMatchups(data.body.schedule || [], leagueId, period);
  }

  /**
   * Get player stats
   */
  async getPlayerStats(playerId: string, options?: StatsOptions): Promise<PlayerStats> {
    // CBS player stats would need sport context
    throw new Error('Player stats must be retrieved through league context in CBS API');
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const credentials = Array.from(this.authManager['credentials'].values())
        .find(c => c.platform === this.platform);
      
      if (!credentials) {
        return false;
      }

      // Try a simple API call
      const url = `${this.baseUrl}/general/api-status`;
      const response = await this.makeRequest(url, credentials);
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Make authenticated request to CBS API
   */
  private async makeRequest(url: string, credentials: AuthCredentials): Promise<Response> {
    const headers = this.authManager.getAuthHeaders(credentials);
    headers['Accept'] = 'application/json';
    headers['Content-Type'] = 'application/json';
    
    // CBS specific headers
    headers['X-CBS-App'] = 'fantasy-web';

    const response = await fetch(url, { headers });

    if (response.status === 401) {
      // Try to refresh token
      const newCredentials = await this.refreshToken(credentials);
      // Retry with new token
      const newHeaders = this.authManager.getAuthHeaders(newCredentials);
      newHeaders['Accept'] = 'application/json';
      newHeaders['Content-Type'] = 'application/json';
      newHeaders['X-CBS-App'] = 'fantasy-web';
      
      return fetch(url, { headers: newHeaders });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CBS API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response;
  }

  /**
   * Get league context
   */
  private async getLeagueContext(leagueId: string): Promise<[SportType, string, AuthCredentials]> {
    // CBS league IDs are formatted as "cbs_sport_numericId"
    const parts = leagueId.split('_');
    const sport = parts[1] as SportType;
    const numericId = parts[2];
    
    const credentials = Array.from(this.authManager['credentials'].values())
      .find(c => c.platform === this.platform);
    
    if (!credentials) {
      throw new Error('No credentials found');
    }

    return [sport, numericId, credentials];
  }

  /**
   * Get current period/week
   */
  private async getCurrentPeriod(
    sport: SportType,
    leagueId: string,
    credentials: AuthCredentials
  ): Promise<number> {
    const endpoint = this.sportEndpoints[sport];
    const url = `${this.baseUrl}/${endpoint}/leagues/${leagueId}/info`;
    
    const response = await this.makeRequest(url, credentials);
    const data = await response.json();

    return data.body.league.current_period || 1;
  }

  /**
   * Parse leagues from CBS response
   */
  private parseLeagues(leaguesData: any[], sport: SportType): League[] {
    return leaguesData.map(leagueData => this.parseLeague(leagueData, sport));
  }

  /**
   * Parse single league data
   */
  private parseLeague(data: any, sport: SportType): League {
    return {
      id: `cbs_${sport}_${data.id}`,
      platform: 'cbs',
      platformLeagueId: String(data.id),
      name: data.name,
      season: data.season || new Date().getFullYear(),
      sport,
      isActive: data.is_active || !data.is_complete,
      settings: {
        scoringSystem: {
          type: this.determineScoringType(data),
          scoringItems: this.parseScoringItems(data.scoring || {})
        },
        rosterPositions: this.parseRosterPositions(data.roster_settings || {}),
        waiverType: this.parseWaiverType(data.waiver_type),
        tradeDeadline: data.trade_deadline ? new Date(data.trade_deadline) : undefined,
        playoffStartWeek: data.playoff_start_week,
        maxTeams: data.num_teams || data.max_teams,
        draftType: this.parseDraftType(data.draft_type),
        scoringPeriod: data.scoring_period || 'weekly'
      },
      teams: [],
      currentWeek: data.current_period || 1,
      totalWeeks: data.num_periods || data.regular_season_periods || 17,
      playoffWeeks: this.getPlayoffWeeks(data),
      createdAt: new Date(data.created_at || Date.now()),
      updatedAt: new Date(data.updated_at || Date.now())
    };
  }

  /**
   * Determine scoring type
   */
  private determineScoringType(data: any): string {
    if (data.scoring_type === 'POINTS') {
      return data.is_head_to_head ? 'h2h_points' : 'points';
    } else if (data.scoring_type === 'CATEGORY') {
      return data.is_head_to_head ? 'h2h_category' : 'category';
    } else if (data.scoring_type === 'ROTISSERIE') {
      return 'roto';
    }
    return 'points';
  }

  /**
   * Parse scoring items
   */
  private parseScoringItems(scoring: any): ScoringItem[] {
    const items: ScoringItem[] = [];
    
    Object.entries(scoring).forEach(([category, settings]) => {
      if (typeof settings === 'object' && settings !== null) {
        Object.entries(settings as any).forEach(([stat, value]) => {
          if (typeof value === 'number') {
            items.push({
              statId: `${category}_${stat}`,
              statName: this.formatStatName(category, stat),
              points: value,
              isDecimal: !Number.isInteger(value)
            });
          }
        });
      }
    });

    return items;
  }

  /**
   * Format stat name for display
   */
  private formatStatName(category: string, stat: string): string {
    // Convert snake_case to Title Case
    const formatted = stat
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return `${category.charAt(0).toUpperCase() + category.slice(1)} ${formatted}`;
  }

  /**
   * Parse roster positions
   */
  private parseRosterPositions(settings: any): RosterPosition[] {
    const positions: RosterPosition[] = [];
    
    if (settings.positions) {
      Object.entries(settings.positions).forEach(([position, count]) => {
        positions.push({
          position: position.toUpperCase(),
          abbreviation: position.toUpperCase(),
          count: Number(count),
          isActive: position !== 'BN' && position !== 'IR',
          isFlex: position.includes('FLEX') || position.includes('/'),
          eligiblePositions: this.getEligiblePositions(position)
        });
      });
    }

    return positions;
  }

  /**
   * Get eligible positions for a roster slot
   */
  private getEligiblePositions(position: string): string[] {
    if (position.includes('/')) {
      return position.split('/');
    }
    if (position === 'FLEX' || position === 'W/R/T') {
      return ['WR', 'RB', 'TE'];
    }
    if (position === 'W/T') {
      return ['WR', 'TE'];
    }
    return [position];
  }

  /**
   * Parse waiver type
   */
  private parseWaiverType(waiverType: string): WaiverType {
    const typeMap: Record<string, WaiverType> = {
      'STANDARD': 'standard',
      'FAAB': 'faab',
      'CONTINUOUS': 'continuous',
      'NONE': 'none'
    };

    return typeMap[waiverType?.toUpperCase()] || 'standard';
  }

  /**
   * Parse draft type
   */
  private parseDraftType(draftType: string): 'snake' | 'auction' | 'linear' | 'keeper' | 'dynasty' {
    const typeMap: Record<string, any> = {
      'SNAKE': 'snake',
      'AUCTION': 'auction',
      'LINEAR': 'linear',
      'KEEPER': 'keeper',
      'DYNASTY': 'dynasty'
    };

    return typeMap[draftType?.toUpperCase()] || 'snake';
  }

  /**
   * Get playoff weeks
   */
  private getPlayoffWeeks(data: any): number[] {
    const playoffWeeks: number[] = [];
    
    if (data.playoff_start_week && data.num_playoff_weeks) {
      for (let i = 0; i < data.num_playoff_weeks; i++) {
        playoffWeeks.push(data.playoff_start_week + i);
      }
    }

    return playoffWeeks;
  }

  /**
   * Parse teams data
   */
  private parseTeams(teamsData: any[], leagueId: string): Team[] {
    return teamsData.map(teamData => ({
      id: `cbs_${teamData.id}`,
      platformTeamId: String(teamData.id),
      leagueId,
      name: teamData.name,
      abbreviation: teamData.abbreviation || teamData.short_name,
      logoUrl: teamData.logo_url,
      ownerId: String(teamData.owner_id),
      ownerName: teamData.owner_name || teamData.owner?.display_name || '',
      standing: this.parseStanding(teamData),
      roster: { teamId: `cbs_${teamData.id}`, players: [] },
      draftGrade: teamData.draft_grade,
      projectedRank: teamData.projected_rank,
      currentRank: teamData.current_rank || teamData.standing?.rank
    }));
  }

  /**
   * Parse team standing
   */
  private parseStanding(teamData: any): TeamStanding | undefined {
    if (!teamData.record && !teamData.standing) {
      return undefined;
    }

    const record = teamData.record || {};
    const standing = teamData.standing || {};

    return {
      rank: standing.rank || teamData.rank || 0,
      wins: record.wins || standing.wins || 0,
      losses: record.losses || standing.losses || 0,
      ties: record.ties || standing.ties || 0,
      points: record.points_for || standing.points_for || 0,
      pointsAgainst: record.points_against || standing.points_against || 0,
      categories: standing.categories,
      streakType: record.streak_type as 'W' | 'L' | 'T',
      streakLength: record.streak_length || 0
    };
  }

  /**
   * Parse roster data
   */
  private parseRoster(rosterData: any, teamId: string): Roster {
    const roster: Roster = {
      teamId,
      players: [],
      startingLineup: [],
      benchPlayers: [],
      injuredReserve: []
    };

    if (rosterData.players) {
      rosterData.players.forEach((playerData: any) => {
        const player = this.parsePlayer(playerData);
        roster.players.push(player);

        // Categorize by position
        if (playerData.position === 'IR' || playerData.position === 'IL') {
          roster.injuredReserve!.push(player.id);
        } else if (playerData.position === 'BN' || playerData.is_bench) {
          roster.benchPlayers!.push(player.id);
        } else {
          roster.startingLineup!.push(player.id);
        }
      });
    }

    return roster;
  }

  /**
   * Parse player data
   */
  private parsePlayer(playerData: any): RosterPlayer {
    return {
      id: `cbs_${playerData.id}`,
      platformPlayerId: String(playerData.id),
      name: playerData.fullname || `${playerData.firstname} ${playerData.lastname}`,
      position: playerData.position || playerData.primary_position,
      eligiblePositions: playerData.eligible_positions || [playerData.position],
      team: playerData.pro_team || playerData.team_abbr,
      status: {
        isActive: !playerData.is_injured && !playerData.is_suspended,
        isStarting: !playerData.is_bench && playerData.position !== 'BN',
        positionType: this.getPositionType(playerData)
      },
      injuryStatus: playerData.injury_status ? {
        status: this.mapInjuryStatus(playerData.injury_status),
        description: playerData.injury_description,
        returnDate: playerData.injury_return_date ? new Date(playerData.injury_return_date) : undefined
      } : undefined,
      stats: {
        season: playerData.season_stats,
        week: playerData.week_stats,
        projections: playerData.projections
      },
      acquisitionInfo: playerData.acquisition ? {
        type: this.mapAcquisitionType(playerData.acquisition.type),
        date: new Date(playerData.acquisition.date),
        cost: playerData.acquisition.cost,
        tradedFrom: playerData.acquisition.from_team_id,
        draftRound: playerData.acquisition.draft_round,
        draftPick: playerData.acquisition.draft_pick
      } : undefined,
      imageUrl: playerData.photo_url || playerData.headshot_url
    };
  }

  /**
   * Get position type
   */
  private getPositionType(playerData: any): 'starter' | 'bench' | 'ir' | 'na' {
    if (playerData.position === 'IR' || playerData.position === 'IL') {
      return 'ir';
    }
    if (playerData.position === 'BN' || playerData.is_bench) {
      return 'bench';
    }
    if (playerData.position === 'NA' || playerData.is_na) {
      return 'na';
    }
    return 'starter';
  }

  /**
   * Map injury status
   */
  private mapInjuryStatus(status: string): 'healthy' | 'questionable' | 'doubtful' | 'out' | 'ir' {
    const statusMap: Record<string, any> = {
      'PROBABLE': 'questionable',
      'QUESTIONABLE': 'questionable',
      'DOUBTFUL': 'doubtful',
      'OUT': 'out',
      'INJURED_RESERVE': 'ir',
      'IR': 'ir',
      'PUP': 'ir',
      'SUSPENDED': 'out'
    };

    return statusMap[status?.toUpperCase()] || 'healthy';
  }

  /**
   * Map acquisition type
   */
  private mapAcquisitionType(type: string): 'draft' | 'waiver' | 'trade' | 'freeagent' {
    const typeMap: Record<string, any> = {
      'DRAFT': 'draft',
      'WAIVER': 'waiver',
      'TRADE': 'trade',
      'FREE_AGENT': 'freeagent',
      'FREEAGENT': 'freeagent'
    };

    return typeMap[type?.toUpperCase()] || 'freeagent';
  }

  /**
   * Parse draft data
   */
  private parseDraftData(draftData: any, leagueId: string): DraftInfo {
    const picks: DraftPick[] = [];

    if (draftData.picks) {
      draftData.picks.forEach((pick: any) => {
        picks.push({
          round: pick.round,
          pick: pick.pick,
          overallPick: pick.overall_pick || ((pick.round - 1) * (draftData.num_teams || 10) + pick.pick),
          teamId: String(pick.team_id),
          playerId: String(pick.player_id),
          playerName: pick.player_name || '',
          position: pick.position || '',
          keeperRound: pick.keeper_round,
          auctionValue: pick.auction_value || pick.salary,
          timestamp: new Date(pick.timestamp || pick.pick_time)
        });
      });
    }

    return {
      id: `cbs_draft_${leagueId}`,
      leagueId,
      type: draftData.type?.toLowerCase() || 'snake',
      status: draftData.is_complete ? 'post_draft' : 
              draftData.is_in_progress ? 'drafting' : 'pre_draft',
      startTime: new Date(draftData.start_time || draftData.scheduled_time),
      picks,
      rounds: draftData.num_rounds || 15,
      secondsPerPick: draftData.seconds_per_pick
    };
  }

  /**
   * Parse transactions
   */
  private parseTransactions(transactionsData: any[], leagueId: string): Transaction[] {
    return transactionsData.map(trans => {
      const transaction: Transaction = {
        id: `cbs_${trans.id}`,
        leagueId,
        type: this.mapTransactionType(trans.type),
        status: this.mapTransactionStatus(trans.status),
        teams: [],
        players: [],
        proposedDate: new Date(trans.proposed_date || trans.created_date),
        processedDate: trans.processed_date ? new Date(trans.processed_date) : undefined,
        effectiveDate: trans.effective_date ? new Date(trans.effective_date) : undefined,
        bidAmount: trans.bid_amount || trans.faab_bid,
        priority: trans.waiver_priority
      };

      // Parse players
      if (trans.players) {
        trans.players.forEach((player: any) => {
          const transPlayer: TransactionPlayer = {
            playerId: String(player.player_id),
            playerName: player.player_name || '',
            action: this.mapPlayerAction(player.action),
            fromTeamId: player.from_team_id ? String(player.from_team_id) : undefined,
            toTeamId: player.to_team_id ? String(player.to_team_id) : undefined
          };

          transaction.players.push(transPlayer);

          // Add teams
          if (player.from_team_id && !transaction.teams.includes(String(player.from_team_id))) {
            transaction.teams.push(String(player.from_team_id));
          }
          if (player.to_team_id && !transaction.teams.includes(String(player.to_team_id))) {
            transaction.teams.push(String(player.to_team_id));
          }
        });
      }

      return transaction;
    });
  }

  /**
   * Map transaction type
   */
  private mapTransactionType(type: string): 'waiver' | 'trade' | 'freeagent' | 'drop' {
    const typeMap: Record<string, any> = {
      'WAIVER': 'waiver',
      'TRADE': 'trade',
      'FREE_AGENT': 'freeagent',
      'FREEAGENT': 'freeagent',
      'DROP': 'drop'
    };

    return typeMap[type?.toUpperCase()] || 'freeagent';
  }

  /**
   * Map transaction status
   */
  private mapTransactionStatus(status: string): 'pending' | 'approved' | 'rejected' | 'executed' | 'cancelled' {
    const statusMap: Record<string, any> = {
      'PENDING': 'pending',
      'APPROVED': 'approved',
      'REJECTED': 'rejected',
      'EXECUTED': 'executed',
      'COMPLETE': 'executed',
      'CANCELLED': 'cancelled',
      'CANCELED': 'cancelled'
    };

    return statusMap[status?.toUpperCase()] || 'pending';
  }

  /**
   * Map player action
   */
  private mapPlayerAction(action: string): 'add' | 'drop' | 'trade' {
    const actionMap: Record<string, any> = {
      'ADD': 'add',
      'DROP': 'drop',
      'TRADE': 'trade'
    };

    return actionMap[action?.toUpperCase()] || 'add';
  }

  /**
   * Parse matchups
   */
  private parseMatchups(scheduleData: any[], leagueId: string, week: number): Matchup[] {
    return scheduleData
      .filter(game => game.period === week)
      .map((game, index) => ({
        id: `cbs_${leagueId}_w${week}_m${index}`,
        leagueId,
        week,
        team1Id: String(game.home_team_id),
        team2Id: String(game.away_team_id),
        team1Score: game.home_score || 0,
        team2Score: game.away_score || 0,
        team1Projection: game.home_projection || 0,
        team2Projection: game.away_projection || 0,
        winnerId: game.winner_id ? String(game.winner_id) : undefined,
        status: this.getMatchupStatus(game),
        startDate: new Date(game.start_date || game.period_start),
        endDate: new Date(game.end_date || game.period_end),
        isPlayoffs: game.is_playoff || false,
        isConsolation: game.is_consolation || false
      }));
  }

  /**
   * Get matchup status
   */
  private getMatchupStatus(game: any): 'scheduled' | 'in_progress' | 'final' {
    if (game.is_complete || game.status === 'FINAL') {
      return 'final';
    } else if (game.is_in_progress || game.status === 'IN_PROGRESS') {
      return 'in_progress';
    }
    return 'scheduled';
  }
}
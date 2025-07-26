/**
 * Sleeper Fantasy Sports API Client
 * Handles all interactions with Sleeper API
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
import { logger } from '../../logging/logger';

export class SleeperApiClient implements PlatformApiClient {
  private readonly baseUrl = 'https://api.sleeper.app/v1';
  private readonly platform = 'sleeper' as const;
  private authManager: AuthManager;
  private playersCache: Map<string, any> = new Map();
  
  // Sleeper sport mapping
  private readonly sportMap: Record<string, SportType> = {
    nfl: 'nfl',
    nba: 'nba',
    mlb: 'mlb',
    nhl: 'nhl'
  };

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
    this.loadPlayersData();
  }

  /**
   * Load players data (Sleeper provides a static players endpoint)
   */
  private async loadPlayersData(): Promise<void> {
    try {
      // Load players for each sport
      for (const sport of Object.keys(this.sportMap)) {
        const response = await fetch(`${this.baseUrl}/players/${sport}`);
        if (response.ok) {
          const players = await response.json();
          this.playersCache.set(sport, players);
        }
      }
    } catch (error) {
      logger.warn('Failed to load Sleeper players data:'error);
    }
  }

  /**
   * Authenticate with Sleeper (username-based)
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthCredentials> {
    // Sleeper doesn't require OAuth, just username lookup
    return credentials;
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

    try {
      // Get user's leagues for current season
      const url = `${this.baseUrl}/user/${userId}/leagues/nfl/${currentYear}`;
      const response = await this.makeRequest(url);
      
      if (response.ok) {
        const data = await response.json();
        const nflLeagues = await Promise.all(
          data.map((league: any) => this.enrichLeagueData(league, 'nfl'))
        );
        leagues.push(...nflLeagues);
      }

      // Sleeper primarily supports NFL, but check for other sports
      // Note: Sleeper's API structure may vary for other sports
    } catch (error) {
      logger.error('Failed to fetch leagues:', { error: error });
    }

    return leagues;
  }

  /**
   * Get a specific league
   */
  async getLeague(leagueId: string): Promise<League> {
    const numericId = this.extractNumericId(leagueId);
    const url = `${this.baseUrl}/league/${numericId}`;
    
    const response = await this.makeRequest(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch league: ${response.statusText}`);
    }

    const data = await response.json();
    return this.enrichLeagueData(data, data.sport || 'nfl');
  }

  /**
   * Enrich league data with additional information
   */
  private async enrichLeagueData(leagueData: any, sport: string): Promise<League> {
    const league = this.parseLeague(leagueData, this.sportMap[sport] || 'nfl');
    
    // Get rosters to determine team count and standings
    try {
      const rostersUrl = `${this.baseUrl}/league/${leagueData.league_id}/rosters`;
      const rostersResponse = await this.makeRequest(rostersUrl);
      if (rostersResponse.ok) {
        const rosters = await rostersResponse.json();
        league.settings.maxTeams = rosters.length;
      }
    } catch (error) {
      logger.warn('Failed to fetch rosters for team count:'error);
    }

    return league;
  }

  /**
   * Get teams in a league
   */
  async getTeams(leagueId: string): Promise<Team[]> {
    const numericId = this.extractNumericId(leagueId);
    
    // Get rosters and users in parallel
    const [rostersResponse, usersResponse] = await Promise.all([
      this.makeRequest(`${this.baseUrl}/league/${numericId}/rosters`),
      this.makeRequest(`${this.baseUrl}/league/${numericId}/users`)
    ]);

    if (!rostersResponse.ok || !usersResponse.ok) {
      throw new Error('Failed to fetch teams data');
    }

    const rosters = await rostersResponse.json();
    const users = await usersResponse.json();

    return this.parseTeams(rosters, users, leagueId);
  }

  /**
   * Get rosters for all teams
   */
  async getRosters(leagueId: string): Promise<Roster[]> {
    const numericId = this.extractNumericId(leagueId);
    const url = `${this.baseUrl}/league/${numericId}/rosters`;
    
    const response = await this.makeRequest(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch rosters: ${response.statusText}`);
    }

    const rostersData = await response.json();
    
    // Get league info to determine sport
    const league = await this.getLeague(leagueId);
    const sport = league.sport;
    
    return this.parseRosters(rostersData, sport);
  }

  /**
   * Get draft results
   */
  async getDraftData(leagueId: string): Promise<DraftInfo> {
    const numericId = this.extractNumericId(leagueId);
    
    // Get drafts for the league
    const draftsResponse = await this.makeRequest(`${this.baseUrl}/league/${numericId}/drafts`);
    if (!draftsResponse.ok) {
      throw new Error(`Failed to fetch drafts: ${draftsResponse.statusText}`);
    }

    const drafts = await draftsResponse.json();
    if (!drafts || drafts.length === 0) {
      throw new Error('No draft found for league');
    }

    // Get the most recent draft
    const draftId = drafts[0].draft_id;
    
    // Get draft picks
    const picksResponse = await this.makeRequest(`${this.baseUrl}/draft/${draftId}/picks`);
    if (!picksResponse.ok) {
      throw new Error(`Failed to fetch draft picks: ${picksResponse.statusText}`);
    }

    const picks = await picksResponse.json();
    const draftInfo = drafts[0];

    return this.parseDraftData(draftInfo, picks, leagueId);
  }

  /**
   * Get transactions
   */
  async getTransactions(
    leagueId: string,
    options?: TransactionOptions
  ): Promise<Transaction[]> {
    const numericId = this.extractNumericId(leagueId);
    const transactions: Transaction[] = [];
    
    // Sleeper paginates transactions by week
    const league = await this.getLeague(leagueId);
    const currentWeek = league.currentWeek || 1;
    
    // Get transactions for each week up to current
    for (let week = 1; week <= currentWeek; week++) {
      try {
        const url = `${this.baseUrl}/league/${numericId}/transactions/${week}`;
        const response = await this.makeRequest(url);
        
        if (response.ok) {
          const weekTransactions = await response.json();
          const parsed = this.parseTransactions(weekTransactions, leagueId, week);
          transactions.push(...parsed);
        }
      } catch (error) {
        logger.warn('Failed to fetch transactions for week ${week}:'error);
      }
    }

    // Apply filters if provided
    let filteredTransactions = transactions;
    
    if (options?.types) {
      filteredTransactions = filteredTransactions.filter(t => 
        options.types!.includes(t.type)
      );
    }
    
    if (options?.startDate) {
      filteredTransactions = filteredTransactions.filter(t => 
        t.proposedDate >= options.startDate!
      );
    }
    
    if (options?.endDate) {
      filteredTransactions = filteredTransactions.filter(t => 
        t.proposedDate <= options.endDate!
      );
    }
    
    if (options?.teamId) {
      filteredTransactions = filteredTransactions.filter(t => 
        t.teams.includes(options.teamId!)
      );
    }
    
    if (options?.limit) {
      filteredTransactions = filteredTransactions.slice(0, options.limit);
    }

    return filteredTransactions;
  }

  /**
   * Get matchups for a week
   */
  async getMatchups(leagueId: string, week?: number): Promise<Matchup[]> {
    const numericId = this.extractNumericId(leagueId);
    
    // If no week specified, get current week
    if (!week) {
      const league = await this.getLeague(leagueId);
      week = league.currentWeek || 1;
    }
    
    const url = `${this.baseUrl}/league/${numericId}/matchups/${week}`;
    const response = await this.makeRequest(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch matchups: ${response.statusText}`);
    }

    const matchupsData = await response.json();
    return this.parseMatchups(matchupsData, leagueId, week);
  }

  /**
   * Get player stats
   */
  async getPlayerStats(playerId: string, options?: StatsOptions): Promise<PlayerStats> {
    // Sleeper doesn't provide individual player stats through the API
    // Stats are typically included in roster/matchup data
    throw new Error('Individual player stats not available through Sleeper API');
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest(`${this.baseUrl}/user/sleeper`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Make request to Sleeper API (no auth required)
   */
  private async makeRequest(url: string): Promise<Response> {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, { headers });

    if (!response.ok && response.status !== 404) {
      }

    return response;
  }

  /**
   * Extract numeric ID from our formatted ID
   */
  private extractNumericId(leagueId: string): string {
    // Our IDs are formatted as "sleeper_123456"
    return leagueId.replace('sleeper_', '');
  }

  /**
   * Parse league data
   */
  private parseLeague(data: any, sport: SportType): League {
    const scoringSettings = data.scoring_settings || {};
    
    return {
      id: `sleeper_${data.league_id}`,
      platform: 'sleeper',
      platformLeagueId: data.league_id,
      name: data.name,
      season: parseInt(data.season),
      sport,
      isActive: data.status === 'in_season',
      settings: {
        scoringSystem: {
          type: 'points', // Sleeper uses points-based scoring
          scoringItems: this.parseScoringSettings(scoringSettings)
        },
        rosterPositions: this.parseRosterPositions(data.roster_positions),
        waiverType: this.parseWaiverType(data.settings),
        tradeDeadline: data.settings?.trade_deadline ? 
          new Date(data.settings.trade_deadline * 1000) : undefined,
        playoffStartWeek: data.settings?.playoff_week_start,
        maxTeams: data.total_rosters,
        draftType: data.settings?.type === 2 ? 'dynasty' : 'snake',
        scoringPeriod: 'weekly'
      },
      teams: [],
      currentWeek: this.getCurrentWeek(data),
      totalWeeks: data.settings?.playoff_week_start ? 
        data.settings.playoff_week_start - 1 : 17,
      playoffWeeks: this.getPlayoffWeeks(data.settings),
      createdAt: new Date(data.created * 1000),
      updatedAt: new Date()
    };
  }

  /**
   * Get current week from league state
   */
  private getCurrentWeek(leagueData: any): number {
    if (leagueData.state === 'in_season' && leagueData.week) {
      return leagueData.week;
    }
    return 1;
  }

  /**
   * Parse scoring settings
   */
  private parseScoringSettings(settings: any): ScoringItem[] {
    const items: ScoringItem[] = [];
    
    Object.entries(settings).forEach(([stat, value]) => {
      if (typeof value === 'number' && value !== 0) {
        items.push({
          statId: stat,
          statName: this.formatStatName(stat),
          points: value,
          isDecimal: !Number.isInteger(value)
        });
      }
    });

    return items;
  }

  /**
   * Format Sleeper stat key to readable name
   */
  private formatStatName(stat: string): string {
    // Common Sleeper stat mappings
    const statMap: Record<string, string> = {
      pass_yd: 'Passing Yards',
      pass_td: 'Passing TDs',
      pass_int: 'Interceptions',
      rush_yd: 'Rushing Yards',
      rush_td: 'Rushing TDs',
      rec: 'Receptions',
      rec_yd: 'Receiving Yards',
      rec_td: 'Receiving TDs',
      fum_lost: 'Fumbles Lost',
      def_td: 'Defensive TDs',
      sack: 'Sacks',
      int: 'Interceptions (DEF)',
      fum_rec: 'Fumble Recoveries',
      ff: 'Forced Fumbles',
      fg_made: 'Field Goals Made',
      xp_made: 'Extra Points Made'
    };

    return statMap[stat] || stat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Parse roster positions
   */
  private parseRosterPositions(positions: any): RosterPosition[] {
    if (!positions) return [];
    
    const positionCounts: Record<string, number> = {};
    
    // Sleeper provides an array of positions
    if (Array.isArray(positions)) {
      positions.forEach(pos => {
        positionCounts[pos] = (positionCounts[pos] || 0) + 1;
      });
    } else {
      Object.entries(positions).forEach(([pos, count]) => {
        positionCounts[pos] = Number(count);
      });
    }

    return Object.entries(positionCounts).map(([position, count]) => ({
      position,
      abbreviation: position,
      count,
      isActive: position !== 'BN' && position !== 'IR',
      isFlex: position === 'FLEX' || position === 'SUPER_FLEX',
      eligiblePositions: this.getEligiblePositions(position)
    }));
  }

  /**
   * Get eligible positions for a roster slot
   */
  private getEligiblePositions(position: string): string[] {
    const eligibleMap: Record<string, string[]> = {
      'FLEX': ['RB', 'WR', 'TE'],
      'SUPER_FLEX': ['QB', 'RB', 'WR', 'TE'],
      'WR/RB/TE': ['WR', 'RB', 'TE'],
      'WR/TE': ['WR', 'TE'],
      'RB/WR': ['RB', 'WR']
    };

    return eligibleMap[position] || [position];
  }

  /**
   * Parse waiver type
   */
  private parseWaiverType(settings: any): WaiverType {
    if (!settings) return 'standard';
    
    if (settings.waiver_type === 2) {
      return 'faab';
    } else if (settings.waiver_type === 1) {
      return 'continuous';
    }
    
    return 'standard';
  }

  /**
   * Get playoff weeks
   */
  private getPlayoffWeeks(settings: any): number[] {
    if (!settings?.playoff_week_start) return [];
    
    const playoffWeeks: number[] = [];
    const startWeek = settings.playoff_week_start;
    const numTeams = settings.playoff_teams || 6;
    const numWeeks = Math.ceil(Math.log2(numTeams));
    
    for (let i = 0; i < numWeeks; i++) {
      playoffWeeks.push(startWeek + i);
    }
    
    return playoffWeeks;
  }

  /**
   * Parse teams data
   */
  private parseTeams(rosters: any[], users: any[], leagueId: string): Team[] {
    const userMap = new Map(users.map(u => [u.user_id, u]));
    
    return rosters.map(roster => {
      const user = userMap.get(roster.owner_id) || {};
      
      return {
        id: `sleeper_${roster.roster_id}`,
        platformTeamId: String(roster.roster_id),
        leagueId,
        name: user.metadata?.team_name || user.display_name || 'Unknown Team',
        abbreviation: user.metadata?.team_abbr,
        logoUrl: user.metadata?.avatar || user.avatar,
        ownerId: roster.owner_id,
        ownerName: user.display_name || '',
        standing: this.parseStanding(roster, rosters),
        roster: { teamId: `sleeper_${roster.roster_id}`, players: [] }
      };
    });
  }

  /**
   * Parse team standing
   */
  private parseStanding(roster: any, allRosters: any[]): TeamStanding {
    // Calculate rank based on wins/losses
    const sortedRosters = [...allRosters].sort((a, b) => {
      const aWinPct = a.settings.wins / (a.settings.wins + a.settings.losses || 1);
      const bWinPct = b.settings.wins / (b.settings.wins + b.settings.losses || 1);
      return bWinPct - aWinPct;
    });
    
    const rank = sortedRosters.findIndex(r => r.roster_id === roster.roster_id) + 1;
    
    return {
      rank,
      wins: roster.settings?.wins || 0,
      losses: roster.settings?.losses || 0,
      ties: roster.settings?.ties || 0,
      points: roster.settings?.fpts || 0,
      pointsAgainst: roster.settings?.fpts_against || 0
    };
  }

  /**
   * Parse rosters
   */
  private parseRosters(rostersData: any[], sport: SportType): Roster[] {
    const players = this.playersCache.get(sport) || {};
    
    return rostersData.map(rosterData => {
      const roster: Roster = {
        teamId: String(rosterData.roster_id),
        players: [],
        startingLineup: [],
        benchPlayers: [],
        injuredReserve: []
      };

      // Parse starters
      if (rosterData.starters) {
        rosterData.starters.forEach((playerId: string) => {
          if (playerId && playerId !== '0') {
            roster.startingLineup!.push(`sleeper_${playerId}`);
          }
        });
      }

      // Parse all players
      if (rosterData.players) {
        rosterData.players.forEach((playerId: string) => {
          const playerInfo = players[playerId] || {};
          const player = this.parsePlayer(playerId, playerInfo, rosterData);
          
          roster.players.push(player);
          
          // Categorize players
          if (!roster.startingLineup!.includes(player.id)) {
            if (rosterData.reserve?.includes(playerId)) {
              roster.injuredReserve!.push(player.id);
            } else {
              roster.benchPlayers!.push(player.id);
            }
          }
        });
      }

      return roster;
    });
  }

  /**
   * Parse player data
   */
  private parsePlayer(playerId: string, playerInfo: any, rosterData: any): RosterPlayer {
    const isStarter = rosterData.starters?.includes(playerId);
    const isReserve = rosterData.reserve?.includes(playerId);
    
    return {
      id: `sleeper_${playerId}`,
      platformPlayerId: playerId,
      name: `${playerInfo.first_name || ''} ${playerInfo.last_name || ''}`.trim() || 'Unknown Player',
      position: playerInfo.position || 'Unknown',
      eligiblePositions: playerInfo.fantasy_positions || [playerInfo.position],
      team: playerInfo.team || 'FA',
      status: {
        isActive: playerInfo.status === 'Active',
        isStarting: isStarter,
        positionType: isReserve ? 'ir' : (isStarter ? 'starter' : 'bench')
      },
      injuryStatus: playerInfo.injury_status ? {
        status: this.mapInjuryStatus(playerInfo.injury_status),
        description: playerInfo.injury_body_part
      } : undefined,
      imageUrl: playerInfo.metadata?.photo_url
    };
  }

  /**
   * Map Sleeper injury status
   */
  private mapInjuryStatus(status: string): 'healthy' | 'questionable' | 'doubtful' | 'out' | 'ir' {
    const statusMap: Record<string, any> = {
      'Questionable': 'questionable',
      'Doubtful': 'doubtful',
      'Out': 'out',
      'IR': 'ir',
      'PUP': 'ir',
      'Sus': 'out',
      'COV': 'out'
    };

    return statusMap[status] || 'healthy';
  }

  /**
   * Parse draft data
   */
  private parseDraftData(draftInfo: any, picks: any[], leagueId: string): DraftInfo {
    const draftPicks: DraftPick[] = [];
    const players = this.playersCache.get(draftInfo.sport || 'nfl') || {};

    Object.entries(picks).forEach(([pickId, pick]: [string, any]) => {
      const playerInfo = players[pick.player_id] || {};
      
      draftPicks.push({
        round: pick.round,
        pick: pick.draft_slot,
        overallPick: pick.pick_no,
        teamId: String(pick.roster_id),
        playerId: pick.player_id,
        playerName: `${playerInfo.first_name || ''} ${playerInfo.last_name || ''}`.trim(),
        position: playerInfo.position || '',
        timestamp: new Date(pick.picked_at || draftInfo.start_time * 1000)
      });
    });

    // Sort by overall pick
    draftPicks.sort((a, b) => a.overallPick - b.overallPick);

    return {
      id: `sleeper_draft_${draftInfo.draft_id}`,
      leagueId,
      type: draftInfo.type === 'auction' ? 'auction' : 'snake',
      status: draftInfo.status === 'complete' ? 'post_draft' : 
              draftInfo.status === 'drafting' ? 'drafting' : 'pre_draft',
      startTime: new Date(draftInfo.start_time * 1000),
      picks: draftPicks,
      rounds: draftInfo.rounds || draftInfo.settings?.rounds || 15,
      secondsPerPick: draftInfo.settings?.pick_timer
    };
  }

  /**
   * Parse transactions
   */
  private parseTransactions(transactionsData: any[], leagueId: string, week: number): Transaction[] {
    return transactionsData.map(trans => {
      const transaction: Transaction = {
        id: `sleeper_${trans.transaction_id}`,
        leagueId,
        type: this.mapTransactionType(trans.type),
        status: trans.status === 'complete' ? 'executed' : 'pending',
        teams: [],
        players: [],
        proposedDate: new Date(trans.created),
        processedDate: trans.status_updated ? new Date(trans.status_updated) : undefined,
        bidAmount: trans.settings?.waiver_bid
      };

      // Parse adds
      if (trans.adds) {
        Object.entries(trans.adds).forEach(([playerId, rosterId]) => {
          transaction.players.push({
            playerId,
            playerName: '', // Would need player lookup
            action: 'add',
            toTeamId: String(rosterId)
          });

          if (!transaction.teams.includes(String(rosterId))) {
            transaction.teams.push(String(rosterId));
          }
        });
      }

      // Parse drops
      if (trans.drops) {
        Object.entries(trans.drops).forEach(([playerId, rosterId]) => {
          transaction.players.push({
            playerId,
            playerName: '', // Would need player lookup
            action: 'drop',
            fromTeamId: String(rosterId)
          });

          if (!transaction.teams.includes(String(rosterId))) {
            transaction.teams.push(String(rosterId));
          }
        });
      }

      // Parse trades
      if (trans.type === 'trade' && trans.roster_ids) {
        trans.roster_ids.forEach((rosterId: number) => {
          if (!transaction.teams.includes(String(rosterId))) {
            transaction.teams.push(String(rosterId));
          }
        });
      }

      return transaction;
    });
  }

  /**
   * Map Sleeper transaction type
   */
  private mapTransactionType(type: string): 'waiver' | 'trade' | 'freeagent' | 'drop' {
    const typeMap: Record<string, any> = {
      'waiver': 'waiver',
      'trade': 'trade',
      'free_agent': 'freeagent',
      'free agent': 'freeagent'
    };

    return typeMap[type] || 'freeagent';
  }

  /**
   * Parse matchups
   */
  private parseMatchups(matchupsData: any[], leagueId: string, week: number): Matchup[] {
    const matchups: Matchup[] = [];
    const matchupMap = new Map<number, any[]>();

    // Group by matchup_id
    matchupsData.forEach(matchup => {
      const matchupId = matchup.matchup_id;
      if (!matchupMap.has(matchupId)) {
        matchupMap.set(matchupId, []);
      }
      matchupMap.get(matchupId)!.push(matchup);
    });

    // Create matchup objects
    let matchupIndex = 0;
    matchupMap.forEach((teams, matchupId) => {
      if (teams.length === 2) {
        const [team1, team2] = teams;
        
        matchups.push({
          id: `sleeper_${leagueId}_w${week}_m${matchupIndex}`,
          leagueId,
          week,
          team1Id: String(team1.roster_id),
          team2Id: String(team2.roster_id),
          team1Score: team1.points || 0,
          team2Score: team2.points || 0,
          team1Projection: team1.points_decimal || 0,
          team2Projection: team2.points_decimal || 0,
          winnerId: this.determineWinner(team1, team2),
          status: this.determineMatchupStatus(week),
          startDate: new Date(), // Would need actual date
          endDate: new Date(), // Would need actual date
          isPlayoffs: false, // Would need to determine from league settings
          isConsolation: false // Would need to determine from league settings
        });
        
        matchupIndex++;
      }
    });

    return matchups;
  }

  /**
   * Determine matchup winner
   */
  private determineWinner(team1: any, team2: any): string | undefined {
    if (!team1.points || !team2.points) return undefined;
    
    if (team1.points > team2.points) {
      return String(team1.roster_id);
    } else if (team2.points > team1.points) {
      return String(team2.roster_id);
    }
    
    return undefined; // Tie
  }

  /**
   * Determine matchup status based on week
   */
  private determineMatchupStatus(week: number): 'scheduled' | 'in_progress' | 'final' {
    // This would need actual game schedule data
    // For now, assume past weeks are final
    const currentWeek = new Date().getDay() === 0 ? 
      Math.ceil((Date.now() - new Date('2024-09-05').getTime()) / (7 * 24 * 60 * 60 * 1000)) : 
      Math.floor((Date.now() - new Date('2024-09-05').getTime()) / (7 * 24 * 60 * 60 * 1000));
    
    if (week < currentWeek) return 'final';
    if (week === currentWeek) return 'in_progress';
    return 'scheduled';
  }
}
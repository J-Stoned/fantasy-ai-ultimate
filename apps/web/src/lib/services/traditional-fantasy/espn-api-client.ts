/**
 * ESPN Fantasy Sports API Client
 * Handles all interactions with ESPN Fantasy API
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
  WaiverType
} from './types';
import { AuthManager } from './auth-manager';
import {
import { logger } from '../../logging/logger';
  ESPNApiResponse,
  ESPNLeagueSettings,
  ESPNTeamData,
  ESPNMatchup,
  ESPNDraftDetail,
  ESPNTopic,
  ESPNMessage,
  ESPNScoringItem,
  ESPNRosterEntry,
  ESPNPlayerData,
  ESPNMember,
  ESPNPositionInfo,
  ESPNDraftPick,
  ESPNMatchupTeam,
  ESPNTeamRecord
} from '../../../types/external-apis';

export class ESPNApiClient implements PlatformApiClient {
  private readonly baseUrl = 'https://fantasy.espn.com/apis/v3/games';
  private readonly platform = 'espn' as const;
  private authManager: AuthManager;
  
  // ESPN sport endpoints
  private readonly sportEndpoints: Record<SportType, string> = {
    nfl: 'ffl',
    nba: 'fba',
    mlb: 'flb',
    nhl: 'fhl'
  };

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
  }

  /**
   * Authenticate with ESPN (using cookies)
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthCredentials> {
    // ESPN uses cookie-based auth handled by AuthManager
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

    // Fetch leagues for each sport
    for (const [sport, endpoint] of Object.entries(this.sportEndpoints)) {
      try {
        const url = `${this.baseUrl}/${endpoint}/seasons/${currentYear}/segments/0/leagues?view=mTeam&view=mSettings`;
        const response = await this.makeRequest(url, credentials);
        
        if (response.ok) {
          const data = await response.json();
          const sportLeagues = this.parseLeagues(data, sport as SportType);
          leagues.push(...sportLeagues);
        }
      } catch (error) {
        logger.warn('Failed to fetch ${sport} leagues:'error);
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
    const currentYear = new Date().getFullYear();
    const url = `${this.baseUrl}/${endpoint}/seasons/${currentYear}/segments/0/leagues/${numericId}?view=mSettings&view=mTeam&view=mRoster`;
    
    const response = await this.makeRequest(url, credentials);
    const data = await response.json();

    return this.parseLeague(data, sport);
  }

  /**
   * Get teams in a league
   */
  async getTeams(leagueId: string): Promise<Team[]> {
    const [sport, numericId, credentials] = await this.getLeagueContext(leagueId);
    
    const endpoint = this.sportEndpoints[sport];
    const currentYear = new Date().getFullYear();
    const url = `${this.baseUrl}/${endpoint}/seasons/${currentYear}/segments/0/leagues/${numericId}?view=mTeam&view=mRoster&view=mSettings`;
    
    const response = await this.makeRequest(url, credentials);
    const data = await response.json();

    return this.parseTeams(data);
  }

  /**
   * Get rosters for all teams
   */
  async getRosters(leagueId: string): Promise<Roster[]> {
    const [sport, numericId, credentials] = await this.getLeagueContext(leagueId);
    
    const endpoint = this.sportEndpoints[sport];
    const currentYear = new Date().getFullYear();
    const url = `${this.baseUrl}/${endpoint}/seasons/${currentYear}/segments/0/leagues/${numericId}?view=mRoster&view=kona_player_info`;
    
    const response = await this.makeRequest(url, credentials);
    const data = await response.json();

    return this.parseRosters(data);
  }

  /**
   * Get draft results
   */
  async getDraftData(leagueId: string): Promise<DraftInfo> {
    const [sport, numericId, credentials] = await this.getLeagueContext(leagueId);
    
    const endpoint = this.sportEndpoints[sport];
    const currentYear = new Date().getFullYear();
    const url = `${this.baseUrl}/${endpoint}/seasons/${currentYear}/segments/0/leagues/${numericId}?view=mDraftDetail`;
    
    const response = await this.makeRequest(url, credentials);
    const data = await response.json();

    return this.parseDraftData(data, leagueId);
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
    const currentYear = new Date().getFullYear();
    
    // ESPN uses topics for different transaction types
    const topics = options?.types?.map(type => {
      const topicMap: Record<string, string> = {
        'waiver': 'WAIVER',
        'trade': 'TRADE',
        'freeagent': 'FREEAGENT',
        'drop': 'DROP_PLAYER'
      };
      return topicMap[type];
    }).filter(Boolean);

    let url = `${this.baseUrl}/${endpoint}/seasons/${currentYear}/segments/0/leagues/${numericId}/communication?view=kona_league_communication`;
    
    if (topics && topics.length > 0) {
      url += `&topics=${topics.join(',')}`;
    }

    const response = await this.makeRequest(url, credentials);
    const data = await response.json();

    return this.parseTransactions(data, leagueId);
  }

  /**
   * Get matchups for a week
   */
  async getMatchups(leagueId: string, week?: number): Promise<Matchup[]> {
    const [sport, numericId, credentials] = await this.getLeagueContext(leagueId);
    
    const endpoint = this.sportEndpoints[sport];
    const currentYear = new Date().getFullYear();
    
    // If no week specified, get current scoring period
    const scoringPeriod = week || await this.getCurrentScoringPeriod(sport, numericId, credentials);
    
    const url = `${this.baseUrl}/${endpoint}/seasons/${currentYear}/segments/0/leagues/${numericId}?view=mMatchup&view=mMatchupScore&scoringPeriodId=${scoringPeriod}`;
    
    const response = await this.makeRequest(url, credentials);
    const data = await response.json();

    return this.parseMatchups(data, leagueId, scoringPeriod);
  }

  /**
   * Get player stats
   */
  async getPlayerStats(playerId: string, options?: StatsOptions): Promise<PlayerStats> {
    // ESPN player stats are typically retrieved through league context
    throw new Error('Player stats must be retrieved through league context in ESPN API');
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
      const url = `${this.baseUrl}/ffl/seasons/2024`;
      const response = await this.makeRequest(url, credentials);
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Make authenticated request to ESPN API
   */
  private async makeRequest(url: string, credentials: AuthCredentials): Promise<Response> {
    const headers = this.authManager.getAuthHeaders(credentials);
    headers['Accept'] = 'application/json';
    headers['Content-Type'] = 'application/json';
    
    // ESPN specific headers
    headers['X-Fantasy-Source'] = 'kona';

    const response = await fetch(url, { 
      headers,
      credentials: 'include' // Important for cookie-based auth
    });

    if (!response.ok && response.status !== 401) {
      const errorText = await response.text();
      throw new Error(`ESPN API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response;
  }

  /**
   * Get league context
   */
  private async getLeagueContext(leagueId: string): Promise<[SportType, string, AuthCredentials]> {
    // ESPN league IDs are formatted as "sport_numericId" (e.g., "nfl_12345")
    const [sport, numericId] = leagueId.split('_');
    
    const credentials = Array.from(this.authManager['credentials'].values())
      .find(c => c.platform === this.platform);
    
    if (!credentials) {
      throw new Error('No credentials found');
    }

    return [sport as SportType, numericId, credentials];
  }

  /**
   * Get current scoring period
   */
  private async getCurrentScoringPeriod(
    sport: SportType,
    leagueId: string,
    credentials: AuthCredentials
  ): Promise<number> {
    const endpoint = this.sportEndpoints[sport];
    const currentYear = new Date().getFullYear();
    const url = `${this.baseUrl}/${endpoint}/seasons/${currentYear}/segments/0/leagues/${leagueId}?view=mSettings`;
    
    const response = await this.makeRequest(url, credentials);
    const data = await response.json();

    return data.status.currentMatchupPeriod || 1;
  }

  /**
   * Parse leagues from ESPN response
   */
  private parseLeagues(data: ESPNApiResponse[] | unknown, sport: SportType): League[] {
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((leagueData: ESPNApiResponse) => this.parseLeague(leagueData, sport));
  }

  /**
   * Parse single league data
   */
  private parseLeague(data: ESPNApiResponse, sport: SportType): League {
    const settings = data.settings;
    
    return {
      id: `espn_${sport}_${data.id}`,
      platform: 'espn',
      platformLeagueId: String(data.id),
      name: settings.name,
      season: data.seasonId,
      sport,
      isActive: data.status.isActive,
      settings: {
        scoringSystem: {
          type: this.determineScoringType(settings),
          scoringItems: this.parseScoringItems(settings.scoringSettings)
        },
        rosterPositions: this.parseRosterPositions(settings.rosterSettings),
        waiverType: this.parseWaiverType(settings.acquisitionSettings),
        tradeDeadline: settings.tradeSettings?.deadlineDate ? 
          new Date(settings.tradeSettings.deadlineDate) : undefined,
        playoffStartWeek: settings.scheduleSettings?.playoffMatchupPeriodCount || 0,
        maxTeams: settings.size,
        draftType: settings.draftSettings?.type === 'SNAKE' ? 'snake' : 'auction',
        scoringPeriod: 'weekly'
      },
      teams: [],
      currentWeek: data.status.currentMatchupPeriod,
      totalWeeks: settings.scheduleSettings?.matchupPeriodCount || 17,
      playoffWeeks: this.getPlayoffWeeks(settings.scheduleSettings),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Determine scoring type from settings
   */
  private determineScoringType(settings: ESPNLeagueSettings): string {
    if (settings.scoringType === 'H2H_POINTS') {
      return 'h2h_points';
    } else if (settings.scoringType === 'H2H_CATEGORY') {
      return 'h2h_category';
    } else if (settings.scoringType === 'ROTO') {
      return 'roto';
    }
    return 'points';
  }

  /**
   * Parse scoring items
   */
  private parseScoringItems(scoringSettings: { scoringItems?: ESPNScoringItem[] } | undefined): ScoringItem[] {
    if (!scoringSettings?.scoringItems) {
      return [];
    }

    return scoringSettings.scoringItems.map((item: ESPNScoringItem) => ({
      statId: String(item.statId),
      statName: this.getStatName(item.statId),
      points: item.pointsOverrides?.[0]?.points || item.points || 0,
      isDecimal: true
    }));
  }

  /**
   * Get stat name from ESPN stat ID
   */
  private getStatName(statId: number): string {
    // Common ESPN stat IDs
    const statMap: Record<number, string> = {
      1: 'Passing Yards',
      2: 'Passing TDs',
      3: 'Passing INTs',
      24: 'Rushing Yards',
      25: 'Rushing TDs',
      42: 'Receiving Yards',
      43: 'Receiving TDs',
      53: 'Receptions',
      // Add more as needed
    };

    return statMap[statId] || `Stat ${statId}`;
  }

  /**
   * Parse roster positions
   */
  private parseRosterPositions(rosterSettings: { lineupSlotCounts?: Record<string, number> } | undefined): RosterPosition[] {
    if (!rosterSettings?.lineupSlotCounts) {
      return [];
    }

    return Object.entries(rosterSettings.lineupSlotCounts).map(([slotId, count]) => {
      const position = this.getPositionFromSlotId(parseInt(slotId));
      return {
        position: position.name,
        abbreviation: position.abbrev,
        count: count as number,
        isActive: position.isActive,
        isFlex: position.isFlex,
        eligiblePositions: position.eligible
      };
    });
  }

  /**
   * Get position info from ESPN slot ID
   */
  private getPositionFromSlotId(slotId: number): ESPNPositionInfo {
    const positionMap: Record<number, ESPNPositionInfo> = {
      0: { name: 'QB', abbrev: 'QB', isActive: true, isFlex: false, eligible: ['QB'] },
      2: { name: 'RB', abbrev: 'RB', isActive: true, isFlex: false, eligible: ['RB'] },
      4: { name: 'WR', abbrev: 'WR', isActive: true, isFlex: false, eligible: ['WR'] },
      6: { name: 'TE', abbrev: 'TE', isActive: true, isFlex: false, eligible: ['TE'] },
      16: { name: 'D/ST', abbrev: 'DST', isActive: true, isFlex: false, eligible: ['DST'] },
      17: { name: 'K', abbrev: 'K', isActive: true, isFlex: false, eligible: ['K'] },
      20: { name: 'Bench', abbrev: 'BE', isActive: false, isFlex: false, eligible: [] },
      21: { name: 'IR', abbrev: 'IR', isActive: false, isFlex: false, eligible: [] },
      23: { name: 'Flex', abbrev: 'FLEX', isActive: true, isFlex: true, eligible: ['RB', 'WR', 'TE'] },
      // Add more positions as needed
    };

    return positionMap[slotId] || { 
      name: `Position ${slotId}`, 
      abbrev: `P${slotId}`, 
      isActive: true, 
      isFlex: false,
      eligible: []
    };
  }

  /**
   * Parse waiver type
   */
  private parseWaiverType(acquisitionSettings: { acquisitionType?: string; isUsingAcquisitionBudget?: boolean } | undefined): WaiverType {
    if (acquisitionSettings?.acquisitionType === 'WAIVERS_TRADITIONAL') {
      return 'standard';
    } else if (acquisitionSettings?.acquisitionType === 'WAIVERS_CONTINUOUS') {
      return 'continuous';
    } else if (acquisitionSettings?.isUsingAcquisitionBudget) {
      return 'faab';
    }
    return 'none';
  }

  /**
   * Get playoff weeks
   */
  private getPlayoffWeeks(scheduleSettings: { playoffMatchupPeriodCount?: number; matchupPeriodCount?: number } | undefined): number[] {
    if (!scheduleSettings?.playoffMatchupPeriodCount || !scheduleSettings?.matchupPeriodCount) {
      return [];
    }

    const playoffWeeks: number[] = [];
    const regularSeasonWeeks = scheduleSettings.matchupPeriodCount - scheduleSettings.playoffMatchupPeriodCount;
    
    for (let i = 1; i <= scheduleSettings.playoffMatchupPeriodCount; i++) {
      playoffWeeks.push(regularSeasonWeeks + i);
    }

    return playoffWeeks;
  }

  /**
   * Parse teams data
   */
  private parseTeams(data: ESPNApiResponse): Team[] {
    if (!data.teams) {
      return [];
    }

    return data.teams.map((teamData: ESPNTeamData) => ({
      id: `espn_${teamData.id}`,
      platformTeamId: String(teamData.id),
      leagueId: String(data.id),
      name: `${teamData.location} ${teamData.nickname}`.trim(),
      abbreviation: teamData.abbrev,
      logoUrl: teamData.logo,
      ownerId: teamData.primaryOwner,
      ownerName: data.members?.find((m: ESPNMember) => m.id === teamData.primaryOwner)?.displayName || '','
      standing: this.parseStanding(teamData),
      roster: { teamId: `espn_${teamData.id}`, players: [] },
      draftGrade: teamData.draftDayProjectedRank ? String(teamData.draftDayProjectedRank) : undefined,
      projectedRank: teamData.currentProjectedRank,
      currentRank: teamData.playoffSeed || teamData.rankCalculatedFinal
    }));
  }

  /**
   * Parse team standing
   */
  private parseStanding(teamData: ESPNTeamData): TeamStanding {
    const record = teamData.record?.overall || {};
    
    return {
      rank: teamData.playoffSeed || teamData.rankCalculatedFinal || 0,
      wins: record.wins || 0,
      losses: record.losses || 0,
      ties: record.ties || 0,
      points: record.pointsFor || 0,
      pointsAgainst: record.pointsAgainst || 0,
      streakType: record.streakType as 'W' | 'L' | 'T',
      streakLength: record.streakLength || 0
    };
  }

  /**
   * Parse rosters data
   */
  private parseRosters(data: ESPNApiResponse): Roster[] {
    if (!data.teams) {
      return [];
    }

    return data.teams.map((teamData: ESPNTeamData) => {
      const roster: Roster = {
        teamId: String(teamData.id),
        players: [],
        startingLineup: [],
        benchPlayers: [],
        injuredReserve: []
      };

      if (teamData.roster?.entries) {
        teamData.roster.entries.forEach((entry: ESPNRosterEntry) => {
          const player = this.parsePlayer(entry, data.players);
          roster.players.push(player);

          // Categorize by lineup slot
          if (entry.lineupSlotId === 20) {
            roster.benchPlayers!.push(player.id);
          } else if (entry.lineupSlotId === 21) {
            roster.injuredReserve!.push(player.id);
          } else {
            roster.startingLineup!.push(player.id);
          }
        });
      }

      return roster;
    });
  }

  /**
   * Parse player data
   */
  private parsePlayer(entry: ESPNRosterEntry, playersPool: ESPNPlayerData[] | undefined): RosterPlayer {
    const playerData = playersPool?.find(p => p.id === entry.playerId) || {};
    const player = playerData.player || {};
    
    return {
      id: `espn_${entry.playerId}`,
      platformPlayerId: String(entry.playerId),
      name: player.fullName || '',
      position: player.defaultPositionId ? this.getPositionFromId(player.defaultPositionId) : '',
      eligiblePositions: player.eligibleSlots?.map((slotId: number) => 
        this.getPositionFromSlotId(slotId).abbrev
      ) || [],
      team: player.proTeamId ? this.getTeamAbbreviation(player.proTeamId) : '',
      status: {
        isActive: entry.lineupSlotId !== 20 && entry.lineupSlotId !== 21,
        isStarting: entry.lineupSlotId < 20,
        positionType: this.getPositionTypeFromSlot(entry.lineupSlotId)
      },
      injuryStatus: player.injuryStatus ? {
        status: this.mapInjuryStatus(player.injuryStatus),
        description: player.injuryStatus
      } : undefined,
      stats: {
        season: entry.playerPoolEntry?.appliedStatTotal || 0,
        week: entry.playerPoolEntry?.appliedStats || {}
      },
      acquisitionInfo: entry.acquisitionType ? {
        type: this.mapAcquisitionType(entry.acquisitionType),
        date: new Date(entry.acquisitionDate)
      } : undefined
    };
  }

  /**
   * Get position from ESPN position ID
   */
  private getPositionFromId(positionId: number): string {
    const positionMap: Record<number, string> = {
      1: 'QB',
      2: 'RB',
      3: 'WR',
      4: 'TE',
      5: 'K',
      16: 'D/ST'
    };

    return positionMap[positionId] || 'Unknown';
  }

  /**
   * Get team abbreviation from ESPN team ID
   */
  private getTeamAbbreviation(teamId: number): string {
    // This would be a comprehensive mapping of ESPN team IDs to abbreviations
    const teamMap: Record<number, string> = {
      1: 'ATL',
      2: 'BUF',
      3: 'CHI',
      4: 'CIN',
      5: 'CLE',
      6: 'DAL',
      7: 'DEN',
      8: 'DET',
      9: 'GB',
      10: 'TEN',
      11: 'IND',
      12: 'KC',
      13: 'LV',
      14: 'LAR',
      15: 'MIA',
      16: 'MIN',
      17: 'NE',
      18: 'NO',
      19: 'NYG',
      20: 'NYJ',
      21: 'PHI',
      22: 'ARI',
      23: 'PIT',
      24: 'LAC',
      25: 'SF',
      26: 'SEA',
      27: 'TB',
      28: 'WSH',
      29: 'CAR',
      30: 'JAX',
      33: 'BAL',
      34: 'HOU'
    };

    return teamMap[teamId] || 'FA';
  }

  /**
   * Get position type from lineup slot
   */
  private getPositionTypeFromSlot(slotId: number): 'starter' | 'bench' | 'ir' | 'na' {
    if (slotId === 20) return 'bench';
    if (slotId === 21) return 'ir';
    if (slotId < 20) return 'starter';
    return 'na';
  }

  /**
   * Map ESPN injury status
   */
  private mapInjuryStatus(status: string): 'healthy' | 'questionable' | 'doubtful' | 'out' | 'ir' {
    const statusMap: Record<string, 'healthy' | 'questionable' | 'doubtful' | 'out' | 'ir'> = {
      'ACTIVE': 'healthy',
      'QUESTIONABLE': 'questionable',
      'DOUBTFUL': 'doubtful',
      'OUT': 'out',
      'INJURY_RESERVE': 'ir',
      'SUSPENSION': 'out'
    };

    return statusMap[status] || 'healthy';
  }

  /**
   * Map acquisition type
   */
  private mapAcquisitionType(type: string): 'draft' | 'waiver' | 'trade' | 'freeagent' {
    const typeMap: Record<string, 'draft' | 'waiver' | 'trade' | 'freeagent'> = {
      'DRAFT': 'draft',
      'ADD': 'freeagent',
      'WAIVER': 'waiver',
      'TRADE': 'trade'
    };

    return typeMap[type] || 'freeagent';
  }

  /**
   * Parse draft data
   */
  private parseDraftData(data: ESPNApiResponse, leagueId: string): DraftInfo {
    const draft = data.draftDetail || {};
    const picks: DraftPick[] = [];

    if (draft.picks) {
      draft.picks.forEach((pick: ESPNDraftPick) => {
        picks.push({
          round: pick.roundId,
          pick: pick.roundPickNumber,
          overallPick: pick.overallPickNumber,
          teamId: String(pick.teamId),
          playerId: String(pick.playerId),
          playerName: '', // Would need player lookup
          position: '', // Would need player lookup
          keeperRound: pick.keeper ? pick.keeperRoundId : undefined,
          auctionValue: pick.bidAmount,
          timestamp: new Date(pick.timestamp)
        });
      });
    }

    return {
      id: `espn_draft_${leagueId}`,
      leagueId,
      type: draft.type === 'SNAKE' ? 'snake' : 'auction',
      status: draft.completeDate ? 'post_draft' : 'pre_draft',
      startTime: new Date(draft.startTime),
      picks,
      rounds: draft.rounds || 15
    };
  }

  /**
   * Parse transactions
   */
  private parseTransactions(data: ESPNApiResponse, leagueId: string): Transaction[] {
    if (!data.topics) {
      return [];
    }

    const transactions: Transaction[] = [];

    data.topics.forEach((topic: ESPNTopic) => {
      topic.messages?.forEach((message: ESPNMessage) => {
        if (message.messageTypeId === 178 || message.messageTypeId === 180) { // Transaction messages
          const transaction: Transaction = {
            id: `espn_${topic.id}_${message.id}`,
            leagueId,
            type: this.mapTopicToTransactionType(topic.type),
            status: 'executed',
            teams: [],
            players: [],
            proposedDate: new Date(message.date),
            processedDate: new Date(message.date)
          };

          // Parse transaction details from message
          if (message.for) {
            message.for.forEach((playerId: number) => {
              transaction.players.push({
                playerId: String(playerId),
                playerName: '', // Would need player lookup
                action: 'add',
                toTeamId: String(message.to)
              });
            });
          }

          if (message.for2) {
            message.for2.forEach((playerId: number) => {
              transaction.players.push({
                playerId: String(playerId),
                playerName: '', // Would need player lookup
                action: 'drop',
                fromTeamId: String(message.from || message.to)
              });
            });
          }

          // Add teams
          if (message.to && !transaction.teams.includes(String(message.to))) {
            transaction.teams.push(String(message.to));
          }
          if (message.from && !transaction.teams.includes(String(message.from))) {
            transaction.teams.push(String(message.from));
          }

          transactions.push(transaction);
        }
      });
    });

    return transactions;
  }

  /**
   * Map topic type to transaction type
   */
  private mapTopicToTransactionType(topicType: string): 'waiver' | 'trade' | 'freeagent' | 'drop' {
    const typeMap: Record<string, 'waiver' | 'trade' | 'freeagent' | 'drop'> = {
      'WAIVER': 'waiver',
      'TRADE': 'trade',
      'FREEAGENT': 'freeagent',
      'DROP_PLAYER': 'drop'
    };

    return typeMap[topicType] || 'freeagent';
  }

  /**
   * Parse matchups
   */
  private parseMatchups(data: ESPNApiResponse, leagueId: string, week: number): Matchup[] {
    const matchups: Matchup[] = [];
    const schedule = data.schedule || [];

    // Filter for the specific week
    const weekMatchups = schedule.filter((m: ESPNMatchup) => m.matchupPeriodId === week);

    weekMatchups.forEach((matchupData: ESPNMatchup, index: number) => {
      // Skip bye weeks
      if (!matchupData.away) {
        return;
      }

      const matchup: Matchup = {
        id: `espn_${leagueId}_w${week}_m${index}`,
        leagueId,
        week,
        team1Id: String(matchupData.home.teamId),
        team2Id: String(matchupData.away.teamId),
        team1Score: matchupData.home.totalPoints || 0,
        team2Score: matchupData.away.totalPoints || 0,
        team1Projection: matchupData.home.totalProjectedPoints || 0,
        team2Projection: matchupData.away.totalProjectedPoints || 0,
        winnerId: matchupData.winner === 'HOME' ? String(matchupData.home.teamId) : 
                 matchupData.winner === 'AWAY' ? String(matchupData.away.teamId) : undefined,
        status: this.getMatchupStatus(matchupData),
        startDate: new Date(), // Would need actual date
        endDate: new Date(), // Would need actual date
        isPlayoffs: matchupData.playoffTierType === 'WINNERS_BRACKET',
        isConsolation: matchupData.playoffTierType === 'LOSERS_BRACKET'
      };

      matchups.push(matchup);
    });

    return matchups;
  }

  /**
   * Get matchup status
   */
  private getMatchupStatus(matchupData: ESPNMatchup): 'scheduled' | 'in_progress' | 'final' {
    if (matchupData.winner) {
      return 'final';
    } else if (matchupData.home.totalPointsLive || matchupData.away.totalPointsLive) {
      return 'in_progress';
    }
    return 'scheduled';
  }
}
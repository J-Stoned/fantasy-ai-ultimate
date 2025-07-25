/**
 * Data Normalizer for Fantasy Platform APIs
 * Converts platform-specific data into a unified format
 */

import {
  League,
  Team,
  Roster,
  RosterPlayer,
  DraftInfo,
  Transaction,
  Matchup,
  FantasyPlatform,
  SportType,
  PlayerStats,
  InjuryStatus,
  TeamStanding,
  ScoringSystem,
  RosterPosition,
  LeagueSettings,
  RawLeagueData,
  RawTeamData,
  RawRosterData,
  RawPlayerData,
  RawInjuryData,
  RawDraftData,
  RawTransactionData,
  RawMatchupData,
  RawPositionData
} from './types';

export class DataNormalizer {
  /**
   * Normalize league data from any platform
   */
  async normalizeLeague(league: RawLeagueData, platform: FantasyPlatform): Promise<League> {
    // League data should already be in normalized format from API clients
    // This method ensures consistency and adds any missing fields
    
    const normalized: League = {
      id: league.id || this.generateLeagueId(platform, league),
      platform,
      platformLeagueId: league.platformLeagueId || league.league_id || league.id,
      name: league.name || 'Unnamed League',
      season: league.season || new Date().getFullYear(),
      sport: (league.sport as SportType) || this.detectSport(league),
      isActive: league.isActive ?? true,
      settings: await this.normalizeLeagueSettings(league.settings, platform),
      teams: league.teams || [],
      draftInfo: league.draftInfo,
      currentWeek: league.currentWeek || 1,
      totalWeeks: league.totalWeeks || 17,
      playoffWeeks: league.playoffWeeks || [],
      createdAt: league.createdAt || new Date(),
      updatedAt: league.updatedAt || new Date()
    };

    return normalized;
  }

  /**
   * Normalize league settings
   */
  private async normalizeLeagueSettings(settings: Record<string, unknown> | undefined, platform: FantasyPlatform): Promise<LeagueSettings> {
    return {
      scoringSystem: (settings?.scoringSystem as ScoringSystem) || { type: 'points', scoringItems: [] },
      rosterPositions: this.normalizeRosterPositions((settings?.rosterPositions as RawPositionData[]) || []),
      waiverType: (settings?.waiverType as 'standard' | 'faab' | 'continuous' | 'none') || 'standard',
      tradeDeadline: settings?.tradeDeadline as Date | undefined,
      playoffStartWeek: settings?.playoffStartWeek as number | undefined,
      maxTeams: (settings?.maxTeams as number) || 10,
      draftType: (settings?.draftType as 'snake' | 'auction' | 'linear' | 'keeper' | 'dynasty') || 'snake',
      scoringPeriod: (settings?.scoringPeriod as 'weekly' | 'daily') || 'weekly',
      categories: settings?.categories as string[] | undefined
    };
  }

  /**
   * Normalize roster positions
   */
  private normalizeRosterPositions(positions: RawPositionData[]): RosterPosition[] {
    return positions.map(pos => ({
      position: pos.position || pos.name,
      abbreviation: pos.abbreviation || pos.position || pos.name,
      count: pos.count || 1,
      isActive: pos.isActive ?? true,
      isFlex: pos.isFlex || false,
      eligiblePositions: pos.eligiblePositions || [pos.position || pos.name]
    }));
  }

  /**
   * Normalize team data
   */
  async normalizeTeam(team: RawTeamData, platform: FantasyPlatform): Promise<Team> {
    const normalized: Team = {
      id: team.id || this.generateTeamId(platform, team),
      platformTeamId: team.platformTeamId || team.team_id || team.id,
      leagueId: team.leagueId || team.league_id,
      name: team.name || team.teamName || 'Unnamed Team',
      abbreviation: team.abbreviation || team.abbrev,
      logoUrl: team.logoUrl || team.logo || team.avatar,
      ownerId: team.ownerId || team.owner_id || team.userId,
      ownerName: team.ownerName || team.owner_name || team.userName || '',
      standing: team.standing || await this.createDefaultStanding(),
      roster: team.roster || { teamId: team.id, players: [] },
      draftGrade: team.draftGrade,
      projectedRank: team.projectedRank,
      currentRank: team.currentRank || team.standing?.rank
    };

    return normalized;
  }

  /**
   * Create default standing
   */
  private async createDefaultStanding(): Promise<TeamStanding> {
    return {
      rank: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      points: 0,
      pointsAgainst: 0
    };
  }

  /**
   * Normalize roster data
   */
  async normalizeRoster(roster: RawRosterData, platform: FantasyPlatform): Promise<Roster> {
    const normalized: Roster = {
      teamId: roster.teamId || roster.team_id,
      players: await Promise.all(
        (roster.players || []).map((player: RawPlayerData) => 
          this.normalizePlayer(player, platform)
        )
      ),
      startingLineup: roster.startingLineup || [],
      benchPlayers: roster.benchPlayers || [],
      injuredReserve: roster.injuredReserve || []
    };

    // If lineup arrays are empty, categorize players
    if (normalized.startingLineup.length === 0 && normalized.players.length > 0) {
      normalized.players.forEach(player => {
        if (player.status.positionType === 'starter') {
          normalized.startingLineup!.push(player.id);
        } else if (player.status.positionType === 'bench') {
          normalized.benchPlayers!.push(player.id);
        } else if (player.status.positionType === 'ir') {
          normalized.injuredReserve!.push(player.id);
        }
      });
    }

    return normalized;
  }

  /**
   * Normalize player data
   */
  async normalizePlayer(player: RawPlayerData, platform: FantasyPlatform): Promise<RosterPlayer> {
    const normalized: RosterPlayer = {
      id: player.id || this.generatePlayerId(platform, player),
      platformPlayerId: player.platformPlayerId || player.player_id || player.id,
      name: player.name || player.playerName || player.fullName || 'Unknown Player',
      position: player.position || player.primaryPosition || 'Unknown',
      eligiblePositions: player.eligiblePositions || [player.position] || [],
      team: player.team || player.proTeam || player.nflTeam || 'FA',
      status: {
        isActive: player.status?.isActive ?? true,
        isStarting: player.status?.isStarting ?? false,
        positionType: player.status?.positionType || 'bench'
      },
      injuryStatus: player.injuryStatus || await this.normalizeInjuryStatus(player),
      stats: player.stats || await this.normalizePlayerStats(player),
      projectedStats: player.projectedStats,
      acquisitionInfo: player.acquisitionInfo,
      imageUrl: player.imageUrl || player.photo || player.headshot
    };

    return normalized;
  }

  /**
   * Normalize injury status
   */
  private async normalizeInjuryStatus(player: RawPlayerData): Promise<InjuryStatus | undefined> {
    if (!player.injury && !player.injuryStatus) {
      return undefined;
    }

    const injury = player.injury || player.injuryStatus || {};
    
    return {
      status: this.mapInjuryStatus(injury.status || injury.designation || 'healthy'),
      description: injury.description || injury.details || injury.bodyPart,
      returnDate: injury.returnDate ? new Date(injury.returnDate) : undefined
    };
  }

  /**
   * Map various injury status formats to our standard
   */
  private mapInjuryStatus(status: string): 'healthy' | 'questionable' | 'doubtful' | 'out' | 'ir' {
    const normalized = status.toLowerCase();
    
    if (normalized.includes('question') || normalized === 'q') {
      return 'questionable';
    } else if (normalized.includes('doubt') || normalized === 'd') {
      return 'doubtful';
    } else if (normalized.includes('out') || normalized === 'o') {
      return 'out';
    } else if (normalized.includes('ir') || normalized.includes('injured reserve')) {
      return 'ir';
    }
    
    return 'healthy';
  }

  /**
   * Normalize player stats
   */
  private async normalizePlayerStats(player: RawPlayerData): Promise<PlayerStats | undefined> {
    if (!player.stats && !player.statistics) {
      return undefined;
    }

    const stats = player.stats || player.statistics || {};
    
    return {
      season: stats.season || stats.seasonStats,
      week: stats.week || stats.weekStats,
      projections: stats.projections || stats.projected
    };
  }

  /**
   * Normalize draft info
   */
  async normalizeDraftInfo(draft: RawDraftData, platform: FantasyPlatform): Promise<DraftInfo> {
    const normalized: DraftInfo = {
      id: draft.id || this.generateDraftId(platform, draft),
      leagueId: draft.leagueId || draft.league_id,
      type: (draft.type as 'snake' | 'auction' | 'linear' | 'keeper' | 'dynasty') || 'snake',
      status: (draft.status as 'pre_draft' | 'drafting' | 'post_draft' | 'paused') || 'post_draft',
      startTime: draft.startTime ? new Date(draft.startTime) : new Date(),
      picks: (draft.picks || []) as DraftPick[],
      rounds: draft.rounds || 15,
      secondsPerPick: draft.secondsPerPick
    };

    // Ensure picks are properly formatted
    normalized.picks = normalized.picks.map((pick: DraftPick) => ({
      round: pick.round || 1,
      pick: pick.pick || 1,
      overallPick: pick.overallPick || ((pick.round - 1) * 10 + pick.pick),
      teamId: pick.teamId || pick.team_id,
      playerId: pick.playerId || pick.player_id,
      playerName: pick.playerName || pick.player_name || '',
      position: pick.position || '',
      keeperRound: pick.keeperRound,
      auctionValue: pick.auctionValue,
      timestamp: pick.timestamp ? new Date(pick.timestamp) : new Date()
    }));

    return normalized;
  }

  /**
   * Normalize transaction data
   */
  async normalizeTransaction(transaction: RawTransactionData, platform: FantasyPlatform): Promise<Transaction> {
    const normalized: Transaction = {
      id: transaction.id || this.generateTransactionId(platform, transaction),
      leagueId: transaction.leagueId || transaction.league_id,
      type: (transaction.type as 'waiver' | 'trade' | 'freeagent' | 'drop') || 'freeagent',
      status: (transaction.status as 'pending' | 'approved' | 'rejected' | 'executed' | 'cancelled') || 'executed',
      teams: transaction.teams || [],
      players: (transaction.players || []) as TransactionPlayer[],
      proposedDate: transaction.proposedDate ? new Date(transaction.proposedDate) : new Date(),
      processedDate: transaction.processedDate ? new Date(transaction.processedDate) : undefined,
      effectiveDate: transaction.effectiveDate ? new Date(transaction.effectiveDate) : undefined,
      bidAmount: transaction.bidAmount,
      priority: transaction.priority
    };

    // Ensure players are properly formatted
    normalized.players = normalized.players.map((player: TransactionPlayer) => ({
      playerId: player.playerId || player.player_id,
      playerName: player.playerName || player.player_name || '',
      action: player.action || 'add',
      fromTeamId: player.fromTeamId || player.from_team_id,
      toTeamId: player.toTeamId || player.to_team_id
    }));

    return normalized;
  }

  /**
   * Normalize matchup data
   */
  async normalizeMatchup(matchup: RawMatchupData, platform: FantasyPlatform): Promise<Matchup> {
    const normalized: Matchup = {
      id: matchup.id || this.generateMatchupId(platform, matchup),
      leagueId: matchup.leagueId || matchup.league_id,
      week: matchup.week || matchup.matchupPeriod || 1,
      team1Id: matchup.team1Id || matchup.home_team_id || matchup.homeTeamId,
      team2Id: matchup.team2Id || matchup.away_team_id || matchup.awayTeamId,
      team1Score: matchup.team1Score ?? matchup.homeScore ?? 0,
      team2Score: matchup.team2Score ?? matchup.awayScore ?? 0,
      team1Projection: matchup.team1Projection ?? matchup.homeProjection ?? 0,
      team2Projection: matchup.team2Projection ?? matchup.awayProjection ?? 0,
      winnerId: matchup.winnerId || matchup.winner_id,
      status: (matchup.status as 'scheduled' | 'in_progress' | 'final') || 'scheduled',
      startDate: matchup.startDate ? new Date(matchup.startDate) : new Date(),
      endDate: matchup.endDate ? new Date(matchup.endDate) : new Date(),
      isPlayoffs: matchup.isPlayoffs || false,
      isConsolation: matchup.isConsolation || false
    };

    return normalized;
  }

  /**
   * Generate consistent IDs
   */
  private generateLeagueId(platform: FantasyPlatform, league: RawLeagueData): string {
    return `${platform}_${league.platformLeagueId || league.league_id || league.id}`;
  }

  private generateTeamId(platform: FantasyPlatform, team: RawTeamData): string {
    return `${platform}_${team.platformTeamId || team.team_id || team.id}`;
  }

  private generatePlayerId(platform: FantasyPlatform, player: RawPlayerData): string {
    return `${platform}_${player.platformPlayerId || player.player_id || player.id}`;
  }

  private generateDraftId(platform: FantasyPlatform, draft: RawDraftData): string {
    return `${platform}_draft_${draft.leagueId || draft.league_id}`;
  }

  private generateTransactionId(platform: FantasyPlatform, transaction: RawTransactionData): string {
    return `${platform}_trans_${transaction.transaction_id || Date.now()}`;
  }

  private generateMatchupId(platform: FantasyPlatform, matchup: RawMatchupData): string {
    return `${platform}_${matchup.leagueId}_w${matchup.week}_${matchup.matchup_id || Date.now()}`;
  }

  /**
   * Detect sport from league data
   */
  private detectSport(league: RawLeagueData): SportType {
    // Try to detect from various fields
    const sportIndicators = [
      league.sport,
      league.game_id,
      league.sport_type,
      league.league_type
    ].filter(Boolean).map(s => s.toString().toLowerCase());

    for (const indicator of sportIndicators) {
      if (indicator.includes('nfl') || indicator.includes('football')) {
        return 'nfl';
      } else if (indicator.includes('nba') || indicator.includes('basketball')) {
        return 'nba';
      } else if (indicator.includes('mlb') || indicator.includes('baseball')) {
        return 'mlb';
      } else if (indicator.includes('nhl') || indicator.includes('hockey')) {
        return 'nhl';
      }
    }

    // Default to NFL if unable to detect
    return 'nfl';
  }

  /**
   * Merge platform-specific data with normalized data
   */
  async mergeWithPlatformData<T>(normalized: T, platformData: Partial<T>): Promise<T & { platformSpecific: Partial<T> }> {
    // This allows platforms to add custom fields while maintaining normalized structure
    return {
      ...normalized,
      platformSpecific: platformData
    };
  }

  /**
   * Validate normalized data
   */
  async validateNormalizedData(data: unknown, type: string): Promise<boolean> {
    // Basic validation to ensure required fields are present
    if (!data || typeof data !== 'object') {
      return false;
    }
    
    const obj = data as Record<string, unknown>;
    
    switch (type) {
      case 'league':
        return !!(obj.id && obj.platform && obj.name && obj.sport);
      
      case 'team':
        return !!(obj.id && obj.leagueId && obj.name);
      
      case 'player':
        return !!(obj.id && obj.name && obj.position);
      
      case 'roster':
        return !!(obj.teamId && Array.isArray(obj.players));
      
      case 'draft':
        return !!(obj.id && obj.leagueId && Array.isArray(obj.picks));
      
      case 'transaction':
        return !!(obj.id && obj.leagueId && obj.type);
      
      case 'matchup':
        return !!(obj.id && obj.leagueId && obj.team1Id && obj.team2Id);
      
      default:
        return false;
    }
  }

  /**
   * Clean and sanitize data
   */
  async sanitizeData<T extends Record<string, unknown>>(data: T): Promise<T> {
    // Remove null/undefined values and clean strings
    const cleaned = {} as T;
    
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) {
        if (typeof value === 'string') {
          cleaned[key] = value.trim();
        } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          cleaned[key] = await this.sanitizeData(value);
        } else {
          cleaned[key] = value;
        }
      }
    }
    
    return cleaned;
  }
}
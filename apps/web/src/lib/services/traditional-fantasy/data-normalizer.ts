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
  RosterPosition
} from './types';

export class DataNormalizer {
  /**
   * Normalize league data from any platform
   */
  async normalizeLeague(league: any, platform: FantasyPlatform): Promise<League> {
    // League data should already be in normalized format from API clients
    // This method ensures consistency and adds any missing fields
    
    const normalized: League = {
      id: league.id || this.generateLeagueId(platform, league),
      platform,
      platformLeagueId: league.platformLeagueId || league.league_id || league.id,
      name: league.name || 'Unnamed League',
      season: league.season || new Date().getFullYear(),
      sport: league.sport || this.detectSport(league),
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
  private async normalizeLeagueSettings(settings: any, platform: FantasyPlatform): Promise<any> {
    return {
      scoringSystem: settings.scoringSystem || { type: 'points', scoringItems: [] },
      rosterPositions: this.normalizeRosterPositions(settings.rosterPositions || []),
      waiverType: settings.waiverType || 'standard',
      tradeDeadline: settings.tradeDeadline,
      playoffStartWeek: settings.playoffStartWeek,
      maxTeams: settings.maxTeams || 10,
      draftType: settings.draftType || 'snake',
      scoringPeriod: settings.scoringPeriod || 'weekly',
      categories: settings.categories
    };
  }

  /**
   * Normalize roster positions
   */
  private normalizeRosterPositions(positions: any[]): RosterPosition[] {
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
  async normalizeTeam(team: any, platform: FantasyPlatform): Promise<Team> {
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
  async normalizeRoster(roster: any, platform: FantasyPlatform): Promise<Roster> {
    const normalized: Roster = {
      teamId: roster.teamId || roster.team_id,
      players: await Promise.all(
        (roster.players || []).map((player: any) => 
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
  async normalizePlayer(player: any, platform: FantasyPlatform): Promise<RosterPlayer> {
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
  private async normalizeInjuryStatus(player: any): Promise<InjuryStatus | undefined> {
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
  private async normalizePlayerStats(player: any): Promise<PlayerStats | undefined> {
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
  async normalizeDraftInfo(draft: any, platform: FantasyPlatform): Promise<DraftInfo> {
    const normalized: DraftInfo = {
      id: draft.id || this.generateDraftId(platform, draft),
      leagueId: draft.leagueId || draft.league_id,
      type: draft.type || 'snake',
      status: draft.status || 'post_draft',
      startTime: draft.startTime ? new Date(draft.startTime) : new Date(),
      picks: draft.picks || [],
      rounds: draft.rounds || 15,
      secondsPerPick: draft.secondsPerPick
    };

    // Ensure picks are properly formatted
    normalized.picks = normalized.picks.map((pick: any) => ({
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
  async normalizeTransaction(transaction: any, platform: FantasyPlatform): Promise<Transaction> {
    const normalized: Transaction = {
      id: transaction.id || this.generateTransactionId(platform, transaction),
      leagueId: transaction.leagueId || transaction.league_id,
      type: transaction.type || 'freeagent',
      status: transaction.status || 'executed',
      teams: transaction.teams || [],
      players: transaction.players || [],
      proposedDate: transaction.proposedDate ? new Date(transaction.proposedDate) : new Date(),
      processedDate: transaction.processedDate ? new Date(transaction.processedDate) : undefined,
      effectiveDate: transaction.effectiveDate ? new Date(transaction.effectiveDate) : undefined,
      bidAmount: transaction.bidAmount,
      priority: transaction.priority
    };

    // Ensure players are properly formatted
    normalized.players = normalized.players.map((player: any) => ({
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
  async normalizeMatchup(matchup: any, platform: FantasyPlatform): Promise<Matchup> {
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
      status: matchup.status || 'scheduled',
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
  private generateLeagueId(platform: FantasyPlatform, league: any): string {
    return `${platform}_${league.platformLeagueId || league.league_id || league.id}`;
  }

  private generateTeamId(platform: FantasyPlatform, team: any): string {
    return `${platform}_${team.platformTeamId || team.team_id || team.id}`;
  }

  private generatePlayerId(platform: FantasyPlatform, player: any): string {
    return `${platform}_${player.platformPlayerId || player.player_id || player.id}`;
  }

  private generateDraftId(platform: FantasyPlatform, draft: any): string {
    return `${platform}_draft_${draft.leagueId || draft.league_id}`;
  }

  private generateTransactionId(platform: FantasyPlatform, transaction: any): string {
    return `${platform}_trans_${transaction.transaction_id || Date.now()}`;
  }

  private generateMatchupId(platform: FantasyPlatform, matchup: any): string {
    return `${platform}_${matchup.leagueId}_w${matchup.week}_${matchup.matchup_id || Date.now()}`;
  }

  /**
   * Detect sport from league data
   */
  private detectSport(league: any): SportType {
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
  async mergeWithPlatformData(normalized: any, platformData: any): Promise<any> {
    // This allows platforms to add custom fields while maintaining normalized structure
    return {
      ...normalized,
      platformSpecific: platformData
    };
  }

  /**
   * Validate normalized data
   */
  async validateNormalizedData(data: any, type: string): Promise<boolean> {
    // Basic validation to ensure required fields are present
    switch (type) {
      case 'league':
        return !!(data.id && data.platform && data.name && data.sport);
      
      case 'team':
        return !!(data.id && data.leagueId && data.name);
      
      case 'player':
        return !!(data.id && data.name && data.position);
      
      case 'roster':
        return !!(data.teamId && Array.isArray(data.players));
      
      case 'draft':
        return !!(data.id && data.leagueId && Array.isArray(data.picks));
      
      case 'transaction':
        return !!(data.id && data.leagueId && data.type);
      
      case 'matchup':
        return !!(data.id && data.leagueId && data.team1Id && data.team2Id);
      
      default:
        return false;
    }
  }

  /**
   * Clean and sanitize data
   */
  async sanitizeData(data: any): Promise<any> {
    // Remove null/undefined values and clean strings
    const cleaned: any = {};
    
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
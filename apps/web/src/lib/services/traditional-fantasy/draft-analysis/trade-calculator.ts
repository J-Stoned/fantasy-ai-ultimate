// Trade Value Calculator with Fair Trade Analysis

import {
  TradeProposal,
  TradeAnalysis,
  Player,
  PlayerProjection,
  PlayerValue,
  TeamState,
  DraftState,
  LeagueSettings,
  PositionNeed,
  DraftPickTrade,
  PlayerMap,
  ProjectionMap
} from './types';
import { PlayerValuator } from './player-valuator';

export class TradeCalculator {
  private readonly POSITION_SCARCITY_WEIGHT = 0.2;
  private readonly TEAM_NEED_WEIGHT = 0.25;
  private readonly PLAYOFF_SCHEDULE_WEIGHT = 0.15;
  private readonly KEEPER_VALUE_WEIGHT = 0.1;

  // Trade value chart for draft picks
  private readonly DRAFT_PICK_VALUES: Record<number, number[]> = {
    1: [100, 86, 74, 64, 56, 48, 42, 36, 31, 27, 23, 20, 17, 15, 13],
    2: [86, 74, 64, 56, 48, 42, 36, 31, 27, 23, 20, 17, 15, 13, 11],
    3: [74, 64, 56, 48, 42, 36, 31, 27, 23, 20, 17, 15, 13, 11, 9],
    4: [64, 56, 48, 42, 36, 31, 27, 23, 20, 17, 15, 13, 11, 9, 8],
    5: [56, 48, 42, 36, 31, 27, 23, 20, 17, 15, 13, 11, 9, 8, 7]
  };

  constructor(
    private players: PlayerMap,
    private projections: ProjectionMap,
    private valuator: PlayerValuator,
    private leagueSettings: LeagueSettings
  ) {}

  /**
   * Analyze a trade proposal
   */
  public analyzeTrade(
    proposal: TradeProposal,
    draftState: DraftState,
    currentWeek?: number
  ): TradeAnalysis {
    // Get team states
    const teamA = draftState.teams.get(proposal.teamGiving);
    const teamB = draftState.teams.get(proposal.teamReceiving);

    if (!teamA || !teamB) {
      throw new Error('Invalid team IDs in trade proposal');
    }

    // Calculate base trade values
    const teamAGivingValue = this.calculatePackageValue(
      proposal.playersGiving,
      proposal.draftPicksGiving,
      teamA,
      currentWeek
    );

    const teamBGivingValue = this.calculatePackageValue(
      proposal.playersReceiving,
      proposal.draftPicksReceiving,
      teamB,
      currentWeek
    );

    // Calculate context-adjusted values
    const teamAReceivingValue = this.adjustValueForTeamContext(
      proposal.playersReceiving,
      teamA,
      teamB,
      currentWeek
    );

    const teamBReceivingValue = this.adjustValueForTeamContext(
      proposal.playersGiving,
      teamB,
      teamA,
      currentWeek
    );

    // Calculate net gain/loss
    const teamAGain = teamAReceivingValue - teamAGivingValue;
    const teamBGain = teamBReceivingValue - teamBGivingValue;

    // Calculate fairness score (-100 to 100, 0 is perfectly fair)
    const valueDifference = Math.abs(teamAGivingValue - teamBGivingValue);
    const avgValue = (teamAGivingValue + teamBGivingValue) / 2;
    const fairnessScore = valueDifference / avgValue * 100;

    // Determine which team benefits more
    const adjustedFairness = teamAGain > teamBGain 
      ? -fairnessScore  // Negative means team A wins
      : fairnessScore;   // Positive means team B wins

    // Calculate win probability changes
    const winProbChange = this.calculateWinProbabilityChanges(
      proposal,
      teamA,
      teamB,
      draftState
    );

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      adjustedFairness,
      teamAGain,
      teamBGain
    );

    // Generate reasoning
    const reasoning = this.generateTradeReasoning(
      proposal,
      teamA,
      teamB,
      teamAGain,
      teamBGain,
      adjustedFairness
    );

    return {
      fairnessScore: adjustedFairness,
      teamAGain,
      teamBGain,
      winProbabilityChange: winProbChange,
      recommendation,
      reasoning
    };
  }

  /**
   * Calculate total value of a trade package
   */
  private calculatePackageValue(
    playerIds: string[],
    draftPicks?: DraftPickTrade[],
    team?: TeamState,
    currentWeek?: number
  ): number {
    let totalValue = 0;

    // Calculate player values
    for (const playerId of playerIds) {
      const player = this.players.get(playerId);
      const projection = this.projections.get(playerId);
      const playerValue = this.valuator.getPlayerValue(playerId, new Set(), 1);

      if (!player || !projection || !playerValue) continue;

      // Base value from VORP
      let value = playerValue.tradeValue;

      // Adjust for remaining season
      if (currentWeek) {
        const remainingWeeks = 17 - currentWeek; // Assuming 17-week season
        value *= remainingWeeks / 17;
      }

      // Keeper league adjustment
      if (this.leagueSettings.keeperRules?.enabled) {
        value += (playerValue.keeperValue || 0) * this.KEEPER_VALUE_WEIGHT;
      }

      totalValue += value;
    }

    // Calculate draft pick values
    if (draftPicks) {
      for (const pick of draftPicks) {
        totalValue += this.calculateDraftPickValue(pick);
      }
    }

    return totalValue;
  }

  /**
   * Adjust value based on receiving team's context
   */
  private adjustValueForTeamContext(
    playerIds: string[],
    receivingTeam: TeamState,
    givingTeam: TeamState,
    currentWeek?: number
  ): number {
    let totalValue = 0;

    for (const playerId of playerIds) {
      const player = this.players.get(playerId);
      const projection = this.projections.get(playerId);
      const playerValue = this.valuator.getPlayerValue(playerId, new Set(), 1);

      if (!player || !projection || !playerValue) continue;

      let value = playerValue.tradeValue;

      // Adjust for team need
      const positionNeed = this.calculatePositionNeedMultiplier(
        player.position,
        receivingTeam
      );
      value *= (1 + positionNeed * this.TEAM_NEED_WEIGHT);

      // Adjust for positional scarcity
      const scarcityMultiplier = this.calculateScarcityMultiplier(
        player.position,
        receivingTeam
      );
      value *= (1 + scarcityMultiplier * this.POSITION_SCARCITY_WEIGHT);

      // Playoff schedule strength (if applicable)
      if (currentWeek && currentWeek >= 10) {
        const scheduleMultiplier = this.calculatePlayoffScheduleMultiplier(
          player,
          currentWeek
        );
        value *= (1 + scheduleMultiplier * this.PLAYOFF_SCHEDULE_WEIGHT);
      }

      // Stack synergy bonus
      const synergyBonus = this.calculateSynergyBonus(
        player,
        receivingTeam
      );
      value *= (1 + synergyBonus);

      totalValue += value;
    }

    return totalValue;
  }

  /**
   * Calculate position need multiplier
   */
  private calculatePositionNeedMultiplier(
    position: string,
    team: TeamState
  ): number {
    const need = team.needs.find(n => n.position === position);
    if (!need) return 0;

    // Higher need = higher multiplier
    if (need.currentCount < need.targetCount) {
      return need.priority;
    }

    // Upgrading starter position
    if (need.qualityScore < 80) {
      return 0.5 * (1 - need.qualityScore / 100);
    }

    return 0;
  }

  /**
   * Calculate scarcity multiplier
   */
  private calculateScarcityMultiplier(
    position: string,
    team: TeamState
  ): number {
    // Simplified scarcity calculation
    const scarcityByPosition: Record<string, number> = {
      QB: 0.2,
      RB: 0.5,
      WR: 0.3,
      TE: 0.4,
      K: 0.1,
      DST: 0.1
    };

    return scarcityByPosition[position] || 0.2;
  }

  /**
   * Calculate playoff schedule multiplier
   */
  private calculatePlayoffScheduleMultiplier(
    player: Player,
    currentWeek: number
  ): number {
    // Mock schedule strength - in production, use real matchup data
    const playoffWeeks = [14, 15, 16, 17];
    const remainingPlayoffWeeks = playoffWeeks.filter(w => w > currentWeek);

    if (remainingPlayoffWeeks.length === 0) return 0;

    // Random multiplier for demo
    return (Math.random() - 0.5) * 0.5;
  }

  /**
   * Calculate synergy bonus for stacking
   */
  private calculateSynergyBonus(
    player: Player,
    team: TeamState
  ): number {
    const roster = team.roster.map(id => this.players.get(id)!);

    // QB-WR/TE stack
    if (player.position === 'QB') {
      const teamReceivers = roster.filter(p => 
        (p.position === 'WR' || p.position === 'TE') && 
        p.team === player.team
      );
      if (teamReceivers.length > 0) {
        return 0.1 * teamReceivers.length;
      }
    } else if (player.position === 'WR' || player.position === 'TE') {
      const teamQB = roster.find(p => p.position === 'QB' && p.team === player.team);
      if (teamQB) return 0.15;
    }

    return 0;
  }

  /**
   * Calculate draft pick value
   */
  private calculateDraftPickValue(pick: DraftPickTrade): number {
    const yearMultiplier = Math.pow(0.85, pick.year - 1); // Future picks worth less
    const roundValues = this.DRAFT_PICK_VALUES[pick.round] || this.DRAFT_PICK_VALUES[5];
    
    // Assume mid-round pick position
    const pickPosition = Math.floor(this.leagueSettings.teamCount / 2);
    const baseValue = roundValues[pickPosition] || 5;

    return baseValue * yearMultiplier;
  }

  /**
   * Calculate win probability changes
   */
  private calculateWinProbabilityChanges(
    proposal: TradeProposal,
    teamA: TeamState,
    teamB: TeamState,
    draftState: DraftState
  ): { teamA: number; teamB: number } {
    // Calculate current team strengths
    const teamACurrentStrength = this.calculateTeamStrength(teamA);
    const teamBCurrentStrength = this.calculateTeamStrength(teamB);

    // Simulate post-trade rosters
    const teamAPostTrade = this.simulatePostTradeRoster(
      teamA,
      proposal.playersGiving,
      proposal.playersReceiving
    );
    const teamBPostTrade = this.simulatePostTradeRoster(
      teamB,
      proposal.playersReceiving,
      proposal.playersGiving
    );

    // Calculate post-trade strengths
    const teamAPostStrength = this.calculateTeamStrength(teamAPostTrade);
    const teamBPostStrength = this.calculateTeamStrength(teamBPostTrade);

    // Calculate changes in win probability
    const leagueAvgStrength = this.calculateLeagueAverageStrength(draftState);

    const teamAWinProbChange = this.strengthToWinProbability(
      teamAPostStrength,
      leagueAvgStrength
    ) - this.strengthToWinProbability(teamACurrentStrength, leagueAvgStrength);

    const teamBWinProbChange = this.strengthToWinProbability(
      teamBPostStrength,
      leagueAvgStrength
    ) - this.strengthToWinProbability(teamBCurrentStrength, leagueAvgStrength);

    return {
      teamA: teamAWinProbChange,
      teamB: teamBWinProbChange
    };
  }

  /**
   * Calculate team strength
   */
  private calculateTeamStrength(team: TeamState): number {
    const starters = this.getBestLineup(team);
    
    return starters.reduce((total, playerId) => {
      const projection = this.projections.get(playerId);
      return total + (projection?.projectedPoints || 0);
    }, 0);
  }

  /**
   * Get best possible lineup from roster
   */
  private getBestLineup(team: TeamState): string[] {
    const lineup: string[] = [];
    const requirements = this.leagueSettings.rosterRequirements;

    // Group players by position
    const playersByPosition = new Map<string, string[]>();
    for (const playerId of team.roster) {
      const player = this.players.get(playerId);
      if (!player) continue;

      const positionPlayers = playersByPosition.get(player.position) || [];
      positionPlayers.push(playerId);
      playersByPosition.set(player.position, positionPlayers);
    }

    // Fill each position with best available
    for (const [position, req] of Object.entries(requirements)) {
      if (position === 'BENCH') continue;

      const positionPlayers = playersByPosition.get(position) || [];
      
      // Sort by projected points
      const sorted = positionPlayers.sort((a, b) => {
        const projA = this.projections.get(a)?.projectedPoints || 0;
        const projB = this.projections.get(b)?.projectedPoints || 0;
        return projB - projA;
      });

      // Add best players up to min requirement
      const toAdd = Math.min(req.min, sorted.length);
      lineup.push(...sorted.slice(0, toAdd));
    }

    // Handle flex positions
    if (requirements.FLEX) {
      const flexEligible = ['RB', 'WR', 'TE'];
      const flexPlayers: string[] = [];

      for (const position of flexEligible) {
        const players = playersByPosition.get(position) || [];
        const used = lineup.filter(id => {
          const p = this.players.get(id);
          return p?.position === position;
        }).length;

        // Add unused players
        flexPlayers.push(...players.slice(used));
      }

      // Sort flex candidates
      flexPlayers.sort((a, b) => {
        const projA = this.projections.get(a)?.projectedPoints || 0;
        const projB = this.projections.get(b)?.projectedPoints || 0;
        return projB - projA;
      });

      // Add best flex players
      lineup.push(...flexPlayers.slice(0, requirements.FLEX.min));
    }

    return lineup;
  }

  /**
   * Simulate post-trade roster
   */
  private simulatePostTradeRoster(
    team: TeamState,
    playersOut: string[],
    playersIn: string[]
  ): TeamState {
    const newRoster = team.roster.filter(id => !playersOut.includes(id));
    newRoster.push(...playersIn);

    return {
      ...team,
      roster: newRoster
    };
  }

  /**
   * Calculate league average strength
   */
  private calculateLeagueAverageStrength(draftState: DraftState): number {
    let totalStrength = 0;
    let teamCount = 0;

    for (const team of draftState.teams.values()) {
      totalStrength += this.calculateTeamStrength(team);
      teamCount++;
    }

    return totalStrength / teamCount;
  }

  /**
   * Convert strength to win probability
   */
  private strengthToWinProbability(
    teamStrength: number,
    leagueAverage: number
  ): number {
    // Simple logistic function
    const strengthRatio = teamStrength / leagueAverage;
    return 1 / (1 + Math.exp(-2 * (strengthRatio - 1)));
  }

  /**
   * Generate trade recommendation
   */
  private generateRecommendation(
    fairnessScore: number,
    teamAGain: number,
    teamBGain: number
  ): 'accept' | 'reject' | 'counter' {
    // If trade is reasonably fair
    if (Math.abs(fairnessScore) < 15) {
      // Accept if you're gaining value
      if (teamAGain > 0) return 'accept';
      if (teamAGain > -5) return 'counter'; // Small loss, try to improve
      return 'reject';
    }

    // If trade heavily favors you
    if (fairnessScore < -20 && teamAGain > 0) {
      return 'accept'; // Take the win
    }

    // If trade heavily favors them
    if (fairnessScore > 20) {
      return 'reject';
    }

    return 'counter';
  }

  /**
   * Generate reasoning for trade analysis
   */
  private generateTradeReasoning(
    proposal: TradeProposal,
    teamA: TeamState,
    teamB: TeamState,
    teamAGain: number,
    teamBGain: number,
    fairnessScore: number
  ): string[] {
    const reasoning: string[] = [];

    // Fairness assessment
    if (Math.abs(fairnessScore) < 10) {
      reasoning.push('This trade is relatively fair in terms of overall value');
    } else if (fairnessScore < -20) {
      reasoning.push(`This trade heavily favors ${teamA.teamName}`);
    } else if (fairnessScore > 20) {
      reasoning.push(`This trade heavily favors ${teamB.teamName}`);
    }

    // Value gains/losses
    if (teamAGain > 0) {
      reasoning.push(`${teamA.teamName} gains ${teamAGain.toFixed(1)} points of value`);
    } else {
      reasoning.push(`${teamA.teamName} loses ${Math.abs(teamAGain).toFixed(1)} points of value`);
    }

    // Position needs addressed
    for (const playerId of proposal.playersReceiving) {
      const player = this.players.get(playerId);
      if (!player) continue;

      const need = teamA.needs.find(n => n.position === player.position);
      if (need && need.priority > 0.7) {
        reasoning.push(`Addresses ${teamA.teamName}'s need at ${player.position}`);
      }
    }

    // Check for selling high/buying low
    for (const playerId of proposal.playersGiving) {
      const projection = this.projections.get(playerId);
      if (projection && projection.upside < 0.3) {
        reasoning.push(`Selling high on ${this.players.get(playerId)?.name}`);
      }
    }

    return reasoning;
  }

  /**
   * Find fair trades for a specific player
   */
  public findFairTrades(
    playerId: string,
    myTeamId: string,
    draftState: DraftState,
    maxResults: number = 10
  ): TradeProposal[] {
    const player = this.players.get(playerId);
    const playerValue = this.valuator.getPlayerValue(playerId, new Set(), 1);
    
    if (!player || !playerValue) return [];

    const fairTrades: TradeProposal[] = [];
    const targetValue = playerValue.tradeValue;

    // Check all other teams
    for (const [teamId, team] of draftState.teams) {
      if (teamId === myTeamId) continue;

      // Find 1-for-1 trades
      const oneForOneTrades = this.findOneForOneTrades(
        playerId,
        targetValue,
        team,
        myTeamId,
        teamId
      );
      fairTrades.push(...oneForOneTrades);

      // Find 2-for-1 trades
      const twoForOneTrades = this.findTwoForOneTrades(
        playerId,
        targetValue,
        team,
        myTeamId,
        teamId
      );
      fairTrades.push(...twoForOneTrades);
    }

    // Sort by fairness
    return fairTrades
      .map(trade => ({
        trade,
        analysis: this.analyzeTrade(trade, draftState)
      }))
      .sort((a, b) => Math.abs(a.analysis.fairnessScore) - Math.abs(b.analysis.fairnessScore))
      .slice(0, maxResults)
      .map(t => t.trade);
  }

  /**
   * Find 1-for-1 trades
   */
  private findOneForOneTrades(
    playerId: string,
    targetValue: number,
    otherTeam: TeamState,
    myTeamId: string,
    otherTeamId: string
  ): TradeProposal[] {
    const trades: TradeProposal[] = [];

    for (const theirPlayerId of otherTeam.roster) {
      const theirValue = this.valuator.getPlayerValue(theirPlayerId, new Set(), 1);
      if (!theirValue) continue;

      // Check if values are close
      if (Math.abs(theirValue.tradeValue - targetValue) < targetValue * 0.2) {
        trades.push({
          teamGiving: myTeamId,
          teamReceiving: otherTeamId,
          playersGiving: [playerId],
          playersReceiving: [theirPlayerId]
        });
      }
    }

    return trades;
  }

  /**
   * Find 2-for-1 trades
   */
  private findTwoForOneTrades(
    playerId: string,
    targetValue: number,
    otherTeam: TeamState,
    myTeamId: string,
    otherTeamId: string
  ): TradeProposal[] {
    const trades: TradeProposal[] = [];
    const roster = otherTeam.roster;

    // Try all combinations of 2 players
    for (let i = 0; i < roster.length - 1; i++) {
      for (let j = i + 1; j < roster.length; j++) {
        const value1 = this.valuator.getPlayerValue(roster[i], new Set(), 1);
        const value2 = this.valuator.getPlayerValue(roster[j], new Set(), 1);

        if (!value1 || !value2) continue;

        const combinedValue = value1.tradeValue + value2.tradeValue;

        // Check if combined value is close
        if (Math.abs(combinedValue - targetValue) < targetValue * 0.25) {
          trades.push({
            teamGiving: myTeamId,
            teamReceiving: otherTeamId,
            playersGiving: [playerId],
            playersReceiving: [roster[i], roster[j]]
          });
        }
      }
    }

    return trades;
  }
}
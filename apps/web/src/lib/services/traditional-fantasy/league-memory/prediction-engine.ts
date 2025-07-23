// Prediction Engine - Predictive analytics for manager behavior and outcomes

import {
  LeagueMemory,
  ManagerProfile,
  DraftPrediction,
  TradePrediction,
  WaiverPrediction,
  SeasonPrediction,
  BehaviorPrediction,
  LeaguePredictions,
  Transaction,
  Trade,
  DraftResult,
  WaiverClaim
} from './types';

export class PredictionEngine {
  private readonly CONFIDENCE_THRESHOLD = 0.6;
  private readonly MIN_HISTORICAL_DATA = 2; // Seasons

  // Generate all predictions for the league
  generatePredictions(memory: LeagueMemory): LeaguePredictions {
    return {
      draftPredictions: this.generateDraftPredictions(memory),
      tradePredictions: this.generateTradePredictions(memory),
      waiverPredictions: this.generateWaiverPredictions(memory),
      seasonPredictions: this.generateSeasonPredictions(memory),
      behaviorPredictions: this.generateBehaviorPredictions(memory)
    };
  }

  // Generate draft predictions
  private generateDraftPredictions(memory: LeagueMemory): DraftPrediction[] {
    const predictions: DraftPrediction[] = [];
    
    // Get current draft order (would need live data)
    const draftOrder = this.estimateDraftOrder(memory);
    
    for (let round = 1; round <= 5; round++) { // Predict first 5 rounds
      for (const managerId of draftOrder) {
        const manager = memory.managers.find(m => m.managerId === managerId);
        if (!manager) continue;

        const prediction = this.predictManagerDraftPick(manager, round, memory);
        predictions.push(prediction);
      }
    }

    return predictions;
  }

  // Predict individual manager's draft pick
  private predictManagerDraftPick(
    manager: ManagerProfile,
    round: number,
    memory: LeagueMemory
  ): DraftPrediction {
    const historicalPicks = this.getManagerDraftHistory(manager.managerId, memory);
    const availablePlayers = this.getAvailablePlayers(round, memory); // Would need live data
    
    // Analyze historical patterns
    const positionPreference = this.analyzePositionPreference(manager, round, historicalPicks);
    const reachTendency = manager.tendencies.draftPatterns.find(p => p.type === 'reach')?.confidence || 0.5;
    const teamBias = manager.tendencies.preferredTeams;

    // Score each available player
    const playerScores = availablePlayers.map(player => {
      let score = 0;
      
      // Position fit
      if (positionPreference.includes(player.position)) {
        score += 0.4;
      }
      
      // Team preference
      if (teamBias.includes(player.team)) {
        score += 0.2;
      }
      
      // ADP fit
      const adpDiff = Math.abs(player.adp - (round * 12)); // Assume 12-team league
      if (adpDiff < 10) {
        score += 0.3;
      }
      
      // Reach tendency
      if (player.adp > (round * 12) + 10 && reachTendency > 0.7) {
        score += 0.1;
      }

      return {
        playerId: player.id,
        score,
        probability: this.normalizeScore(score)
      };
    });

    // Get top predictions
    const topPredictions = playerScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(p => ({ playerId: p.playerId, probability: p.probability }));

    // Generate reasoning
    const reasoning = this.generateDraftReasoning(manager, round, topPredictions);

    return {
      managerId: manager.managerId,
      round,
      predictedPicks: topPredictions,
      reasoning
    };
  }

  // Generate trade predictions
  private generateTradePredictions(memory: LeagueMemory): TradePrediction[] {
    const predictions: TradePrediction[] = [];
    
    // Analyze each manager pair
    for (let i = 0; i < memory.managers.length; i++) {
      for (let j = i + 1; j < memory.managers.length; j++) {
        const manager1 = memory.managers[i];
        const manager2 = memory.managers[j];
        
        const tradeLikelihood = this.calculateTradeLikelihood(manager1, manager2, memory);
        
        if (tradeLikelihood > 0.3) { // Threshold for prediction
          const prediction = this.predictTrade(manager1, manager2, tradeLikelihood, memory);
          predictions.push(prediction);
        }
      }
    }

    return predictions.sort((a, b) => b.likelihood - a.likelihood).slice(0, 10);
  }

  // Calculate trade likelihood between two managers
  private calculateTradeLikelihood(
    manager1: ManagerProfile,
    manager2: ManagerProfile,
    memory: LeagueMemory
  ): number {
    let likelihood = 0;

    // Historical trading frequency
    const tradingHistory = manager1.tendencies.tradingPartners.find(
      p => p.managerId === manager2.managerId
    );
    if (tradingHistory) {
      likelihood += Math.min(tradingHistory.frequency / 10, 0.3);
    }

    // Trading activity levels
    const activityMatch = 
      (manager1.personality.tradeActivity === 'aggressive' ? 0.2 : 0) +
      (manager2.personality.tradeActivity === 'aggressive' ? 0.2 : 0) +
      (manager1.personality.tradeActivity === 'moderate' ? 0.1 : 0) +
      (manager2.personality.tradeActivity === 'moderate' ? 0.1 : 0);
    likelihood += activityMatch;

    // Complementary needs (would need roster analysis)
    const needsMatch = this.analyzeComplementaryNeeds(manager1, manager2, memory);
    likelihood += needsMatch * 0.3;

    // Rivalry reduces trade likelihood
    const isRival = manager1.relationships.rivals.some(r => r.managerId === manager2.managerId);
    if (isRival) {
      likelihood *= 0.5;
    }

    // Current season context (would need live data)
    const seasonContext = this.getSeasonContext(memory);
    if (seasonContext.week > 8 && seasonContext.week < 12) {
      likelihood *= 1.3; // Trade deadline approaching
    }

    return Math.min(likelihood, 1);
  }

  // Predict specific trade details
  private predictTrade(
    manager1: ManagerProfile,
    manager2: ManagerProfile,
    likelihood: number,
    memory: LeagueMemory
  ): TradePrediction {
    // Analyze typical trade patterns
    const manager1Patterns = this.getManagerTradePatterns(manager1.managerId, memory);
    const manager2Patterns = this.getManagerTradePatterns(manager2.managerId, memory);

    // Predict timing
    const timing = this.predictTradeTiming(manager1, manager2, memory);

    // Predict players involved (would need roster data)
    const predictedPlayers = this.predictTradePlayers(manager1, manager2, memory);

    // Identify triggers
    const triggers = this.identifyTradeTriggers(manager1, manager2, memory);

    return {
      likelihood,
      manager1Id: manager1.managerId,
      manager2Id: manager2.managerId,
      predictedPlayers,
      timing,
      triggers
    };
  }

  // Generate waiver predictions
  private generateWaiverPredictions(memory: LeagueMemory): WaiverPrediction[] {
    const predictions: WaiverPrediction[] = [];
    
    // Get trending players (would need live data)
    const trendingPlayers = this.getTrendingWaiverPlayers(memory);
    
    for (const player of trendingPlayers) {
      const interestedManagers = this.predictInterestedManagers(player, memory);
      const optimalBid = this.calculateOptimalBid(player, interestedManagers, memory);
      const reasoning = this.generateWaiverReasoning(player, interestedManagers);

      predictions.push({
        playerId: player.id,
        interestedManagers,
        optimalBid,
        reasoning
      });
    }

    return predictions;
  }

  // Predict which managers will be interested in a player
  private predictInterestedManagers(
    player: any,
    memory: LeagueMemory
  ): { managerId: string; likelihood: number; bidEstimate?: number }[] {
    const interested: { managerId: string; likelihood: number; bidEstimate?: number }[] = [];

    for (const manager of memory.managers) {
      const likelihood = this.calculateWaiverInterest(manager, player, memory);
      
      if (likelihood > 0.3) {
        const bidEstimate = this.estimateManagerBid(manager, player, likelihood, memory);
        
        interested.push({
          managerId: manager.managerId,
          likelihood,
          bidEstimate
        });
      }
    }

    return interested.sort((a, b) => b.likelihood - a.likelihood);
  }

  // Calculate manager's interest in a waiver player
  private calculateWaiverInterest(
    manager: ManagerProfile,
    player: any,
    memory: LeagueMemory
  ): number {
    let interest = 0;

    // Position need (would need roster analysis)
    const needsPosition = this.managerNeedsPosition(manager.managerId, player.position, memory);
    if (needsPosition) {
      interest += 0.4;
    }

    // Waiver aggression
    interest += manager.personality.waiverAggression * 0.3;

    // Historical interest in similar players
    const similarPlayerHistory = this.getSimilarPlayerHistory(manager.managerId, player, memory);
    interest += similarPlayerHistory * 0.2;

    // Team preference
    if (manager.tendencies.preferredTeams.includes(player.team)) {
      interest += 0.1;
    }

    return Math.min(interest, 1);
  }

  // Generate season predictions
  private generateSeasonPredictions(memory: LeagueMemory): SeasonPrediction[] {
    const currentStandings = this.getCurrentStandings(memory);
    const managerProfiles = memory.managers;

    // Predict final standings
    const standingsPredictions = this.predictFinalStandings(managerProfiles, currentStandings, memory);

    // Predict playoff teams
    const playoffPredictions = this.predictPlayoffTeams(standingsPredictions);

    // Predict champion
    const championPredictions = this.predictChampion(playoffPredictions, managerProfiles, memory);

    // Identify surprise factors
    const surpriseFactors = this.identifySurpriseFactors(memory);

    return [{
      standings: standingsPredictions,
      playoffTeams: playoffPredictions,
      champion: championPredictions,
      surpriseFactors
    }];
  }

  // Predict final standings
  private predictFinalStandings(
    managers: ManagerProfile[],
    currentStandings: any,
    memory: LeagueMemory
  ): { managerId: string; predictedRank: number; confidence: number }[] {
    const predictions = managers.map(manager => {
      const currentRank = currentStandings[manager.managerId] || 6;
      const historicalAvgRank = this.getHistoricalAverageRank(manager.managerId, memory);
      const performanceTrend = this.getPerformanceTrend(manager.managerId, memory);
      const scheduleStrength = this.getRemainingScheduleStrength(manager.managerId, memory);

      // Weight factors
      const predictedRank = 
        currentRank * 0.4 +
        historicalAvgRank * 0.3 +
        performanceTrend * 0.2 +
        scheduleStrength * 0.1;

      // Calculate confidence based on data quality and variability
      const confidence = this.calculateStandingConfidence(manager, memory);

      return {
        managerId: manager.managerId,
        predictedRank: Math.round(predictedRank),
        confidence
      };
    });

    return predictions.sort((a, b) => a.predictedRank - b.predictedRank);
  }

  // Predict playoff teams
  private predictPlayoffTeams(
    standings: { managerId: string; predictedRank: number; confidence: number }[]
  ): { managerId: string; probability: number }[] {
    const playoffSpots = 6; // Typical playoff size
    
    return standings.map((standing, index) => {
      let probability = 0;
      
      if (standing.predictedRank <= playoffSpots) {
        // Currently projected to make playoffs
        probability = standing.confidence;
      } else {
        // Currently out, but could make it
        const spotsAway = standing.predictedRank - playoffSpots;
        probability = Math.max(0, standing.confidence * (1 - spotsAway * 0.2));
      }

      return {
        managerId: standing.managerId,
        probability
      };
    }).filter(p => p.probability > 0.1);
  }

  // Predict champion
  private predictChampion(
    playoffTeams: { managerId: string; probability: number }[],
    managers: ManagerProfile[],
    memory: LeagueMemory
  ): { managerId: string; probability: number }[] {
    return playoffTeams.map(team => {
      const manager = managers.find(m => m.managerId === team.managerId)!;
      
      // Factor in clutch performance
      const clutchFactor = manager.performance.clutchFactor;
      
      // Factor in playoff history
      const playoffSuccess = manager.performance.championshipRate;
      
      // Factor in current form
      const currentForm = this.getCurrentForm(manager.managerId, memory);
      
      const championshipProbability = 
        team.probability * 0.3 +
        clutchFactor * 0.3 +
        playoffSuccess * 0.2 +
        currentForm * 0.2;

      return {
        managerId: team.managerId,
        probability: championshipProbability
      };
    }).sort((a, b) => b.probability - a.probability);
  }

  // Generate behavior predictions
  private generateBehaviorPredictions(memory: LeagueMemory): BehaviorPrediction[] {
    return memory.managers.map(manager => {
      const recentActions = this.getRecentActions(manager.managerId, memory);
      const patterns = memory.patterns;
      const context = this.getCurrentContext(memory);

      const predictedActions = this.predictNextActions(manager, recentActions, patterns, context);

      return {
        managerId: manager.managerId,
        predictedActions
      };
    });
  }

  // Predict next actions for a manager
  private predictNextActions(
    manager: ManagerProfile,
    recentActions: any[],
    patterns: any,
    context: any
  ): { type: string; probability: number; timing: string; trigger: string }[] {
    const actions: { type: string; probability: number; timing: string; trigger: string }[] = [];

    // Trade prediction
    if (manager.personality.tradeActivity !== 'passive') {
      const tradeProbability = this.calculateActionProbability('trade', manager, context);
      if (tradeProbability > 0.3) {
        actions.push({
          type: 'trade',
          probability: tradeProbability,
          timing: this.predictActionTiming('trade', manager, context),
          trigger: this.identifyActionTrigger('trade', manager, context)
        });
      }
    }

    // Waiver claim prediction
    const waiverProbability = this.calculateActionProbability('waiver', manager, context);
    if (waiverProbability > 0.4) {
      actions.push({
        type: 'waiver-claim',
        probability: waiverProbability,
        timing: this.predictActionTiming('waiver', manager, context),
        trigger: this.identifyActionTrigger('waiver', manager, context)
      });
    }

    // Lineup tinkering prediction
    if (manager.personality.decisionSpeed === 'overthinking') {
      actions.push({
        type: 'lineup-change',
        probability: 0.8,
        timing: 'game-day-morning',
        trigger: 'analyst-updates'
      });
    }

    // Trash talk prediction
    if (manager.personality.chatActivity === 'provocateur') {
      actions.push({
        type: 'trash-talk',
        probability: 0.7,
        timing: 'post-win',
        trigger: 'victory-over-rival'
      });
    }

    return actions.sort((a, b) => b.probability - a.probability);
  }

  // Helper methods
  private estimateDraftOrder(memory: LeagueMemory): string[] {
    // Would need to determine draft order based on previous season or randomization
    return memory.managers.map(m => m.managerId);
  }

  private getManagerDraftHistory(managerId: string, memory: LeagueMemory): DraftResult[] {
    const picks: DraftResult[] = [];
    for (const season of memory.seasons) {
      picks.push(...season.draftResults.filter(d => d.managerId === managerId));
    }
    return picks;
  }

  private getAvailablePlayers(round: number, memory: LeagueMemory): any[] {
    // Would need live draft data
    return [
      { id: 'player1', position: 'RB', team: 'DAL', adp: round * 12 - 5 },
      { id: 'player2', position: 'WR', team: 'GB', adp: round * 12 },
      { id: 'player3', position: 'QB', team: 'KC', adp: round * 12 + 5 }
    ];
  }

  private analyzePositionPreference(
    manager: ManagerProfile,
    round: number,
    historicalPicks: DraftResult[]
  ): string[] {
    const roundPicks = historicalPicks.filter(p => p.round === round);
    const positionCounts = new Map<string, number>();
    
    for (const pick of roundPicks) {
      positionCounts.set(pick.position, (positionCounts.get(pick.position) || 0) + 1);
    }

    return Array.from(positionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([position]) => position)
      .slice(0, 2);
  }

  private normalizeScore(score: number): number {
    return Math.min(Math.max(score, 0), 1);
  }

  private generateDraftReasoning(
    manager: ManagerProfile,
    round: number,
    predictions: any[]
  ): string[] {
    const reasoning: string[] = [];
    
    if (manager.personality.draftStyle === 'homer') {
      reasoning.push('Manager typically drafts players from favorite teams');
    }
    
    if (manager.tendencies.favoritePositions.length > 0) {
      reasoning.push(`Historical preference for ${manager.tendencies.favoritePositions[0]} in round ${round}`);
    }
    
    if (predictions[0].probability > 0.7) {
      reasoning.push('High confidence based on consistent historical patterns');
    }

    return reasoning;
  }

  private analyzeComplementaryNeeds(
    manager1: ManagerProfile,
    manager2: ManagerProfile,
    memory: LeagueMemory
  ): number {
    // Would need roster analysis
    return Math.random() * 0.5;
  }

  private getSeasonContext(memory: LeagueMemory): { week: number } {
    // Would need current season data
    return { week: 10 };
  }

  private getManagerTradePatterns(managerId: string, memory: LeagueMemory): any {
    // Analyze historical trade patterns
    return {};
  }

  private predictTradeTiming(
    manager1: ManagerProfile,
    manager2: ManagerProfile,
    memory: LeagueMemory
  ): 'preseason' | 'early' | 'mid' | 'late' | 'deadline' {
    const week = this.getSeasonContext(memory).week;
    
    if (week < 1) return 'preseason';
    if (week < 4) return 'early';
    if (week < 8) return 'mid';
    if (week < 12) return 'late';
    return 'deadline';
  }

  private predictTradePlayers(
    manager1: ManagerProfile,
    manager2: ManagerProfile,
    memory: LeagueMemory
  ): string[] {
    // Would need roster data
    return ['player1', 'player2'];
  }

  private identifyTradeTriggers(
    manager1: ManagerProfile,
    manager2: ManagerProfile,
    memory: LeagueMemory
  ): string[] {
    const triggers: string[] = [];
    
    if (manager1.personality.tradeActivity === 'aggressive') {
      triggers.push('proactive-roster-improvement');
    }
    
    // Would analyze more context
    triggers.push('injury-replacement', 'bye-week-fill');
    
    return triggers;
  }

  private getTrendingWaiverPlayers(memory: LeagueMemory): any[] {
    // Would need live data
    return [
      { id: 'waiver1', position: 'RB', team: 'NYG' },
      { id: 'waiver2', position: 'WR', team: 'LAR' }
    ];
  }

  private calculateOptimalBid(
    player: any,
    interestedManagers: any[],
    memory: LeagueMemory
  ): number {
    if (interestedManagers.length === 0) return 0;
    
    // Calculate based on competition
    const maxLikelyBid = Math.max(...interestedManagers.map(m => m.bidEstimate || 0));
    const optimalBid = maxLikelyBid * 1.1; // Bid slightly above highest expected
    
    return Math.round(optimalBid);
  }

  private generateWaiverReasoning(player: any, interestedManagers: any[]): string[] {
    const reasoning: string[] = [];
    
    if (interestedManagers.length > 3) {
      reasoning.push('High competition expected from multiple managers');
    }
    
    reasoning.push(`${interestedManagers.length} managers likely interested`);
    
    return reasoning;
  }

  private estimateManagerBid(
    manager: ManagerProfile,
    player: any,
    likelihood: number,
    memory: LeagueMemory
  ): number {
    const baseBid = 10;
    const aggressionMultiplier = 1 + manager.personality.waiverAggression;
    const likelihoodMultiplier = likelihood;
    
    return Math.round(baseBid * aggressionMultiplier * likelihoodMultiplier);
  }

  private managerNeedsPosition(managerId: string, position: string, memory: LeagueMemory): boolean {
    // Would need roster analysis
    return Math.random() > 0.5;
  }

  private getSimilarPlayerHistory(managerId: string, player: any, memory: LeagueMemory): number {
    // Analyze history with similar players
    return Math.random() * 0.5;
  }

  private getCurrentStandings(memory: LeagueMemory): any {
    // Would need current season data
    const standings: any = {};
    memory.managers.forEach((m, i) => {
      standings[m.managerId] = i + 1;
    });
    return standings;
  }

  private getHistoricalAverageRank(managerId: string, memory: LeagueMemory): number {
    // Calculate from historical data
    return 6;
  }

  private getPerformanceTrend(managerId: string, memory: LeagueMemory): number {
    // Analyze recent performance trend
    return 5;
  }

  private getRemainingScheduleStrength(managerId: string, memory: LeagueMemory): number {
    // Analyze remaining opponents
    return 6;
  }

  private calculateStandingConfidence(manager: ManagerProfile, memory: LeagueMemory): number {
    // Base confidence on consistency and data quality
    return 0.7 + (manager.performance.consistency * 0.3);
  }

  private getCurrentForm(managerId: string, memory: LeagueMemory): number {
    // Analyze last 3-4 weeks performance
    return 0.75;
  }

  private identifySurpriseFactors(memory: LeagueMemory): string[] {
    return [
      'Rookie manager exceeding expectations',
      'Key injuries to top teams',
      'Unexpected player breakouts',
      'Trade deadline moves paying off'
    ];
  }

  private getRecentActions(managerId: string, memory: LeagueMemory): any[] {
    // Get last 2 weeks of actions
    return [];
  }

  private getCurrentContext(memory: LeagueMemory): any {
    return {
      week: 10,
      tradeDeadlineApproaching: true,
      playoffRace: true
    };
  }

  private calculateActionProbability(action: string, manager: ManagerProfile, context: any): number {
    // Calculate based on personality and context
    if (action === 'trade' && context.tradeDeadlineApproaching) {
      return 0.6 + (manager.personality.tradeActivity === 'aggressive' ? 0.3 : 0);
    }
    
    return 0.5;
  }

  private predictActionTiming(action: string, manager: ManagerProfile, context: any): string {
    if (action === 'trade') {
      return 'within-7-days';
    }
    if (action === 'waiver') {
      return 'tuesday-night';
    }
    return 'unknown';
  }

  private identifyActionTrigger(action: string, manager: ManagerProfile, context: any): string {
    if (action === 'trade') {
      return 'trade-deadline-pressure';
    }
    if (action === 'waiver') {
      return 'injury-news';
    }
    return 'unknown';
  }
}
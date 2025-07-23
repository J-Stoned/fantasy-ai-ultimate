// Pattern Analyzer - Recognizes patterns and anomalies in league behavior

import {
  LeagueMemory,
  LeaguePatterns,
  Transaction,
  Trade,
  DraftResult,
  WaiverClaim,
  PositionRun,
  ReachPattern,
  ValuePattern,
  SeasonalTrend,
  MarketPattern,
  PanicPattern,
  TimingPattern,
  BidPattern,
  PriorityPattern,
  TiltPattern,
  RivalryPattern,
  GroupThinkPattern
} from './types';

export class PatternAnalyzer {
  private readonly MIN_PATTERN_OCCURRENCES = 3;
  private readonly ANOMALY_THRESHOLD = 2.5; // Standard deviations

  // Analyze all patterns in league history
  analyzePatterns(memory: LeagueMemory): LeaguePatterns {
    return {
      draftPatterns: this.analyzeDraftPatterns(memory),
      tradePatterns: this.analyzeTradePatterns(memory),
      waiverPatterns: this.analyzeWaiverPatterns(memory),
      behavioralPatterns: this.analyzeBehavioralPatterns(memory)
    };
  }

  // Draft pattern analysis
  private analyzeDraftPatterns(memory: LeagueMemory): {
    positionRuns: PositionRun[];
    reachTendencies: ReachPattern[];
    valueIdentification: ValuePattern[];
  } {
    return {
      positionRuns: this.detectPositionRuns(memory),
      reachTendencies: this.analyzeReachTendencies(memory),
      valueIdentification: this.identifyValuePatterns(memory)
    };
  }

  // Detect position runs in drafts
  private detectPositionRuns(memory: LeagueMemory): PositionRun[] {
    const runs: PositionRun[] = [];
    const positionRunMap = new Map<string, PositionRun[]>();

    for (const season of memory.seasons) {
      let currentRun: PositionRun | null = null;
      
      for (let i = 0; i < season.draftResults.length; i++) {
        const pick = season.draftResults[i];
        
        if (currentRun && currentRun.position === pick.position) {
          // Continue run
          currentRun.participants.push(pick.managerId);
          currentRun.endRound = pick.round;
        } else {
          // End current run and start new one
          if (currentRun && currentRun.participants.length >= 3) {
            const key = `${currentRun.position}_${currentRun.startRound}`;
            if (!positionRunMap.has(key)) {
              positionRunMap.set(key, []);
            }
            positionRunMap.get(key)!.push(currentRun);
          }
          
          currentRun = {
            position: pick.position,
            startRound: pick.round,
            endRound: pick.round,
            participants: [pick.managerId],
            frequency: 0
          };
        }
      }
    }

    // Calculate frequencies
    for (const [key, runsList] of positionRunMap) {
      if (runsList.length >= this.MIN_PATTERN_OCCURRENCES) {
        const avgRun = {
          position: runsList[0].position,
          startRound: Math.round(runsList.reduce((sum, r) => sum + r.startRound, 0) / runsList.length),
          endRound: Math.round(runsList.reduce((sum, r) => sum + r.endRound, 0) / runsList.length),
          participants: [], // Will be filled with most common participants
          frequency: runsList.length / memory.seasons.length
        };
        
        runs.push(avgRun);
      }
    }

    return runs.sort((a, b) => b.frequency - a.frequency);
  }

  // Analyze manager reach tendencies
  private analyzeReachTendencies(memory: LeagueMemory): ReachPattern[] {
    const managerReaches = new Map<string, number[]>();
    const managerTargets = new Map<string, Map<string, number>>();

    for (const season of memory.seasons) {
      for (const pick of season.draftResults) {
        const reach = pick.adp - pick.pick;
        
        if (!managerReaches.has(pick.managerId)) {
          managerReaches.set(pick.managerId, []);
          managerTargets.set(pick.managerId, new Map());
        }
        
        managerReaches.get(pick.managerId)!.push(reach);
        
        // Track repeated target players
        const targetMap = managerTargets.get(pick.managerId)!;
        targetMap.set(pick.playerId, (targetMap.get(pick.playerId) || 0) + 1);
      }
    }

    const patterns: ReachPattern[] = [];
    
    for (const [managerId, reaches] of managerReaches) {
      const avgReach = reaches.reduce((sum, r) => sum + r, 0) / reaches.length;
      const variance = reaches.reduce((sum, r) => sum + Math.pow(r - avgReach, 2), 0) / reaches.length;
      const consistency = 1 / (1 + Math.sqrt(variance));
      
      // Find favorite targets
      const targets = managerTargets.get(managerId)!;
      const favoriteTargets = Array.from(targets.entries())
        .filter(([_, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([playerId]) => playerId);
      
      patterns.push({
        managerId,
        averageReach: avgReach,
        consistency,
        targetPlayers: favoriteTargets
      });
    }

    return patterns.sort((a, b) => Math.abs(b.averageReach) - Math.abs(a.averageReach));
  }

  // Identify value finding patterns
  private identifyValuePatterns(memory: LeagueMemory): ValuePattern[] {
    const patterns: ValuePattern[] = [];
    const roundValueMap = new Map<number, { managers: Set<string>; success: number; total: number }>();

    for (const season of memory.seasons) {
      for (const pick of season.draftResults) {
        if (pick.seasonOutcome.value === 'exceed' || pick.seasonOutcome.value === 'league-winner') {
          const round = pick.round;
          
          if (!roundValueMap.has(round)) {
            roundValueMap.set(round, { managers: new Set(), success: 0, total: 0 });
          }
          
          const data = roundValueMap.get(round)!;
          data.managers.add(pick.managerId);
          data.success++;
        }
        
        // Track total picks per round
        if (roundValueMap.has(pick.round)) {
          roundValueMap.get(pick.round)!.total++;
        }
      }
    }

    // Create patterns from successful value rounds
    for (const [round, data] of roundValueMap) {
      if (data.success >= this.MIN_PATTERN_OCCURRENCES) {
        patterns.push({
          rounds: [round],
          positions: [], // Would need position analysis
          managers: Array.from(data.managers),
          successRate: data.success / data.total
        });
      }
    }

    return patterns.sort((a, b) => b.successRate - a.successRate);
  }

  // Trade pattern analysis
  private analyzeTradePatterns(memory: LeagueMemory): {
    seasonalTrends: SeasonalTrend[];
    buyLowSellHigh: MarketPattern[];
    panicTrades: PanicPattern[];
  } {
    return {
      seasonalTrends: this.analyzeSeasonalTrends(memory),
      buyLowSellHigh: this.identifyMarketPatterns(memory),
      panicTrades: this.detectPanicPatterns(memory)
    };
  }

  // Analyze seasonal trade trends
  private analyzeSeasonalTrends(memory: LeagueMemory): SeasonalTrend[] {
    const weeklyTrades = new Map<number, Trade[]>();
    
    for (const season of memory.seasons) {
      for (const trade of season.trades) {
        const week = this.getWeekNumber(trade.timestamp);
        if (!weeklyTrades.has(week)) {
          weeklyTrades.set(week, []);
        }
        weeklyTrades.get(week)!.push(trade);
      }
    }

    const trends: SeasonalTrend[] = [];
    
    for (const [week, trades] of weeklyTrades) {
      if (trades.length >= this.MIN_PATTERN_OCCURRENCES) {
        // Analyze common themes
        const themes = this.extractTradeThemes(trades);
        const triggers = this.identifyTradeTriggers(trades, memory);
        
        trends.push({
          week,
          tradeVolume: trades.length,
          commonThemes: themes,
          triggers
        });
      }
    }

    return trends.sort((a, b) => b.tradeVolume - a.tradeVolume);
  }

  // Identify buy low/sell high patterns
  private identifyMarketPatterns(memory: LeagueMemory): MarketPattern[] {
    const managerPatterns = new Map<string, MarketPattern>();

    for (const manager of memory.managers) {
      const trades = this.getManagerTrades(manager.managerId, memory);
      const buyTargets: { playerId: string; timing: string }[] = [];
      const sellTargets: { playerId: string; timing: string }[] = [];
      
      for (const trade of trades) {
        // Analyze trade context and outcomes
        const isBuyLow = this.isBuyLowTrade(trade, manager.managerId);
        const isSellHigh = this.isSellHighTrade(trade, manager.managerId);
        
        if (isBuyLow) {
          const players = trade.team1.managerId === manager.managerId 
            ? trade.team1.playersReceived 
            : trade.team2.playersReceived;
          
          players.forEach(playerId => {
            buyTargets.push({ playerId, timing: this.getTradeTiming(trade.timestamp) });
          });
        }
        
        if (isSellHigh) {
          const players = trade.team1.managerId === manager.managerId 
            ? trade.team1.playersGiven 
            : trade.team2.playersGiven;
          
          players.forEach(playerId => {
            sellTargets.push({ playerId, timing: this.getTradeTiming(trade.timestamp) });
          });
        }
      }

      const successRate = this.calculateTradeSuccessRate(manager.managerId, trades);
      
      managerPatterns.set(manager.managerId, {
        managerId: manager.managerId,
        buyTargets,
        sellTargets,
        successRate
      });
    }

    return Array.from(managerPatterns.values())
      .filter(p => p.buyTargets.length > 0 || p.sellTargets.length > 0)
      .sort((a, b) => b.successRate - a.successRate);
  }

  // Detect panic trading patterns
  private detectPanicPatterns(memory: LeagueMemory): PanicPattern[] {
    const panicTriggers = new Map<string, { managers: Set<string>; count: number }>();
    
    for (const season of memory.seasons) {
      for (const trade of season.trades) {
        const trigger = this.identifyPanicTrigger(trade, season);
        
        if (trigger) {
          if (!panicTriggers.has(trigger)) {
            panicTriggers.set(trigger, { managers: new Set(), count: 0 });
          }
          
          const data = panicTriggers.get(trigger)!;
          data.managers.add(trade.team1.managerId);
          data.managers.add(trade.team2.managerId);
          data.count++;
        }
      }
    }

    const patterns: PanicPattern[] = [];
    
    for (const [trigger, data] of panicTriggers) {
      if (data.count >= this.MIN_PATTERN_OCCURRENCES) {
        patterns.push({
          trigger,
          managers: Array.from(data.managers),
          overreactionRate: this.calculateOverreactionRate(trigger, memory),
          recoveryTime: this.calculateRecoveryTime(trigger, memory)
        });
      }
    }

    return patterns.sort((a, b) => b.overreactionRate - a.overreactionRate);
  }

  // Waiver pattern analysis
  private analyzeWaiverPatterns(memory: LeagueMemory): {
    claimTiming: TimingPattern[];
    bidPatterns: BidPattern[];
    priorityUsage: PriorityPattern[];
  } {
    return {
      claimTiming: this.analyzeClaimTiming(memory),
      bidPatterns: this.analyzeBidPatterns(memory),
      priorityUsage: this.analyzePriorityUsage(memory)
    };
  }

  // Analyze waiver claim timing
  private analyzeClaimTiming(memory: LeagueMemory): TimingPattern[] {
    const timingMap = new Map<string, { success: number; total: number; competition: number }>();
    
    for (const season of memory.seasons) {
      for (const claim of season.waiverClaims) {
        const day = new Date(claim.timestamp).toLocaleDateString('en-US', { weekday: 'long' });
        const hour = new Date(claim.timestamp).getHours();
        const key = `${day}_${hour}`;
        
        if (!timingMap.has(key)) {
          timingMap.set(key, { success: 0, total: 0, competition: 0 });
        }
        
        const data = timingMap.get(key)!;
        data.total++;
        if (claim.successful) data.success++;
        data.competition += claim.competingClaims.length;
      }
    }

    const patterns: TimingPattern[] = [];
    
    for (const [key, data] of timingMap) {
      const [day, hour] = key.split('_');
      
      patterns.push({
        dayOfWeek: day,
        hourOfDay: parseInt(hour),
        successRate: data.success / data.total,
        competition: data.competition / data.total
      });
    }

    return patterns.sort((a, b) => b.successRate - a.successRate);
  }

  // Analyze FAAB bidding patterns
  private analyzeBidPatterns(memory: LeagueMemory): BidPattern[] {
    const managerBids = new Map<string, number[]>();
    
    for (const season of memory.seasons) {
      for (const claim of season.waiverClaims) {
        if (claim.bidAmount !== undefined) {
          if (!managerBids.has(claim.managerId)) {
            managerBids.set(claim.managerId, []);
          }
          managerBids.get(claim.managerId)!.push(claim.bidAmount);
        }
      }
    }

    const patterns: BidPattern[] = [];
    
    for (const [managerId, bids] of managerBids) {
      if (bids.length >= 10) { // Need sufficient data
        const avgBid = bids.reduce((sum, b) => sum + b, 0) / bids.length;
        const overbids = bids.filter(b => b > avgBid * 1.5).length;
        const underbids = bids.filter(b => b < avgBid * 0.5).length;
        
        patterns.push({
          managerId,
          averageBid: avgBid,
          overbidRate: overbids / bids.length,
          underbidRate: underbids / bids.length,
          adaptability: this.calculateBidAdaptability(managerId, memory)
        });
      }
    }

    return patterns;
  }

  // Analyze waiver priority usage
  private analyzePriorityUsage(memory: LeagueMemory): PriorityPattern[] {
    const managerPriority = new Map<string, { early: number; late: number; total: number }>();
    
    for (const season of memory.seasons) {
      const weekClaims = new Map<number, WaiverClaim[]>();
      
      // Group by week
      for (const claim of season.waiverClaims) {
        const week = this.getWeekNumber(claim.timestamp);
        if (!weekClaims.has(week)) {
          weekClaims.set(week, []);
        }
        weekClaims.get(week)!.push(claim);
      }
      
      // Analyze priority usage
      for (const [week, claims] of weekClaims) {
        const isEarly = week < 6;
        const isLate = week > 10;
        
        for (const claim of claims) {
          if (claim.priority <= 3) { // High priority claim
            if (!managerPriority.has(claim.managerId)) {
              managerPriority.set(claim.managerId, { early: 0, late: 0, total: 0 });
            }
            
            const data = managerPriority.get(claim.managerId)!;
            data.total++;
            if (isEarly) data.early++;
            if (isLate) data.late++;
          }
        }
      }
    }

    const patterns: PriorityPattern[] = [];
    
    for (const [managerId, data] of managerPriority) {
      patterns.push({
        managerId,
        earlyUsage: data.early / data.total,
        lateUsage: data.late / data.total,
        effectiveness: this.calculatePriorityEffectiveness(managerId, memory)
      });
    }

    return patterns;
  }

  // Behavioral pattern analysis
  private analyzeBehavioralPatterns(memory: LeagueMemory): {
    tiltBehavior: TiltPattern[];
    rivalryIntensity: RivalryPattern[];
    groupThink: GroupThinkPattern[];
  } {
    return {
      tiltBehavior: this.detectTiltPatterns(memory),
      rivalryIntensity: this.analyzeRivalries(memory),
      groupThink: this.detectGroupThink(memory)
    };
  }

  // Detect tilt behavior
  private detectTiltPatterns(memory: LeagueMemory): TiltPattern[] {
    const patterns: TiltPattern[] = [];
    
    for (const manager of memory.managers) {
      const tiltEvents = this.identifyTiltEvents(manager.managerId, memory);
      
      if (tiltEvents.length >= this.MIN_PATTERN_OCCURRENCES) {
        const triggers = tiltEvents.map(e => e.trigger);
        const reactions = tiltEvents.map(e => e.reaction);
        const avgDuration = tiltEvents.reduce((sum, e) => sum + e.duration, 0) / tiltEvents.length;
        const avgImpact = tiltEvents.reduce((sum, e) => sum + e.impact, 0) / tiltEvents.length;
        
        patterns.push({
          managerId: manager.managerId,
          triggers: [...new Set(triggers)],
          reactions: [...new Set(reactions)],
          duration: avgDuration,
          impact: avgImpact
        });
      }
    }

    return patterns.sort((a, b) => b.impact - a.impact);
  }

  // Analyze rivalry patterns
  private analyzeRivalries(memory: LeagueMemory): RivalryPattern[] {
    const patterns: RivalryPattern[] = [];
    
    for (const manager of memory.managers) {
      for (const rival of manager.relationships.rivals) {
        const intensity = this.calculateRivalryIntensity(
          manager.managerId,
          rival.managerId,
          memory
        );
        
        const escalation = this.calculateEscalationRate(
          manager.managerId,
          rival.managerId,
          memory
        );
        
        const impact = this.calculateRivalryImpact(
          manager.managerId,
          rival.managerId,
          memory
        );
        
        patterns.push({
          manager1Id: manager.managerId,
          manager2Id: rival.managerId,
          intensity,
          escalationRate: escalation,
          impactOnDecisions: impact
        });
      }
    }

    return patterns.sort((a, b) => b.intensity - a.intensity);
  }

  // Detect group think patterns
  private detectGroupThink(memory: LeagueMemory): GroupThinkPattern[] {
    const patterns: GroupThinkPattern[] = [];
    const topics = this.identifyGroupThinkTopics(memory);
    
    for (const topic of topics) {
      const participants = this.getTopicParticipants(topic, memory);
      const contrarians = this.getContrarians(topic, memory);
      const outcome = this.evaluateGroupThinkOutcome(topic, memory);
      
      if (participants.length >= 4) { // Need critical mass
        patterns.push({
          topic,
          participants,
          contrarians,
          outcome
        });
      }
    }

    return patterns;
  }

  // Anomaly detection
  detectAnomalies(memory: LeagueMemory): {
    transactions: Transaction[];
    trades: Trade[];
    drafts: DraftResult[];
  } {
    return {
      transactions: this.detectTransactionAnomalies(memory),
      trades: this.detectTradeAnomalies(memory),
      drafts: this.detectDraftAnomalies(memory)
    };
  }

  // Helper methods
  private getWeekNumber(date: Date): number {
    const startOfSeason = new Date(date.getFullYear(), 8, 1); // September 1
    const diff = date.getTime() - startOfSeason.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
  }

  private extractTradeThemes(trades: Trade[]): string[] {
    // Implement theme extraction logic
    return ['buy-low', 'sell-high', 'position-swap', 'consolidation'];
  }

  private identifyTradeTriggers(trades: Trade[], memory: LeagueMemory): string[] {
    // Implement trigger identification
    return ['injury', 'breakout', 'slump', 'bye-week'];
  }

  private getManagerTrades(managerId: string, memory: LeagueMemory): Trade[] {
    const trades: Trade[] = [];
    for (const season of memory.seasons) {
      trades.push(...season.trades.filter(t => 
        t.team1.managerId === managerId || t.team2.managerId === managerId
      ));
    }
    return trades;
  }

  private isBuyLowTrade(trade: Trade, managerId: string): boolean {
    // Implement buy-low detection logic
    return Math.random() > 0.7; // Placeholder
  }

  private isSellHighTrade(trade: Trade, managerId: string): boolean {
    // Implement sell-high detection logic
    return Math.random() > 0.7; // Placeholder
  }

  private getTradeTiming(timestamp: Date): string {
    const week = this.getWeekNumber(timestamp);
    if (week < 4) return 'early';
    if (week < 10) return 'mid';
    if (week < 14) return 'late';
    return 'deadline';
  }

  private calculateTradeSuccessRate(managerId: string, trades: Trade[]): number {
    // Calculate based on trade outcomes
    let wins = 0;
    for (const trade of trades) {
      if (trade.outcome.winner === managerId) wins++;
    }
    return trades.length > 0 ? wins / trades.length : 0;
  }

  private identifyPanicTrigger(trade: Trade, season: any): string | null {
    // Implement panic trigger detection
    const triggers = ['major-injury', 'losing-streak', 'rival-success'];
    return triggers[Math.floor(Math.random() * triggers.length)];
  }

  private calculateOverreactionRate(trigger: string, memory: LeagueMemory): number {
    // Calculate how often the trigger leads to overreaction
    return 0.65; // Placeholder
  }

  private calculateRecoveryTime(trigger: string, memory: LeagueMemory): number {
    // Calculate average recovery time in weeks
    return 3.5; // Placeholder
  }

  private calculateBidAdaptability(managerId: string, memory: LeagueMemory): number {
    // Calculate how well manager adapts bids based on competition
    return 0.75; // Placeholder
  }

  private calculatePriorityEffectiveness(managerId: string, memory: LeagueMemory): number {
    // Calculate how effectively manager uses priority
    return 0.82; // Placeholder
  }

  private identifyTiltEvents(managerId: string, memory: LeagueMemory): any[] {
    // Identify tilt events for manager
    return []; // Placeholder
  }

  private calculateRivalryIntensity(
    manager1: string,
    manager2: string,
    memory: LeagueMemory
  ): number {
    // Calculate rivalry intensity
    return 0.85; // Placeholder
  }

  private calculateEscalationRate(
    manager1: string,
    manager2: string,
    memory: LeagueMemory
  ): number {
    // Calculate how quickly rivalry escalates
    return 0.45; // Placeholder
  }

  private calculateRivalryImpact(
    manager1: string,
    manager2: string,
    memory: LeagueMemory
  ): number {
    // Calculate impact on decision making
    return 0.72; // Placeholder
  }

  private identifyGroupThinkTopics(memory: LeagueMemory): string[] {
    // Identify topics prone to group think
    return ['rookie-hype', 'injury-panic', 'breakout-chase'];
  }

  private getTopicParticipants(topic: string, memory: LeagueMemory): string[] {
    // Get managers who participate in group think
    return [];
  }

  private getContrarians(topic: string, memory: LeagueMemory): string[] {
    // Get managers who go against group think
    return [];
  }

  private evaluateGroupThinkOutcome(topic: string, memory: LeagueMemory): string {
    // Evaluate outcome of group think
    return 'negative';
  }

  private detectTransactionAnomalies(memory: LeagueMemory): Transaction[] {
    // Detect unusual transactions
    return [];
  }

  private detectTradeAnomalies(memory: LeagueMemory): Trade[] {
    // Detect unusual trades
    return [];
  }

  private detectDraftAnomalies(memory: LeagueMemory): DraftResult[] {
    // Detect unusual draft picks
    return [];
  }
}
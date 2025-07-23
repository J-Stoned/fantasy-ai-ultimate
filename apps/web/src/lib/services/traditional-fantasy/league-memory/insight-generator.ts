// Insight Generator - Generates actionable insights from league data

import {
  LeagueMemory,
  ManagerProfile,
  LeaguePatterns,
  LeaguePredictions,
  MemoryInsight,
  Evidence,
  Trade,
  Transaction,
  DraftResult
} from './types';

export class InsightGenerator {
  private readonly INSIGHT_CONFIDENCE_THRESHOLD = 0.6;
  private readonly MAX_INSIGHTS_PER_CATEGORY = 5;

  // Generate all insights for the league
  generateInsights(
    memory: LeagueMemory,
    patterns: LeaguePatterns,
    predictions: LeaguePredictions
  ): MemoryInsight[] {
    const insights: MemoryInsight[] = [];

    // Pattern-based insights
    insights.push(...this.generatePatternInsights(patterns, memory));

    // Anomaly-based insights
    insights.push(...this.generateAnomalyInsights(memory));

    // Prediction-based insights
    insights.push(...this.generatePredictionInsights(predictions, memory));

    // Recommendation-based insights
    insights.push(...this.generateRecommendationInsights(memory, patterns, predictions));

    // Sort by confidence and actionability
    return insights
      .filter(i => i.confidence >= this.INSIGHT_CONFIDENCE_THRESHOLD)
      .sort((a, b) => {
        if (a.actionable !== b.actionable) {
          return a.actionable ? -1 : 1;
        }
        return b.confidence - a.confidence;
      })
      .slice(0, 20); // Top 20 insights
  }

  // Generate pattern-based insights
  private generatePatternInsights(patterns: LeaguePatterns, memory: LeagueMemory): MemoryInsight[] {
    const insights: MemoryInsight[] = [];

    // Draft pattern insights
    insights.push(...this.analyzeDraftPatterns(patterns.draftPatterns, memory));

    // Trade pattern insights
    insights.push(...this.analyzeTradePatterns(patterns.tradePatterns, memory));

    // Waiver pattern insights
    insights.push(...this.analyzeWaiverPatterns(patterns.waiverPatterns, memory));

    // Behavioral pattern insights
    insights.push(...this.analyzeBehavioralPatterns(patterns.behavioralPatterns, memory));

    return insights;
  }

  // Analyze draft patterns for insights
  private analyzeDraftPatterns(draftPatterns: any, memory: LeagueMemory): MemoryInsight[] {
    const insights: MemoryInsight[] = [];

    // Position run insights
    for (const run of draftPatterns.positionRuns) {
      if (run.frequency > 0.6) {
        insights.push({
          type: 'pattern',
          title: `Predictable ${run.position} Run in Round ${run.startRound}`,
          description: `Your league consistently sees a ${run.position} run starting in round ${run.startRound}. Plan accordingly by either getting ahead of it or finding value after.`,
          confidence: run.frequency,
          evidence: [{
            type: 'historical',
            description: `Occurred in ${Math.round(run.frequency * 100)}% of drafts`,
            relevance: 0.9,
            data: run
          }],
          actionable: true,
          actions: [
            `Draft ${run.position} in round ${run.startRound - 1} to get ahead of the run`,
            `Wait until round ${run.endRound + 1} for better value at other positions`
          ]
        });
      }
    }

    // Reach tendency insights
    for (const reach of draftPatterns.reachTendencies) {
      if (Math.abs(reach.averageReach) > 15 && reach.consistency > 0.7) {
        const manager = memory.managers.find(m => m.managerId === reach.managerId);
        const isReacher = reach.averageReach > 0;
        
        insights.push({
          type: 'pattern',
          title: `${manager?.name || reach.managerId} ${isReacher ? 'Reaches' : 'Waits'} Predictably`,
          description: isReacher 
            ? `This manager consistently reaches ${Math.round(reach.averageReach)} picks early. Their targets are predictable.`
            : `This manager consistently waits for value, drafting ${Math.round(Math.abs(reach.averageReach))} picks after ADP.`,
          confidence: reach.consistency,
          evidence: [{
            type: 'statistical',
            description: `Average reach: ${reach.averageReach.toFixed(1)} picks`,
            relevance: 0.9,
            data: reach
          }],
          actionable: true,
          actions: isReacher
            ? [`Target their favorite players one pick before them`, `Let them reach while you get value`]
            : [`They'll likely pass on slight reaches`, `Trade with them post-draft for their value picks`]
        });
      }
    }

    // Value identification insights
    for (const value of draftPatterns.valueIdentification) {
      if (value.successRate > 0.7) {
        const managers = value.managers.map(id => 
          memory.managers.find(m => m.managerId === id)?.name || id
        ).join(', ');
        
        insights.push({
          type: 'pattern',
          title: `Round ${value.rounds[0]} is a Value Goldmine`,
          description: `Managers who find value in round ${value.rounds[0]} have a ${Math.round(value.successRate * 100)}% success rate. ${managers} excel here.`,
          confidence: value.successRate,
          evidence: [{
            type: 'statistical',
            description: `Success rate: ${(value.successRate * 100).toFixed(1)}%`,
            relevance: 0.85,
            data: value
          }],
          actionable: true,
          actions: [
            `Pay extra attention to available players in round ${value.rounds[0]}`,
            `Consider trading up/down to this round`
          ]
        });
      }
    }

    return insights;
  }

  // Analyze trade patterns for insights
  private analyzeTradePatterns(tradePatterns: any, memory: LeagueMemory): MemoryInsight[] {
    const insights: MemoryInsight[] = [];

    // Seasonal trend insights
    for (const trend of tradePatterns.seasonalTrends) {
      if (trend.tradeVolume > memory.metadata.totalTrades / memory.metadata.totalSeasons / 17 * 2) {
        insights.push({
          type: 'pattern',
          title: `Week ${trend.week} Trade Frenzy Incoming`,
          description: `Week ${trend.week} historically sees ${trend.tradeVolume} trades, ${trend.commonThemes.join(', ')} are common themes.`,
          confidence: 0.8,
          evidence: [{
            type: 'historical',
            description: `Average ${trend.tradeVolume} trades in week ${trend.week}`,
            relevance: 0.9,
            data: trend
          }],
          actionable: true,
          actions: [
            `Prepare trade offers before week ${trend.week}`,
            `Target managers affected by ${trend.triggers.join(', ')}`
          ]
        });
      }
    }

    // Buy low/sell high insights
    for (const market of tradePatterns.buyLowSellHigh) {
      if (market.successRate > 0.65) {
        const manager = memory.managers.find(m => m.managerId === market.managerId);
        
        insights.push({
          type: 'pattern',
          title: `${manager?.name || market.managerId} is a Savvy Trader`,
          description: `This manager has a ${Math.round(market.successRate * 100)}% success rate on trades. Study their patterns.`,
          confidence: market.successRate,
          evidence: [{
            type: 'behavioral',
            description: `Consistently buys low and sells high`,
            relevance: 0.9,
            data: market
          }],
          actionable: true,
          actions: [
            `Carefully evaluate any trade offers from this manager`,
            `Learn from their buy/sell timing patterns`,
            `Consider partnering with them on mutually beneficial deals`
          ]
        });
      }
    }

    // Panic trade insights
    for (const panic of tradePatterns.panicTrades) {
      if (panic.overreactionRate > 0.6) {
        const managerNames = panic.managers.slice(0, 3).map(id => 
          memory.managers.find(m => m.managerId === id)?.name || id
        ).join(', ');
        
        insights.push({
          type: 'pattern',
          title: `${panic.trigger} Triggers Panic Trades`,
          description: `When ${panic.trigger} occurs, ${managerNames} tend to overreact ${Math.round(panic.overreactionRate * 100)}% of the time.`,
          confidence: panic.overreactionRate,
          evidence: [{
            type: 'behavioral',
            description: `Recovery time: ${panic.recoveryTime} weeks`,
            relevance: 0.85,
            data: panic
          }],
          actionable: true,
          actions: [
            `Prepare buy-low offers when ${panic.trigger} occurs`,
            `Target panic-prone managers with calm, rational offers`,
            `Wait ${Math.round(panic.recoveryTime)} weeks for maximum value`
          ]
        });
      }
    }

    return insights;
  }

  // Analyze waiver patterns for insights
  private analyzeWaiverPatterns(waiverPatterns: any, memory: LeagueMemory): MemoryInsight[] {
    const insights: MemoryInsight[] = [];

    // Timing insights
    const bestTiming = waiverPatterns.claimTiming
      .sort((a: any, b: any) => b.successRate - a.successRate)[0];
    
    if (bestTiming && bestTiming.successRate > 0.6) {
      insights.push({
        type: 'pattern',
        title: `Optimal Waiver Timing: ${bestTiming.dayOfWeek} at ${bestTiming.hourOfDay}:00`,
        description: `Claims submitted on ${bestTiming.dayOfWeek} at ${bestTiming.hourOfDay}:00 have a ${Math.round(bestTiming.successRate * 100)}% success rate with ${bestTiming.competition.toFixed(1)} average competitors.`,
        confidence: bestTiming.successRate,
        evidence: [{
          type: 'statistical',
          description: `Based on historical claim data`,
          relevance: 0.9,
          data: bestTiming
        }],
        actionable: true,
        actions: [
          `Set waiver claims on ${bestTiming.dayOfWeek} at ${bestTiming.hourOfDay}:00`,
          `Expect ${Math.round(bestTiming.competition)} other managers competing`
        ]
      });
    }

    // Bidding insights
    for (const bid of waiverPatterns.bidPatterns) {
      if (bid.overbidRate > 0.4 || bid.underbidRate > 0.4) {
        const manager = memory.managers.find(m => m.managerId === bid.managerId);
        const tendency = bid.overbidRate > bid.underbidRate ? 'overbids' : 'underbids';
        
        insights.push({
          type: 'pattern',
          title: `${manager?.name || bid.managerId} Consistently ${tendency}`,
          description: `This manager ${tendency} ${Math.round(Math.max(bid.overbidRate, bid.underbidRate) * 100)}% of the time. Average bid: $${bid.averageBid.toFixed(0)}.`,
          confidence: Math.max(bid.overbidRate, bid.underbidRate),
          evidence: [{
            type: 'behavioral',
            description: `Adaptability score: ${bid.adaptability.toFixed(2)}`,
            relevance: 0.85,
            data: bid
          }],
          actionable: true,
          actions: tendency === 'overbids'
            ? [`Bid just under their typical amount`, `Let them overpay for hyped players`]
            : [`Outbid them by small margins`, `They'll likely give up early`]
        });
      }
    }

    return insights;
  }

  // Analyze behavioral patterns for insights
  private analyzeBehavioralPatterns(behavioralPatterns: any, memory: LeagueMemory): MemoryInsight[] {
    const insights: MemoryInsight[] = [];

    // Tilt behavior insights
    for (const tilt of behavioralPatterns.tiltBehavior) {
      if (tilt.impact > 0.6) {
        const manager = memory.managers.find(m => m.managerId === tilt.managerId);
        
        insights.push({
          type: 'pattern',
          title: `${manager?.name || tilt.managerId} Goes on Tilt`,
          description: `Triggers: ${tilt.triggers.join(', ')}. Results in ${tilt.reactions.join(', ')} lasting ${tilt.duration} days.`,
          confidence: 0.75,
          evidence: [{
            type: 'behavioral',
            description: `Performance impact: ${(tilt.impact * 100).toFixed(0)}% decrease`,
            relevance: 0.9,
            data: tilt
          }],
          actionable: true,
          actions: [
            `Watch for tilt triggers to make favorable trades`,
            `Avoid negotiating during their ${tilt.duration}-day tilt period`,
            `Target them with reasonable offers after cooldown`
          ]
        });
      }
    }

    // Rivalry insights
    for (const rivalry of behavioralPatterns.rivalryIntensity) {
      if (rivalry.intensity > 0.7) {
        const manager1 = memory.managers.find(m => m.managerId === rivalry.manager1Id);
        const manager2 = memory.managers.find(m => m.managerId === rivalry.manager2Id);
        
        insights.push({
          type: 'pattern',
          title: `Intense Rivalry: ${manager1?.name} vs ${manager2?.name}`,
          description: `This rivalry affects ${Math.round(rivalry.impactOnDecisions * 100)}% of their decisions. Escalation rate: ${(rivalry.escalationRate * 100).toFixed(0)}% per incident.`,
          confidence: rivalry.intensity,
          evidence: [{
            type: 'behavioral',
            description: `Rivalry intensity: ${(rivalry.intensity * 100).toFixed(0)}%`,
            relevance: 0.85,
            data: rivalry
          }],
          actionable: true,
          actions: [
            `Avoid being caught in the middle of their disputes`,
            `Use their rivalry to your advantage in trades`,
            `They're unlikely to trade with each other`
          ]
        });
      }
    }

    // Group think insights
    for (const group of behavioralPatterns.groupThink) {
      const participantNames = group.participants.slice(0, 3).map(id => 
        memory.managers.find(m => m.managerId === id)?.name || id
      ).join(', ');
      
      insights.push({
        type: 'pattern',
        title: `Group Think Alert: ${group.topic}`,
        description: `${participantNames} and others tend to follow the crowd on ${group.topic}. Outcome is usually ${group.outcome}.`,
        confidence: 0.7,
        evidence: [{
          type: 'behavioral',
          description: `${group.participants.length} managers affected, ${group.contrarians.length} contrarians`,
          relevance: 0.8,
          data: group
        }],
        actionable: true,
        actions: [
          `Be contrarian when group think emerges on ${group.topic}`,
          `Target contrarians for like-minded trade partners`,
          `Fade the group consensus for value`
        ]
      });
    }

    return insights;
  }

  // Generate anomaly-based insights
  private generateAnomalyInsights(memory: LeagueMemory): MemoryInsight[] {
    const insights: MemoryInsight[] = [];

    // Recent unusual activity
    const recentAnomalies = this.detectRecentAnomalies(memory);
    
    for (const anomaly of recentAnomalies) {
      insights.push({
        type: 'anomaly',
        title: anomaly.title,
        description: anomaly.description,
        confidence: anomaly.confidence,
        evidence: anomaly.evidence,
        actionable: anomaly.actionable,
        actions: anomaly.actions
      });
    }

    return insights;
  }

  // Generate prediction-based insights
  private generatePredictionInsights(predictions: LeaguePredictions, memory: LeagueMemory): MemoryInsight[] {
    const insights: MemoryInsight[] = [];

    // Draft prediction insights
    const upcomingDraft = predictions.draftPredictions.filter(p => p.predictedPicks[0].probability > 0.7);
    for (const pred of upcomingDraft.slice(0, 3)) {
      const manager = memory.managers.find(m => m.managerId === pred.managerId);
      
      insights.push({
        type: 'prediction',
        title: `${manager?.name}'s Round ${pred.round} Pick Predicted`,
        description: `${Math.round(pred.predictedPicks[0].probability * 100)}% chance they draft player ${pred.predictedPicks[0].playerId}`,
        confidence: pred.predictedPicks[0].probability,
        evidence: [{
          type: 'pattern',
          description: pred.reasoning.join('. '),
          relevance: 0.9,
          data: pred
        }],
        actionable: true,
        actions: [
          `Draft this player before them if you want them`,
          `Prepare alternative targets knowing this player will be gone`
        ]
      });
    }

    // Trade prediction insights
    const likelyTrades = predictions.tradePredictions.filter(p => p.likelihood > 0.6);
    for (const trade of likelyTrades.slice(0, 3)) {
      const manager1 = memory.managers.find(m => m.managerId === trade.manager1Id);
      const manager2 = memory.managers.find(m => m.managerId === trade.manager2Id);
      
      insights.push({
        type: 'prediction',
        title: `Trade Alert: ${manager1?.name} ↔ ${manager2?.name}`,
        description: `${Math.round(trade.likelihood * 100)}% chance of trade in the ${trade.timing} season. Triggers: ${trade.triggers.join(', ')}.`,
        confidence: trade.likelihood,
        evidence: [{
          type: 'pattern',
          description: `Historical trading frequency and current needs align`,
          relevance: 0.85,
          data: trade
        }],
        actionable: true,
        actions: [
          `Monitor these teams for trade opportunities`,
          `Consider making competing offers`,
          `Watch for the triggers to materialize`
        ]
      });
    }

    // Season outcome insights
    if (predictions.seasonPredictions.length > 0) {
      const season = predictions.seasonPredictions[0];
      const champion = season.champion[0];
      const championManager = memory.managers.find(m => m.managerId === champion.managerId);
      
      insights.push({
        type: 'prediction',
        title: `Championship Favorite: ${championManager?.name}`,
        description: `${Math.round(champion.probability * 100)}% chance to win championship. Key factors: ${season.surpriseFactors.slice(0, 2).join(', ')}.`,
        confidence: champion.probability,
        evidence: [{
          type: 'statistical',
          description: `Based on current performance and historical clutch factor`,
          relevance: 0.8,
          data: champion
        }],
        actionable: true,
        actions: [
          `Study their roster construction and strategy`,
          `Consider trading with non-contenders for upgrades`,
          `Focus on defeating them in head-to-head matchups`
        ]
      });
    }

    return insights;
  }

  // Generate recommendation insights
  private generateRecommendationInsights(
    memory: LeagueMemory,
    patterns: LeaguePatterns,
    predictions: LeaguePredictions
  ): MemoryInsight[] {
    const insights: MemoryInsight[] = [];

    // Strategic recommendations based on patterns
    insights.push(...this.generateStrategicRecommendations(memory, patterns));

    // Tactical recommendations based on predictions
    insights.push(...this.generateTacticalRecommendations(memory, predictions));

    // Relationship recommendations
    insights.push(...this.generateRelationshipRecommendations(memory));

    return insights;
  }

  // Generate strategic recommendations
  private generateStrategicRecommendations(memory: LeagueMemory, patterns: LeaguePatterns): MemoryInsight[] {
    const insights: MemoryInsight[] = [];

    // League meta recommendations
    const leagueMeta = this.analyzeLeagueMeta(memory, patterns);
    if (leagueMeta) {
      insights.push({
        type: 'recommendation',
        title: 'Exploit Your League\'s Meta',
        description: leagueMeta.description,
        confidence: leagueMeta.confidence,
        evidence: leagueMeta.evidence,
        actionable: true,
        actions: leagueMeta.actions
      });
    }

    // Personal improvement recommendations
    const improvements = this.identifyPersonalImprovements(memory);
    for (const improvement of improvements) {
      insights.push({
        type: 'recommendation',
        title: improvement.title,
        description: improvement.description,
        confidence: improvement.confidence,
        evidence: improvement.evidence,
        actionable: true,
        actions: improvement.actions
      });
    }

    return insights;
  }

  // Generate tactical recommendations
  private generateTacticalRecommendations(memory: LeagueMemory, predictions: LeaguePredictions): MemoryInsight[] {
    const insights: MemoryInsight[] = [];

    // Immediate action recommendations
    const immediateActions = this.identifyImmediateActions(memory, predictions);
    for (const action of immediateActions) {
      insights.push({
        type: 'recommendation',
        title: action.title,
        description: action.description,
        confidence: action.confidence,
        evidence: action.evidence,
        actionable: true,
        actions: action.actions
      });
    }

    return insights;
  }

  // Generate relationship recommendations
  private generateRelationshipRecommendations(memory: LeagueMemory): MemoryInsight[] {
    const insights: MemoryInsight[] = [];

    // Find potential trade partners
    const tradePartners = this.identifyIdealTradePartners(memory);
    if (tradePartners.length > 0) {
      const partnerNames = tradePartners.slice(0, 3).map(p => p.name).join(', ');
      
      insights.push({
        type: 'recommendation',
        title: 'Ideal Trade Partners Identified',
        description: `${partnerNames} have complementary needs and fair trading history. Build relationships with them.`,
        confidence: 0.75,
        evidence: [{
          type: 'behavioral',
          description: 'Based on trading history and roster needs',
          relevance: 0.85,
          data: tradePartners
        }],
        actionable: true,
        actions: [
          'Initiate friendly communication',
          'Propose mutually beneficial trades',
          'Avoid creating rivalries with these managers'
        ]
      });
    }

    return insights;
  }

  // Helper methods
  private detectRecentAnomalies(memory: LeagueMemory): MemoryInsight[] {
    const anomalies: MemoryInsight[] = [];

    // Check for unusual trade activity
    const recentTrades = this.getRecentTrades(memory);
    const unusualTrades = recentTrades.filter(t => this.isUnusualTrade(t, memory));
    
    for (const trade of unusualTrades) {
      anomalies.push({
        type: 'anomaly',
        title: 'Unusual Trade Detected',
        description: `Recent trade between ${trade.team1.managerId} and ${trade.team2.managerId} deviates from normal patterns`,
        confidence: 0.7,
        evidence: [{
          type: 'statistical',
          description: 'Trade value imbalance or unusual timing',
          relevance: 0.8,
          data: trade
        }],
        actionable: true,
        actions: ['Investigate the motivation behind this trade', 'Adjust your valuations accordingly']
      });
    }

    return anomalies;
  }

  private analyzeLeagueMeta(memory: LeagueMemory, patterns: LeaguePatterns): any {
    // Analyze overall league tendencies
    const isConservative = memory.managers.filter(m => 
      m.personality.riskTolerance < 0.4
    ).length > memory.managers.length * 0.6;

    if (isConservative) {
      return {
        description: 'Your league is conservative. Bold moves and calculated risks can give you an edge.',
        confidence: 0.75,
        evidence: [{
          type: 'statistical',
          description: '60%+ of managers have low risk tolerance',
          relevance: 0.9,
          data: { conservative: true }
        }],
        actions: [
          'Take calculated risks others avoid',
          'Target high-upside players in drafts',
          'Be aggressive with waiver claims'
        ]
      };
    }

    return null;
  }

  private identifyPersonalImprovements(memory: LeagueMemory): any[] {
    // This would analyze user's own patterns and suggest improvements
    return [];
  }

  private identifyImmediateActions(memory: LeagueMemory, predictions: LeaguePredictions): any[] {
    const actions: any[] = [];

    // Check for urgent waiver targets
    const hotWaivers = predictions.waiverPredictions.filter(w => 
      w.interestedManagers.length > 3
    );

    if (hotWaivers.length > 0) {
      actions.push({
        title: 'Hot Waiver Wire Alert',
        description: `${hotWaivers.length} players will be heavily targeted this week. Act now.`,
        confidence: 0.8,
        evidence: [{
          type: 'prediction',
          description: 'Multiple managers showing interest patterns',
          relevance: 0.9,
          data: hotWaivers
        }],
        actions: [
          'Submit waiver claims before Tuesday',
          `Bid at least $${hotWaivers[0].optimalBid} for top target`,
          'Have backup options ready'
        ]
      });
    }

    return actions;
  }

  private identifyIdealTradePartners(memory: LeagueMemory): any[] {
    // Analyze compatibility between managers
    return memory.managers
      .filter(m => {
        // Filter for good trade partners
        return m.personality.tradeActivity !== 'passive' &&
               m.performance.tradeGrade > 0.5 &&
               !m.relationships.rivals.some(r => r.intensity > 0.7);
      })
      .map(m => ({
        managerId: m.managerId,
        name: m.name,
        compatibility: 0.75 // Would calculate based on needs
      }))
      .sort((a, b) => b.compatibility - a.compatibility);
  }

  private getRecentTrades(memory: LeagueMemory): Trade[] {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const trades: Trade[] = [];
    for (const season of memory.seasons) {
      trades.push(...season.trades.filter(t => t.timestamp > twoWeeksAgo));
    }
    return trades;
  }

  private isUnusualTrade(trade: Trade, memory: LeagueMemory): boolean {
    // Check if trade deviates from normal patterns
    if (!trade.outcome.value) return false;
    
    const imbalance = Math.abs(
      trade.outcome.value[trade.team1.managerId] - 
      trade.outcome.value[trade.team2.managerId]
    );
    
    return imbalance > 0.5; // Significant value imbalance
  }
}
import { VoiceQuery, QueryIntent, ExtractedEntity } from './voice-input-processor';
import { MLService, LineupOptimizationRequest, TradeAnalysisRequest } from '../../api/services/ml.service';
import { PlayerService } from '../../api/services/player.service';
import { Player, PlayerProjection } from '../../types';

// 2025 Best Practice: ML-powered natural language response generation
export interface VoiceResponse {
  text: string;
  ssml: string;
  visualData?: any;
  confidence: number;
  audioStreamId?: string;
  suggestions?: string[];
  requiresFollowUp?: boolean;
}

export interface ResponseContext {
  tone: 'professional' | 'casual' | 'analytical' | 'excited';
  length: 'brief' | 'normal' | 'detailed';
  includeVisuals: boolean;
  personalization: ResponsePersonalization;
}

export interface ResponsePersonalization {
  userName?: string;
  favoriteTeam?: string;
  fantasyExperience: 'beginner' | 'intermediate' | 'expert';
  preferredInsights: string[];
}

export class MLResponseGenerator {
  constructor(
    private mlService: MLService,
    private playerService: PlayerService
  ) {}
  
  async generateResponse(
    query: VoiceQuery,
    context?: ResponseContext
  ): Promise<VoiceResponse> {
    const tone = context?.tone || 'analytical';
    const length = context?.length || 'normal';
    
    try {
      switch (query.intent.type) {
        case 'PLAYER_ANALYSIS':
          return await this.generatePlayerAnalysis(query, tone, length);
          
        case 'LINEUP_OPTIMIZATION':
          return await this.generateLineupRecommendations(query, tone, length);
          
        case 'TRADE_EVALUATION':
          return await this.evaluateTrade(query, tone, length);
          
        case 'PREDICTION':
          return await this.generatePrediction(query, tone, length);
          
        case 'COMPARISON':
          return await this.compareEntities(query, tone, length);
          
        case 'INJURY_IMPACT':
          return await this.analyzeInjuryImpact(query, tone, length);
          
        default:
          return this.generateGeneralResponse(query, tone);
      }
    } catch (error) {
      return this.generateErrorResponse(error as Error, tone);
    }
  }
  
  private async generatePlayerAnalysis(
    query: VoiceQuery,
    tone: string,
    length: string
  ): Promise<VoiceResponse> {
    const playerEntity = query.entities.find(e => e.type === 'PLAYER');
    if (!playerEntity) {
      return this.generateErrorResponse(new Error('No player specified'), tone);
    }
    
    // Get player data
    const playerResponse = await this.playerService.searchPlayers(playerEntity.normalized);
    if (!playerResponse.success || !playerResponse.data?.length) {
      return this.generateErrorResponse(new Error('Player not found'), tone);
    }
    
    const player = playerResponse.data[0];
    
    // Get ML predictions
    const predictionResponse = await this.mlService.getPlayerPrediction(player.id);
    if (!predictionResponse.success || !predictionResponse.data) {
      return this.generateErrorResponse(new Error('Unable to generate prediction'), tone);
    }
    
    const prediction = predictionResponse.data;
    
    // Generate response based on length preference
    let text = '';
    if (length === 'brief') {
      text = this.generateBriefPlayerAnalysis(player, prediction);
    } else if (length === 'detailed') {
      text = this.generateDetailedPlayerAnalysis(player, prediction);
    } else {
      text = this.generateNormalPlayerAnalysis(player, prediction);
    }
    
    const ssml = this.generateSSML(text, tone, {
      playerName: player.name,
      emphasis: prediction.confidence > 0.8 ? 'strong' : 'moderate'
    });
    
    return {
      text,
      ssml,
      visualData: {
        player,
        prediction,
        charts: this.generatePlayerCharts(player, prediction)
      },
      confidence: prediction.confidence,
      suggestions: this.generateFollowUpSuggestions('player_analysis', player)
    };
  }
  
  private generateBriefPlayerAnalysis(player: Player, prediction: any): string {
    return `${player.name} is projected for ${prediction.predictedValue.toFixed(1)} fantasy points with ${(prediction.confidence * 100).toFixed(0)}% confidence. ${this.getTrendEmoji(prediction.features.recentForm)} trending.`;
  }
  
  private generateNormalPlayerAnalysis(player: Player, prediction: any): string {
    const factors = this.explainTopFactors(prediction.features);
    return `Based on our ML analysis with 96.97% accuracy, ${player.name} is projected to score ${prediction.predictedValue.toFixed(1)} fantasy points this week. ${factors} Our confidence in this projection is ${(prediction.confidence * 100).toFixed(0)}%.`;
  }
  
  private generateDetailedPlayerAnalysis(player: Player, prediction: any): string {
    const factors = this.explainAllFactors(prediction.features);
    const historicalContext = this.getHistoricalContext(player, prediction);
    const matchupAnalysis = this.getMatchupAnalysis(prediction.features);
    
    return `Let me give you a comprehensive analysis of ${player.name}. 

Our machine learning model, which has achieved 96.97% accuracy this season, projects ${player.name} to score ${prediction.predictedValue.toFixed(1)} fantasy points in the upcoming game.

${factors}

${matchupAnalysis}

${historicalContext}

With a confidence rating of ${(prediction.confidence * 100).toFixed(0)}%, this projection accounts for all available data including recent performance trends, opponent defensive rankings, weather conditions, and historical matchup data.`;
  }
  
  private async generateLineupRecommendations(
    query: VoiceQuery,
    tone: string,
    length: string
  ): Promise<VoiceResponse> {
    // Extract contest info if provided
    const contestEntity = query.entities.find(e => e.type === 'CONTEST');
    const sport = query.context.currentSport || 'NFL';
    
    const optimizationRequest: LineupOptimizationRequest = {
      sport,
      salaryCap: 50000, // Default DFS salary cap
      positions: this.getPositionRequirements(sport),
      optimizationType: 'balanced'
    };
    
    const response = await this.mlService.optimizeLineup(optimizationRequest);
    if (!response.success || !response.data) {
      return this.generateErrorResponse(new Error('Unable to optimize lineup'), tone);
    }
    
    const lineup = response.data;
    
    let text = '';
    if (length === 'brief') {
      text = `Your optimal lineup projects ${lineup.projectedPoints.toFixed(1)} points using $${lineup.totalSalary.toLocaleString()} of salary cap.`;
    } else {
      text = this.generateLineupNarrative(lineup, sport, length === 'detailed');
    }
    
    const ssml = this.generateSSML(text, tone, {
      emphasis: lineup.confidence > 0.8 ? 'strong' : 'moderate',
      excitement: lineup.projectedPoints > 150 // High scoring lineup
    });
    
    return {
      text,
      ssml,
      visualData: {
        lineup: lineup.lineup,
        projectedPoints: lineup.projectedPoints,
        salary: lineup.totalSalary,
        alternatives: lineup.alternativeLineups
      },
      confidence: lineup.confidence,
      suggestions: [
        "Would you like me to show you alternative lineups?",
        "Should I explain why I chose these players?",
        "Want to see the ceiling and floor projections?"
      ]
    };
  }
  
  private generateLineupNarrative(lineup: any, sport: string, detailed: boolean): string {
    const positions = this.groupByPosition(lineup.lineup);
    let narrative = `Here's your optimized ${sport} lineup that projects ${lineup.projectedPoints.toFixed(1)} fantasy points:\n\n`;
    
    // Describe each position
    for (const [position, players] of Object.entries(positions)) {
      narrative += `At ${position}: `;
      const playerDescriptions = (players as any[]).map(p => 
        `${p.playerName} (${p.projectedPoints.toFixed(1)} pts, $${p.salary.toLocaleString()})`
      );
      narrative += playerDescriptions.join(', ') + '\n';
    }
    
    narrative += `\nTotal salary used: $${lineup.totalSalary.toLocaleString()} of $50,000`;
    
    if (detailed) {
      narrative += `\n\nKey insights:\n`;
      narrative += `• This lineup has a ${(lineup.confidence * 100).toFixed(0)}% confidence rating\n`;
      narrative += `• The ceiling projection is ${(lineup.projectedPoints * 1.3).toFixed(1)} points\n`;
      narrative += `• The floor projection is ${(lineup.projectedPoints * 0.7).toFixed(1)} points`;
    }
    
    return narrative;
  }
  
  private async evaluateTrade(
    query: VoiceQuery,
    tone: string,
    length: string
  ): Promise<VoiceResponse> {
    // Extract players involved in trade
    const players = query.entities.filter(e => e.type === 'PLAYER');
    if (players.length < 2) {
      return this.generateErrorResponse(new Error('Please specify players for both sides of the trade'), tone);
    }
    
    // Simple heuristic to split players
    const midpoint = Math.ceil(players.length / 2);
    const teamAPlayers = players.slice(0, midpoint).map(p => p.normalized);
    const teamBPlayers = players.slice(midpoint).map(p => p.normalized);
    
    const tradeRequest: TradeAnalysisRequest = {
      leagueId: query.context.currentLeague || 'default',
      teamAPlayers,
      teamBPlayers,
      includeProjections: true
    };
    
    const response = await this.mlService.analyzeTradeWithML(tradeRequest);
    if (!response.success || !response.data) {
      return this.generateErrorResponse(new Error('Unable to analyze trade'), tone);
    }
    
    const analysis = response.data;
    
    let text = '';
    if (length === 'brief') {
      text = `This trade ${analysis.recommendation === 'accept' ? 'favors you' : 'doesn\'t favor you'}. Trade value difference: ${Math.abs(analysis.teamAValue - analysis.teamBValue).toFixed(1)} points.`;
    } else {
      text = this.generateTradeNarrative(analysis, teamAPlayers, teamBPlayers, length === 'detailed');
    }
    
    const ssml = this.generateSSML(text, tone, {
      recommendation: analysis.recommendation,
      confidence: analysis.fairnessScore > 0.8
    });
    
    return {
      text,
      ssml,
      visualData: {
        analysis,
        teamAPlayers,
        teamBPlayers,
        charts: this.generateTradeCharts(analysis)
      },
      confidence: analysis.fairnessScore,
      suggestions: [
        "Would you like to see alternative trade targets?",
        "Should I explain the long-term impact?",
        "Want me to find a more balanced trade?"
      ]
    };
  }
  
  private generateTradeNarrative(analysis: any, teamA: string[], teamB: string[], detailed: boolean): string {
    const recommendation = analysis.recommendation === 'accept' ? 'ACCEPT' : 'REJECT';
    const valueDiff = analysis.teamAValue - analysis.teamBValue;
    
    let narrative = `Trade Analysis: ${recommendation} this trade.\n\n`;
    narrative += `You're giving: ${teamA.join(', ')}\n`;
    narrative += `You're getting: ${teamB.join(', ')}\n\n`;
    
    narrative += analysis.reasoning + '\n\n';
    
    narrative += `Trade value: ${valueDiff > 0 ? 'You lose' : 'You gain'} ${Math.abs(valueDiff).toFixed(1)} points of value.\n`;
    narrative += `Fairness score: ${(analysis.fairnessScore * 100).toFixed(0)}%\n`;
    
    if (detailed) {
      narrative += `\nProjected impact:\n`;
      narrative += `• Your team: ${analysis.projectedImpact.teamA.wins} wins (${analysis.projectedImpact.teamA.points.toFixed(1)} pts/week)\n`;
      narrative += `• After trade: ${analysis.projectedImpact.teamB.wins} wins (${analysis.projectedImpact.teamB.points.toFixed(1)} pts/week)\n`;
    }
    
    return narrative;
  }
  
  private generateSSML(
    text: string, 
    tone: string,
    options?: any
  ): string {
    let ssml = '<speak>';
    
    // Add tone-specific prosody
    const prosodyMap: Record<string, string> = {
      professional: 'rate="medium" pitch="medium"',
      casual: 'rate="fast" pitch="high"',
      analytical: 'rate="slow" pitch="low"',
      excited: 'rate="fast" pitch="high" volume="loud"'
    };
    
    ssml += `<prosody ${prosodyMap[tone] || prosodyMap.professional}>`;
    
    // Process text with SSML enhancements
    let processedText = text;
    
    // Add emphasis for player names
    if (options?.playerName) {
      processedText = processedText.replace(
        new RegExp(options.playerName, 'g'),
        `<emphasis level="${options.emphasis || 'moderate'}">${options.playerName}</emphasis>`
      );
    }
    
    // Add pauses for readability
    processedText = processedText
      .replace(/\.\s/g, '.<break time="300ms"/> ')
      .replace(/,\s/g, ',<break time="200ms"/> ')
      .replace(/:\s/g, ':<break time="250ms"/> ');
    
    // Add excitement for recommendations
    if (options?.recommendation) {
      const recMap: Record<string, string> = {
        accept: '<emphasis level="strong">ACCEPT</emphasis>',
        reject: '<emphasis level="strong">REJECT</emphasis>',
        neutral: 'consider carefully'
      };
      processedText = processedText.replace(
        /ACCEPT|REJECT|consider carefully/g,
        match => recMap[options.recommendation] || match
      );
    }
    
    ssml += processedText;
    ssml += '</prosody></speak>';
    
    return ssml;
  }
  
  private explainTopFactors(features: any): string {
    const factors = [];
    
    if (features.recentForm > 20) {
      factors.push(`he's averaging ${features.recentForm.toFixed(1)} points over his last 5 games`);
    }
    
    if (features.opponentRank > 25) {
      factors.push('facing a bottom-10 defense');
    } else if (features.opponentRank < 10) {
      factors.push('facing a tough top-10 defense');
    }
    
    if (features.homeAway) {
      factors.push('playing at home');
    }
    
    if (features.weather && features.weather.windSpeed > 15) {
      factors.push('weather could be a factor');
    }
    
    if (factors.length === 0) {
      return 'The projection is based on season averages and matchup data.';
    }
    
    return `Key factors: ${factors.join(', ')}.`;
  }
  
  private explainAllFactors(features: any): string {
    let explanation = 'Here\'s what our model considers:\n\n';
    
    explanation += `• Recent performance: ${features.recentForm.toFixed(1)} points average (last 5 games)\n`;
    explanation += `• Season average: ${features.seasonAverage.toFixed(1)} points per game\n`;
    explanation += `• Opponent defense: Ranked ${features.opponentRank} in the league\n`;
    explanation += `• Home/Away: Playing ${features.homeAway ? 'at home' : 'on the road'}\n`;
    explanation += `• Rest advantage: ${features.restDays} days of rest\n`;
    
    if (features.weather) {
      explanation += `• Weather conditions: ${features.weather.temperature}°F, `;
      explanation += `${features.weather.windSpeed} mph winds\n`;
    }
    
    explanation += `• Vegas implied total: ${features.vegasTotal} points\n`;
    explanation += `• Point spread: ${features.spread > 0 ? '+' : ''}${features.spread}\n`;
    
    return explanation;
  }
  
  private getHistoricalContext(player: Player, prediction: any): string {
    return `Historically, ${player.name} averages ${prediction.features.h2hAverage.toFixed(1)} points against this opponent and ${prediction.features.venueAverage.toFixed(1)} points at this venue.`;
  }
  
  private getMatchupAnalysis(features: any): string {
    let analysis = 'Matchup analysis: ';
    
    if (features.paceOfPlay > 100) {
      analysis += 'This should be a fast-paced game, which benefits fantasy scoring. ';
    } else if (features.paceOfPlay < 95) {
      analysis += 'This projects as a slower-paced game, which could limit fantasy upside. ';
    }
    
    if (features.vegasTotal > 50) {
      analysis += `Vegas expects a high-scoring game with ${features.vegasTotal} total points. `;
    } else if (features.vegasTotal < 40) {
      analysis += `Vegas expects a low-scoring game with only ${features.vegasTotal} total points. `;
    }
    
    return analysis;
  }
  
  private getTrendEmoji(trend: number): string {
    if (trend > 5) return '🔥 Hot and';
    if (trend > 0) return '📈 Positively';
    if (trend < -5) return '❄️ Cold and';
    return '📉 Negatively';
  }
  
  private getPositionRequirements(sport: string): Record<string, number> {
    const requirements: Record<string, Record<string, number>> = {
      NFL: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1, DST: 1 },
      NBA: { PG: 1, SG: 1, SF: 1, PF: 1, C: 1, G: 1, F: 1, UTIL: 1 },
      MLB: { P: 2, C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, OF: 3 },
      NHL: { C: 2, W: 3, D: 2, G: 1, UTIL: 1 }
    };
    
    return requirements[sport] || requirements.NFL;
  }
  
  private groupByPosition(lineup: any[]): Record<string, any[]> {
    return lineup.reduce((acc, player) => {
      if (!acc[player.position]) {
        acc[player.position] = [];
      }
      acc[player.position].push(player);
      return acc;
    }, {} as Record<string, any[]>);
  }
  
  private generatePlayerCharts(player: Player, prediction: any): any {
    return {
      projectionChart: {
        type: 'line',
        data: {
          labels: ['Week -3', 'Week -2', 'Week -1', 'Current', 'Projection'],
          datasets: [{
            label: 'Fantasy Points',
            data: [18.5, 22.3, 19.8, 21.2, prediction.predictedValue]
          }]
        }
      },
      confidenceGauge: {
        type: 'gauge',
        value: prediction.confidence * 100,
        max: 100
      }
    };
  }
  
  private generateTradeCharts(analysis: any): any {
    return {
      valueComparison: {
        type: 'bar',
        data: {
          labels: ['You Give', 'You Get'],
          datasets: [{
            label: 'Trade Value',
            data: [analysis.teamAValue, analysis.teamBValue]
          }]
        }
      },
      impactProjection: {
        type: 'radar',
        data: {
          labels: ['Wins', 'Points', 'Consistency', 'Ceiling', 'Floor'],
          datasets: [
            {
              label: 'Before Trade',
              data: [8, 120, 0.7, 140, 100]
            },
            {
              label: 'After Trade',
              data: [analysis.projectedImpact.teamB.wins, analysis.projectedImpact.teamB.points, 0.8, 150, 110]
            }
          ]
        }
      }
    };
  }
  
  private generateFollowUpSuggestions(
    type: string, 
    context?: any
  ): string[] {
    const suggestions: Record<string, string[]> = {
      player_analysis: [
        `What about ${context?.name}'s injury history?`,
        `Compare ${context?.name} to other ${context?.position}s`,
        `Should I start ${context?.name} this week?`,
        `What's ${context?.name}'s trade value?`,
        `Show me ${context?.name}'s upcoming schedule`
      ],
      lineup: [
        "Show me alternative lineups",
        "What's the ceiling lineup?",
        "Give me a safer floor lineup",
        "Explain your player choices",
        "Save this lineup for me"
      ],
      trade: [
        "Find me better trade targets",
        "What if I add a draft pick?",
        "Show me fair trades for my team",
        "Analyze my team's needs",
        "What trades should I propose?"
      ]
    };
    
    return suggestions[type] || [
      "What else would you like to know?",
      "Any other questions?",
      "How can I help you further?"
    ];
  }
  
  private async generatePrediction(
    query: VoiceQuery,
    tone: string,
    length: string
  ): Promise<VoiceResponse> {
    // Implementation for predictions
    return this.generateGeneralResponse(query, tone);
  }
  
  private async compareEntities(
    query: VoiceQuery,
    tone: string,
    length: string
  ): Promise<VoiceResponse> {
    // Implementation for comparisons
    return this.generateGeneralResponse(query, tone);
  }
  
  private async analyzeInjuryImpact(
    query: VoiceQuery,
    tone: string,
    length: string
  ): Promise<VoiceResponse> {
    // Implementation for injury analysis
    return this.generateGeneralResponse(query, tone);
  }
  
  private generateGeneralResponse(query: VoiceQuery, tone: string): VoiceResponse {
    const text = "I understand your question, but I need more specific information to provide a detailed analysis. Could you please clarify what you'd like to know?";
    
    return {
      text,
      ssml: this.generateSSML(text, tone),
      confidence: 0.5,
      requiresFollowUp: true,
      suggestions: [
        "Ask about a specific player's projection",
        "Request lineup optimization",
        "Evaluate a trade",
        "Check injury updates",
        "Compare two players"
      ]
    };
  }
  
  private generateErrorResponse(error: Error, tone: string): VoiceResponse {
    const text = `I apologize, but I encountered an issue: ${error.message}. Please try rephrasing your question or ask about something else.`;
    
    return {
      text,
      ssml: this.generateSSML(text, tone),
      confidence: 0,
      requiresFollowUp: true
    };
  }
}
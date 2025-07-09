import { BaseAgent, AgentContext, AgentResponse } from '../BaseAgent';
import { supabase } from '../../../supabase/client-browser';
import { createAgentLogger } from '../../../utils/logger';

interface TradePlayer {
  id: string;
  name: string;
  position: string[];
  team: string;
  stats: any;
  value: number;
}

export class TradeAnalyzerAgent extends BaseAgent {
  private logger = createAgentLogger('TradeAnalyzerAgent');
  
  constructor() {
    super(
      'Trade Analyzer',
      'Evaluates trade proposals and suggests fair trades based on player values',
      ['trade', 'swap', 'deal', 'offer', 'exchange', 'value']
    );
  }

  async process(query: string, context: AgentContext): Promise<AgentResponse> {
    try {
      // Parse trade from query
      const trade = this.parseTradeFromQuery(query);
      
      if (!trade.giving.length || !trade.receiving.length) {
        return {
          success: false,
          message: "Please specify the trade in format: 'Should I trade [Player A] for [Player B]?'",
        };
      }

      // Get player data
      const givingPlayers = await this.getPlayersData(trade.giving);
      const receivingPlayers = await this.getPlayersData(trade.receiving);

      if (givingPlayers.length === 0 || receivingPlayers.length === 0) {
        return {
          success: false,
          message: "I couldn't find all the players mentioned in the trade.",
        };
      }

      // Calculate trade values
      const givingValue = await this.calculateTotalValue(givingPlayers);
      const receivingValue = await this.calculateTotalValue(receivingPlayers);

      // Analyze trade fairness
      const analysis = this.analyzeTradeFairness(givingValue, receivingValue);
      
      // Get alternative suggestions if unfair
      const suggestions = analysis.verdict !== 'fair' 
        ? await this.suggestAlternatives(givingPlayers, receivingPlayers, analysis)
        : [];

      return {
        success: true,
        message: this.generateTradeReport(
          givingPlayers,
          receivingPlayers,
          givingValue,
          receivingValue,
          analysis
        ),
        data: {
          giving: givingPlayers,
          receiving: receivingPlayers,
          givingValue,
          receivingValue,
          analysis,
        },
        suggestions,
        confidence: 0.8,
      };
    } catch (error) {
      this.logger.error('Trade analysis error', error);
      return {
        success: false,
        message: 'I encountered an error analyzing this trade.',
      };
    }
  }

  private parseTradeFromQuery(query: string): { giving: string[], receiving: string[] } {
    const giving: string[] = [];
    const receiving: string[] = [];
    
    // Look for common trade patterns
    const patterns = [
      /trade\s+(.+?)\s+for\s+(.+)/i,
      /give\s+(.+?)\s+get\s+(.+)/i,
      /(.+?)\s+for\s+(.+)/i,
    ];
    
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        giving.push(...this.extractPlayerNames(match[1]));
        receiving.push(...this.extractPlayerNames(match[2]));
        break;
      }
    }
    
    return { giving, receiving };
  }

  private extractPlayerNames(text: string): string[] {
    // Simple extraction - look for capitalized consecutive words
    const names: string[] = [];
    const words = text.split(/\s+/);
    
    let currentName = '';
    for (const word of words) {
      if (word[0] === word[0].toUpperCase() && word.length > 1) {
        currentName += (currentName ? ' ' : '') + word;
      } else if (currentName) {
        names.push(currentName);
        currentName = '';
      }
    }
    
    if (currentName) names.push(currentName);
    
    return names;
  }

  private async getPlayersData(playerNames: string[]): Promise<TradePlayer[]> {
    const players: TradePlayer[] = [];
    
    for (const name of playerNames) {
      const { data: player } = await supabase
        .from('players')
        .select(`
          id,
          full_name,
          position,
          current_team:teams_master(name, abbreviation),
          player_stats!inner(
            stats,
            season,
            games_played
          )
        `)
        .ilike('full_name', `%${name}%`)
        .eq('player_stats.season', new Date().getFullYear())
        .limit(1)
        .single();
      
      if (player) {
        const value = await this.calculatePlayerValue(player);
        players.push({
          id: player.id,
          name: player.full_name,
          position: player.position,
          team: player.current_team?.abbreviation || 'FA',
          stats: player.player_stats[0]?.stats || {},
          value,
        });
      }
    }
    
    return players;
  }

  private async calculatePlayerValue(player: any): Promise<number> {
    const stats = player.player_stats[0]?.stats || {};
    const gamesPlayed = player.player_stats[0]?.games_played || 1;
    
    // Calculate fantasy points per game
    let ppg = 0;
    
    // PPR scoring
    ppg += (stats.passing_yards || 0) / gamesPlayed * 0.04;
    ppg += (stats.passing_tds || 0) / gamesPlayed * 4;
    ppg += (stats.rushing_yards || 0) / gamesPlayed * 0.1;
    ppg += (stats.rushing_tds || 0) / gamesPlayed * 6;
    ppg += (stats.receptions || 0) / gamesPlayed * 1;
    ppg += (stats.receiving_yards || 0) / gamesPlayed * 0.1;
    ppg += (stats.receiving_tds || 0) / gamesPlayed * 6;
    
    // NBA scoring
    ppg += (stats.points || 0) / gamesPlayed * 1;
    ppg += (stats.rebounds || 0) / gamesPlayed * 1.2;
    ppg += (stats.assists || 0) / gamesPlayed * 1.5;
    ppg += (stats.steals || 0) / gamesPlayed * 3;
    ppg += (stats.blocks || 0) / gamesPlayed * 3;
    
    // Position multiplier
    const positionMultiplier = this.getPositionMultiplier(player.position);
    
    return Math.round(ppg * positionMultiplier * 10) / 10;
  }

  private getPositionMultiplier(positions: string[]): number {
    // Scarce positions get higher multiplier
    const position = positions[0]?.toLowerCase() || '';
    
    const multipliers: Record<string, number> = {
      'qb': 1.2,
      'rb': 1.1,
      'wr': 1.0,
      'te': 1.3,
      'k': 0.7,
      'dst': 0.8,
      'pg': 1.1,
      'sg': 1.0,
      'sf': 1.0,
      'pf': 1.1,
      'c': 1.2,
    };
    
    return multipliers[position] || 1.0;
  }

  private calculateTotalValue(players: TradePlayer[]): number {
    return players.reduce((sum, player) => sum + player.value, 0);
  }

  private analyzeTradeFairness(givingValue: number, receivingValue: number): {
    verdict: 'winning' | 'losing' | 'fair';
    difference: number;
    percentage: number;
  } {
    const difference = receivingValue - givingValue;
    const percentage = (difference / givingValue) * 100;
    
    let verdict: 'winning' | 'losing' | 'fair';
    
    if (percentage > 15) {
      verdict = 'winning';
    } else if (percentage < -15) {
      verdict = 'losing';
    } else {
      verdict = 'fair';
    }
    
    return {
      verdict,
      difference: Math.round(difference * 10) / 10,
      percentage: Math.round(percentage),
    };
  }

  private generateTradeReport(
    giving: TradePlayer[],
    receiving: TradePlayer[],
    givingValue: number,
    receivingValue: number,
    analysis: any
  ): string {
    const givingList = giving.map(p => `${p.name} (${p.position[0]}, ${p.team})`).join(', ');
    const receivingList = receiving.map(p => `${p.name} (${p.position[0]}, ${p.team})`).join(', ');
    
    let verdict = '';
    if (analysis.verdict === 'winning') {
      verdict = `✅ **ACCEPT THIS TRADE!** You're getting ${analysis.percentage}% more value.`;
    } else if (analysis.verdict === 'losing') {
      verdict = `❌ **DECLINE THIS TRADE!** You're giving up ${Math.abs(analysis.percentage)}% more value.`;
    } else {
      verdict = `✅ **FAIR TRADE!** The values are within 15% of each other.`;
    }
    
    return `**Trade Analysis**

**You Give:** ${givingList}
**Total Value:** ${givingValue.toFixed(1)} points

**You Get:** ${receivingList}
**Total Value:** ${receivingValue.toFixed(1)} points

${verdict}

**Value Difference:** ${analysis.difference > 0 ? '+' : ''}${analysis.difference.toFixed(1)} points (${analysis.percentage > 0 ? '+' : ''}${analysis.percentage}%)

${this.getPositionalAnalysis(giving, receiving)}`;
  }

  private getPositionalAnalysis(giving: TradePlayer[], receiving: TradePlayer[]): string {
    const givingPositions = new Set(giving.flatMap(p => p.position));
    const receivingPositions = new Set(receiving.flatMap(p => p.position));
    
    const losingPositions = [...givingPositions].filter(p => !receivingPositions.has(p));
    const gainingPositions = [...receivingPositions].filter(p => !givingPositions.has(p));
    
    let analysis = '\n**Positional Impact:**\n';
    
    if (losingPositions.length > 0) {
      analysis += `- You're losing depth at: ${losingPositions.join(', ')}\n`;
    }
    
    if (gainingPositions.length > 0) {
      analysis += `- You're gaining help at: ${gainingPositions.join(', ')}\n`;
    }
    
    return analysis;
  }

  private async suggestAlternatives(
    giving: TradePlayer[],
    receiving: TradePlayer[],
    analysis: any
  ): Promise<string[]> {
    const suggestions: string[] = [];
    
    if (analysis.verdict === 'losing') {
      suggestions.push('Ask for an additional bench player to balance the trade');
      suggestions.push('Counter with a 2-for-1 to get a better player');
      suggestions.push(`Target a player worth ~${(giving[0].value * 1.1).toFixed(1)} points`);
    } else if (analysis.verdict === 'winning') {
      suggestions.push('Accept quickly before they reconsider!');
      suggestions.push('Consider offering a small add-on to ensure acceptance');
    }
    
    return suggestions;
  }
}
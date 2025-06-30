import { BaseAgent, AgentContext, AgentResponse } from '../BaseAgent';
import { supabase } from '../../../supabase/client-browser';
import { createAgentLogger } from '../../../utils/logger';

export class InjuryAnalystAgent extends BaseAgent {
  private logger = createAgentLogger('InjuryAnalystAgent');
  
  constructor() {
    super(
      'Injury Analyst',
      'Analyzes player injuries and provides return timelines and fantasy impact',
      ['injury', 'injured', 'hurt', 'status', 'return', 'health']
    );
  }

  async process(query: string, context: AgentContext): Promise<AgentResponse> {
    try {
      // Extract player name from query
      const playerName = this.extractPlayerName(query);
      
      if (!playerName) {
        return {
          success: false,
          message: "I couldn't identify which player you're asking about. Please include the player's name.",
        };
      }

      // Find player
      const { data: player } = await supabase
        .from('players')
        .select('id, full_name, position, current_team_id')
        .ilike('full_name', `%${playerName}%`)
        .limit(1)
        .single();

      if (!player) {
        return {
          success: false,
          message: `I couldn't find a player named "${playerName}".`,
        };
      }

      // Get injury info
      const { data: injury } = await supabase
        .from('player_injuries')
        .select('*')
        .eq('player_id', player.id)
        .eq('is_active', true)
        .single();

      if (!injury) {
        return {
          success: true,
          message: `${player.full_name} has no reported injuries. They appear to be healthy!`,
          data: { player, status: 'healthy' },
          confidence: 0.95,
        };
      }

      // Analyze injury impact
      const impact = this.analyzeInjuryImpact(injury, player.position);
      
      // Get recent performance for context
      const { data: recentStats } = await supabase
        .from('player_game_logs')
        .select('stats')
        .eq('player_id', player.id)
        .order('game_date', { ascending: false })
        .limit(5);

      const avgFantasyPoints = this.calculateAverageFantasyPoints(recentStats);

      return {
        success: true,
        message: this.generateInjuryReport(player, injury, impact),
        data: {
          player,
          injury,
          impact,
          recentPerformance: avgFantasyPoints,
        },
        suggestions: this.generateSuggestions(injury, impact),
        confidence: 0.85,
      };
    } catch (error) {
      this.logger.error('Injury analysis error', error);
      return {
        success: false,
        message: 'I encountered an error analyzing the injury data.',
      };
    }
  }

  private extractPlayerName(query: string): string | null {
    // Simple extraction - in production, use NLP
    const words = query.split(' ');
    
    // Look for capitalized words that might be names
    const capitalizedWords = words.filter(word => 
      word.length > 2 && word[0] === word[0].toUpperCase()
    );
    
    if (capitalizedWords.length >= 2) {
      return capitalizedWords.slice(0, 2).join(' ');
    }
    
    return null;
  }

  private analyzeInjuryImpact(injury: any, position: string[]): {
    severity: 'minor' | 'moderate' | 'major';
    estimatedWeeksOut: number;
    fantasyImpact: 'low' | 'medium' | 'high';
  } {
    // Analyze based on injury type and body part
    const severityMap: Record<string, number> = {
      'strain': 1,
      'sprain': 2,
      'tear': 3,
      'fracture': 4,
      'surgery': 5,
    };

    const severity = severityMap[injury.injury_type] || 2;
    
    let estimatedWeeksOut = 0;
    let fantasyImpact: 'low' | 'medium' | 'high' = 'medium';

    switch (injury.status) {
      case 'questionable':
        estimatedWeeksOut = 0;
        fantasyImpact = 'low';
        break;
      case 'doubtful':
        estimatedWeeksOut = 1;
        fantasyImpact = 'medium';
        break;
      case 'out':
        estimatedWeeksOut = 2 + severity;
        fantasyImpact = 'high';
        break;
      case 'ir':
        estimatedWeeksOut = 4 + severity * 2;
        fantasyImpact = 'high';
        break;
    }

    return {
      severity: severity <= 2 ? 'minor' : severity <= 4 ? 'moderate' : 'major',
      estimatedWeeksOut,
      fantasyImpact,
    };
  }

  private calculateAverageFantasyPoints(gameLogs: any[]): number {
    if (!gameLogs || gameLogs.length === 0) return 0;
    
    const totalPoints = gameLogs.reduce((sum, log) => {
      const stats = log.stats;
      let points = 0;
      
      // Simple PPR scoring
      points += (stats.passing_yards || 0) * 0.04;
      points += (stats.passing_tds || 0) * 4;
      points += (stats.rushing_yards || 0) * 0.1;
      points += (stats.rushing_tds || 0) * 6;
      points += (stats.receptions || 0) * 1;
      points += (stats.receiving_yards || 0) * 0.1;
      points += (stats.receiving_tds || 0) * 6;
      
      return sum + points;
    }, 0);
    
    return Math.round((totalPoints / gameLogs.length) * 10) / 10;
  }

  private generateInjuryReport(player: any, injury: any, impact: any): string {
    return `**${player.full_name} Injury Report**

**Status:** ${injury.status.toUpperCase()}
**Injury:** ${injury.body_part} ${injury.injury_type}
**Description:** ${injury.description || 'No additional details'}

**Analysis:**
- Severity: ${impact.severity}
- Estimated time out: ${impact.estimatedWeeksOut === 0 ? 'Game-time decision' : `${impact.estimatedWeeksOut} weeks`}
- Fantasy impact: ${impact.fantasyImpact}

${injury.status === 'questionable' 
  ? "This player has a 75% chance of playing. Monitor practice reports closely."
  : injury.status === 'doubtful'
  ? "This player has only a 25% chance of playing. Have a backup ready."
  : "This player will not play. You need to find a replacement."}`;
  }

  private generateSuggestions(injury: any, impact: any): string[] {
    const suggestions: string[] = [];
    
    if (injury.status === 'questionable') {
      suggestions.push('Check Friday practice report for final status');
      suggestions.push('Have a backup player ready just in case');
    }
    
    if (impact.fantasyImpact === 'high') {
      suggestions.push('Consider picking up their backup/handcuff');
      suggestions.push('Look for waiver wire replacements now');
    }
    
    if (impact.estimatedWeeksOut > 2) {
      suggestions.push('Consider trading if you have depth');
      suggestions.push('Stash on IR if your league has IR spots');
    }
    
    return suggestions;
  }
}
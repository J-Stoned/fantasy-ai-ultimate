import { BaseAgent, AgentContext, AgentResponse } from '../BaseAgent';
import { supabase } from '../../../supabase/client-browser';
import { createAgentLogger } from '../../../utils/logger';

interface LineupSlot {
  position: string;
  player: any;
  projectedPoints: number;
  isLocked: boolean;
}

export class LineupOptimizerAgent extends BaseAgent {
  private logger = createAgentLogger('LineupOptimizerAgent');
  
  constructor() {
    super(
      'Lineup Optimizer',
      'Optimizes your fantasy lineup for maximum points based on matchups and projections',
      ['lineup', 'start', 'sit', 'bench', 'optimize', 'roster', 'who should i start']
    );
  }

  async process(query: string, context: AgentContext): Promise<AgentResponse> {
    try {
      if (!context.fantasyTeamId) {
        return {
          success: false,
          message: "I need to know which fantasy team you want me to optimize. Please specify your team.",
        };
      }

      // Get roster
      const { data: roster } = await supabase
        .from('fantasy_rosters')
        .select(`
          *,
          player:players!inner(
            id,
            full_name,
            position,
            status,
            current_team:teams_master(
              name,
              abbreviation
            )
          )
        `)
        .eq('team_id', context.fantasyTeamId);

      if (!roster || roster.length === 0) {
        return {
          success: false,
          message: "I couldn't find any players on your roster.",
        };
      }

      // Get this week's matchups and projections
      const projections = await this.getPlayerProjections(roster);
      
      // Get league settings for positions
      const { data: league } = await supabase
        .from('fantasy_leagues')
        .select('roster_settings, scoring_settings')
        .eq('id', context.leagueId)
        .single();

      const rosterSettings = league?.roster_settings || this.getDefaultRosterSettings();
      
      // Optimize lineup
      const optimizedLineup = this.optimizeLineup(roster, projections, rosterSettings);
      
      // Check for start/sit specific questions
      const startSitAdvice = this.parseStartSitQuestion(query, roster, projections);

      return {
        success: true,
        message: this.generateLineupReport(optimizedLineup, startSitAdvice),
        data: {
          optimizedLineup,
          totalProjectedPoints: this.calculateTotalPoints(optimizedLineup),
          startSitAdvice,
        },
        suggestions: this.generateLineupSuggestions(optimizedLineup, roster),
        confidence: 0.85,
      };
    } catch (error) {
      this.logger.error('Lineup optimization error', error);
      return {
        success: false,
        message: 'I encountered an error optimizing your lineup.',
      };
    }
  }

  private async getPlayerProjections(roster: any[]): Promise<Map<string, number>> {
    const projections = new Map<string, number>();
    
    for (const slot of roster) {
      const playerId = slot.player.id;
      
      // Get recent performance
      const { data: recentGames } = await supabase
        .from('player_game_logs')
        .select('stats')
        .eq('player_id', playerId)
        .order('game_date', { ascending: false })
        .limit(5);

      // Calculate average points
      const avgPoints = this.calculateAveragePoints(recentGames);
      
      // Get matchup difficulty (simplified)
      const matchupMultiplier = await this.getMatchupMultiplier(slot.player);
      
      // Account for injuries
      const injuryMultiplier = slot.player.status === 'healthy' ? 1.0 : 
                              slot.player.status === 'questionable' ? 0.75 : 0.5;
      
      const projection = avgPoints * matchupMultiplier * injuryMultiplier;
      projections.set(playerId, projection);
    }
    
    return projections;
  }

  private calculateAveragePoints(games: any[]): number {
    if (!games || games.length === 0) return 0;
    
    const totalPoints = games.reduce((sum, game) => {
      const stats = game.stats || {};
      return sum + this.calculateFantasyPoints(stats);
    }, 0);
    
    return totalPoints / games.length;
  }

  private calculateFantasyPoints(stats: any): number {
    let points = 0;
    
    // PPR Football scoring
    points += (stats.passing_yards || 0) * 0.04;
    points += (stats.passing_tds || 0) * 4;
    points += (stats.interceptions || 0) * -2;
    points += (stats.rushing_yards || 0) * 0.1;
    points += (stats.rushing_tds || 0) * 6;
    points += (stats.receptions || 0) * 1;
    points += (stats.receiving_yards || 0) * 0.1;
    points += (stats.receiving_tds || 0) * 6;
    points += (stats.fumbles_lost || 0) * -2;
    
    // NBA scoring
    points += (stats.points || 0) * 1;
    points += (stats.rebounds || 0) * 1.2;
    points += (stats.assists || 0) * 1.5;
    points += (stats.steals || 0) * 3;
    points += (stats.blocks || 0) * 3;
    points += (stats.turnovers || 0) * -1;
    
    return points;
  }

  private async getMatchupMultiplier(player: any): Promise<number> {
    // Simplified matchup analysis
    // In production, analyze opponent's defense rankings
    return 1.0 + (Math.random() * 0.4 - 0.2); // Random between 0.8 and 1.2
  }

  private getDefaultRosterSettings(): any {
    return {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 1,
      K: 1,
      DST: 1,
      BENCH: 6,
    };
  }

  private optimizeLineup(
    roster: any[],
    projections: Map<string, number>,
    rosterSettings: any
  ): LineupSlot[] {
    const lineup: LineupSlot[] = [];
    const usedPlayers = new Set<string>();
    
    // Sort players by projected points
    const sortedRoster = roster.sort((a, b) => {
      const aPoints = projections.get(a.player.id) || 0;
      const bPoints = projections.get(b.player.id) || 0;
      return bPoints - aPoints;
    });
    
    // Fill required positions first
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
    
    for (const position of positions) {
      const required = rosterSettings[position] || 0;
      const eligiblePlayers = sortedRoster.filter(p => 
        p.player.position.includes(position) && 
        !usedPlayers.has(p.player.id) &&
        p.player.status !== 'out' &&
        p.player.status !== 'ir'
      );
      
      for (let i = 0; i < required && i < eligiblePlayers.length; i++) {
        const player = eligiblePlayers[i];
        lineup.push({
          position,
          player: player.player,
          projectedPoints: projections.get(player.player.id) || 0,
          isLocked: false,
        });
        usedPlayers.add(player.player.id);
      }
    }
    
    // Fill FLEX positions
    const flexCount = rosterSettings.FLEX || 0;
    const flexEligible = sortedRoster.filter(p => 
      ['RB', 'WR', 'TE'].some(pos => p.player.position.includes(pos)) &&
      !usedPlayers.has(p.player.id) &&
      p.player.status !== 'out' &&
      p.player.status !== 'ir'
    );
    
    for (let i = 0; i < flexCount && i < flexEligible.length; i++) {
      const player = flexEligible[i];
      lineup.push({
        position: 'FLEX',
        player: player.player,
        projectedPoints: projections.get(player.player.id) || 0,
        isLocked: false,
      });
      usedPlayers.add(player.player.id);
    }
    
    return lineup;
  }

  private parseStartSitQuestion(query: string, roster: any[], projections: Map<string, number>): any {
    const lowerQuery = query.toLowerCase();
    
    if (!lowerQuery.includes('start') && !lowerQuery.includes('sit')) {
      return null;
    }
    
    // Extract player names mentioned
    const mentionedPlayers: any[] = [];
    
    for (const slot of roster) {
      const playerName = slot.player.full_name.toLowerCase();
      if (lowerQuery.includes(playerName)) {
        mentionedPlayers.push({
          player: slot.player,
          projection: projections.get(slot.player.id) || 0,
        });
      }
    }
    
    if (mentionedPlayers.length < 2) {
      return null;
    }
    
    // Sort by projection
    mentionedPlayers.sort((a, b) => b.projection - a.projection);
    
    return {
      start: mentionedPlayers[0],
      sit: mentionedPlayers.slice(1),
    };
  }

  private generateLineupReport(lineup: LineupSlot[], startSitAdvice: any): string {
    let report = '**🏆 Optimized Lineup**\n\n';
    
    // Group by position
    const byPosition = lineup.reduce((acc, slot) => {
      if (!acc[slot.position]) acc[slot.position] = [];
      acc[slot.position].push(slot);
      return acc;
    }, {} as Record<string, LineupSlot[]>);
    
    for (const [position, slots] of Object.entries(byPosition)) {
      report += `**${position}:**\n`;
      for (const slot of slots) {
        const injury = slot.player.status !== 'healthy' ? ` (${slot.player.status})` : '';
        report += `- ${slot.player.full_name}${injury} - ${slot.projectedPoints.toFixed(1)} pts\n`;
      }
      report += '\n';
    }
    
    const totalPoints = this.calculateTotalPoints(lineup);
    report += `**Total Projected Points: ${totalPoints.toFixed(1)}**\n`;
    
    // Add start/sit advice if applicable
    if (startSitAdvice) {
      report += `\n**Start/Sit Advice:**\n`;
      report += `✅ **START:** ${startSitAdvice.start.player.full_name} (${startSitAdvice.start.projection.toFixed(1)} pts)\n`;
      for (const sit of startSitAdvice.sit) {
        report += `❌ **SIT:** ${sit.player.full_name} (${sit.projection.toFixed(1)} pts)\n`;
      }
    }
    
    return report;
  }

  private calculateTotalPoints(lineup: LineupSlot[]): number {
    return lineup.reduce((sum, slot) => sum + slot.projectedPoints, 0);
  }

  private generateLineupSuggestions(lineup: LineupSlot[], roster: any[]): string[] {
    const suggestions: string[] = [];
    
    // Check for injured players
    const injuredStarters = lineup.filter(slot => 
      slot.player.status === 'questionable' || slot.player.status === 'doubtful'
    );
    
    if (injuredStarters.length > 0) {
      suggestions.push(`Monitor injury reports for ${injuredStarters.map(s => s.player.full_name).join(', ')}`);
    }
    
    // Check for empty positions
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
    for (const pos of positions) {
      const filled = lineup.filter(s => s.position === pos).length;
      if (filled === 0) {
        suggestions.push(`You need a ${pos} - check the waiver wire!`);
      }
    }
    
    // Look for boom/bust players
    suggestions.push('Consider floor vs ceiling based on your matchup');
    
    return suggestions;
  }
}
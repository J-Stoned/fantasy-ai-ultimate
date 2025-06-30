import { BaseAgent, AgentContext, AgentResponse } from '../BaseAgent';
import { supabase } from '../../../supabase/client-browser';
import { createAgentLogger } from '../../../utils/logger';

export class WaiverWireAgent extends BaseAgent {
  private logger = createAgentLogger('WaiverWireAgent');
  
  constructor() {
    super(
      'Waiver Wire Scout',
      'Finds the best available players on waivers and suggests pickups',
      ['waiver', 'pickup', 'add', 'drop', 'available', 'free agent']
    );
  }

  async process(query: string, context: AgentContext): Promise<AgentResponse> {
    try {
      // Determine position need from query
      const positionNeed = this.extractPositionNeed(query);
      
      // Get available players (not on any fantasy team)
      const availablePlayers = await this.getAvailablePlayers(
        context.leagueId,
        positionNeed
      );

      if (availablePlayers.length === 0) {
        return {
          success: false,
          message: `No available ${positionNeed || 'players'} found on waivers.`,
        };
      }

      // Rank players by recent performance and opportunity
      const rankedPlayers = await this.rankPlayers(availablePlayers);
      
      // Get drop candidates if needed
      const dropCandidates = await this.getDropCandidates(context.fantasyTeamId);

      return {
        success: true,
        message: this.generateWaiverReport(rankedPlayers, dropCandidates, positionNeed),
        data: {
          topPickups: rankedPlayers.slice(0, 5),
          dropCandidates,
        },
        suggestions: this.generatePickupSuggestions(rankedPlayers),
        confidence: 0.8,
      };
    } catch (error) {
      this.logger.error('Waiver wire error', error);
      return {
        success: false,
        message: 'I encountered an error analyzing the waiver wire.',
      };
    }
  }

  private extractPositionNeed(query: string): string | null {
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'DEF'];
    const lowerQuery = query.toLowerCase();
    
    for (const pos of positions) {
      if (lowerQuery.includes(pos.toLowerCase())) {
        return pos;
      }
    }
    
    return null;
  }

  private async getAvailablePlayers(leagueId?: string, position?: string | null) {
    // Get all rostered players in the league
    const { data: rosteredPlayers } = await supabase
      .from('fantasy_rosters')
      .select('player_id')
      .eq('league_id', leagueId || '');

    const rosteredIds = rosteredPlayers?.map(r => r.player_id) || [];

    // Get available players
    let query = supabase
      .from('players')
      .select(`
        *,
        current_team:teams_master(name, abbreviation),
        player_stats!inner(
          stats,
          games_played,
          season
        )
      `)
      .not('id', 'in', `(${rosteredIds.join(',')})`)
      .eq('status', 'active')
      .eq('player_stats.season', new Date().getFullYear())
      .limit(50);

    if (position) {
      query = query.contains('position', [position]);
    }

    const { data } = await query;
    return data || [];
  }

  private async rankPlayers(players: any[]): Promise<any[]> {
    const rankedPlayers = await Promise.all(
      players.map(async (player) => {
        // Get recent game logs
        const { data: recentGames } = await supabase
          .from('player_game_logs')
          .select('stats')
          .eq('player_id', player.id)
          .order('game_date', { ascending: false })
          .limit(3);

        const recentPoints = this.calculateRecentAverage(recentGames);
        const seasonAvg = this.calculateSeasonAverage(player.player_stats[0]);
        
        // Calculate trend (recent vs season average)
        const trend = recentPoints - seasonAvg;
        
        // Check for opportunity changes (injuries to teammates, etc)
        const opportunityScore = await this.calculateOpportunityScore(player);
        
        // Overall score
        const score = (recentPoints * 0.5) + (trend * 0.3) + (opportunityScore * 0.2);

        return {
          ...player,
          recentAvg: recentPoints,
          seasonAvg,
          trend,
          opportunityScore,
          overallScore: score,
        };
      })
    );

    return rankedPlayers.sort((a, b) => b.overallScore - a.overallScore);
  }

  private calculateRecentAverage(games: any[]): number {
    if (!games || games.length === 0) return 0;
    
    const total = games.reduce((sum, game) => {
      return sum + this.calculateFantasyPoints(game.stats);
    }, 0);
    
    return total / games.length;
  }

  private calculateSeasonAverage(playerStats: any): number {
    if (!playerStats) return 0;
    
    const totalPoints = this.calculateFantasyPoints(playerStats.stats);
    return totalPoints / (playerStats.games_played || 1);
  }

  private calculateFantasyPoints(stats: any): number {
    let points = 0;
    
    // PPR scoring
    points += (stats.passing_yards || 0) * 0.04;
    points += (stats.passing_tds || 0) * 4;
    points += (stats.rushing_yards || 0) * 0.1;
    points += (stats.rushing_tds || 0) * 6;
    points += (stats.receptions || 0) * 1;
    points += (stats.receiving_yards || 0) * 0.1;
    points += (stats.receiving_tds || 0) * 6;
    
    return points;
  }

  private async calculateOpportunityScore(player: any): Promise<number> {
    // Check for injured players at same position on team
    const { data: injuries } = await supabase
      .from('player_injuries')
      .select('player_id')
      .eq('is_active', true)
      .in('player_id', 
        await this.getTeammatesAtPosition(player.current_team_id, player.position)
      );

    // More injuries = more opportunity
    const injuryBoost = (injuries?.length || 0) * 5;
    
    // Base opportunity score
    let score = 10;
    
    // Boost for certain positions on good teams
    if (player.position.includes('RB') && player.current_team?.abbreviation) {
      score += 5; // RBs have clearer opportunity
    }
    
    return Math.min(score + injuryBoost, 20);
  }

  private async getTeammatesAtPosition(teamId: string, positions: string[]): Promise<string[]> {
    const { data } = await supabase
      .from('players')
      .select('id')
      .eq('current_team_id', teamId)
      .overlaps('position', positions);
    
    return data?.map(p => p.id) || [];
  }

  private async getDropCandidates(teamId?: string): Promise<any[]> {
    if (!teamId) return [];

    const { data: roster } = await supabase
      .from('fantasy_rosters')
      .select(`
        *,
        player:players(
          id,
          full_name,
          position,
          player_stats(stats, games_played)
        )
      `)
      .eq('team_id', teamId);

    if (!roster) return [];

    // Rank by recent performance (worst first)
    const candidates = roster
      .map(slot => ({
        ...slot.player,
        avgPoints: this.calculateSeasonAverage(slot.player.player_stats?.[0]),
      }))
      .sort((a, b) => a.avgPoints - b.avgPoints)
      .slice(0, 3);

    return candidates;
  }

  private generateWaiverReport(
    players: any[],
    dropCandidates: any[],
    position: string | null
  ): string {
    let report = `**🎯 Top Waiver Wire Pickups${position ? ` (${position})` : ''}**\n\n`;

    const topPlayers = players.slice(0, 5);
    
    topPlayers.forEach((player, index) => {
      const trendIcon = player.trend > 0 ? '📈' : player.trend < 0 ? '📉' : '➡️';
      
      report += `**${index + 1}. ${player.full_name}** - ${player.position.join('/')} - ${player.current_team?.abbreviation || 'FA'}\n`;
      report += `   Recent Avg: ${player.recentAvg.toFixed(1)} pts ${trendIcon}\n`;
      report += `   Season Avg: ${player.seasonAvg.toFixed(1)} pts\n`;
      if (player.opportunityScore > 15) {
        report += `   ⚡ Increased opportunity!\n`;
      }
      report += '\n';
    });

    if (dropCandidates.length > 0) {
      report += `**💧 Consider Dropping:**\n`;
      dropCandidates.forEach(player => {
        report += `- ${player.full_name} (${player.avgPoints.toFixed(1)} pts/game)\n`;
      });
    }

    return report;
  }

  private generatePickupSuggestions(players: any[]): string[] {
    const suggestions: string[] = [];
    
    const hotPlayers = players.filter(p => p.trend > 3);
    if (hotPlayers.length > 0) {
      suggestions.push(`🔥 ${hotPlayers[0].full_name} is trending up significantly!`);
    }
    
    const highOpportunity = players.filter(p => p.opportunityScore > 15);
    if (highOpportunity.length > 0) {
      suggestions.push(`Grab ${highOpportunity[0].full_name} before others notice the opportunity`);
    }
    
    suggestions.push('Set your waiver priority based on positional need');
    suggestions.push('Consider stashing high-upside players if you have bench space');
    
    return suggestions;
  }
}
import { BaseAgent, AgentContext, AgentResponse } from '../BaseAgent';
import { supabase } from '../../../supabase/client-browser';
import { createAgentLogger } from '../../../utils/logger';

export class GeneralAssistantAgent extends BaseAgent {
  private logger = createAgentLogger('GeneralAssistantAgent');
  
  constructor() {
    super(
      'General Assistant',
      'Handles general fantasy sports questions and provides helpful guidance',
      ['help', 'how', 'what', 'why', 'when', 'explain', 'guide']
    );
  }

  async process(query: string, context: AgentContext): Promise<AgentResponse> {
    try {
      const lowerQuery = query.toLowerCase();
      
      // Determine query type and provide appropriate response
      if (this.isScoreQuery(lowerQuery)) {
        return await this.handleScoreQuery(query, context);
      } else if (this.isRulesQuery(lowerQuery)) {
        return this.handleRulesQuery(query);
      } else if (this.isPlayerSearchQuery(lowerQuery)) {
        return await this.handlePlayerSearch(query);
      } else if (this.isTeamInfoQuery(lowerQuery)) {
        return await this.handleTeamInfo(query, context);
      } else {
        return this.handleGeneralQuery(query);
      }
    } catch (error) {
      this.logger.error('General assistant error', error);
      return {
        success: false,
        message: 'I encountered an error processing your request. Please try rephrasing your question.',
      };
    }
  }

  private isScoreQuery(query: string): boolean {
    return ['score', 'points', 'result', 'winning', 'losing'].some(term => 
      query.includes(term)
    );
  }

  private isRulesQuery(query: string): boolean {
    return ['rule', 'how does', 'scoring', 'work', 'explain'].some(term => 
      query.includes(term)
    );
  }

  private isPlayerSearchQuery(query: string): boolean {
    return ['find', 'search', 'player named', 'who is'].some(term => 
      query.includes(term)
    );
  }

  private isTeamInfoQuery(query: string): boolean {
    return ['my team', 'roster', 'lineup', 'squad'].some(term => 
      query.includes(term)
    );
  }

  private async handleScoreQuery(query: string, context: AgentContext): Promise<AgentResponse> {
    if (!context.fantasyTeamId) {
      return {
        success: true,
        message: "I'd be happy to check your score! Which fantasy team would you like me to look at?",
        suggestions: ['Specify your team name', 'Use the Team Selector in the app'],
      };
    }

    const { data: team } = await supabase
      .from('fantasy_teams')
      .select(`
        team_name,
        total_points,
        fantasy_leagues(name, scoring_settings)
      `)
      .eq('id', context.fantasyTeamId)
      .single();

    if (!team) {
      return {
        success: false,
        message: "I couldn't find your fantasy team information.",
      };
    }

    return {
      success: true,
      message: `Your team "${team.team_name}" has ${team.total_points || 0} points in ${team.fantasy_leagues?.name || 'your league'}.`,
      data: team,
      suggestions: [
        'Check your lineup optimization',
        'View detailed scoring breakdown',
        'Compare with other teams',
      ],
    };
  }

  private handleRulesQuery(query: string): AgentResponse {
    const rules = {
      scoring: `**Standard Fantasy Scoring (PPR)**:
- Passing TD: 4 points
- Passing Yards: 1 point per 25 yards
- Rushing/Receiving TD: 6 points  
- Rushing/Receiving Yards: 1 point per 10 yards
- Reception: 1 point (PPR)
- Interception: -2 points
- Fumble Lost: -2 points`,
      
      positions: `**Typical Roster Positions**:
- QB: Quarterback (1)
- RB: Running Back (2)
- WR: Wide Receiver (2)
- TE: Tight End (1)
- FLEX: RB/WR/TE (1)
- K: Kicker (1)
- DST: Defense/Special Teams (1)
- Bench: 5-7 spots`,
      
      waivers: `**Waiver Wire Rules**:
- Claims process Tuesday night/Wednesday morning
- Priority based on standings (worst team first) or FAAB
- Free agents available after waivers clear`,
    };

    let message = "Here's what you need to know:\n\n";
    
    if (query.includes('scoring')) {
      message += rules.scoring;
    } else if (query.includes('position') || query.includes('roster')) {
      message += rules.positions;
    } else if (query.includes('waiver')) {
      message += rules.waivers;
    } else {
      message += "Fantasy sports involve creating a virtual team of real players and earning points based on their real-life performances.";
    }

    return {
      success: true,
      message,
      suggestions: [
        'Ask about specific scoring settings',
        'Learn about roster positions',
        'Understand waiver wire rules',
      ],
    };
  }

  private async handlePlayerSearch(query: string): Promise<AgentResponse> {
    // Extract potential player name
    const nameMatch = query.match(/(?:named?|find|search for|who is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
    const playerName = nameMatch?.[1];

    if (!playerName) {
      return {
        success: false,
        message: "Please specify the player's name you're looking for.",
      };
    }

    const { data: players } = await supabase
      .from('players')
      .select(`
        id,
        full_name,
        position,
        current_team:teams_master(name, abbreviation),
        status
      `)
      .ilike('full_name', `%${playerName}%`)
      .limit(5);

    if (!players || players.length === 0) {
      return {
        success: false,
        message: `I couldn't find any players matching "${playerName}".`,
        suggestions: ['Check the spelling', 'Try first or last name only'],
      };
    }

    let message = `I found ${players.length} player${players.length > 1 ? 's' : ''} matching "${playerName}":\n\n`;
    
    players.forEach(player => {
      const team = player.current_team?.abbreviation || 'FA';
      const status = player.status !== 'active' ? ` (${player.status})` : '';
      message += `• **${player.full_name}** - ${player.position.join('/')} - ${team}${status}\n`;
    });

    return {
      success: true,
      message,
      data: players,
      suggestions: [
        'Get detailed stats for a player',
        'Check injury status',
        'View recent performance',
      ],
    };
  }

  private async handleTeamInfo(query: string, context: AgentContext): Promise<AgentResponse> {
    if (!context.fantasyTeamId) {
      return {
        success: true,
        message: "I'd love to help with your team! Please select which fantasy team you'd like to view.",
        suggestions: ['Select your team from the dashboard'],
      };
    }

    const { data: roster } = await supabase
      .from('fantasy_rosters')
      .select(`
        position,
        is_starter,
        player:players(
          full_name,
          position,
          current_team:teams_master(abbreviation)
        )
      `)
      .eq('team_id', context.fantasyTeamId)
      .order('is_starter', { ascending: false });

    if (!roster || roster.length === 0) {
      return {
        success: false,
        message: "Your roster appears to be empty. Time to add some players!",
        suggestions: ['Check the waiver wire', 'Join a draft'],
      };
    }

    const starters = roster.filter(r => r.is_starter);
    const bench = roster.filter(r => !r.is_starter);

    let message = "**Your Current Roster:**\n\n**Starters:**\n";
    starters.forEach(slot => {
      message += `• ${slot.position}: ${slot.player.full_name} (${slot.player.current_team?.abbreviation || 'FA'})\n`;
    });

    if (bench.length > 0) {
      message += "\n**Bench:**\n";
      bench.forEach(slot => {
        message += `• ${slot.player.full_name} (${slot.player.position.join('/')})\n`;
      });
    }

    return {
      success: true,
      message,
      data: { starters, bench },
      suggestions: [
        'Optimize your lineup',
        'Check for injured players',
        'Browse waiver wire options',
      ],
    };
  }

  private handleGeneralQuery(query: string): AgentResponse {
    return {
      success: true,
      message: `I'm here to help with all your fantasy sports needs! I can assist you with:

**📊 Analysis & Advice**
• Lineup optimization
• Trade evaluation  
• Waiver wire pickups
• Injury updates

**📈 Stats & Info**
• Player statistics and trends
• Team matchups
• Schedule analysis
• Weather impacts

**🎯 Strategy**
• Draft assistance
• Playoff predictions
• DFS lineup building

What would you like help with today?`,
      suggestions: [
        'Ask "Who should I start?"',
        'Try "Should I trade X for Y?"',
        'Say "Show me waiver wire RBs"',
        'Ask "Is X player injured?"',
      ],
      confidence: 0.9,
    };
  }
}
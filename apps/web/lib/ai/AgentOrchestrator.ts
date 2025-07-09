import { BaseAgent, AgentContext, AgentResponse } from './agents/BaseAgent';
import { PlayerAnalysisAgent } from './agents/consolidated/PlayerAnalysisAgent';
import { TeamManagementAgent } from './agents/consolidated/TeamManagementAgent';
import { MarketAnalysisAgent } from './agents/consolidated/MarketAnalysisAgent';
import { GamePredictionAgent } from './agents/consolidated/GamePredictionAgent';
import { QueryParser, QueryIntent } from './services/QueryParser';

/**
 * AgentOrchestrator - Routes queries to the appropriate consolidated agent
 * 
 * Uses 4 powerful agents instead of 20 specialized ones:
 * - PlayerAnalysisAgent: Stats, injuries, trends, comparisons
 * - TeamManagementAgent: Lineups, trades, waivers, draft
 * - MarketAnalysisAgent: News, social, betting, weather
 * - GamePredictionAgent: Matchups, DFS, playoffs, predictions
 */
export class AgentOrchestrator {
  private agents: Map<string, BaseAgent>;
  private queryParser: QueryParser;
  
  constructor() {
    // Initialize the 4 consolidated agents
    this.agents = new Map<string, BaseAgent>();
    this.agents.set('player', new PlayerAnalysisAgent());
    this.agents.set('team', new TeamManagementAgent());
    this.agents.set('market', new MarketAnalysisAgent());
    this.agents.set('game', new GamePredictionAgent());
    
    this.queryParser = new QueryParser();
  }
  
  /**
   * Process a single query with the best agent
   */
  async processQuery(query: string, context: AgentContext): Promise<{
    agent: string;
    response: AgentResponse;
    intent: QueryIntent;
  }> {
    // Parse the query to understand intent
    const { intent, entities, confidence } = this.queryParser.parseQuery(query);
    
    // Select the appropriate agent based on intent
    const selectedAgent = this.selectAgentByIntent(intent);
    
    // Process with selected agent
    const response = await selectedAgent.agent.process(query, context);
    
    // If the selected agent fails, try a fallback
    if (!response.success && confidence < 0.7) {
      const fallbackResponse = await this.tryFallbackAgents(query, context, selectedAgent.key);
      if (fallbackResponse.success) {
        return {
          agent: fallbackResponse.agentName,
          response: fallbackResponse.response,
          intent
        };
      }
    }
    
    return {
      agent: selectedAgent.agent.getName(),
      response,
      intent
    };
  }
  
  /**
   * Process query with multiple relevant agents
   */
  async processMultiAgentQuery(
    query: string,
    context: AgentContext,
    maxAgents: number = 3
  ): Promise<{
    agents: Array<{
      agent: string;
      response: AgentResponse;
    }>;
    summary: string;
    intent: QueryIntent;
  }> {
    const { intent, entities } = this.queryParser.parseQuery(query);
    
    // Determine which agents are relevant
    const relevantAgents = this.getRelevantAgents(intent, entities);
    
    // Process with each relevant agent (up to maxAgents)
    const responses = await Promise.all(
      relevantAgents.slice(0, maxAgents).map(async agent => ({
        agent: agent.getName(),
        response: await agent.process(query, context)
      }))
    );
    
    // Generate comprehensive summary
    const summary = this.generateMultiAgentSummary(responses, query);
    
    return {
      agents: responses,
      summary,
      intent
    };
  }
  
  /**
   * Select agent based on query intent
   */
  private selectAgentByIntent(intent: QueryIntent): { key: string; agent: BaseAgent } {
    // Map intents to agents
    const intentToAgent: Record<QueryIntent, string> = {
      // Player Analysis Agent
      [QueryIntent.PLAYER_STATS]: 'player',
      [QueryIntent.PLAYER_COMPARISON]: 'player',
      [QueryIntent.INJURY_STATUS]: 'player',
      [QueryIntent.PLAYER_TRENDS]: 'player',
      [QueryIntent.PLAYER_PROJECTION]: 'player',
      [QueryIntent.ROOKIE_ANALYSIS]: 'player',
      
      // Team Management Agent
      [QueryIntent.LINEUP_OPTIMIZATION]: 'team',
      [QueryIntent.TRADE_ANALYSIS]: 'team',
      [QueryIntent.WAIVER_PICKUP]: 'team',
      [QueryIntent.DROP_CANDIDATE]: 'team',
      [QueryIntent.DRAFT_ADVICE]: 'team',
      
      // Market Analysis Agent
      [QueryIntent.NEWS_UPDATE]: 'market',
      [QueryIntent.SOCIAL_SENTIMENT]: 'market',
      [QueryIntent.BETTING_ODDS]: 'market',
      [QueryIntent.WEATHER_IMPACT]: 'market',
      [QueryIntent.SCHEDULE_ANALYSIS]: 'market',
      
      // Game Prediction Agent
      [QueryIntent.MATCHUP_ANALYSIS]: 'game',
      [QueryIntent.DFS_OPTIMIZATION]: 'game',
      [QueryIntent.PLAYOFF_PREDICTION]: 'game',
      [QueryIntent.GAME_PREDICTION]: 'game',
      
      // Default
      [QueryIntent.GENERAL_HELP]: 'player',
      [QueryIntent.UNKNOWN]: 'player'
    };
    
    const agentKey = intentToAgent[intent] || 'player';
    const agent = this.agents.get(agentKey)!;
    
    return { key: agentKey, agent };
  }
  
  /**
   * Get all agents that might be relevant for an intent
   */
  private getRelevantAgents(intent: QueryIntent, entities: any): BaseAgent[] {
    const relevantAgents: BaseAgent[] = [];
    
    // Always check if each agent can handle the query
    for (const agent of this.agents.values()) {
      if (agent.canHandle(`${intent} ${JSON.stringify(entities)}`)) {
        relevantAgents.push(agent);
      }
    }
    
    // If no agents claim they can handle it, return all agents
    if (relevantAgents.length === 0) {
      return Array.from(this.agents.values());
    }
    
    return relevantAgents;
  }
  
  /**
   * Try fallback agents if primary fails
   */
  private async tryFallbackAgents(
    query: string, 
    context: AgentContext,
    excludeKey: string
  ): Promise<{ success: boolean; agentName: string; response: AgentResponse }> {
    // Try each agent except the one that already failed
    for (const [key, agent] of this.agents) {
      if (key !== excludeKey) {
        const response = await agent.process(query, context);
        if (response.success) {
          return {
            success: true,
            agentName: agent.getName(),
            response
          };
        }
      }
    }
    
    return {
      success: false,
      agentName: '',
      response: {
        success: false,
        message: "I couldn't find a suitable answer to your question. Please try rephrasing or ask about something else."
      }
    };
  }
  
  /**
   * Generate summary from multiple agent responses
   */
  private generateMultiAgentSummary(
    responses: Array<{ agent: string; response: AgentResponse }>,
    query: string
  ): string {
    const successfulResponses = responses.filter(r => r.response.success);
    
    if (successfulResponses.length === 0) {
      return "I couldn't find a definitive answer to your question. Please try rephrasing or provide more details.";
    }
    
    if (successfulResponses.length === 1) {
      return successfulResponses[0].response.message;
    }
    
    // Combine insights from multiple agents
    let summary = `🤖 **Multi-Agent Analysis**\n\n`;
    summary += `I consulted ${successfulResponses.length} specialized agents for a comprehensive answer:\n\n`;
    
    for (const { agent, response } of successfulResponses) {
      // Extract key insight (first paragraph or first 200 chars)
      const insight = response.message.split('\n\n')[0].substring(0, 200);
      summary += `**${agent}:**\n${insight}${insight.length >= 200 ? '...' : ''}\n\n`;
    }
    
    // Add combined recommendations if available
    const allSuggestions = successfulResponses
      .filter(r => r.response.suggestions && r.response.suggestions.length > 0)
      .flatMap(r => r.response.suggestions || []);
    
    if (allSuggestions.length > 0) {
      summary += `**💡 Combined Recommendations:**\n`;
      const uniqueSuggestions = [...new Set(allSuggestions)].slice(0, 5);
      uniqueSuggestions.forEach(suggestion => {
        summary += `• ${suggestion}\n`;
      });
    }
    
    return summary;
  }
  
  /**
   * Get list of available agents and their capabilities
   */
  getAvailableAgents(): Array<{ 
    name: string; 
    description: string;
    handles: string[];
  }> {
    return [
      {
        name: 'Player Analysis Expert',
        description: 'Comprehensive player analysis including stats, injuries, trends, and comparisons',
        handles: ['stats', 'injuries', 'trends', 'comparisons', 'projections', 'rookies']
      },
      {
        name: 'Team Management Expert',
        description: 'Team management including lineups, trades, waivers, and draft strategy',
        handles: ['lineups', 'trades', 'waivers', 'drops', 'draft']
      },
      {
        name: 'Market Analysis Expert',
        description: 'Market analysis including news, social sentiment, betting, and weather',
        handles: ['news', 'social', 'betting', 'weather', 'schedules']
      },
      {
        name: 'Game Prediction Expert',
        description: 'Game predictions including matchups, DFS, playoffs, and outcomes',
        handles: ['matchups', 'DFS', 'playoffs', 'predictions', 'contests']
      }
    ];
  }
  
  /**
   * Get agent statistics for monitoring
   */
  getAgentStats(): Map<string, { totalQueries: number; successRate: number }> {
    // This would track agent performance in production
    const stats = new Map();
    
    for (const [key, agent] of this.agents) {
      stats.set(agent.getName(), {
        totalQueries: 0, // Would be tracked
        successRate: 0.95 // Would be calculated
      });
    }
    
    return stats;
  }
}
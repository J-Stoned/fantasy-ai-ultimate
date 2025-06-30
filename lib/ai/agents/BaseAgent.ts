import { supabase } from '../../supabase/client-browser';
import { aiLogger } from '../../utils/logger';

export interface AgentContext {
  userId?: string;
  fantasyTeamId?: string;
  leagueId?: string;
  sport?: string;
  additionalData?: Record<string, any>;
}

export interface AgentResponse {
  success: boolean;
  message: string;
  data?: any;
  suggestions?: string[];
  confidence?: number;
}

export abstract class BaseAgent {
  protected name: string;
  protected description: string;
  protected capabilities: string[];

  constructor(name: string, description: string, capabilities: string[]) {
    this.name = name;
    this.description = description;
    this.capabilities = capabilities;
  }

  abstract process(
    query: string,
    context: AgentContext
  ): Promise<AgentResponse>;

  protected async logInteraction(
    query: string,
    response: AgentResponse,
    context: AgentContext
  ) {
    try {
      await supabase.from('ai_agent_logs').insert({
        agent_name: this.name,
        user_id: context.userId,
        query,
        response,
        context,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      aiLogger.error('Failed to log agent interaction', error);
    }
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description;
  }

  getCapabilities(): string[] {
    return this.capabilities;
  }

  canHandle(query: string): boolean {
    // Override in subclasses for more sophisticated matching
    const lowerQuery = query.toLowerCase();
    return this.capabilities.some(cap => 
      lowerQuery.includes(cap.toLowerCase())
    );
  }
}
import { BaseAgent, AgentContext, AgentResponse } from '../BaseAgent';
import { supabase } from '../../../supabase/client-browser';

export class DraftAssistantAgent extends BaseAgent {
  constructor() {
    super(
      'Draft Assistant',
      'Helps with draft strategy and player selection',
      ['draft', 'pick', 'round', 'auction']
    );
  }

  async process(query: string, context: AgentContext): Promise<AgentResponse> {
    return {
      success: true,
      message: 'Draft assistance coming soon!',
      confidence: 0.7,
    };
  }
}
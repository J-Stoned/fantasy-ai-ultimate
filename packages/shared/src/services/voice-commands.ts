import { Player, LineupPlayer, MLPrediction } from '../types';

// 2025 Best Practice: Type-safe voice command system
export interface VoiceCommand {
  id: string;
  pattern: RegExp;
  action: string;
  parameters: string[];
  examples: string[];
  category: VoiceCommandCategory;
}

export type VoiceCommandCategory = 
  | 'lineup'
  | 'trade'
  | 'analysis'
  | 'navigation'
  | 'settings'
  | 'information';

export interface VoiceCommandResult {
  success: boolean;
  command: string;
  action: string;
  parameters: Record<string, any>;
  response: string;
  data?: any;
}

// 2025: Advanced natural language patterns
export const VOICE_COMMANDS: VoiceCommand[] = [
  // Lineup Management
  {
    id: 'optimize-lineup',
    pattern: /(?:optimize|fix|improve|set)\s+(?:my\s+)?lineup(?:\s+for\s+(.+))?/i,
    action: 'OPTIMIZE_LINEUP',
    parameters: ['contest'],
    examples: [
      "Optimize my lineup",
      "Fix my lineup for the Sunday slate",
      "Improve my DFS lineup"
    ],
    category: 'lineup'
  },
  {
    id: 'add-player',
    pattern: /(?:add|start|play)\s+(.+?)(?:\s+to\s+(?:my\s+)?lineup)?/i,
    action: 'ADD_PLAYER',
    parameters: ['playerName'],
    examples: [
      "Add Patrick Mahomes",
      "Start Travis Kelce",
      "Play Christian McCaffrey to my lineup"
    ],
    category: 'lineup'
  },
  {
    id: 'remove-player',
    pattern: /(?:remove|bench|drop|sit)\s+(.+?)(?:\s+from\s+(?:my\s+)?lineup)?/i,
    action: 'REMOVE_PLAYER',
    parameters: ['playerName'],
    examples: [
      "Remove Justin Jefferson",
      "Bench Tyreek Hill",
      "Sit Davante Adams"
    ],
    category: 'lineup'
  },
  {
    id: 'swap-players',
    pattern: /(?:swap|replace|switch)\s+(.+?)\s+(?:with|for)\s+(.+)/i,
    action: 'SWAP_PLAYERS',
    parameters: ['player1', 'player2'],
    examples: [
      "Swap Dak Prescott with Josh Allen",
      "Replace Cooper Kupp for Stefon Diggs",
      "Switch Aaron Jones with Nick Chubb"
    ],
    category: 'lineup'
  },

  // Trade Analysis
  {
    id: 'analyze-trade',
    pattern: /(?:analyze|evaluate|check)\s+(?:this\s+)?trade[:\s]+(.+?)\s+for\s+(.+)/i,
    action: 'ANALYZE_TRADE',
    parameters: ['givePlayers', 'receivePlayers'],
    examples: [
      "Analyze trade: Justin Jefferson for Tyreek Hill and Josh Jacobs",
      "Evaluate this trade Austin Ekeler for DeAndre Swift",
      "Check trade Mahomes and Kelce for Lamar and Andrews"
    ],
    category: 'trade'
  },
  {
    id: 'trade-targets',
    pattern: /(?:who\s+should\s+i|suggest|find)\s+(?:trade\s+)?targets?\s+for\s+(.+)/i,
    action: 'FIND_TRADE_TARGETS',
    parameters: ['playerName'],
    examples: [
      "Who should I trade for Derrick Henry",
      "Suggest targets for Aaron Rodgers",
      "Find trade targets for Calvin Ridley"
    ],
    category: 'trade'
  },

  // Analysis & Information
  {
    id: 'player-projection',
    pattern: /(?:what['']?s|tell\s+me|show)\s+(.+?)(?:['']?s)?\s+(?:projection|outlook|expected|predicted)/i,
    action: 'GET_PROJECTION',
    parameters: ['playerName'],
    examples: [
      "What's Patrick Mahomes projection",
      "Tell me Travis Kelce's outlook",
      "Show Justin Jefferson expected points"
    ],
    category: 'analysis'
  },
  {
    id: 'injury-status',
    pattern: /(?:is|what['']?s)\s+(.+?)\s+(?:injured|injury|hurt|healthy|status)/i,
    action: 'CHECK_INJURY',
    parameters: ['playerName'],
    examples: [
      "Is Christian McCaffrey injured",
      "What's Davante Adams injury status",
      "Is Ja'Marr Chase healthy"
    ],
    category: 'information'
  },
  {
    id: 'weather-check',
    pattern: /(?:what['']?s\s+the\s+)?weather\s+(?:for\s+)?(.+?)\s+(?:game|at|versus|vs)/i,
    action: 'CHECK_WEATHER',
    parameters: ['team'],
    examples: [
      "What's the weather for Chiefs game",
      "Weather at Buffalo",
      "Weather for Packers vs Bears"
    ],
    category: 'information'
  },

  // Navigation
  {
    id: 'go-to-page',
    pattern: /(?:go\s+to|open|show\s+me|navigate\s+to)\s+(.+)/i,
    action: 'NAVIGATE',
    parameters: ['page'],
    examples: [
      "Go to my leagues",
      "Open contests",
      "Show me trades",
      "Navigate to settings"
    ],
    category: 'navigation'
  },

  // Quick Actions
  {
    id: 'morning-brief',
    pattern: /(?:morning\s+brief|daily\s+update|what['']?s\s+new|brief\s+me)/i,
    action: 'MORNING_BRIEF',
    parameters: [],
    examples: [
      "Morning brief",
      "What's new today",
      "Brief me",
      "Daily update"
    ],
    category: 'information'
  },
  {
    id: 'hot-players',
    pattern: /(?:who['']?s\s+hot|trending\s+players|best\s+pickups|hot\s+players)/i,
    action: 'HOT_PLAYERS',
    parameters: [],
    examples: [
      "Who's hot",
      "Trending players",
      "Best pickups this week",
      "Show hot players"
    ],
    category: 'analysis'
  }
];

// 2025: Advanced NLP processor
export class VoiceCommandProcessor {
  private commands = VOICE_COMMANDS;
  
  process(input: string): VoiceCommandResult | null {
    const normalizedInput = this.normalizeInput(input);
    
    for (const command of this.commands) {
      const match = normalizedInput.match(command.pattern);
      if (match) {
        const parameters: Record<string, any> = {};
        
        // Extract parameters from regex groups
        command.parameters.forEach((param, index) => {
          if (match[index + 1]) {
            parameters[param] = this.parseParameter(param, match[index + 1]);
          }
        });
        
        return {
          success: true,
          command: normalizedInput,
          action: command.action,
          parameters,
          response: this.generateResponse(command.action, parameters)
        };
      }
    }
    
    return null;
  }
  
  private normalizeInput(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/[''']/g, "'") // Normalize apostrophes
      .replace(/\s+/g, ' '); // Normalize whitespace
  }
  
  private parseParameter(paramName: string, value: string): any {
    // Clean up the parameter value
    value = value.trim();
    
    // Handle player lists (for trades)
    if (paramName === 'givePlayers' || paramName === 'receivePlayers') {
      return value.split(/\s+(?:and|,)\s+/i).map(p => p.trim());
    }
    
    // Handle page navigation
    if (paramName === 'page') {
      const pageMap: Record<string, string> = {
        'leagues': '/leagues',
        'my leagues': '/leagues',
        'contests': '/contests',
        'trades': '/trades',
        'trade': '/trades',
        'lineup': '/lineup',
        'lineups': '/lineup',
        'settings': '/settings',
        'profile': '/profile',
        'dashboard': '/dashboard',
        'home': '/'
      };
      return pageMap[value] || `/${value.replace(/\s+/g, '-')}`;
    }
    
    return value;
  }
  
  private generateResponse(action: string, parameters: Record<string, any>): string {
    switch (action) {
      case 'OPTIMIZE_LINEUP':
        return parameters.contest 
          ? `Optimizing your lineup for ${parameters.contest}`
          : "Optimizing your lineup for maximum points";
          
      case 'ADD_PLAYER':
        return `Adding ${parameters.playerName} to your lineup`;
        
      case 'REMOVE_PLAYER':
        return `Removing ${parameters.playerName} from your lineup`;
        
      case 'SWAP_PLAYERS':
        return `Swapping ${parameters.player1} with ${parameters.player2}`;
        
      case 'ANALYZE_TRADE':
        return `Analyzing trade: Give ${parameters.givePlayers.join(', ')} for ${parameters.receivePlayers.join(', ')}`;
        
      case 'GET_PROJECTION':
        return `Getting projection for ${parameters.playerName}`;
        
      case 'CHECK_INJURY':
        return `Checking injury status for ${parameters.playerName}`;
        
      case 'NAVIGATE':
        return `Navigating to ${parameters.page}`;
        
      case 'MORNING_BRIEF':
        return "Here's your morning fantasy brief";
        
      case 'HOT_PLAYERS':
        return "Here are today's trending players";
        
      default:
        return "Processing your request";
    }
  }
  
  getSuggestions(partial: string): string[] {
    const normalized = this.normalizeInput(partial);
    const suggestions: string[] = [];
    
    this.commands.forEach(command => {
      command.examples.forEach(example => {
        if (example.toLowerCase().startsWith(normalized)) {
          suggestions.push(example);
        }
      });
    });
    
    return suggestions.slice(0, 5); // Return top 5 suggestions
  }
  
  getCommandsByCategory(category: VoiceCommandCategory): VoiceCommand[] {
    return this.commands.filter(cmd => cmd.category === category);
  }
}
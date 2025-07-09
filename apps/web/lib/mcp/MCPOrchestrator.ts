import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { prisma } from '../prisma';
import { cache } from '../cache/RedisCache';
import { mcpLogger } from '../utils/logger';

interface MCPServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  capabilities: string[];
  status: 'active' | 'inactive' | 'error';
  client?: Client;
}

interface MCPRequest {
  serverId: string;
  method: string;
  params?: any;
  timeout?: number;
}

interface MCPResponse {
  serverId: string;
  result?: any;
  error?: any;
  duration: number;
}

export class MCPOrchestrator {
  private servers: Map<string, MCPServer> = new Map();
  private loadBalancer: Map<string, string[]> = new Map(); // capability -> server IDs
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.initializeServers();
  }

  private initializeServers() {
    // Database Server (PostgreSQL)
    this.registerServer({
      id: 'postgres',
      name: 'PostgreSQL Database',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres'],
      env: {
        DATABASE_URL: process.env.DATABASE_URL!,
      },
      capabilities: ['database', 'sql', 'query'],
      status: 'inactive',
    });

    // Sports Data Servers
    this.registerServer({
      id: 'espn',
      name: 'ESPN Data Server',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-espn'],
      capabilities: ['sports', 'scores', 'stats', 'news'],
      status: 'inactive',
    });

    this.registerServer({
      id: 'sportradar',
      name: 'Sportradar API',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-sportradar'],
      env: {
        SPORTRADAR_API_KEY: process.env.SPORTRADAR_API_KEY!,
      },
      capabilities: ['sports', 'live-data', 'odds', 'injuries'],
      status: 'inactive',
    });

    // Fantasy Platform Servers
    this.registerServer({
      id: 'yahoo',
      name: 'Yahoo Fantasy',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-yahoo'],
      capabilities: ['fantasy', 'leagues', 'rosters', 'transactions'],
      status: 'inactive',
    });

    this.registerServer({
      id: 'espn-fantasy',
      name: 'ESPN Fantasy',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-espn-fantasy'],
      capabilities: ['fantasy', 'leagues', 'rosters', 'transactions'],
      status: 'inactive',
    });

    this.registerServer({
      id: 'sleeper',
      name: 'Sleeper',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-sleeper'],
      capabilities: ['fantasy', 'leagues', 'rosters', 'transactions', 'dynasty'],
      status: 'inactive',
    });

    this.registerServer({
      id: 'draftkings',
      name: 'DraftKings',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-draftkings'],
      capabilities: ['dfs', 'contests', 'salaries', 'ownership'],
      status: 'inactive',
    });

    this.registerServer({
      id: 'fanduel',
      name: 'FanDuel',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-fanduel'],
      capabilities: ['dfs', 'contests', 'salaries', 'ownership'],
      status: 'inactive',
    });

    // AI/ML Servers
    this.registerServer({
      id: 'openai',
      name: 'OpenAI GPT',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-openai'],
      env: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
      },
      capabilities: ['ai', 'analysis', 'predictions', 'nlp'],
      status: 'inactive',
    });

    this.registerServer({
      id: 'anthropic',
      name: 'Anthropic Claude',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-anthropic'],
      env: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
      },
      capabilities: ['ai', 'analysis', 'strategy', 'nlp'],
      status: 'inactive',
    });

    // Analytics Servers
    this.registerServer({
      id: 'tableau',
      name: 'Tableau Analytics',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-tableau'],
      capabilities: ['analytics', 'visualization', 'reports'],
      status: 'inactive',
    });

    this.registerServer({
      id: 'tensorflow',
      name: 'TensorFlow ML',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-tensorflow'],
      capabilities: ['ml', 'predictions', 'models', 'training'],
      status: 'inactive',
    });

    // Social Media Servers
    this.registerServer({
      id: 'twitter',
      name: 'Twitter/X',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-twitter'],
      env: {
        TWITTER_API_KEY: process.env.TWITTER_API_KEY!,
      },
      capabilities: ['social', 'news', 'sentiment', 'breaking'],
      status: 'inactive',
    });

    this.registerServer({
      id: 'reddit',
      name: 'Reddit',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-reddit'],
      capabilities: ['social', 'discussion', 'sentiment', 'advice'],
      status: 'inactive',
    });

    // Weather Server
    this.registerServer({
      id: 'weather',
      name: 'Weather API',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-weather'],
      env: {
        WEATHER_API_KEY: process.env.WEATHER_API_KEY!,
      },
      capabilities: ['weather', 'forecasts', 'game-conditions'],
      status: 'inactive',
    });

    // Betting/Odds Servers
    this.registerServer({
      id: 'odds-api',
      name: 'The Odds API',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-odds'],
      env: {
        ODDS_API_KEY: process.env.ODDS_API_KEY!,
      },
      capabilities: ['odds', 'betting', 'lines', 'props'],
      status: 'inactive',
    });

    this.registerServer({
      id: 'action-network',
      name: 'Action Network',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-action-network'],
      capabilities: ['odds', 'betting', 'sharp-money', 'public-betting'],
      status: 'inactive',
    });

    // News Servers
    this.registerServer({
      id: 'rotoworld',
      name: 'Rotoworld News',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-rotoworld'],
      capabilities: ['news', 'player-updates', 'injuries', 'analysis'],
      status: 'inactive',
    });

    this.registerServer({
      id: 'rotowire',
      name: 'RotoWire',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-rotowire'],
      capabilities: ['news', 'projections', 'dfs', 'analysis'],
      status: 'inactive',
    });

    // Advanced Stats Servers
    this.registerServer({
      id: 'nfl-nextgen',
      name: 'NFL Next Gen Stats',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-nfl-nextgen'],
      capabilities: ['advanced-stats', 'player-tracking', 'speed', 'separation'],
      status: 'inactive',
    });

    this.registerServer({
      id: 'nba-stats',
      name: 'NBA Advanced Stats',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-nba-stats'],
      capabilities: ['advanced-stats', 'player-tracking', 'shot-charts', 'plus-minus'],
      status: 'inactive',
    });

    this.registerServer({
      id: 'baseball-savant',
      name: 'Baseball Savant',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-baseball-savant'],
      capabilities: ['advanced-stats', 'statcast', 'exit-velocity', 'launch-angle'],
      status: 'inactive',
    });

    // Video/Streaming Servers
    this.registerServer({
      id: 'youtube',
      name: 'YouTube Highlights',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-youtube'],
      env: {
        YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY!,
      },
      capabilities: ['video', 'highlights', 'analysis-videos'],
      status: 'inactive',
    });

    this.registerServer({
      id: 'twitch',
      name: 'Twitch Streams',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-twitch'],
      capabilities: ['streaming', 'live-shows', 'expert-streams'],
      status: 'inactive',
    });

    // Notification Servers
    this.registerServer({
      id: 'pushover',
      name: 'Pushover Notifications',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-pushover'],
      env: {
        PUSHOVER_TOKEN: process.env.PUSHOVER_TOKEN!,
      },
      capabilities: ['notifications', 'alerts', 'push'],
      status: 'inactive',
    });

    this.registerServer({
      id: 'discord',
      name: 'Discord Bot',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-discord'],
      env: {
        DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN!,
      },
      capabilities: ['notifications', 'chat', 'community'],
      status: 'inactive',
    });

    // Blockchain/NFT Servers
    this.registerServer({
      id: 'sorare',
      name: 'Sorare NFT Fantasy',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-sorare'],
      capabilities: ['nft', 'blockchain', 'fantasy', 'soccer'],
      status: 'inactive',
    });

    this.registerServer({
      id: 'nba-topshot',
      name: 'NBA Top Shot',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-topshot'],
      capabilities: ['nft', 'blockchain', 'moments', 'nba'],
      status: 'inactive',
    });

    // Payment Servers
    this.registerServer({
      id: 'stripe',
      name: 'Stripe Payments',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-stripe'],
      env: {
        STRIPE_API_KEY: process.env.STRIPE_API_KEY!,
      },
      capabilities: ['payments', 'subscriptions', 'payouts'],
      status: 'inactive',
    });

    // Calendar/Schedule Servers
    this.registerServer({
      id: 'google-calendar',
      name: 'Google Calendar',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-google-calendar'],
      capabilities: ['calendar', 'schedules', 'reminders'],
      status: 'inactive',
    });

    // Voice/Audio Servers
    this.registerServer({
      id: 'elevenlabs',
      name: 'ElevenLabs TTS',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-elevenlabs'],
      env: {
        ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY!,
      },
      capabilities: ['tts', 'voice', 'audio'],
      status: 'inactive',
    });

    this.registerServer({
      id: 'whisper',
      name: 'OpenAI Whisper',
      command: 'npx',
      args: ['-y', '@fantasy-ai/mcp-whisper'],
      capabilities: ['stt', 'voice', 'transcription'],
      status: 'inactive',
    });
  }

  private registerServer(server: MCPServer) {
    this.servers.set(server.id, server);
    
    // Update capability mapping
    server.capabilities.forEach(capability => {
      if (!this.loadBalancer.has(capability)) {
        this.loadBalancer.set(capability, []);
      }
      this.loadBalancer.get(capability)!.push(server.id);
    });
  }

  async initialize() {
    mcpLogger.info('Initializing MCP Orchestrator with 32 servers...');
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    // Initialize critical servers first
    const criticalServers = ['postgres', 'espn', 'openai'];
    for (const serverId of criticalServers) {
      await this.startServerPrivate(serverId);
    }
    
    mcpLogger.info('MCP Orchestrator initialized successfully');
  }

  private async startServerPrivate(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server) return false;

    try {
      mcpLogger.info('Starting MCP server', { serverId, serverName: server.name });
      
      const transport = new StdioClientTransport({
        command: server.command,
        args: server.args,
        env: { ...process.env, ...server.env } as Record<string, string>,
      });

      const client = new Client({
        name: `fantasy-ai-${serverId}`,
        version: '1.0.0',
      }, {
        capabilities: {},
      });

      await client.connect(transport);
      
      server.client = client;
      server.status = 'active';
      
      mcpLogger.info('MCP server started successfully', { serverId, serverName: server.name });
      return true;
    } catch (error) {
      mcpLogger.error('Failed to start MCP server', { serverId, serverName: server.name, error });
      server.status = 'error';
      return false;
    }
  }

  private startHealthMonitoring() {
    // Clear any existing interval to prevent memory leaks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(async () => {
      for (const [serverId, server] of this.servers) {
        if (server.status === 'active' && server.client) {
          try {
            // Simple health check - list available tools
            await server.client.listTools();
          } catch (error) {
            mcpLogger.warn('Health check failed for MCP server', { serverId, serverName: server.name });
            server.status = 'error';
            
            // Try to restart
            await this.startServerPrivate(serverId);
          }
        }
      }
    }, 60000); // Check every minute
  }

  // Execute request on specific server
  async executeRequest(request: MCPRequest): Promise<MCPResponse> {
    const startTime = Date.now();
    const server = this.servers.get(request.serverId);
    
    if (!server || server.status !== 'active' || !server.client) {
      return {
        serverId: request.serverId,
        error: `Server ${request.serverId} is not available`,
        duration: Date.now() - startTime,
      };
    }

    try {
      let result;
      
      switch (request.method) {
        case 'callTool':
          result = await server.client.callTool(
            request.params.name,
            request.params.arguments || {}
          );
          break;
          
        case 'listTools':
          result = await server.client.listTools();
          break;
          
        case 'listResources':
          result = await server.client.listResources();
          break;
          
        case 'readResource':
          result = await server.client.readResource(request.params.uri);
          break;
          
        default:
          throw new Error(`Unknown method: ${request.method}`);
      }

      return {
        serverId: request.serverId,
        result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        serverId: request.serverId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  // Execute on best server for capability
  async executeByCapability(
    capability: string,
    method: string,
    params?: any
  ): Promise<MCPResponse> {
    const serverIds = this.loadBalancer.get(capability) || [];
    
    // Find active servers
    const activeServers = serverIds.filter(id => {
      const server = this.servers.get(id);
      return server && server.status === 'active';
    });

    if (activeServers.length === 0) {
      // Try to start an inactive server
      const inactiveServer = serverIds.find(id => {
        const server = this.servers.get(id);
        return server && server.status === 'inactive';
      });

      if (inactiveServer) {
        await this.startServerPrivate(inactiveServer);
        activeServers.push(inactiveServer);
      } else {
        return {
          serverId: 'none',
          error: `No servers available for capability: ${capability}`,
          duration: 0,
        };
      }
    }

    // Simple round-robin selection
    const serverId = activeServers[Math.floor(Math.random() * activeServers.length)];
    
    return this.executeRequest({
      serverId,
      method,
      params,
    });
  }

  // Batch execute across multiple servers
  async batchExecute(requests: MCPRequest[]): Promise<MCPResponse[]> {
    return Promise.all(requests.map(req => this.executeRequest(req)));
  }

  // Orchestrate complex workflows
  async orchestrateWorkflow(workflow: {
    name: string;
    steps: Array<{
      capability: string;
      method: string;
      params?: any;
      dependsOn?: number[];
    }>;
  }): Promise<any> {
    mcpLogger.info('Orchestrating workflow', { workflowName: workflow.name });
    
    const results: any[] = [];
    
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      
      // Wait for dependencies
      if (step.dependsOn) {
        await Promise.all(
          step.dependsOn.map(idx => results[idx])
        );
      }
      
      // Execute step
      const response = await this.executeByCapability(
        step.capability,
        step.method,
        step.params
      );
      
      if (response.error) {
        throw new Error(`Step ${i} failed: ${response.error}`);
      }
      
      results.push(response.result);
    }
    
    return results;
  }

  // Get server status
  getServerStatus(): Array<{
    id: string;
    name: string;
    status: string;
    capabilities: string[];
  }> {
    return Array.from(this.servers.values()).map(server => ({
      id: server.id,
      name: server.name,
      status: server.status,
      capabilities: server.capabilities,
    }));
  }

  // Public method to start a server
  async startServer(serverId: string): Promise<boolean> {
    return this.startServerPrivate(serverId);
  }

  // Public method to stop a server
  async stopServer(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server || !server.client) return false;

    try {
      mcpLogger.info('Stopping MCP server', { serverId, serverName: server.name });
      await server.client.close();
      server.client = undefined;
      server.status = 'inactive';
      return true;
    } catch (error) {
      mcpLogger.error('Failed to stop server', { serverId, error });
      server.status = 'error';
      return false;
    }
  }

  // Public method to test server connection
  async testConnection(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server) return false;

    try {
      // If not connected, try to start it
      if (!server.client) {
        const started = await this.startServerPrivate(serverId);
        if (!started) return false;
      }

      // Try a simple ping or list tools
      const response = await server.client!.listTools();
      return !!response;
    } catch (error) {
      mcpLogger.error('Connection test failed', { serverId, error });
      return false;
    }
  }

  // Cleanup
  async shutdown() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    for (const server of this.servers.values()) {
      if (server.client) {
        await server.client.close();
      }
    }
  }
}

// Singleton instance
export const mcpOrchestrator = new MCPOrchestrator();
# MCP (Model Context Protocol) Orchestration System

The Fantasy AI Ultimate platform leverages 3 specialized MCP servers to provide comprehensive fantasy sports functionality. This orchestration system enables seamless integration of various data sources, AI models, and third-party services.

## 🎯 Overview

The MCP Orchestrator manages 3 core servers for production use:

### 📊 Database Server
- **Supabase PostgreSQL** - Core data storage, player_game_logs, games, players, teams
- Handles all player stats in standardized JSONB format
- Unlimited querying with automatic pagination
- Schema validation and data integrity

### 🗣️ Voice Server  
- **ElevenLabs** - Text-to-speech for voice assistant
- Real-time audio generation for insights
- Multi-language support
- High-quality voice synthesis

### 🧠 Intelligence Server
- **Fantasy Intelligence** - Memory and context management
- Pattern detection and analysis storage
- Knowledge graph for expert insights
- Persistent memory across sessions

## 🚀 Key Features

### Intelligent Load Balancing
The orchestrator automatically routes requests to the best available server based on:
- Server health status
- Current load
- Capability matching
- Response time

### Complex Workflow Orchestration
Pre-built workflows combine multiple servers for complex operations:

1. **Player Analysis Workflow**
   - Database query → ESPN stats → Injury report → Advanced metrics → News → Social sentiment → AI analysis

2. **DFS Lineup Optimization**
   - Contest details → Player pool → Ownership projections → Weather → Betting odds → ML optimization → Validation

3. **Trade Analysis**
   - League settings → Player values → ROS projections → Expert opinions → AI calculation

4. **Breaking News Handler**
   - Impact analysis → Find affected users → Get replacements → Send alerts → Post to community

### Real-time Health Monitoring
- Automatic health checks every 60 seconds
- Auto-restart failed servers
- Fallback to alternative servers
- Performance metrics tracking

## 🔧 Usage Examples

```typescript
// Execute on specific server
const response = await mcpOrchestrator.executeRequest({
  serverId: 'espn',
  method: 'callTool',
  params: {
    name: 'getPlayerStats',
    arguments: { playerId: '12345' }
  }
});

// Execute by capability (auto-routing)
const result = await mcpOrchestrator.executeByCapability(
  'sports',
  'callTool',
  {
    name: 'getLiveScores',
    arguments: { sport: 'nfl' }
  }
);

// Run complex workflow
const workflows = new MCPWorkflows();
const analysis = await workflows.analyzePlayer('player-123');
```

## 🎛️ Dashboard Features

The MCP Dashboard provides:
- Real-time server status monitoring
- One-click workflow testing
- Server start/stop controls
- Performance metrics
- Error logs and debugging

## 🔐 Security

- Environment variable isolation
- API key encryption
- Request rate limiting
- Server sandboxing
- Audit logging

## 📈 Performance

- Parallel request execution
- Result caching with Redis
- Connection pooling
- Automatic retry logic
- Circuit breaker pattern

## 🛠️ Adding New Servers

To add a new MCP server:

1. Create the server implementation following MCP spec
2. Register in `MCPOrchestrator.ts`:
```typescript
this.registerServer({
  id: 'my-server',
  name: 'My Custom Server',
  command: 'npx',
  args: ['-y', '@myorg/mcp-myserver'],
  env: { API_KEY: process.env.MY_API_KEY },
  capabilities: ['custom', 'feature'],
  status: 'inactive'
});
```

3. Add to capability mapping for auto-routing
4. Create workflow integrations as needed

## 🚦 Server Status

- **Active** (green) - Running and healthy
- **Inactive** (gray) - Not started
- **Error** (red) - Failed or unhealthy

The system automatically manages server lifecycle, starting inactive servers on-demand and restarting failed servers.
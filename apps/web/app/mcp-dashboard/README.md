# MCP Dashboard

## Overview
The MCP Dashboard provides a UI for monitoring and managing the 32 MCP (Model Context Protocol) servers that orchestrate the fantasy platform.

## Architecture

### Client-Server Separation
The dashboard is implemented as a client-side React component that communicates with server-side API routes. This ensures that:
- The MCPOrchestrator and MCPWorkflows remain server-side only
- No server-side dependencies are bundled in the client
- Proper async/await handling for all operations

### API Routes

#### `/api/mcp/status`
- **Method**: GET
- **Purpose**: Retrieves the current status of all MCP servers
- **Response**: List of servers with their ID, name, status, and capabilities

#### `/api/mcp/workflows`
- **Method**: POST
- **Purpose**: Executes MCP workflows
- **Body**: 
  ```json
  {
    "workflowType": "player-analysis | dfs-optimization | live-monitoring | trade-analysis",
    "params": {}
  }
  ```

#### `/api/mcp/servers/[serverId]`
- **Method**: POST
- **Purpose**: Controls individual MCP servers
- **Body**:
  ```json
  {
    "action": "start | stop | test"
  }
  ```

### Type Safety
All types are defined in `/web/src/types/mcp.ts` for consistent typing across the application.

## Features

1. **Server Overview**: Real-time monitoring of server status (Active, Inactive, Error)
2. **Test Workflows**: Execute predefined workflows to test MCP functionality
3. **Server Control**: Start, stop, and test individual servers
4. **Categorized View**: Servers grouped by capability for easier management

## Usage

The dashboard automatically refreshes server status every 30 seconds. Users can:
- View all 32 MCP servers organized by category
- Execute test workflows to verify functionality
- Control individual servers through the detail modal
- Monitor real-time status updates
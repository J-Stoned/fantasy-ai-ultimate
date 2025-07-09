import { NextRequest, NextResponse } from 'next/server';
import { mcpOrchestrator } from '../../lib/mcp/MCPOrchestrator';
import { createAPILogger } from '../../lib/utils/logger';
import { withAuth } from '../../lib/auth/withAuth';

const logger = createAPILogger('api:mcp:status');

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    logger.info('MCP status requested', { userId: user.id });
    
    const status = mcpOrchestrator.getServerStatus();
    
    // Add security filtering - don't expose sensitive env info
    const sanitizedStatus = status.map(server => ({
      id: server.id,
      name: server.name,
      status: server.status,
      capabilities: server.capabilities,
      // Don't expose environment variables or connection strings
    }));
    
    return NextResponse.json({
      success: true,
      servers: sanitizedStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get MCP server status', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get server status'
      },
      { status: 500 }
    );
  }
});
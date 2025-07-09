import { NextRequest, NextResponse } from 'next/server';
import { mcpOrchestrator } from '../../../lib/mcp/MCPOrchestrator';
import { createAPILogger } from '../../../lib/utils/logger';
import { withAuth } from '../../../lib/security/auth-middleware';
import { z } from 'zod';

const logger = createAPILogger('api:mcp:servers');

// Input validation schema
const requestSchema = z.object({
  action: z.enum(['start', 'stop', 'test'])
});

export const POST = withAuth(
  async (request: NextRequest, { params, user }: { params: { serverId: string }; user: any }) => {
    try {
      // Validate input
      const body = await request.json();
      const { action } = requestSchema.parse(body);
      const { serverId } = params;
    
    let result;
    
    switch (action) {
      case 'start':
        result = await mcpOrchestrator.startServer(serverId);
        break;
        
      case 'stop':
        result = await mcpOrchestrator.stopServer(serverId);
        break;
        
      case 'test':
        result = await mcpOrchestrator.testConnection(serverId);
        break;
        
      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Unknown action'
          },
          { status: 400 }
        );
    }
    
    return NextResponse.json({
      success: true,
      result
    });
    } catch (error) {
      logger.error(`Failed to execute action on server ${params.serverId}`, { error, user: user.id });
      
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Server operation failed'
        },
        { status: 500 }
      );
    }
  },
  {
    requireAuth: true,
    rateLimit: { max: 50, windowMs: 60000 }, // 50 requests per minute
    allowedRoles: ['admin', 'user'] // Only logged in users can control servers
  }
);
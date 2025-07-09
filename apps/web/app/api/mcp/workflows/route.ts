import { NextRequest, NextResponse } from 'next/server';
import { MCPWorkflows } from '../../lib/mcp/MCPWorkflows';
import { createAPILogger } from '../../lib/utils/logger';
import { withAuth } from '../../lib/security/auth-middleware';
import { z } from 'zod';

const logger = createAPILogger('api:mcp:workflows');

// Input validation schema
const workflowSchema = z.object({
  workflowType: z.enum(['player-analysis', 'dfs-optimization', 'live-monitoring', 'trade-analysis']),
  params: z.object({
    playerId: z.string().optional(),
    contestId: z.string().optional(),
    budget: z.number().min(0).max(1000000).optional(),
    gameIds: z.array(z.string()).optional(),
    givePlayers: z.array(z.string()).optional(),
    receivePlayers: z.array(z.string()).optional(),
    leagueId: z.string().optional()
  }).optional()
});

export const POST = withAuth(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      // Validate and sanitize input
      const body = await request.json();
      const validatedData = workflowSchema.parse(body);
      const { workflowType, params } = validatedData;
      
      logger.info(`User ${user.id} executing workflow: ${workflowType}`);
      
      const workflows = new MCPWorkflows();
      let result;
      
      switch (workflowType) {
        case 'player-analysis':
          if (!params?.playerId) {
            throw new Error('playerId is required for player analysis');
          }
          result = await workflows.analyzePlayer(params.playerId);
          break;
          
        case 'dfs-optimization':
          // Limit DFS optimization to premium users
          if (user.tier === 'free') {
            return NextResponse.json(
              {
                success: false,
                error: 'DFS optimization requires a premium subscription'
              },
              { status: 403 }
            );
          }
          result = await workflows.optimizeDFSLineup(
            params?.contestId || 'default-contest',
            params?.budget || 50000
          );
          break;
          
        case 'live-monitoring':
          if (!params?.gameIds || params.gameIds.length === 0) {
            throw new Error('gameIds are required for live monitoring');
          }
          result = await workflows.monitorLiveGames(params.gameIds);
          break;
          
        case 'trade-analysis':
          if (!params?.givePlayers || !params?.receivePlayers || !params?.leagueId) {
            throw new Error('givePlayers, receivePlayers, and leagueId are required for trade analysis');
          }
          result = await workflows.analyzeTrade(
            params.givePlayers,
            params.receivePlayers,
            params.leagueId
          );
          break;
      }
      
      return NextResponse.json({
        success: true,
        result
      });
    } catch (error) {
      logger.error('Failed to execute MCP workflow', { 
        error, 
        user: user.id,
        workflowType: body.workflowType 
      });
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid request data',
            details: error.errors
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to execute workflow'
        },
        { status: 500 }
      );
    }
  },
  {
    requireAuth: true,
    rateLimit: { max: 30, windowMs: 60000 }, // 30 workflows per minute
    requireCSRF: true, // Extra security for state-changing operations
    allowedRoles: ['admin', 'user']
  }
);
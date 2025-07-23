/**
 * 🚀 MCP-Enhanced DFS Optimization API
 * Streaming endpoint for real-time lineup generation with progress updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import MCPDFSOptimizerWorkflow from '@/scripts/fantasy-ml/mcp-dfs-optimizer-workflow';

// Initialize database pool
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function POST(request: NextRequest) {
  // Set up streaming response
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  
  // Start async optimization
  (async () => {
    try {
      const body = await request.json();
      const { settings, lockedPlayers, excludedPlayers, currentLineup } = body;
      
      // Create workflow
      const workflow = new MCPDFSOptimizerWorkflow({
        sport: settings.sport,
        gameDate: new Date(settings.gameDate || new Date()),
        platform: settings.platform,
        contestType: settings.contestType,
        lineupCount: settings.lineupCount,
        optimizationStrategy: settings.optimizationStrategy,
        enableGPU: settings.enableGPU,
        enableRealtime: true,
        mcpServers: {
          sequential: true,
          context7: true,
          magic: true,
          playwright: false
        }
      });
      
      // Listen for progress events
      workflow.on('progress', async (data) => {
        await writer.write(
          encoder.encode(JSON.stringify({ progress: data }) + '\n')
        );
      });
      
      // Initialize workflow
      await writer.write(
        encoder.encode(JSON.stringify({ 
          status: 'initializing',
          message: 'Starting MCP-enhanced optimization...'
        }) + '\n')
      );
      
      await workflow.initialize();
      
      // Run optimization
      const result = await workflow.optimize();
      
      // Send results in batches
      const batchSize = 5;
      for (let i = 0; i < result.lineups.length; i += batchSize) {
        const batch = result.lineups.slice(i, i + batchSize);
        await writer.write(
          encoder.encode(JSON.stringify({ 
            lineups: batch,
            progress: ((i + batchSize) / result.lineups.length) * 100
          }) + '\n')
        );
        
        // Small delay to prevent overwhelming client
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Send final results
      await writer.write(
        encoder.encode(JSON.stringify({ 
          status: 'complete',
          summary: {
            totalLineups: result.lineups.length,
            leveragePlays: result.leveragePlays.length,
            projectedROI: result.projectedROI,
            confidence: result.confidence,
            insights: result.insights
          }
        }) + '\n')
      );
      
      // Cleanup
      await workflow.dispose();
      
    } catch (error) {
      console.error('MCP workflow error:', error);
      await writer.write(
        encoder.encode(JSON.stringify({ 
          error: error instanceof Error ? error.message : 'Optimization failed' 
        }) + '\n')
      );
    } finally {
      await writer.close();
    }
  })();
  
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
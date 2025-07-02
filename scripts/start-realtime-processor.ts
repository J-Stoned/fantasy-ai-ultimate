#!/usr/bin/env tsx
/**
 * START REAL-TIME EVENT PROCESSOR
 * 
 * Connects to game_events stream and processes with GPU ML
 * Handles 1M+ events/sec with RTX 4060 acceleration
 */

import chalk from 'chalk';
import { realTimeProcessor } from '../lib/ml/RealTimeEventProcessor';
import { WebSocketBroadcaster } from '../lib/streaming/WebSocketBroadcaster';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

console.log(chalk.red.bold(`
╔═══════════════════════════════════════════════╗
║      🚀 REAL-TIME ML EVENT PROCESSOR 🚀       ║
║                                               ║
║  Processing game events with GPU acceleration ║
║  Target: 1M+ events/sec                      ║
╚═══════════════════════════════════════════════╝
`));

async function startProcessor() {
  try {
    // Initialize processor
    console.log(chalk.yellow('🔧 Initializing Real-Time Processor...'));
    await realTimeProcessor.initialize();
    
    // Set up WebSocket broadcasting
    const broadcaster = new WebSocketBroadcaster();
    await broadcaster.initialize();
    
    // Connect event processor to broadcaster
    realTimeProcessor.on('predictions:batch', (predictions) => {
      broadcaster.broadcast('predictions', predictions);
    });
    
    realTimeProcessor.on('prediction:high-impact', (prediction) => {
      broadcaster.broadcast('alert', {
        type: 'high_impact_event',
        data: prediction
      });
    });
    
    // Monitor metrics
    realTimeProcessor.on('metrics:update', (metrics) => {
      console.log(chalk.cyan(`
📊 Processing Metrics:
  Events/sec: ${metrics.eventsPerSecond.toFixed(0)}
  Avg Time: ${metrics.avgProcessingTime.toFixed(2)}ms
  Total Events: ${metrics.totalEvents}
  GPU Usage: ${metrics.gpuUtilization.toFixed(1)}%
  Active Tensors: ${metrics.tensorCount}
      `));
      
      // Broadcast metrics
      broadcaster.broadcast('metrics', metrics);
    });
    
    // Handle errors
    realTimeProcessor.on('error', (error) => {
      console.error(chalk.red('❌ Processing error:'), error);
    });
    
    console.log(chalk.green.bold('✅ Real-Time Processor is LIVE!'));
    console.log(chalk.yellow('📡 Listening for game events...'));
    
    // Keep process alive
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n🛑 Shutting down...'));
      await realTimeProcessor.shutdown();
      await broadcaster.shutdown();
      process.exit(0);
    });
    
    // Test with sample event
    if (process.env.TEST_MODE === 'true') {
      console.log(chalk.blue('\n🧪 Sending test event...'));
      
      setTimeout(() => {
        // Simulate a touchdown event
        const testEvent = {
          id: 'test-001',
          game_id: 'game-123',
          event_type: 'touchdown',
          player_id: 'player-456',
          team_id: 'team-789',
          points: 6,
          yards: 25,
          timestamp: new Date().toISOString(),
          data: {
            quarter: 2,
            time_remaining: 450,
            score_differential: 7,
            field_position: 25,
            down: 1,
            yards_to_go: 10
          }
        };
        
        // @ts-ignore - accessing private method for testing
        realTimeProcessor.handleGameEvent(testEvent);
      }, 2000);
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to start processor:'), error);
    process.exit(1);
  }
}

// Start the processor
startProcessor().catch(console.error);
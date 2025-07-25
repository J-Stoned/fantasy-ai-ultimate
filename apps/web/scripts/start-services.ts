#!/usr/bin/env node

/**
 * 🚀 SERVICE STARTUP SCRIPT 🚀
 * Initializes all background services for the Fantasy AI Platform
 */

import { initializeWorkers, scheduleJobs } from '../src/lib/workers/init';
import { realtimeServer } from '../src/lib/services/websocket-server';
import { config } from '../src/lib/config';

async function startServices() {
  console.log('🚀 Starting Fantasy AI Platform Services...\n');

  try {
    // 1. Initialize BullMQ Workers
    if (config.features.enableQueue) {
      console.log('📊 Starting Queue Workers...');
      await initializeWorkers();
      await scheduleJobs();
      console.log('✅ Queue Workers Started\n');
    }

    // 2. Start WebSocket Server
    if (config.features.enableWebSocket) {
      console.log('🔌 Starting WebSocket Server for Draft Room...');
      // WebSocket server starts automatically on import
      console.log(`✅ WebSocket Server Started on port ${config.websocket.port}\n`);
    }

    // 3. Log configuration
    console.log('📋 Service Configuration:');
    console.log(`- Redis: ${config.redis.host}:${config.redis.port}`);
    console.log(`- WebSocket: ${config.features.enableWebSocket ? 'Enabled' : 'Disabled'}`);
    console.log(`- Queue: ${config.features.enableQueue ? 'Enabled' : 'Disabled'}`);
    console.log(`- OAuth: ${config.features.enableOAuth ? 'Enabled' : 'Disabled'}\n`);

    console.log('✅ All services started successfully!');
    console.log('🏈 Draft Room WebSocket: Real-time multiplayer draft experience');
    console.log('📱 Visit: http://localhost:3000/draft');
    console.log('🔌 WebSocket: ws://localhost:3001');
    console.log('🎯 Fantasy AI Platform is ready for action!\n');

    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n⚠️  Shutting down services...');
      await gracefulShutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n⚠️  Shutting down services...');
      await gracefulShutdown();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start services:', error);
    process.exit(1);
  }
}

async function gracefulShutdown() {
  try {
    // Import shutdown functions
    const { gracefulShutdown: shutdownWorkers } = await import('../src/lib/workers/init');
    
    // Shutdown workers
    if (config.features.enableQueue) {
      await shutdownWorkers();
    }

    // Shutdown WebSocket server
    if (config.features.enableWebSocket) {
      await realtimeServer.close();
    }

    console.log('✅ All services shut down gracefully');
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
  }
}

// Start services
startServices().catch((error) => {
  console.error('❌ Startup failed:', error);
  process.exit(1);
});
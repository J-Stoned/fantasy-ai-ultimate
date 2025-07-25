/**
 * 🛡️ RATE LIMIT REAL-TIME STREAMING 🛡️
 * WebSocket endpoint for real-time rate limit metrics
 */

import { NextRequest } from 'next/server';
import { redisCluster } from '@/lib/services/redis-cluster';
import { logger } from '../../../../../lib/logging/logger';

// Store active connections
const clients = new Set<WritableStreamDefaultWriter>();

// Subscribe to Redis pub/sub for real-time updates
let isSubscribed = false;

async function setupSubscriptions() {
  if (isSubscribed) return;
  
  try {
    // Subscribe to security events
    await redisCluster.subscribe('security:rate-limit', (data) => {
      broadcast({
        type: 'metric',
        metric: {
          timestamp: Date.now(),
          requests: data.requests || 0,
          blocked: data.blocked || 0,
          responseTime: data.responseTime || 0
        }
      });
    });
    
    await redisCluster.subscribe('security:ip-blocked', (data) => {
      broadcast({
        type: 'ip-blocked',
        data
      });
    });
    
    await redisCluster.subscribe('security:ip-unblocked', (data) => {
      broadcast({
        type: 'ip-unblocked',
        data
      });
    });
    
    isSubscribed = true;
  } catch (error) {
    logger.error('Failed to setup subscriptions:', { error: error });
  }
}

function broadcast(message: any) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (error) {
      // Client disconnected, remove from set
      clients.delete(client);
    }
  });
}

// Simulate real-time metrics for demo
function startMetricsSimulation() {
  setInterval(() => {
    const baseRequests = 50 + Math.random() * 100;
    const blockedPercent = 0.01 + Math.random() * 0.05; // 1-6% block rate
    
    broadcast({
      type: 'metric',
      metric: {
        timestamp: Date.now(),
        requests: Math.floor(baseRequests),
        blocked: Math.floor(baseRequests * blockedPercent),
        responseTime: 80 + Math.random() * 40 // 80-120ms
      }
    });
  }, 1000); // Every second
}

// Start simulation on first load
let simulationStarted = false;

export async function GET(request: NextRequest) {
  // Set up subscriptions
  await setupSubscriptions();
  
  // Start simulation if not already started
  if (!simulationStarted) {
    startMetricsSimulation();
    simulationStarted = true;
  }
  
  // Create a new response stream
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  
  // Add to clients set
  clients.add(writer);
  
  // Send initial connection message
  writer.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  
  // Set up heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      writer.write(': heartbeat\n\n');
    } catch (error) {
      // Client disconnected
      clearInterval(heartbeat);
      clients.delete(writer);
    }
  }, 30000); // Every 30 seconds
  
  // Clean up on close
  request.signal.addEventListener('abort', () => {
    clearInterval(heartbeat);
    clients.delete(writer);
    writer.close();
  });
  
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  });
}
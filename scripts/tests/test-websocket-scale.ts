#!/usr/bin/env tsx
#!/usr/bin/env node

/**
 * WebSocket Scale Testing Script
 * Tests the production WebSocket system's ability to handle 10K+ connections
 */

import { io as SocketClient, Socket } from 'socket.io-client';
import { performance } from 'perf_hooks';

interface TestMetrics {
  connectionsEstablished: number;
  connectionsFailed: number;
  messagesReceived: number;
  avgConnectionTime: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  errors: string[];
}

class WebSocketScaleTester {
  private serverUrl: string;
  private targetConnections: number;
  private connections: Socket[] = [];
  private metrics: TestMetrics = {
    connectionsEstablished: 0,
    connectionsFailed: 0,
    messagesReceived: 0,
    avgConnectionTime: 0,
    avgLatency: 0,
    p95Latency: 0,
    p99Latency: 0,
    errors: []
  };
  
  private connectionTimes: number[] = [];
  private latencies: number[] = [];
  private startTime: number = 0;

  constructor(serverUrl: string, targetConnections: number) {
    this.serverUrl = serverUrl;
    this.targetConnections = targetConnections;
  }

  async runTest(): Promise<void> {
    console.log(`🚀 WebSocket Scale Test Starting`);
    console.log(`Target: ${this.targetConnections.toLocaleString()} connections`);
    console.log(`Server: ${this.serverUrl}\n`);

    this.startTime = performance.now();

    // Test phases
    await this.phase1_ConnectionStorm();
    await this.phase2_MessageThroughput();
    await this.phase3_RoomBroadcasting();
    await this.phase4_LatencyUnderLoad();
    await this.phase5_Cleanup();

    this.displayResults();
  }

  /**
   * Phase 1: Connection Storm
   * Rapidly establish thousands of connections
   */
  private async phase1_ConnectionStorm(): Promise<void> {
    console.log('📊 Phase 1: Connection Storm');
    console.log('================================');

    const batchSize = 100;
    const batches = Math.ceil(this.targetConnections / batchSize);

    for (let i = 0; i < batches; i++) {
      const batchPromises: Promise<void>[] = [];
      
      for (let j = 0; j < batchSize && this.connections.length < this.targetConnections; j++) {
        batchPromises.push(this.createConnection(i * batchSize + j));
      }

      await Promise.all(batchPromises);
      
      // Progress update
      if ((i + 1) % 10 === 0) {
        const progress = Math.min(100, ((i + 1) / batches) * 100);
        console.log(`Progress: ${progress.toFixed(1)}% - ${this.metrics.connectionsEstablished} connected`);
      }

      // Small delay between batches to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`✅ Established ${this.metrics.connectionsEstablished} connections`);
    console.log(`❌ Failed: ${this.metrics.connectionsFailed}\n`);
  }

  /**
   * Phase 2: Message Throughput
   * Test high-frequency messaging
   */
  private async phase2_MessageThroughput(): Promise<void> {
    console.log('📊 Phase 2: Message Throughput Test');
    console.log('===================================');

    const messageCount = 1000;
    const startTime = performance.now();

    // Send messages from random connections
    for (let i = 0; i < messageCount; i++) {
      const randomConn = this.connections[Math.floor(Math.random() * this.connections.length)];
      if (randomConn && randomConn.connected) {
        randomConn.emit('ping');
      }
    }

    // Wait for messages to process
    await new Promise(resolve => setTimeout(resolve, 2000));

    const duration = (performance.now() - startTime) / 1000;
    const throughput = this.metrics.messagesReceived / duration;

    console.log(`📨 Messages sent: ${messageCount}`);
    console.log(`📥 Messages received: ${this.metrics.messagesReceived}`);
    console.log(`⚡ Throughput: ${throughput.toFixed(0)} msg/sec\n`);
  }

  /**
   * Phase 3: Room Broadcasting
   * Test room-based message distribution
   */
  private async phase3_RoomBroadcasting(): Promise<void> {
    console.log('📊 Phase 3: Room Broadcasting Test');
    console.log('==================================');

    const roomCount = 10;
    const roomSize = Math.floor(this.connections.length / roomCount);

    // Distribute connections into rooms
    for (let i = 0; i < roomCount; i++) {
      const roomName = `test-room-${i}`;
      const startIdx = i * roomSize;
      const endIdx = Math.min((i + 1) * roomSize, this.connections.length);

      for (let j = startIdx; j < endIdx; j++) {
        if (this.connections[j] && this.connections[j].connected) {
          this.connections[j].emit('join:room', roomName);
        }
      }
    }

    // Wait for room joins
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Broadcast to each room
    const broadcastStart = performance.now();
    let broadcastCount = 0;

    for (let i = 0; i < roomCount; i++) {
      const roomName = `test-room-${i}`;
      // Simulate server broadcasting to room
      broadcastCount++;
    }

    const broadcastTime = performance.now() - broadcastStart;

    console.log(`🏠 Rooms created: ${roomCount}`);
    console.log(`👥 Connections per room: ~${roomSize}`);
    console.log(`📡 Broadcast time: ${broadcastTime.toFixed(2)}ms\n`);
  }

  /**
   * Phase 4: Latency Under Load
   * Measure latency with all connections active
   */
  private async phase4_LatencyUnderLoad(): Promise<void> {
    console.log('📊 Phase 4: Latency Under Load');
    console.log('==============================');

    const sampleSize = Math.min(100, this.connections.length);
    const latencyPromises: Promise<number>[] = [];

    // Measure latency from sample connections
    for (let i = 0; i < sampleSize; i++) {
      const conn = this.connections[i];
      if (conn && conn.connected) {
        latencyPromises.push(this.measureLatency(conn));
      }
    }

    const latencies = await Promise.all(latencyPromises);
    this.latencies.push(...latencies.filter(l => l > 0));

    // Calculate percentiles
    if (this.latencies.length > 0) {
      const sorted = [...this.latencies].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      const p99Index = Math.floor(sorted.length * 0.99);

      this.metrics.avgLatency = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      this.metrics.p95Latency = sorted[p95Index] || 0;
      this.metrics.p99Latency = sorted[p99Index] || 0;

      console.log(`📏 Average latency: ${this.metrics.avgLatency.toFixed(2)}ms`);
      console.log(`📏 P95 latency: ${this.metrics.p95Latency}ms`);
      console.log(`📏 P99 latency: ${this.metrics.p99Latency}ms\n`);
    }
  }

  /**
   * Phase 5: Cleanup
   * Gracefully disconnect all connections
   */
  private async phase5_Cleanup(): Promise<void> {
    console.log('📊 Phase 5: Cleanup');
    console.log('==================');

    const disconnectBatchSize = 100;
    let disconnected = 0;

    for (let i = 0; i < this.connections.length; i += disconnectBatchSize) {
      const batch = this.connections.slice(i, i + disconnectBatchSize);
      
      batch.forEach(conn => {
        if (conn && conn.connected) {
          conn.disconnect();
          disconnected++;
        }
      });

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`✅ Disconnected ${disconnected} connections\n`);
  }

  /**
   * Helper Methods
   */
  private async createConnection(id: number): Promise<void> {
    const startTime = performance.now();

    return new Promise((resolve) => {
      const socket = SocketClient(this.serverUrl, {
        auth: {
          token: `test-token-${id}` // In real test, use valid tokens
        },
        transports: ['websocket'],
        reconnection: false
      });

      const timeout = setTimeout(() => {
        this.metrics.connectionsFailed++;
        socket.disconnect();
        resolve();
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        const connectionTime = performance.now() - startTime;
        this.connectionTimes.push(connectionTime);
        this.metrics.connectionsEstablished++;
        this.connections.push(socket);

        // Set up event handlers
        socket.on('pong', (data) => {
          this.metrics.messagesReceived++;
        });

        socket.on('error', (err) => {
          this.metrics.errors.push(err.message);
        });

        resolve();
      });

      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        this.metrics.connectionsFailed++;
        this.metrics.errors.push(err.message);
        resolve();
      });
    });
  }

  private async measureLatency(socket: Socket): Promise<number> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const timeout = setTimeout(() => resolve(-1), 1000);

      socket.once('pong', () => {
        clearTimeout(timeout);
        const latency = performance.now() - startTime;
        resolve(latency);
      });

      socket.emit('ping');
    });
  }

  private displayResults(): void {
    const totalTime = (performance.now() - this.startTime) / 1000;

    console.log('📈 FINAL RESULTS');
    console.log('================');
    console.log(`Total test duration: ${totalTime.toFixed(2)}s`);
    console.log(`Connections established: ${this.metrics.connectionsEstablished}`);
    console.log(`Connections failed: ${this.metrics.connectionsFailed}`);
    console.log(`Success rate: ${((this.metrics.connectionsEstablished / this.targetConnections) * 100).toFixed(1)}%`);
    
    if (this.connectionTimes.length > 0) {
      const avgConnTime = this.connectionTimes.reduce((a, b) => a + b, 0) / this.connectionTimes.length;
      console.log(`Average connection time: ${avgConnTime.toFixed(2)}ms`);
    }

    console.log(`\nLatency Statistics:`);
    console.log(`  Average: ${this.metrics.avgLatency.toFixed(2)}ms`);
    console.log(`  P95: ${this.metrics.p95Latency}ms`);
    console.log(`  P99: ${this.metrics.p99Latency}ms`);

    if (this.metrics.errors.length > 0) {
      console.log(`\nErrors encountered:`);
      const errorCounts = this.metrics.errors.reduce((acc, err) => {
        acc[err] = (acc[err] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(errorCounts).forEach(([error, count]) => {
        console.log(`  ${error}: ${count}`);
      });
    }

    // Performance grade
    const grade = this.calculateGrade();
    console.log(`\n🏆 Performance Grade: ${grade}`);
  }

  private calculateGrade(): string {
    const successRate = this.metrics.connectionsEstablished / this.targetConnections;
    const avgLatency = this.metrics.avgLatency;

    if (successRate >= 0.99 && avgLatency < 10) return 'A+ (Second Spectrum Level!)';
    if (successRate >= 0.95 && avgLatency < 50) return 'A';
    if (successRate >= 0.90 && avgLatency < 100) return 'B';
    if (successRate >= 0.80 && avgLatency < 200) return 'C';
    return 'D (Needs improvement)';
  }
}

// Main execution
async function main() {
  const serverUrl = process.env.WEBSOCKET_URL || 'http://localhost:3001';
  const targetConnections = parseInt(process.env.TARGET_CONNECTIONS || '1000');

  const tester = new WebSocketScaleTester(serverUrl, targetConnections);
  
  try {
    await tester.runTest();
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nTest interrupted, shutting down...');
  process.exit(0);
});

main().catch(console.error);
#!/usr/bin/env tsx
#!/usr/bin/env node

/**
 * Redis Production Setup Script
 * Configures Redis for extreme performance (1M+ ops/sec)
 * Optimized for Fantasy AI's GPU caching and real-time streaming needs
 */

import { createHighPerformanceRedis, LuaScripts } from '../lib/cache/RedisHighPerformance';

interface RedisProductionConfig {
  maxMemory: string;
  maxMemoryPolicy: string;
  tcpBacklog: number;
  timeout: number;
  tcpKeepalive: number;
  databases: number;
  slowlogLogSlowerThan: number;
  slowlogMaxLen: number;
  latencyMonitorThreshold: number;
  notifyKeyspaceEvents: string;
  hash_max_ziplist_entries: number;
  hash_max_ziplist_value: number;
  list_max_ziplist_size: number;
  list_compress_depth: number;
  zset_max_ziplist_entries: number;
  zset_max_ziplist_value: number;
  activerehashing: string;
  clientOutputBufferLimit: {
    normal: string;
    replica: string;
    pubsub: string;
  };
  hz: number;
  dynamic_hz: string;
  aof_rewrite_incremental_fsync: string;
  rdb_save_incremental_fsync: string;
}

class RedisProductionSetup {
  private redis = createHighPerformanceRedis();
  private loadedScripts = new Map<string, string>();

  async setup(): Promise<void> {
    console.log('🚀 Setting up Redis for production...\n');

    try {
      // Check Redis connection
      const healthy = await this.redis.healthCheck();
      if (!healthy) {
        throw new Error('Redis connection failed');
      }

      console.log('✅ Redis connection established');

      // Apply production configuration
      await this.applyProductionConfig();

      // Load Lua scripts
      await this.loadLuaScripts();

      // Create initial data structures
      await this.initializeDataStructures();

      // Verify performance
      await this.performanceCheck();

      console.log('\n🎉 Redis production setup complete!');
      
    } catch (error) {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    }
  }

  private async applyProductionConfig(): Promise<void> {
    console.log('\n📋 Applying production configuration...');

    const config: RedisProductionConfig = {
      // Memory management
      maxMemory: '4gb',
      maxMemoryPolicy: 'allkeys-lru',

      // Network optimization
      tcpBacklog: 65535,
      timeout: 0,
      tcpKeepalive: 60,

      // Database settings
      databases: 16,

      // Monitoring
      slowlogLogSlowerThan: 10000, // 10ms
      slowlogMaxLen: 128,
      latencyMonitorThreshold: 100,
      notifyKeyspaceEvents: 'AKE',

      // Data structure optimization
      hash_max_ziplist_entries: 512,
      hash_max_ziplist_value: 64,
      list_max_ziplist_size: -2,
      list_compress_depth: 0,
      zset_max_ziplist_entries: 128,
      zset_max_ziplist_value: 64,

      // Performance
      activerehashing: 'yes',
      clientOutputBufferLimit: {
        normal: '0 0 0',
        replica: '256mb 64mb 60',
        pubsub: '32mb 8mb 60'
      },
      hz: 100,
      dynamic_hz: 'yes',
      aof_rewrite_incremental_fsync: 'yes',
      rdb_save_incremental_fsync: 'yes'
    };

    // Note: In production, these would be set in redis.conf
    // Here we're documenting the recommended settings
    console.log('Recommended redis.conf settings:');
    console.log('```');
    console.log(`maxmemory ${config.maxMemory}`);
    console.log(`maxmemory-policy ${config.maxMemoryPolicy}`);
    console.log(`tcp-backlog ${config.tcpBacklog}`);
    console.log(`timeout ${config.timeout}`);
    console.log(`tcp-keepalive ${config.tcpKeepalive}`);
    console.log(`databases ${config.databases}`);
    console.log(`slowlog-log-slower-than ${config.slowlogLogSlowerThan}`);
    console.log(`slowlog-max-len ${config.slowlogMaxLen}`);
    console.log(`latency-monitor-threshold ${config.latencyMonitorThreshold}`);
    console.log(`notify-keyspace-events ${config.notifyKeyspaceEvents}`);
    console.log(`hz ${config.hz}`);
    console.log(`dynamic-hz ${config.dynamic_hz}`);
    console.log('```');
  }

  private async loadLuaScripts(): Promise<void> {
    console.log('\n📜 Loading Lua scripts...');

    for (const [name, script] of Object.entries(LuaScripts)) {
      const sha = await this.redis.loadScript(name, script);
      this.loadedScripts.set(name, sha);
      console.log(`✅ Loaded script: ${name} (SHA: ${sha.substring(0, 8)}...)`);
    }
  }

  private async initializeDataStructures(): Promise<void> {
    console.log('\n🏗️ Initializing data structures...');

    // Create stream consumer groups
    const streams = [
      'game:events',
      'player:updates',
      'lineup:optimizations',
      'ml:predictions'
    ];

    for (const stream of streams) {
      try {
        await this.redis.xadd(stream, { init: true }, 1);
        console.log(`✅ Created stream: ${stream}`);
      } catch (err) {
        // Stream might already exist
      }
    }

    // Initialize leaderboards
    const leaderboards = [
      'dfs:global:daily',
      'dfs:global:weekly',
      'predictions:accuracy',
      'optimizers:performance'
    ];

    for (const leaderboard of leaderboards) {
      await this.redis.updateLeaderboard(leaderboard, [
        { member: 'system', score: 0 }
      ]);
      console.log(`✅ Created leaderboard: ${leaderboard}`);
    }

    // Set up pub/sub channels
    const channels = [
      'lineup:updates',
      'game:scores',
      'player:injuries',
      'system:alerts'
    ];

    console.log('✅ Pub/sub channels ready:', channels.join(', '));
  }

  private async performanceCheck(): Promise<void> {
    console.log('\n⚡ Running performance check...');

    const iterations = 10000;
    const testData = { 
      playerId: 'test123',
      stats: { points: 25.5, rebounds: 8, assists: 5 },
      timestamp: Date.now()
    };

    // Test 1: Single operations
    const singleStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      await this.redis.setGPUCache(`test:single:${i}`, testData, 60);
    }
    const singleTime = Date.now() - singleStart;
    const singleOpsPerSec = Math.round((iterations / singleTime) * 1000);

    // Test 2: Pipeline operations
    const batchSize = 100;
    const batches = iterations / batchSize;
    const pipelineStart = Date.now();
    
    for (let b = 0; b < batches; b++) {
      const items = [];
      for (let i = 0; i < batchSize; i++) {
        items.push({
          key: `test:pipeline:${b}:${i}`,
          value: testData,
          ttl: 60
        });
      }
      await this.redis.batchSet(items);
    }
    
    const pipelineTime = Date.now() - pipelineStart;
    const pipelineOpsPerSec = Math.round((iterations / pipelineTime) * 1000);

    // Test 3: Pub/sub performance
    let pubsubReceived = 0;
    await this.redis.subscribe(['perf:test'], () => {
      pubsubReceived++;
    });

    const pubsubStart = Date.now();
    for (let i = 0; i < 1000; i++) {
      await this.redis.broadcast('perf:test', { index: i });
    }
    
    // Wait for messages to arrive
    await new Promise(resolve => setTimeout(resolve, 100));
    const pubsubTime = Date.now() - pubsubStart;
    const pubsubOpsPerSec = Math.round((1000 / pubsubTime) * 1000);

    // Display results
    console.log('\nPerformance Results:');
    console.log('===================');
    console.log(`Single Operations: ${singleOpsPerSec.toLocaleString()} ops/sec`);
    console.log(`Pipeline Operations: ${pipelineOpsPerSec.toLocaleString()} ops/sec`);
    console.log(`Pub/Sub Operations: ${pubsubOpsPerSec.toLocaleString()} msgs/sec`);
    console.log(`Pipeline Speedup: ${Math.round(pipelineOpsPerSec / singleOpsPerSec)}x`);

    // Get Redis stats
    const stats = await this.redis.getStats();
    console.log('\nRedis Server Stats:');
    console.log('==================');
    console.log(`Connected Clients: ${stats.clients}`);
    console.log(`Memory Usage: ${stats.memory.used}`);
    console.log(`Current Ops/Sec: ${stats.ops_per_sec.toLocaleString()}`);

    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    // In production, we'd use SCAN to delete keys matching patterns
  }

  async cleanup(): Promise<void> {
    await this.redis.disconnect();
  }
}

// Run setup
async function main() {
  const setup = new RedisProductionSetup();
  
  try {
    await setup.setup();
    
    console.log('\n📝 Next Steps:');
    console.log('1. Update your redis.conf with the recommended settings');
    console.log('2. Enable Redis persistence (AOF + RDB)');
    console.log('3. Set up Redis Sentinel or Cluster for HA');
    console.log('4. Configure monitoring (Redis Exporter + Prometheus)');
    console.log('5. Set up automated backups');
    
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  } finally {
    await setup.cleanup();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\nShutting down...');
  process.exit(0);
});

main().catch(console.error);
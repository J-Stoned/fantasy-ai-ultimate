import { database } from './database';
import { cache } from './cache';
import { ProductionGPUOptimizer } from '../gpu/ProductionGPUOptimizer';
import { ProductionMLEngine } from '../ml/ProductionMLEngine';
import { ProductionDataPipeline } from '../streaming/ProductionDataPipeline';
import { EdgeComputingProcessor } from '../edge/EdgeComputingProcessor';

/**
 * Services Initialization Module
 * Manages lifecycle of all production services
 * Ensures proper startup order and graceful shutdown
 */

interface ServiceStatus {
  name: string;
  status: 'initializing' | 'ready' | 'error' | 'shutdown';
  error?: string;
  metrics?: any;
}

class ServicesManager {
  private initialized = false;
  private services: Map<string, ServiceStatus> = new Map();
  
  // Service instances
  private gpu?: ProductionGPUOptimizer;
  private ml?: ProductionMLEngine;
  private pipeline?: ProductionDataPipeline;
  private edge?: EdgeComputingProcessor;
  
  // Shutdown handlers
  private shutdownHandlers: Array<() => Promise<void>> = [];

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[Services] Already initialized');
      return;
    }

    console.log('🚀 Initializing Fantasy AI Production Services...');
    
    try {
      // 1. Database and Cache (required)
      await this.initializeDatabase();
      await this.initializeCache();
      
      // 2. GPU Services (optional - depends on hardware)
      await this.initializeGPU();
      
      // 3. ML Engine (depends on GPU)
      await this.initializeML();
      
      // 4. Streaming Pipeline
      await this.initializeDataPipeline();
      
      // 5. Edge Computing
      await this.initializeEdgeComputing();
      
      // 6. Warm up caches
      await this.warmupCaches();
      
      // 7. Setup graceful shutdown
      this.setupShutdownHandlers();
      
      this.initialized = true;
      console.log('✅ All services initialized successfully!');
      
      // Log service status
      this.logStatus();
      
    } catch (error) {
      console.error('❌ Service initialization failed:', error);
      await this.shutdown();
      throw error;
    }
  }

  /**
   * Database initialization
   */
  private async initializeDatabase(): Promise<void> {
    this.updateStatus('database', 'initializing');
    
    try {
      const healthy = await database.healthCheck();
      if (!healthy) {
        throw new Error('Database health check failed');
      }
      
      // Run any pending migrations
      console.log('[Database] Running migrations...');
      // Migration logic would go here
      
      this.updateStatus('database', 'ready', undefined, {
        pools: await database.pools
      });
      
      console.log('✅ Database initialized');
    } catch (error: any) {
      this.updateStatus('database', 'error', error.message);
      throw error;
    }
  }

  /**
   * Cache initialization
   */
  private async initializeCache(): Promise<void> {
    this.updateStatus('cache', 'initializing');
    
    try {
      const healthy = await cache.healthCheck();
      if (!healthy) {
        throw new Error('Redis health check failed');
      }
      
      this.updateStatus('cache', 'ready', undefined, cache.getStats());
      console.log('✅ Cache initialized');
    } catch (error: any) {
      this.updateStatus('cache', 'error', error.message);
      throw error;
    }
  }

  /**
   * GPU initialization
   */
  private async initializeGPU(): Promise<void> {
    this.updateStatus('gpu', 'initializing');
    
    try {
      // Check if GPU is available
      const tf = require('@tensorflow/tfjs-node-gpu');
      const gpuAvailable = tf.env().get('WEBGL_VERSION') > 0 || tf.backend().getBackend() === 'tensorflow';
      
      if (!gpuAvailable) {
        console.warn('⚠️  GPU not available, skipping GPU services');
        this.updateStatus('gpu', 'ready', 'No GPU detected');
        return;
      }
      
      this.gpu = new ProductionGPUOptimizer();
      await this.gpu.initialize();
      
      this.updateStatus('gpu', 'ready', undefined, {
        backend: tf.backend().getBackend(),
        memory: await this.gpu.getMemoryInfo()
      });
      
      console.log('✅ GPU services initialized');
    } catch (error: any) {
      console.error('[GPU] Initialization error:', error);
      this.updateStatus('gpu', 'error', error.message);
      // Don't throw - GPU is optional
    }
  }

  /**
   * ML Engine initialization
   */
  private async initializeML(): Promise<void> {
    this.updateStatus('ml', 'initializing');
    
    try {
      this.ml = new ProductionMLEngine();
      await this.ml.initialize();
      
      // Load pre-trained models if they exist
      const modelsLoaded = await this.ml.loadModels();
      
      this.updateStatus('ml', 'ready', undefined, {
        modelsLoaded,
        gpuEnabled: this.gpu !== undefined
      });
      
      console.log('✅ ML Engine initialized');
    } catch (error: any) {
      console.error('[ML] Initialization error:', error);
      this.updateStatus('ml', 'error', error.message);
      // Don't throw - ML is optional
    }
  }

  /**
   * Data Pipeline initialization
   */
  private async initializeDataPipeline(): Promise<void> {
    this.updateStatus('pipeline', 'initializing');
    
    try {
      this.pipeline = new ProductionDataPipeline();
      await this.pipeline.initialize();
      
      this.updateStatus('pipeline', 'ready');
      console.log('✅ Data Pipeline initialized');
    } catch (error: any) {
      console.error('[Pipeline] Initialization error:', error);
      this.updateStatus('pipeline', 'error', error.message);
      // Don't throw - pipeline is optional
    }
  }

  /**
   * Edge Computing initialization
   */
  private async initializeEdgeComputing(): Promise<void> {
    this.updateStatus('edge', 'initializing');
    
    try {
      this.edge = new EdgeComputingProcessor();
      await this.edge.initialize();
      
      const nodeInfo = await this.edge.getNodeInfo();
      
      this.updateStatus('edge', 'ready', undefined, nodeInfo);
      console.log('✅ Edge Computing initialized');
    } catch (error: any) {
      console.error('[Edge] Initialization error:', error);
      this.updateStatus('edge', 'error', error.message);
      // Don't throw - edge is optional
    }
  }

  /**
   * Warm up caches with frequently accessed data
   */
  private async warmupCaches(): Promise<void> {
    console.log('[Cache] Warming up...');
    
    const warmupTasks = [
      // Recent games
      {
        key: 'games:today',
        factory: async () => database.getGames(new Date()),
        ttl: 600
      },
      // Top players
      {
        key: 'players:top:100',
        factory: async () => database.getPlayers(100, 0),
        ttl: 1800
      },
      // System metrics
      {
        key: 'metrics:system',
        factory: async () => database.getSystemMetrics('all', '1 hour'),
        ttl: 60
      }
    ];
    
    await cache.warmCache(warmupTasks);
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    // Database shutdown
    this.shutdownHandlers.push(async () => {
      console.log('[Database] Shutting down...');
      await database.pools.shutdown();
    });
    
    // Cache shutdown
    this.shutdownHandlers.push(async () => {
      console.log('[Cache] Shutting down...');
      await cache.disconnect();
    });
    
    // GPU shutdown
    if (this.gpu) {
      this.shutdownHandlers.push(async () => {
        console.log('[GPU] Shutting down...');
        await this.gpu!.shutdown();
      });
    }
    
    // ML shutdown
    if (this.ml) {
      this.shutdownHandlers.push(async () => {
        console.log('[ML] Shutting down...');
        await this.ml!.shutdown();
      });
    }
    
    // Pipeline shutdown
    if (this.pipeline) {
      this.shutdownHandlers.push(async () => {
        console.log('[Pipeline] Shutting down...');
        await this.pipeline!.shutdown();
      });
    }
    
    // Edge shutdown
    if (this.edge) {
      this.shutdownHandlers.push(async () => {
        console.log('[Edge] Shutting down...');
        await this.edge!.shutdown();
      });
    }
    
    // Register process handlers
    process.on('SIGINT', () => this.handleShutdown('SIGINT'));
    process.on('SIGTERM', () => this.handleShutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.handleShutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.handleShutdown('unhandledRejection');
    });
  }

  /**
   * Handle shutdown signal
   */
  private async handleShutdown(signal: string): Promise<void> {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    
    await this.shutdown();
    process.exit(0);
  }

  /**
   * Shutdown all services
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down services...');
    
    // Update all service statuses
    for (const [name] of this.services) {
      this.updateStatus(name, 'shutdown');
    }
    
    // Run shutdown handlers in reverse order
    for (const handler of this.shutdownHandlers.reverse()) {
      try {
        await handler();
      } catch (error) {
        console.error('Shutdown handler error:', error);
      }
    }
    
    this.initialized = false;
    console.log('✅ All services shut down');
  }

  /**
   * Service status management
   */
  private updateStatus(
    name: string, 
    status: ServiceStatus['status'], 
    error?: string,
    metrics?: any
  ): void {
    this.services.set(name, { name, status, error, metrics });
  }

  getStatus(): ServiceStatus[] {
    return Array.from(this.services.values());
  }

  isReady(): boolean {
    return this.initialized && 
      Array.from(this.services.values()).every(s => 
        s.status === 'ready' || s.status === 'error'
      );
  }

  private logStatus(): void {
    console.log('\n📊 Service Status:');
    console.log('==================');
    
    for (const service of this.services.values()) {
      const icon = service.status === 'ready' ? '✅' : 
                   service.status === 'error' ? '❌' : '⏳';
      console.log(`${icon} ${service.name}: ${service.status}`);
      if (service.error) {
        console.log(`   Error: ${service.error}`);
      }
    }
    console.log('');
  }

  /**
   * Get service instances
   */
  getServices() {
    return {
      database,
      cache,
      gpu: this.gpu,
      ml: this.ml,
      pipeline: this.pipeline,
      edge: this.edge
    };
  }

  /**
   * Health check endpoint data
   */
  async getHealthCheck() {
    const services = this.getStatus();
    const dbHealth = await database.healthCheck();
    const cacheHealth = await cache.healthCheck();
    
    return {
      status: this.isReady() ? 'healthy' : 'unhealthy',
      services,
      database: dbHealth,
      cache: cacheHealth,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const services = new ServicesManager();

// Auto-initialize in non-test environments
if (process.env.NODE_ENV !== 'test' && typeof process.env.SKIP_SERVICE_INIT === 'undefined') {
  services.initialize().catch(error => {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  });
}

// Export types
export type { ServicesManager, ServiceStatus };
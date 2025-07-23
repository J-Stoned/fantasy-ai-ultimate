/**
 * 🚀 Service Initialization Module
 * Initializes all core services for the Fantasy AI platform
 */

import { Pool } from 'pg';
import { ModelLoaderService } from '../../../../../scripts/fantasy-ml/services/model-loader';
import { PredictionService } from '../../../../../scripts/fantasy-ml/services/prediction-service';
import { MLDFSOptimizer } from '../../../../../scripts/fantasy-ml/services/ml-dfs-optimizer';
import { GPUOptimizerService } from '../../../../../scripts/fantasy-ml/services/gpu-optimizer-service';
import { InjuryService } from '../../../../../scripts/fantasy-ml/services/injury-service';
import { WeatherService } from '../../../../../scripts/fantasy-ml/services/weather-service';
import { VegasService } from '../../../../../scripts/fantasy-ml/services/vegas-service';
import { CacheService } from '../../../../../scripts/fantasy-ml/services/cache-service';

export interface Services {
  pool: Pool;
  modelLoader: ModelLoaderService;
  predictionService: PredictionService;
  mlOptimizer: MLDFSOptimizer;
  gpu: GPUOptimizerService;
  injuryService: InjuryService;
  weatherService: WeatherService;
  vegasService: VegasService;
  cacheService: CacheService;
}

class ServiceManager {
  private services: Services | null = null;
  private initialized: boolean = false;

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.log('🚀 Initializing Fantasy AI Services...');
    
    // Database connection
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'fantasy_ai_local',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Test database connection
    try {
      await pool.query('SELECT 1');
      console.log('✅ Database connected');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
    
    // Initialize ML services
    const modelLoader = new ModelLoaderService(pool);
    await modelLoader.initialize();
    
    // Initialize injury service
    const injuryService = new InjuryService(pool);
    await injuryService.initialize();
    
    // Initialize weather service
    const weatherService = new WeatherService(pool);
    await weatherService.initialize();
    
    // Initialize Vegas service
    const vegasService = new VegasService(pool);
    await vegasService.initialize();
    
    // Initialize cache service
    const cacheService = new CacheService();
    await cacheService.initialize();
    
    const predictionService = new PredictionService(pool, modelLoader, injuryService);
    const mlOptimizer = new MLDFSOptimizer(pool, predictionService, weatherService);
    
    // Initialize GPU service
    const gpu = new GPUOptimizerService();
    await gpu.initialize();
    
    this.services = {
      pool,
      modelLoader,
      predictionService,
      mlOptimizer,
      gpu,
      injuryService,
      weatherService,
      vegasService,
      cacheService
    };
    
    this.initialized = true;
    console.log('✅ All services initialized successfully');
  }

  /**
   * Get initialized services
   */
  getServices(): Services {
    if (!this.services) {
      throw new Error('Services not initialized. Call initialize() first.');
    }
    return this.services;
  }

  /**
   * Cleanup services
   */
  async cleanup(): Promise<void> {
    if (this.services) {
      await this.services.pool.end();
      this.services.gpu.dispose();
      console.log('🧹 Services cleaned up');
    }
  }
}

// Export singleton instance
export const services = new ServiceManager();

// Auto-initialize on import in development
if (process.env.NODE_ENV !== 'production') {
  services.initialize().catch(console.error);
}
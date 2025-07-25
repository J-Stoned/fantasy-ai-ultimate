/**
 * 🚀 Service Initialization Module
 * Initializes all core services for the Fantasy AI platform
 */

import { Pool } from 'pg';
import { logger } from '../logging/logger';

// Dynamic imports to prevent client-side bundling
let ModelLoaderService: any;
let PredictionService: any;
let MLDFSOptimizer: any;
let GPUOptimizerService: any;
let InjuryService: any;
let WeatherService: any;
let VegasService: any;
let CacheService: any;

// Only import on server side
if (typeof window === 'undefined') {
  try {
    ModelLoaderService = require('../../../../../scripts/fantasy-ml/services/model-loader').ModelLoaderService;
    PredictionService = require('../../../../../scripts/fantasy-ml/services/prediction-service').PredictionService;
    MLDFSOptimizer = require('../../../../../scripts/fantasy-ml/services/ml-dfs-optimizer').MLDFSOptimizer;
    GPUOptimizerService = require('../../../../../scripts/fantasy-ml/services/gpu-optimizer-service').GPUOptimizerService;
    InjuryService = require('../../../../../scripts/fantasy-ml/services/injury-service').InjuryService;
    WeatherService = require('../../../../../scripts/fantasy-ml/services/weather-service').WeatherService;
    VegasService = require('../../../../../scripts/fantasy-ml/services/vegas-service').VegasService;
    CacheService = require('../../../../../scripts/fantasy-ml/services/cache-service').CacheService;
  } catch (error) {
    logger.warn('Failed to load ML services, using mocks:'error.message);
    // Use mock GPU service if real one fails
    GPUOptimizerService = require('./gpu-mock').GPUOptimizerService;
  }
} else {
  // Use mock GPU service on client side
  GPUOptimizerService = require('./gpu-mock').GPUOptimizerService;
}

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
    
    // Skip initialization on client side
    if (typeof window !== 'undefined') {
      logger.info('⚠️ Skipping service initialization on client side');
      return;
    }
    
    logger.info('🚀 Initializing Fantasy AI Services...');
    
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
      logger.info('✅ Database connected');
    } catch (error) {
      logger.error('❌ Database connection failed:', { error: error });
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
    logger.info('✅ All services initialized successfully');
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
   * Get health check status
   */
  async getHealthCheck(): Promise<any> {
    const health = {
      services: [],
      database: false,
      cache: true
    };

    if (!this.services) {
      return health;
    }

    try {
      // Check database
      await this.services.pool.query('SELECT 1');
      health.database = true;
      health.services.push({ name: 'database', status: 'ok' });
    } catch (error) {
      health.services.push({ name: 'database', status: 'error', error: error.message });
    }

    // Check other services
    if (this.services.modelLoader) {
      health.services.push({ name: 'modelLoader', status: 'ok' });
    }
    if (this.services.predictionService) {
      health.services.push({ name: 'predictionService', status: 'ok' });
    }
    if (this.services.gpu) {
      health.services.push({ name: 'gpu', status: 'ok' });
    }

    return health;
  }

  /**
   * Cleanup services
   */
  async cleanup(): Promise<void> {
    if (this.services) {
      await this.services.pool.end();
      if (this.services.gpu && this.services.gpu.dispose) {
        this.services.gpu.dispose();
      }
      logger.info('🧹 Services cleaned up');
    }
  }
}

// Export singleton instance
export const services = new ServiceManager();

// Auto-initialize on import in development
if (process.env.NODE_ENV !== 'production') {
  services.initialize().catch(console.error);
}
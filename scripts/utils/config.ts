/**
 * Configuration Management Utility
 * 
 * Centralizes all configuration values and eliminates hardcoded values.
 * Supports environment variables, defaults, and runtime validation.
 */

import { logger } from './logger';

// Configuration schema with types and defaults
interface Config {
  // Database
  database: {
    url: string;
    serviceRoleKey: string;
    anonKey: string;
    poolSize: number;
    connectionTimeout: number;
  };

  // API URLs
  apis: {
    espn: {
      baseUrl: string;
      sports: {
        [key: string]: string;
      };
    };
    mlb: {
      baseUrl: string;
      version: string;
    };
    sixFortyThree: {
      baseUrl: string;
      apiKey: string;
    };
  };

  // Server Configuration
  server: {
    ports: {
      gateway: number;
      patternV4: number;
      unifiedPattern: number;
      websocket: number;
      prediction: number;
    };
    corsOrigins: string[];
  };

  // Performance
  performance: {
    httpConcurrency: number;
    workerThreads: number;
    batchSize: number;
    cacheSize: number;
    cacheTTL: number;
  };

  // ML Configuration
  ml: {
    modelsPath: string;
    gpuEnabled: boolean;
    batchSize: number;
    confidenceThreshold: number;
  };

  // Pattern Detection
  patterns: {
    thresholds: {
      confidence: number;
      roi: number;
      winRate: number;
    };
    multipliers: {
      backToBackFade: number;
      revengeGame: number;
      altitudeAdvantage: number;
      primetimeUnder: number;
      divisionDogBite: number;
    };
  };

  // Rate Limiting
  rateLimiting: {
    requests: number;
    window: number;
    skipTokens: string[];
  };

  // Logging
  logging: {
    level: string;
    format: 'json' | 'pretty';
    output: 'console' | 'file' | 'both';
    filePath: string;
  };

  // Feature Flags
  features: {
    enableGPU: boolean;
    enableWebSocket: boolean;
    enableCaching: boolean;
    enableAuthentication: boolean;
    enableRateLimiting: boolean;
  };

  // Environment
  environment: 'development' | 'staging' | 'production';
  debug: boolean;
}

class ConfigManager {
  private config: Config;
  private static instance: ConfigManager;

  private constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfiguration(): Config {
    const env = process.env;
    
    return {
      database: {
        url: env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || '',
        serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
        anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        poolSize: parseInt(env.DB_POOL_SIZE || '10'),
        connectionTimeout: parseInt(env.DB_CONNECTION_TIMEOUT || '30000'),
      },

      apis: {
        espn: {
          baseUrl: env.ESPN_API_URL || 'https://site.api.espn.com/apis/site/v2/sports',
          sports: {
            nfl: 'football/nfl',
            nba: 'basketball/nba',
            mlb: 'baseball/mlb',
            nhl: 'hockey/nhl',
            ncaaf: 'football/college-football',
            ncaab: 'basketball/mens-college-basketball',
          },
        },
        mlb: {
          baseUrl: env.MLB_API_URL || 'https://statsapi.mlb.com/api',
          version: env.MLB_API_VERSION || 'v1',
        },
        sixFortyThree: {
          baseUrl: env.SIX43_API_URL || 'https://api.643charts.com',
          apiKey: env.SIX43_API_KEY || '',
        },
      },

      server: {
        ports: {
          gateway: parseInt(env.PORT || '3000'),
          patternV4: parseInt(env.PATTERN_V4_PORT || '3337'),
          unifiedPattern: parseInt(env.UNIFIED_PATTERN_PORT || '3336'),
          websocket: parseInt(env.WEBSOCKET_PORT || '3338'),
          prediction: parseInt(env.PREDICTION_PORT || '3339'),
        },
        corsOrigins: (env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:19000').split(','),
      },

      performance: {
        httpConcurrency: parseInt(env.HTTP_CONCURRENCY || '48'),
        workerThreads: parseInt(env.WORKER_THREADS || '12'),
        batchSize: parseInt(env.BATCH_SIZE || '1000'),
        cacheSize: parseInt(env.CACHE_SIZE || '10000'),
        cacheTTL: parseInt(env.CACHE_TTL || '3600'),
      },

      ml: {
        modelsPath: env.MODELS_PATH || './models',
        gpuEnabled: env.GPU_ENABLED === 'true',
        batchSize: parseInt(env.ML_BATCH_SIZE || '32'),
        confidenceThreshold: parseFloat(env.ML_CONFIDENCE_THRESHOLD || '0.7'),
      },

      patterns: {
        thresholds: {
          confidence: parseFloat(env.PATTERN_CONFIDENCE_THRESHOLD || '0.7'),
          roi: parseFloat(env.PATTERN_ROI_THRESHOLD || '0.3'),
          winRate: parseFloat(env.PATTERN_WINRATE_THRESHOLD || '0.6'),
        },
        multipliers: {
          backToBackFade: parseFloat(env.MULTIPLIER_B2B || '0.95'),
          revengeGame: parseFloat(env.MULTIPLIER_REVENGE || '0.9'),
          altitudeAdvantage: parseFloat(env.MULTIPLIER_ALTITUDE || '0.85'),
          primetimeUnder: parseFloat(env.MULTIPLIER_PRIMETIME || '0.8'),
          divisionDogBite: parseFloat(env.MULTIPLIER_DIVISION || '0.75'),
        },
      },

      rateLimiting: {
        requests: parseInt(env.RATE_LIMIT_REQUESTS || '100'),
        window: parseInt(env.RATE_LIMIT_WINDOW || '3600000'),
        skipTokens: (env.RATE_LIMIT_SKIP_TOKENS || '').split(',').filter(Boolean),
      },

      logging: {
        level: env.LOG_LEVEL || 'INFO',
        format: (env.LOG_FORMAT as 'json' | 'pretty') || 'json',
        output: (env.LOG_OUTPUT as 'console' | 'file' | 'both') || 'console',
        filePath: env.LOG_FILE_PATH || './logs/app.log',
      },

      features: {
        enableGPU: env.ENABLE_GPU !== 'false',
        enableWebSocket: env.ENABLE_WEBSOCKET !== 'false',
        enableCaching: env.ENABLE_CACHING !== 'false',
        enableAuthentication: env.ENABLE_AUTH !== 'false',
        enableRateLimiting: env.ENABLE_RATE_LIMITING !== 'false',
      },

      environment: (env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
      debug: env.DEBUG === 'true',
    };
  }

  private validateConfiguration(): void {
    const errors: string[] = [];

    // Required database config
    if (!this.config.database.url) {
      errors.push('Database URL is required');
    }

    // Required keys for production
    if (this.config.environment === 'production') {
      if (!this.config.database.serviceRoleKey) {
        errors.push('Service role key is required in production');
      }
      if (this.config.features.enableAuthentication && !this.config.database.anonKey) {
        errors.push('Anon key is required when authentication is enabled');
      }
    }

    // Validate ports
    const ports = Object.values(this.config.server.ports);
    if (new Set(ports).size !== ports.length) {
      errors.push('Server ports must be unique');
    }

    // Validate numeric ranges
    if (this.config.performance.httpConcurrency < 1 || this.config.performance.httpConcurrency > 1000) {
      errors.push('HTTP concurrency must be between 1 and 1000');
    }

    if (errors.length > 0) {
      logger.error('Configuration validation failed', undefined, { errors });
      if (this.config.environment === 'production') {
        throw new Error(`Configuration errors: ${errors.join(', ')}`);
      }
    }
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  getDeep<T>(path: string): T {
    const keys = path.split('.');
    let value: any = this.config;
    
    for (const key of keys) {
      value = value[key];
      if (value === undefined) {
        throw new Error(`Configuration key not found: ${path}`);
      }
    }
    
    return value as T;
  }

  isProduction(): boolean {
    return this.config.environment === 'production';
  }

  isDevelopment(): boolean {
    return this.config.environment === 'development';
  }

  isFeatureEnabled(feature: keyof Config['features']): boolean {
    return this.config.features[feature];
  }

  // Update configuration at runtime (for testing)
  update<K extends keyof Config>(key: K, value: Config[K]): void {
    if (this.isProduction()) {
      logger.warn('Attempting to update configuration in production', { key });
    }
    this.config[key] = value;
  }

  // Get all configuration (for debugging)
  getAll(): Config {
    // Mask sensitive values
    const masked = JSON.parse(JSON.stringify(this.config));
    masked.database.serviceRoleKey = '***MASKED***';
    masked.database.anonKey = '***MASKED***';
    masked.apis.sixFortyThree.apiKey = '***MASKED***';
    return masked;
  }
}

// Export singleton instance
export const config = ConfigManager.getInstance();

// Export types
export type { Config };
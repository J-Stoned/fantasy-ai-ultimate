/**
 * Dependency Injection setup and configuration
 */

import { container } from './container';
import { SERVICE_TOKENS } from './interfaces';

// Import services
import { LoggerService, ProductionLoggerService } from './services/logger.service';
import { DatabaseService } from './services/database.service';
import { CacheService, InMemoryCacheService } from './services/cache.service';

// Import other services as they're created
// import { AuthService } from './services/auth.service';
// import { PredictionService } from './services/prediction.service';
// import { WebSocketService } from './services/websocket.service';
// import { FantasyService } from './services/fantasy.service';

/**
 * Configure dependency injection container
 */
export function setupDI() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';

  // Register Logger
  container.register(
    SERVICE_TOKENS.Logger,
    () => isDevelopment ? new LoggerService() : new ProductionLoggerService(),
    { singleton: true }
  );

  // Register Database
  container.register(
    SERVICE_TOKENS.Database,
    () => {
      const logger = container.resolve(SERVICE_TOKENS.Logger);
      return new DatabaseService(logger);
    },
    { singleton: true }
  );

  // Register Cache
  container.register(
    SERVICE_TOKENS.Cache,
    () => {
      const logger = container.resolve(SERVICE_TOKENS.Logger);
      // Use in-memory cache for development/test
      return isTest || isDevelopment 
        ? new InMemoryCacheService(logger)
        : new CacheService(logger);
    },
    { singleton: true }
  );

  // Register Feature Flags
  container.register(
    SERVICE_TOKENS.FeatureFlags,
    () => ({
      isEnabled: (feature: string) => {
        const flags = {
          newUI: true,
          mlPredictions: true,
          advancedStats: true,
          realtimeUpdates: true,
        };
        return flags[feature as keyof typeof flags] || false;
      },
      getAllFlags: () => ({
        newUI: true,
        mlPredictions: true,
        advancedStats: true,
        realtimeUpdates: true,
      }),
      setFlag: (feature: string, enabled: boolean) => {
        // In production, this would update a remote config
        },
    }),
    { singleton: true }
  );

  // Register Config
  container.register(
    SERVICE_TOKENS.Config,
    () => {
      const config: Record<string, any> = {
        apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
        wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
        environment: process.env.NODE_ENV || 'development',
      };

      return {
        get: <T>(key: string, defaultValue?: T): T => {
          return config[key] ?? defaultValue;
        },
        set: (key: string, value: any) => {
          config[key] = value;
        },
        has: (key: string) => {
          return key in config;
        },
        getAll: () => ({ ...config }),
      };
    },
    { singleton: true }
  );

  // TODO: Register remaining services as they're implemented
  /*
  container.register(
    SERVICE_TOKENS.AuthService,
    () => new AuthService(
      container.resolve(SERVICE_TOKENS.Database),
      container.resolve(SERVICE_TOKENS.Cache),
      container.resolve(SERVICE_TOKENS.Logger)
    ),
    { singleton: true }
  );

  container.register(
    SERVICE_TOKENS.PredictionService,
    () => new PredictionService(
      container.resolve(SERVICE_TOKENS.Database),
      container.resolve(SERVICE_TOKENS.Cache),
      container.resolve(SERVICE_TOKENS.Logger)
    ),
    { singleton: true }
  );

  container.register(
    SERVICE_TOKENS.WebSocketService,
    () => new WebSocketService(
      container.resolve(SERVICE_TOKENS.Config),
      container.resolve(SERVICE_TOKENS.Logger)
    ),
    { singleton: true }
  );

  container.register(
    SERVICE_TOKENS.FantasyService,
    () => new FantasyService(
      container.resolve(SERVICE_TOKENS.Database),
      container.resolve(SERVICE_TOKENS.Cache),
      container.resolve(SERVICE_TOKENS.PredictionService),
      container.resolve(SERVICE_TOKENS.Logger)
    ),
    { singleton: true }
  );
  */
}

/**
 * Initialize DI container on app startup
 */
export function initializeDI() {
  if (typeof window === 'undefined') {
    // Server-side initialization
    setupDI();
  } else {
    // Client-side initialization
    // Only setup client-safe services
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    container.register(
      SERVICE_TOKENS.Logger,
      () => isDevelopment ? new LoggerService() : new ProductionLoggerService(),
      { singleton: true }
    );

    container.register(
      SERVICE_TOKENS.Config,
      () => ({
        get: <T>(key: string, defaultValue?: T): T => {
          const config: Record<string, any> = {
            apiUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
            wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
          };
          return config[key] ?? defaultValue;
        },
        set: () => {},
        has: (key: string) => {
          const config = ['apiUrl', 'wsUrl'];
          return config.includes(key);
        },
        getAll: () => ({
          apiUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
          wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
        }),
      }),
      { singleton: true }
    );
  }
}

// Auto-initialize on import
initializeDI();
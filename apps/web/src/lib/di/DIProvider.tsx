/**
 * React Context Provider for Dependency Injection
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { DIContainer, container } from './container';
import { SERVICE_TOKENS } from './interfaces';
import type { 
  ILogger, 
  ICache, 
  IDatabase, 
  IAuthService,
  IPredictionService,
  IWebSocketService,
  IFantasyService,
  IConfig,
  IFeatureFlags
} from './interfaces';

interface DIContextValue {
  container: DIContainer;
  logger: ILogger;
  config: IConfig;
  featureFlags: IFeatureFlags;
  // Add other commonly used services
  cache?: ICache;
  database?: IDatabase;
  auth?: IAuthService;
  prediction?: IPredictionService;
  websocket?: IWebSocketService;
  fantasy?: IFantasyService;
}

const DIContext = createContext<DIContextValue | null>(null);

interface DIProviderProps {
  children: React.ReactNode;
  overrides?: Partial<Record<symbol, any>>;
}

/**
 * Dependency Injection Provider Component
 */
export function DIProvider({ children, overrides }: DIProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [services, setServices] = useState<Partial<DIContextValue>>({});

  useEffect(() => {
    // Initialize services
    const initializeServices = async () => {
      try {
        // Get core services that are always available
        const logger = container.resolve<ILogger>(SERVICE_TOKENS.Logger);
        const config = container.resolve<IConfig>(SERVICE_TOKENS.Config);
        const featureFlags = container.resolve<IFeatureFlags>(SERVICE_TOKENS.FeatureFlags);

        const baseServices: DIContextValue = {
          container,
          logger,
          config,
          featureFlags,
        };

        // Try to resolve optional services (server-side only)
        if (typeof window === 'undefined') {
          try {
            baseServices.cache = container.resolve<ICache>(SERVICE_TOKENS.Cache);
            baseServices.database = container.resolve<IDatabase>(SERVICE_TOKENS.Database);
          } catch (error) {
            logger.warn('Some services not available on client side');
          }
        }

        // Apply any overrides (useful for testing)
        if (overrides) {
          Object.entries(overrides).forEach(([token, service]) => {
            container.registerValue(token, service);
          });
        }

        setServices(baseServices);
        setIsInitialized(true);
      } catch (error) {
        }
    };

    initializeServices();
  }, [overrides]);

  if (!isInitialized) {
    return null; // Or a loading spinner
  }

  return (
    <DIContext.Provider value={services as DIContextValue}>
      {children}
    </DIContext.Provider>
  );
}

/**
 * Hook to use dependency injection context
 */
export function useDI() {
  const context = useContext(DIContext);
  if (!context) {
    throw new Error('useDI must be used within a DIProvider');
  }
  return context;
}

/**
 * Hook to resolve a specific service
 */
export function useService<T>(token: symbol): T {
  const { container } = useDI();
  return container.resolve<T>(token);
}

/**
 * Hook to use logger service
 */
export function useLogger() {
  const { logger } = useDI();
  return logger;
}

/**
 * Hook to use config service
 */
export function useConfig() {
  const { config } = useDI();
  return config;
}

/**
 * Hook to use feature flags
 */
export function useFeatureFlags() {
  const { featureFlags } = useDI();
  return featureFlags;
}

/**
 * HOC to inject services into class components
 */
export function withDI<P extends object>(
  Component: React.ComponentType<P & DIContextValue>
) {
  return function WithDIComponent(props: P) {
    const diContext = useDI();
    return <Component {...props} {...diContext} />;
  };
}

/**
 * Decorator to inject services into class components
 */
export function InjectServices(tokens: { [key: string]: symbol }) {
  return function <T extends { new(...args: any[]): {} }>(constructor: T) {
    return class extends constructor {
      static contextType = DIContext;
      
      constructor(...args: any[]) {
        super(...args);
        
        // Inject services after component is constructed
        setTimeout(() => {
          const context = (this as any).context as DIContextValue;
          if (context) {
            Object.entries(tokens).forEach(([propName, token]) => {
              try {
                (this as any)[propName] = context.container.resolve(token);
              } catch (error) {
                }
            });
          }
        }, 0);
      }
    };
  };
}
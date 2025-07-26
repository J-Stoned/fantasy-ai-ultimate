/**
 * Dependency Injection Container
 * Implements IoC pattern for better testability and maintainability
 */

import 'reflect-metadata';

type Constructor<T = {}> = new (...args: any[]) => T;
type Factory<T> = () => T | Promise<T>;

interface ServiceDescriptor {
  token: any;
  factory: Factory<any>;
  singleton: boolean;
  instance?: any;
}

export class DIContainer {
  private services = new Map<any, ServiceDescriptor>();
  private static instance: DIContainer;

  private constructor() {}

  /**
   * Get singleton instance of container
   */
  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  /**
   * Register a service with the container
   */
  register<T>(
    token: Constructor<T> | string | symbol,
    factory: Factory<T>,
    options: { singleton?: boolean } = {}
  ): void {
    this.services.set(token, {
      token,
      factory,
      singleton: options.singleton ?? true,
    });
  }

  /**
   * Register a class as a service
   */
  registerClass<T>(
    token: Constructor<T>,
    ClassConstructor: Constructor<T>,
    options: { singleton?: boolean } = {}
  ): void {
    this.register(
      token,
      () => {
        const paramTypes = Reflect.getMetadata('design:paramtypes', ClassConstructor) || [];
        const params = paramTypes.map((type: any) => this.resolve(type));
        return new ClassConstructor(...params);
      },
      options
    );
  }

  /**
   * Register a value as a service
   */
  registerValue<T>(token: any, value: T): void {
    this.services.set(token, {
      token,
      factory: () => value,
      singleton: true,
      instance: value,
    });
  }

  /**
   * Resolve a service from the container
   */
  resolve<T>(token: Constructor<T> | string | symbol): T {
    const descriptor = this.services.get(token);
    
    if (!descriptor) {
      throw new Error(`Service not found: ${String(token)}`);
    }

    if (descriptor.singleton) {
      if (!descriptor.instance) {
        descriptor.instance = descriptor.factory();
      }
      return descriptor.instance;
    }

    return descriptor.factory();
  }

  /**
   * Resolve a service asynchronously
   */
  async resolveAsync<T>(token: Constructor<T> | string | symbol): Promise<T> {
    const descriptor = this.services.get(token);
    
    if (!descriptor) {
      throw new Error(`Service not found: ${String(token)}`);
    }

    if (descriptor.singleton) {
      if (!descriptor.instance) {
        descriptor.instance = await descriptor.factory();
      }
      return descriptor.instance;
    }

    return await descriptor.factory();
  }

  /**
   * Check if a service is registered
   */
  has(token: any): boolean {
    return this.services.has(token);
  }

  /**
   * Clear all registered services
   */
  clear(): void {
    this.services.clear();
  }

  /**
   * Create a child container
   */
  createChild(): DIContainer {
    const child = new (DIContainer as any)();
    // Copy parent services
    this.services.forEach((descriptor, token) => {
      child.services.set(token, { ...descriptor });
    });
    return child;
  }
}

// Decorators for dependency injection

/**
 * Mark a class as injectable
 */
export function Injectable(options: { singleton?: boolean } = {}) {
  return function <T extends Constructor>(target: T) {
    // Register with container when decorated
    const container = DIContainer.getInstance();
    container.registerClass(target, target, options);
    return target;
  };
}

/**
 * Inject a dependency into a constructor parameter
 */
export function Inject(token: any) {
  return function (target: any, propertyKey: string | symbol, parameterIndex: number) {
    const existingTokens = Reflect.getMetadata('custom:inject_tokens', target) || [];
    existingTokens[parameterIndex] = token;
    Reflect.defineMetadata('custom:inject_tokens', existingTokens, target);
  };
}

/**
 * Service locator pattern (use sparingly)
 */
export const container = DIContainer.getInstance();
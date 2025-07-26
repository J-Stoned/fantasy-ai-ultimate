/**
 * Tests for Dependency Injection Container
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DIContainer, Injectable, Inject } from '../container';

describe('DIContainer', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
  });

  describe('register and resolve', () => {
    it('should register and resolve a simple factory', () => {
      const factory = () => ({ name: 'test' });
      container.register('test', factory);

      const instance = container.resolve('test');
      expect(instance).toEqual({ name: 'test' });
    });

    it('should register and resolve with constructor token', () => {
      class TestService {
        name = 'test';
      }

      container.register(TestService, () => new TestService());
      const instance = container.resolve(TestService);

      expect(instance).toBeInstanceOf(TestService);
      expect(instance.name).toBe('test');
    });

    it('should register and resolve with symbol token', () => {
      const TOKEN = Symbol('test');
      const factory = () => ({ value: 42 });

      container.register(TOKEN, factory);
      const instance = container.resolve(TOKEN);

      expect(instance).toEqual({ value: 42 });
    });

    it('should handle singleton option', () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { id: callCount };
      };

      container.register('singleton', factory, { singleton: true });

      const instance1 = container.resolve('singleton');
      const instance2 = container.resolve('singleton');

      expect(instance1).toBe(instance2);
      expect(callCount).toBe(1);
    });

    it('should create new instances without singleton option', () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { id: callCount };
      };

      container.register('transient', factory);

      const instance1 = container.resolve('transient');
      const instance2 = container.resolve('transient');

      expect(instance1).not.toBe(instance2);
      expect(callCount).toBe(2);
    });

    it('should throw error for unregistered token', () => {
      expect(() => container.resolve('unknown')).toThrow(
        'No registration found for token: unknown'
      );
    });
  });

  describe('registerValue', () => {
    it('should register a value directly', () => {
      const value = { name: 'test', value: 42 };
      container.registerValue('value', value);

      const resolved = container.resolve('value');
      expect(resolved).toBe(value);
    });

    it('should always return the same instance for values', () => {
      const value = { count: 0 };
      container.registerValue('counter', value);

      const instance1 = container.resolve('counter');
      const instance2 = container.resolve('counter');

      expect(instance1).toBe(instance2);
    });
  });

  describe('has', () => {
    it('should return true for registered tokens', () => {
      container.register('exists', () => ({}));
      expect(container.has('exists')).toBe(true);
    });

    it('should return false for unregistered tokens', () => {
      expect(container.has('notExists')).toBe(false);
    });

    it('should work with different token types', () => {
      const symbolToken = Symbol('test');
      class TestClass {}

      container.register(symbolToken, () => ({}));
      container.register(TestClass, () => new TestClass());

      expect(container.has(symbolToken)).toBe(true);
      expect(container.has(TestClass)).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear all registrations', () => {
      container.register('test1', () => ({ id: 1 }));
      container.register('test2', () => ({ id: 2 }));

      expect(container.has('test1')).toBe(true);
      expect(container.has('test2')).toBe(true);

      container.clear();

      expect(container.has('test1')).toBe(false);
      expect(container.has('test2')).toBe(false);
    });
  });

  describe('createChildContainer', () => {
    it('should create a child container with access to parent registrations', () => {
      container.register('parent', () => ({ source: 'parent' }));
      
      const child = container.createChildContainer();
      const instance = child.resolve('parent');

      expect(instance).toEqual({ source: 'parent' });
    });

    it('should allow child to override parent registrations', () => {
      container.register('service', () => ({ source: 'parent' }));
      
      const child = container.createChildContainer();
      child.register('service', () => ({ source: 'child' }));

      const parentInstance = container.resolve('service');
      const childInstance = child.resolve('service');

      expect(parentInstance).toEqual({ source: 'parent' });
      expect(childInstance).toEqual({ source: 'child' });
    });

    it('should not affect parent when child adds registrations', () => {
      const child = container.createChildContainer();
      child.register('childOnly', () => ({ id: 'child' }));

      expect(child.has('childOnly')).toBe(true);
      expect(container.has('childOnly')).toBe(false);
    });
  });

  describe('decorators', () => {
    it('should work with @Injectable decorator', () => {
      @Injectable()
      class TestService {
        getValue() {
          return 'test';
        }
      }

      const instance = container.resolve(TestService);
      expect(instance).toBeInstanceOf(TestService);
      expect(instance.getValue()).toBe('test');
    });

    it('should handle singleton option in @Injectable', () => {
      @Injectable({ singleton: true })
      class SingletonService {
        id = Math.random();
      }

      const instance1 = container.resolve(SingletonService);
      const instance2 = container.resolve(SingletonService);

      expect(instance1).toBe(instance2);
      expect(instance1.id).toBe(instance2.id);
    });

    it('should work with @Inject decorator', () => {
      const TOKEN = Symbol('dependency');

      class Dependency {
        name = 'dependency';
      }

      @Injectable()
      class ServiceWithDependency {
        constructor(
          @Inject(TOKEN) public dependency: Dependency
        ) {}
      }

      container.register(TOKEN, () => new Dependency());

      const instance = container.resolve(ServiceWithDependency);
      expect(instance.dependency).toBeInstanceOf(Dependency);
      expect(instance.dependency.name).toBe('dependency');
    });

    it('should handle multiple @Inject parameters', () => {
      const TOKEN1 = Symbol('dep1');
      const TOKEN2 = Symbol('dep2');

      @Injectable()
      class MultiDependencyService {
        constructor(
          @Inject(TOKEN1) public dep1: any,
          @Inject(TOKEN2) public dep2: any
        ) {}
      }

      container.register(TOKEN1, () => ({ id: 1 }));
      container.register(TOKEN2, () => ({ id: 2 }));

      const instance = container.resolve(MultiDependencyService);
      expect(instance.dep1).toEqual({ id: 1 });
      expect(instance.dep2).toEqual({ id: 2 });
    });

    it('should handle nested dependencies', () => {
      const LOGGER = Symbol('logger');
      const DATABASE = Symbol('database');

      @Injectable()
      class Logger {
        log(message: string) {
          return `[LOG] ${message}`;
        }
      }

      @Injectable()
      class Database {
        constructor(@Inject(LOGGER) private logger: Logger) {}

        query(sql: string) {
          return this.logger.log(`Executing: ${sql}`);
        }
      }

      @Injectable()
      class UserService {
        constructor(
          @Inject(DATABASE) private db: Database,
          @Inject(LOGGER) private logger: Logger
        ) {}

        getUser(id: string) {
          const result = this.db.query(`SELECT * FROM users WHERE id = '${id}'`);
          this.logger.log(`Got user ${id}`);
          return result;
        }
      }

      container.register(LOGGER, () => container.resolve(Logger), { singleton: true });
      container.register(DATABASE, () => container.resolve(Database), { singleton: true });

      const userService = container.resolve(UserService);
      const result = userService.getUser('123');

      expect(result).toBe('[LOG] Executing: SELECT * FROM users WHERE id = \'123\'');
    });
  });

  describe('error handling', () => {
    it('should provide helpful error for circular dependencies', () => {
      const TOKEN_A = Symbol('a');
      const TOKEN_B = Symbol('b');

      container.register(TOKEN_A, () => container.resolve(TOKEN_B));
      container.register(TOKEN_B, () => container.resolve(TOKEN_A));

      expect(() => container.resolve(TOKEN_A)).toThrow();
    });

    it('should handle factory errors gracefully', () => {
      container.register('failing', () => {
        throw new Error('Factory error');
      });

      expect(() => container.resolve('failing')).toThrow('Factory error');
    });
  });
});
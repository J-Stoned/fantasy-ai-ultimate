/**
 * Tests for DIProvider and related hooks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { DIProvider, useDI, useService, useLogger, useConfig, useFeatureFlags } from '../DIProvider';
import { container } from '../container';
import { SERVICE_TOKENS } from '../interfaces';
import React from 'react';

// Mock the setup module
vi.mock('../setup', () => ({
  setupDI: vi.fn(),
  initializeDI: vi.fn(),
}));

describe('DIProvider', () => {
  beforeEach(() => {
    container.clear();
    
    // Setup basic services for testing
    container.register(SERVICE_TOKENS.Logger, () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }), { singleton: true });

    container.register(SERVICE_TOKENS.Config, () => ({
      get: vi.fn().mockReturnValue('test-value'),
      set: vi.fn(),
      has: vi.fn().mockReturnValue(true),
      getAll: vi.fn().mockReturnValue({}),
    }), { singleton: true });

    container.register(SERVICE_TOKENS.FeatureFlags, () => ({
      isEnabled: vi.fn().mockReturnValue(true),
      getAllFlags: vi.fn().mockReturnValue({}),
      setFlag: vi.fn(),
    }), { singleton: true });
  });

  describe('DIProvider component', () => {
    it('should provide container context to children', async () => {
      const TestComponent = () => {
        const context = useDI();
        return <div>{context ? 'Context available' : 'No context'}</div>;
      };

      const { getByText } = render(
        <DIProvider>
          <TestComponent />
        </DIProvider>
      );

      await waitFor(() => {
        expect(getByText('Context available')).toBeInTheDocument();
      });
    });

    it('should apply overrides when provided', async () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const TestComponent = () => {
        const logger = useLogger();
        React.useEffect(() => {
          logger.info('Test message');
        }, [logger]);
        return null;
      };

      render(
        <DIProvider overrides={{ [SERVICE_TOKENS.Logger]: mockLogger }}>
          <TestComponent />
        </DIProvider>
      );

      await waitFor(() => {
        expect(mockLogger.info).toHaveBeenCalledWith('Test message');
      });
    });

    it('should handle initialization errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Force an error during initialization
      container.clear();
      container.register(SERVICE_TOKENS.Logger, () => {
        throw new Error('Init error');
      });

      const { container: testContainer } = render(
        <DIProvider>
          <div>Test</div>
        </DIProvider>
      );

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to initialize DI services:',
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });
  });

  describe('useDI hook', () => {
    it('should throw error when used outside DIProvider', () => {
      const { result } = renderHook(() => useDI());
      
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('useDI must be used within a DIProvider');
    });

    it('should return context when used inside DIProvider', async () => {
      const { result } = renderHook(() => useDI(), {
        wrapper: DIProvider,
      });

      await waitFor(() => {
        expect(result.current).toBeDefined();
        expect(result.current.container).toBe(container);
        expect(result.current.logger).toBeDefined();
        expect(result.current.config).toBeDefined();
        expect(result.current.featureFlags).toBeDefined();
      });
    });
  });

  describe('useService hook', () => {
    it('should resolve services by token', async () => {
      const TEST_TOKEN = Symbol('test');
      const testService = { getValue: () => 'test-value' };
      
      container.register(TEST_TOKEN, () => testService);

      const { result } = renderHook(() => useService(TEST_TOKEN), {
        wrapper: DIProvider,
      });

      await waitFor(() => {
        expect(result.current).toBe(testService);
        expect(result.current.getValue()).toBe('test-value');
      });
    });

    it('should throw error for unregistered service', async () => {
      const UNKNOWN_TOKEN = Symbol('unknown');

      const { result } = renderHook(() => useService(UNKNOWN_TOKEN), {
        wrapper: DIProvider,
      });

      await waitFor(() => {
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('useLogger hook', () => {
    it('should return logger service', async () => {
      const { result } = renderHook(() => useLogger(), {
        wrapper: DIProvider,
      });

      await waitFor(() => {
        expect(result.current).toBeDefined();
        expect(result.current.debug).toBeDefined();
        expect(result.current.info).toBeDefined();
        expect(result.current.warn).toBeDefined();
        expect(result.current.error).toBeDefined();
      });
    });

    it('should use logger methods correctly', async () => {
      const { result } = renderHook(() => useLogger(), {
        wrapper: DIProvider,
      });

      await waitFor(() => {
        result.current.info('Test log');
        expect(result.current.info).toHaveBeenCalledWith('Test log');
      });
    });
  });

  describe('useConfig hook', () => {
    it('should return config service', async () => {
      const { result } = renderHook(() => useConfig(), {
        wrapper: DIProvider,
      });

      await waitFor(() => {
        expect(result.current).toBeDefined();
        expect(result.current.get).toBeDefined();
        expect(result.current.get('test')).toBe('test-value');
      });
    });
  });

  describe('useFeatureFlags hook', () => {
    it('should return feature flags service', async () => {
      const { result } = renderHook(() => useFeatureFlags(), {
        wrapper: DIProvider,
      });

      await waitFor(() => {
        expect(result.current).toBeDefined();
        expect(result.current.isEnabled).toBeDefined();
        expect(result.current.isEnabled('testFeature')).toBe(true);
      });
    });
  });

  describe('server vs client initialization', () => {
    it('should skip database/cache services on client side', async () => {
      // Mock window object to simulate client side
      const originalWindow = global.window;
      global.window = {} as any;

      const TestComponent = () => {
        const context = useDI();
        return (
          <div>
            {context.database ? 'Has database' : 'No database'}
            {context.cache ? 'Has cache' : 'No cache'}
          </div>
        );
      };

      const { getByText } = render(
        <DIProvider>
          <TestComponent />
        </DIProvider>
      );

      await waitFor(() => {
        expect(getByText(/No database/)).toBeInTheDocument();
        expect(getByText(/No cache/)).toBeInTheDocument();
      });

      // Restore window
      global.window = originalWindow;
    });
  });
});
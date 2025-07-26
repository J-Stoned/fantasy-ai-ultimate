/**
 * Test utilities and custom render functions
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { DIProvider } from '../di/DIProvider';
import { container } from '../di/container';
import { SERVICE_TOKENS } from '../di/interfaces';
import { vi } from 'vitest';

// Mock services for testing
export const createMockLogger = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

export const createMockCache = () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
  has: vi.fn().mockResolvedValue(false),
});

export const createMockDatabase = () => ({
  query: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
  execute: vi.fn().mockResolvedValue(0),
  transaction: vi.fn().mockImplementation(async (cb) => cb({})),
});

export const createMockConfig = (overrides?: Record<string, any>) => ({
  get: vi.fn().mockImplementation((key: string, defaultValue?: any) => {
    const config = {
      apiUrl: 'http://localhost:3000/api',
      wsUrl: 'ws://localhost:3001',
      ...overrides,
    };
    return config[key] ?? defaultValue;
  }),
  set: vi.fn(),
  has: vi.fn().mockReturnValue(true),
  getAll: vi.fn().mockReturnValue({
    apiUrl: 'http://localhost:3000/api',
    wsUrl: 'ws://localhost:3001',
    ...overrides,
  }),
});

export const createMockFeatureFlags = (flags?: Record<string, boolean>) => ({
  isEnabled: vi.fn().mockImplementation((feature: string) => {
    const defaultFlags = {
      newUI: true,
      mlPredictions: true,
      advancedStats: true,
      realtimeUpdates: true,
      ...flags,
    };
    return defaultFlags[feature] ?? false;
  }),
  getAllFlags: vi.fn().mockReturnValue({
    newUI: true,
    mlPredictions: true,
    advancedStats: true,
    realtimeUpdates: true,
    ...flags,
  }),
  setFlag: vi.fn(),
});

// Custom providers for testing
interface TestProvidersProps {
  children: React.ReactNode;
  mockServices?: Partial<Record<symbol, any>>;
}

function TestProviders({ children, mockServices = {} }: TestProvidersProps) {
  // Setup default mocks
  const defaultMocks = {
    [SERVICE_TOKENS.Logger]: createMockLogger(),
    [SERVICE_TOKENS.Config]: createMockConfig(),
    [SERVICE_TOKENS.FeatureFlags]: createMockFeatureFlags(),
    ...mockServices,
  };

  return (
    <DIProvider overrides={defaultMocks}>
      {children}
    </DIProvider>
  );
}

// Custom render function
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  mockServices?: Partial<Record<symbol, any>>;
}

export function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions
) {
  const { mockServices, ...renderOptions } = options || {};

  return render(ui, {
    wrapper: ({ children }) => (
      <TestProviders mockServices={mockServices}>
        {children}
      </TestProviders>
    ),
    ...renderOptions,
  });
}

// Re-export everything from testing library
export * from '@testing-library/react';
export { customRender as render };

// Test data factories
export const createMockPlayer = (overrides?: Partial<any>) => ({
  id: 'player-1',
  name: 'Test Player',
  position: 'QB',
  team: 'TEST',
  sport: 'NFL',
  ...overrides,
});

export const createMockContest = (overrides?: Partial<any>) => ({
  id: 'contest-1',
  name: 'Test Contest',
  entryFee: 10,
  totalPrize: 1000,
  maxEntries: 100,
  currentEntries: 50,
  sport: 'NFL',
  platform: 'DraftKings',
  ...overrides,
});

export const createMockLineup = (overrides?: Partial<any>) => ({
  id: 'lineup-1',
  contestId: 'contest-1',
  players: [
    createMockPlayer({ id: 'player-1' }),
    createMockPlayer({ id: 'player-2' }),
  ],
  totalSalary: 45000,
  projectedPoints: 150.5,
  ...overrides,
});

// Async utilities
export async function waitForLoadingToFinish() {
  const { findByText } = screen;
  await waitFor(() => {
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });
}

// API mocking utilities
export function mockApiResponse(url: string, response: any, status = 200) {
  (global.fetch as any).mockImplementationOnce(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: async () => response,
      text: async () => JSON.stringify(response),
    })
  );
}

export function mockApiError(url: string, error: string, status = 500) {
  (global.fetch as any).mockImplementationOnce(() =>
    Promise.resolve({
      ok: false,
      status,
      json: async () => ({ error }),
      text: async () => error,
    })
  );
}

// WebSocket mocking
export class MockWebSocket {
  url: string;
  readyState: number = 0;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  send(data: string) {
    // Mock implementation
  }

  close(code?: number, reason?: string) {
    this.readyState = 3;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }));
    }
  }

  mockMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }
}

(global as any).WebSocket = MockWebSocket;
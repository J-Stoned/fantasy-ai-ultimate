import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AccessibilityProvider } from '@/components/accessibility/AccessibilityProvider'

interface AllTheProvidersProps {
  children: React.ReactNode
}

// Test wrapper with all necessary providers
const AllTheProviders = ({ children }: AllTheProvidersProps) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <AccessibilityProvider>
        {children}
      </AccessibilityProvider>
    </QueryClientProvider>
  )
}

// Custom render function with providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// Mock data generators
export const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  username: 'testuser',
  preferences: {
    theme: 'dark',
    riskTolerance: 'moderate'
  }
}

export const mockContest = {
  id: 'contest-123',
  name: 'NFL Sunday Million',
  sport: 'NFL',
  entryFee: 25,
  totalPrizes: 1000000,
  maxEntries: 500000,
  startTime: new Date('2024-01-01T13:00:00Z'),
  endTime: new Date('2024-01-01T20:00:00Z'),
  isLive: true,
  contestType: 'GPP'
}

export const mockPlayer = {
  id: 'player-123',
  name: 'Josh Allen',
  position: 'QB',
  team: 'BUF',
  salary: 8500,
  projection: 23.5,
  ownership: 15.2,
  value: 2.76,
  isInjured: false,
  gameInfo: {
    opponent: 'MIA',
    spread: -7,
    total: 47.5,
    weather: 'clear'
  }
}

export const mockLeague = {
  id: 'league-123',
  name: 'Test League',
  platform: 'espn',
  sport: 'NFL',
  settings: {
    teamCount: 12,
    scoringType: 'PPR',
    startingLineup: {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 1,
      DST: 1,
      K: 1
    },
    benchSize: 6,
    waiverType: 'FAAB',
    tradeDeadline: '2024-11-01'
  }
}

// Mock API responses
export const mockApiResponse = <T>(data: T, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data)
})

// Mock WebSocket
export const mockWebSocket = {
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: WebSocket.OPEN
}

// Database test helpers
export const cleanupDatabase = async () => {
  // Mock cleanup for tests
  console.log('Mock database cleanup')
}

export const seedTestData = async () => {
  // Mock seed data for tests
  console.log('Mock test data seeded')
}

// Error simulation helpers
export const simulateNetworkError = () => {
  throw new Error('Network Error')
}

export const simulateTimeoutError = () => {
  throw new Error('Request Timeout')
}

// Performance testing helpers
export const measureRenderTime = async (renderFn: () => void) => {
  const start = performance.now()
  renderFn()
  const end = performance.now()
  return end - start
}

// Accessibility testing helpers
export const checkAriaLabels = (element: HTMLElement) => {
  const ariaLabel = element.getAttribute('aria-label')
  const ariaLabelledBy = element.getAttribute('aria-labelledby')
  return ariaLabel || ariaLabelledBy
}

export const checkKeyboardNavigation = async (element: HTMLElement) => {
  const focusable = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  return focusable.length > 0
}

// Export everything needed for testing
export * from '@testing-library/react'
export { customRender as render }
export { default as userEvent } from '@testing-library/user-event'
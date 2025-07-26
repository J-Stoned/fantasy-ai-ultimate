# Testing Framework

This directory contains the testing utilities and setup for the Fantasy AI Ultimate application.

## Overview

We use Vitest as our testing framework with React Testing Library for component testing. The setup includes:

- **Vitest**: Fast unit test framework with Jest compatibility
- **React Testing Library**: For testing React components
- **Mock Service Worker (MSW)**: For API mocking (to be added)
- **Playwright**: For end-to-end testing

## Structure

```
testing/
├── setup.ts           # Global test setup and mocks
├── test-utils.tsx     # Custom render functions and utilities
└── README.md          # This file
```

## Key Features

### 1. Custom Render Function

The `customRender` function wraps components with necessary providers:

```typescript
import { render } from '@/lib/testing/test-utils';

render(<MyComponent />, {
  mockServices: {
    [SERVICE_TOKENS.Logger]: customLogger,
  }
});
```

### 2. Mock Services

Pre-configured mocks for common services:

- `createMockLogger()`: Logger service mock
- `createMockCache()`: Cache service mock
- `createMockDatabase()`: Database service mock
- `createMockConfig()`: Configuration service mock
- `createMockFeatureFlags()`: Feature flags mock

### 3. Test Data Factories

Helper functions to create test data:

- `createMockPlayer()`: Generate player data
- `createMockContest()`: Generate contest data
- `createMockLineup()`: Generate lineup data

### 4. Async Utilities

- `waitForLoadingToFinish()`: Wait for loading states to complete
- `mockApiResponse()`: Mock successful API responses
- `mockApiError()`: Mock API errors

### 5. WebSocket Mocking

The `MockWebSocket` class simulates WebSocket connections for testing real-time features.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test src/components/MyComponent.test.tsx
```

## Writing Tests

### Component Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@/lib/testing/test-utils';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    render(<MyComponent />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('Clicked!')).toBeInTheDocument();
    });
  });
});
```

### Service Test Example

```typescript
import { describe, it, expect, vi } from 'vitest';
import { PlayerService } from '../PlayerService';
import { createMockDatabase, createMockCache, createMockLogger } from '@/lib/testing/test-utils';

describe('PlayerService', () => {
  it('should fetch player from cache first', async () => {
    const mockCache = createMockCache();
    const mockDb = createMockDatabase();
    const mockLogger = createMockLogger();
    
    mockCache.get.mockResolvedValue({ id: '1', name: 'Test Player' });
    
    const service = new PlayerService(mockDb, mockCache, mockLogger);
    const player = await service.getPlayer('1');
    
    expect(mockCache.get).toHaveBeenCalledWith('player:1');
    expect(mockDb.queryOne).not.toHaveBeenCalled();
    expect(player).toEqual({ id: '1', name: 'Test Player' });
  });
});
```

## Best Practices

1. **Use Custom Render**: Always use the custom render function to ensure providers are set up correctly
2. **Mock External Dependencies**: Use the provided mock factories for services
3. **Test User Behavior**: Focus on testing what users see and do, not implementation details
4. **Keep Tests Fast**: Mock heavy operations like API calls and database queries
5. **Use Descriptive Names**: Test names should clearly describe what is being tested
6. **Follow AAA Pattern**: Arrange, Act, Assert structure for clarity

## Coverage Goals

- **Unit Tests**: 80% coverage for business logic
- **Component Tests**: 70% coverage for UI components
- **Integration Tests**: Critical user flows covered
- **E2E Tests**: Happy paths for main features
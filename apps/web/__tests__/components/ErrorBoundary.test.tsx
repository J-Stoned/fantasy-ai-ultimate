import React from 'react'
import { render, screen } from '../helpers/test-utils'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Component that throws an error for testing
const ThrowError: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

// Mock console.error to prevent noise in test output
const originalError = console.error
beforeAll(() => {
  console.error = jest.fn()
})

afterAll(() => {
  console.error = originalError
})

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('should render error UI when child component throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.getByText(/test error/i)).toBeInTheDocument()
  })

  it('should display retry button in error state', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    const retryButton = screen.getByRole('button', { name: /try again/i })
    expect(retryButton).toBeInTheDocument()
  })

  it('should reset error state when retry is clicked', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    // Error should be displayed
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()

    // Click retry button
    const retryButton = screen.getByRole('button', { name: /try again/i })
    retryButton.click()

    // Rerender with a component that doesn't throw
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )

    // Error should be cleared
    expect(screen.getByText('No error')).toBeInTheDocument()
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument()
  })

  it('should log errors to console in development', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(console.error).toHaveBeenCalled()
  })

  it('should display error boundary for nested errors', () => {
    const NestedError = () => (
      <div>
        <span>Nested component</span>
        <ThrowError />
      </div>
    )

    render(
      <ErrorBoundary>
        <NestedError />
      </ErrorBoundary>
    )

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.queryByText('Nested component')).not.toBeInTheDocument()
  })

  it('should handle async errors in useEffect', () => {
    const AsyncError: React.FC = () => {
      React.useEffect(() => {
        throw new Error('Async error')
      }, [])
      return <div>Async component</div>
    }

    // Note: Error boundaries don't catch errors in event handlers, async code, etc.
    // This test verifies the component renders normally since async errors aren't caught
    render(
      <ErrorBoundary>
        <AsyncError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Async component')).toBeInTheDocument()
  })

  it('should provide error context to child components', () => {
    const ErrorInfo: React.FC = () => {
      const error = React.useContext(ErrorBoundary.Context)
      return error ? <div>Error context: {error.message}</div> : <div>No error context</div>
    }

    render(
      <ErrorBoundary>
        <ErrorInfo />
      </ErrorBoundary>
    )

    expect(screen.getByText('No error context')).toBeInTheDocument()
  })

  it('should handle multiple error boundaries', () => {
    const OuterError = () => <ThrowError />
    const InnerContent = () => (
      <ErrorBoundary>
        <div>Inner boundary content</div>
      </ErrorBoundary>
    )

    render(
      <ErrorBoundary>
        <div>
          <OuterError />
          <InnerContent />
        </div>
      </ErrorBoundary>
    )

    // Outer error boundary should catch the error
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.queryByText('Inner boundary content')).not.toBeInTheDocument()
  })

  it('should be accessible with proper ARIA attributes', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    const errorContainer = screen.getByRole('alert')
    expect(errorContainer).toBeInTheDocument()
    expect(errorContainer).toHaveAttribute('aria-live', 'assertive')

    const retryButton = screen.getByRole('button', { name: /try again/i })
    expect(retryButton).toHaveAttribute('aria-describedby')
  })

  it('should handle different error types', () => {
    const CustomError: React.FC<{ errorType: string }> = ({ errorType }) => {
      switch (errorType) {
        case 'reference':
          throw new ReferenceError('Reference error')
        case 'type':
          throw new TypeError('Type error')
        case 'syntax':
          throw new SyntaxError('Syntax error')
        default:
          throw new Error('Generic error')
      }
    }

    const errorTypes = ['reference', 'type', 'syntax', 'generic']

    errorTypes.forEach(errorType => {
      const { unmount } = render(
        <ErrorBoundary>
          <CustomError errorType={errorType} />
        </ErrorBoundary>
      )

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()

      unmount()
    })
  })

  it('should handle errors with custom fallback component', () => {
    const CustomFallback: React.FC<{ error: Error }> = ({ error }) => (
      <div>
        <h2>Custom Error Fallback</h2>
        <p>Error: {error.message}</p>
      </div>
    )

    render(
      <ErrorBoundary fallback={CustomFallback}>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom Error Fallback')).toBeInTheDocument()
    expect(screen.getByText('Error: Test error')).toBeInTheDocument()
  })

  it('should maintain component state across re-renders', () => {
    const StatefulComponent: React.FC = () => {
      const [count, setCount] = React.useState(0)
      
      return (
        <div>
          <span>Count: {count}</span>
          <button onClick={() => setCount(c => c + 1)}>Increment</button>
        </div>
      )
    }

    render(
      <ErrorBoundary>
        <StatefulComponent />
      </ErrorBoundary>
    )

    const incrementButton = screen.getByRole('button', { name: /increment/i })
    incrementButton.click()
    
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
  })
})
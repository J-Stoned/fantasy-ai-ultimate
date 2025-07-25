'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { browserLog } from '@/lib/logging/browser-logger';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to browser logger
    browserLog.logReactError(error, errorInfo, {
      errorId: this.state.errorId || undefined,
      component: errorInfo.componentStack
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update state with error info
    this.setState({
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <CardTitle>Something went wrong</CardTitle>
              </div>
              <CardDescription>
                We've encountered an unexpected error. Our team has been notified.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-mono text-muted-foreground">
                  Error ID: {this.state.errorId}
                </p>
              </div>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="space-y-2">
                  <summary className="cursor-pointer text-sm font-medium">
                    Error Details (Development Only)
                  </summary>
                  <div className="bg-muted p-4 rounded-lg overflow-auto">
                    <p className="text-sm font-semibold text-destructive">
                      {this.state.error.name}: {this.state.error.message}
                    </p>
                    {this.state.error.stack && (
                      <pre className="mt-2 text-xs whitespace-pre-wrap font-mono">
                        {this.state.error.stack}
                      </pre>
                    )}
                  </div>
                </details>
              )}
            </CardContent>
            
            <CardFooter className="flex gap-2">
              <Button
                onClick={this.handleReset}
                variant="default"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Go Home
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Page-level error boundary with custom styling
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-[400px] flex items-center justify-center">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-lg">Page Error</CardTitle>
              <CardDescription>
                This page encountered an error. Please try refreshing or contact support.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button onClick={() => window.location.reload()} className="w-full">
                Refresh Page
              </Button>
            </CardFooter>
          </Card>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

// Component-level error boundary for isolated failures
export function ComponentErrorBoundary({ 
  children,
  componentName = 'Component'
}: { 
  children: ReactNode;
  componentName?: string;
}) {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
          <p className="text-sm text-destructive">
            {componentName} failed to load. Please try again later.
          </p>
        </div>
      }
      onError={(error, errorInfo) => {
        browserLog.error(`${componentName} error`, {
          error: error.message,
          component: componentName,
          stack: error.stack
        });
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

// Hook for functional components
export function useErrorHandler() {
  return (error: Error) => {
    throw error; // This will be caught by the nearest error boundary
  };
}
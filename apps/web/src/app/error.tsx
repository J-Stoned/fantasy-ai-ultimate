'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';
import { browserLog } from '@/lib/logging/browser-logger';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log the error to our centralized logging system
    browserLog.error('Page error', {
      error: error.message,
      digest: error.digest,
      stack: error.stack,
      url: window.location.href
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <CardTitle>Something went wrong!</CardTitle>
          </div>
          <CardDescription>
            We encountered an unexpected error while processing your request.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Our team has been notified and is working to fix this issue.
            </p>
            {error.digest && (
              <p className="text-xs font-mono mt-2 text-muted-foreground">
                Error ID: {error.digest}
              </p>
            )}
          </div>
          
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium mb-2">
                Technical Details (Development Only)
              </summary>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-semibold text-destructive">
                  {error.name}: {error.message}
                </p>
                {error.stack && (
                  <pre className="mt-2 text-xs whitespace-pre-wrap font-mono overflow-auto">
                    {error.stack}
                  </pre>
                )}
              </div>
            </details>
          )}
        </CardContent>
        
        <CardFooter className="flex gap-2">
          <Button
            onClick={reset}
            variant="default"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <Button
            onClick={() => window.location.href = '/'}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Go home
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
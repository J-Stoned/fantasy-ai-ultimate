'use client';

import { ReactNode } from 'react';
import { APIServicesProvider } from './APIServicesProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PerformanceMonitor } from '@/components/PerformanceMonitor';

interface ClientProvidersProps {
  children: ReactNode;
}

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <ErrorBoundary>
      <APIServicesProvider>
        <PerformanceMonitor />
        {children}
      </APIServicesProvider>
    </ErrorBoundary>
  );
}
'use client';

import React, { Suspense, lazy, memo } from 'react';
import { Profiler } from 'react';
import { profileComponent } from '@/lib/utils/performance';
import { PERFORMANCE_CONFIG } from '@/lib/config/performance.config';

// Lazy load performance monitor for development
const PerformanceMonitor = lazy(() => 
  process.env.NODE_ENV === 'development' 
    ? import('./PerformanceMonitor')
    : Promise.resolve({ default: () => null })
);

interface OptimizedLayoutProps {
  children: React.ReactNode;
}

export const OptimizedLayout = memo(function OptimizedLayout({ children }: OptimizedLayoutProps) {
  const showPerformanceMonitor = process.env.NODE_ENV === 'development' && 
    PERFORMANCE_CONFIG.monitoring.enabled;

  return (
    <Profiler id="RootLayout" onRender={profileComponent}>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        {/* Navigation and other layout components can be added here */}
        
        {/* Main content with performance profiling */}
        <main className="relative">
          <Profiler id="MainContent" onRender={profileComponent}>
            {children}
          </Profiler>
        </main>

        {/* Performance monitoring in development */}
        {showPerformanceMonitor && (
          <Suspense fallback={null}>
            <PerformanceMonitor />
          </Suspense>
        )}
      </div>
    </Profiler>
  );
});

export default OptimizedLayout;
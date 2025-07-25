'use client';

import React, { Suspense } from 'react';
import { ContestBrowser } from '@/components/dfs/ContestBrowser';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

// Loading component with purple/blue gradient theme
const ContestBrowserLoading = () => (
  <div className="min-h-screen bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-indigo-900/20">
    <div className="flex items-center justify-center min-h-[600px]">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
        <p className="text-gray-400 text-lg">Loading contests...</p>
      </div>
    </div>
  </div>
);

// Error fallback component
const ContestBrowserError = ({ error, reset }: { error: Error; reset: () => void }) => (
  <div className="min-h-screen bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-indigo-900/20">
    <div className="flex items-center justify-center min-h-[600px]">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-white">Something went wrong!</h2>
        <p className="text-gray-400">{error.message || 'Failed to load contests'}</p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  </div>
);

export default function ContestsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-indigo-900/20">
      <div className="container mx-auto px-4 py-8">
        <ErrorBoundary fallback={ContestBrowserError}>
          <Suspense fallback={<ContestBrowserLoading />}>
            <ContestBrowser />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}
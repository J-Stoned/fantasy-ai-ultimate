import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Loading component
const TerminalLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-950">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-400">Loading Trading Terminal...</p>
    </div>
  </div>
);

// Dynamic import with loading state
const AdvancedTradingTerminal = dynamic(
  () => import('@/components/dfs/advanced-trading-terminal'),
  {
    loading: () => <TerminalLoader />,
    ssr: false, // Disable SSR for heavy client-side component
  }
);

export const metadata = {
  title: 'Advanced DFS Trading Terminal | Fantasy ML',
  description: 'Professional-grade DFS trading terminal with real-time analytics, contest intelligence, ownership projection engine, Kelly Criterion optimization, and advanced risk management - Bloomberg Terminal for DFS',
};

export default function TerminalPage() {
  return (
    <Suspense fallback={<TerminalLoader />}>
      <AdvancedTradingTerminal />
    </Suspense>
  );
}
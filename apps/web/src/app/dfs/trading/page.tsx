import TradingDashboard from '@/components/dfs/trading-dashboard';

export const metadata = {
  title: 'DFS Trading Dashboard | Fantasy ML',
  description: 'Professional Bloomberg Terminal-style DFS trading dashboard with real-time P&L tracking, contest selection AI, ownership projection engine, and advanced risk management',
};

export default function TradingPage() {
  return <TradingDashboard />;
}
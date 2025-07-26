/**
 * Refactored Trading Terminal - Main orchestrator component
 * Follows Single Responsibility Principle
 */

'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  PlayCircle, PauseCircle, RefreshCw, Settings,
  BarChart3, PieChartIcon, LineChart, Shield
} from 'lucide-react';

// Import hooks
import { useRealTimeMetrics } from '@/hooks/trading/useRealTimeMetrics';

// Import components
import { MetricsOverview } from './metrics/MetricsOverview';

// TODO: Import these once created
// import { ContestIntelligence } from './contests/ContestIntelligence';
// import { LivePositionsTable } from './positions/LivePositionsTable';
// import { PortfolioAllocation } from './portfolio/PortfolioAllocation';
// import { RiskDashboard } from './risk/RiskDashboard';

export default function TradingTerminalRefactored() {
  const { metrics, isLoading, error, isLive, toggleLive, refreshMetrics } = useRealTimeMetrics();
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Professional Trading Terminal</h1>
          <p className="text-muted-foreground">
            Real-time DFS trading analytics and portfolio management
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant={isLive ? 'default' : 'secondary'} className="gap-1">
            {isLive ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                LIVE
              </>
            ) : (
              'PAUSED'
            )}
          </Badge>
          
          <Button
            variant="outline"
            size="icon"
            onClick={toggleLive}
            title={isLive ? 'Pause updates' : 'Resume updates'}
          >
            {isLive ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={refreshMetrics}
            disabled={isLoading}
            title="Refresh data"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button variant="outline" size="icon" title="Settings">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Metrics Overview */}
      <MetricsOverview metrics={metrics} />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="contests" className="gap-2">
            <LineChart className="h-4 w-4" />
            Contests
          </TabsTrigger>
          <TabsTrigger value="positions" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Positions
          </TabsTrigger>
          <TabsTrigger value="portfolio" className="gap-2">
            <PieChartIcon className="h-4 w-4" />
            Portfolio
          </TabsTrigger>
          <TabsTrigger value="risk" className="gap-2">
            <Shield className="h-4 w-4" />
            Risk
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">
            {/* TODO: Add performance charts */}
            <p>Performance charts will be displayed here</p>
          </div>
        </TabsContent>

        <TabsContent value="contests" className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">
            {/* TODO: Add ContestIntelligence component */}
            <p>Contest intelligence and recommendations</p>
          </div>
        </TabsContent>

        <TabsContent value="positions" className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">
            {/* TODO: Add LivePositionsTable component */}
            <p>Live positions tracking</p>
          </div>
        </TabsContent>

        <TabsContent value="portfolio" className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">
            {/* TODO: Add PortfolioAllocation component */}
            <p>Portfolio allocation and optimization</p>
          </div>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">
            {/* TODO: Add RiskDashboard component */}
            <p>Risk management dashboard</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
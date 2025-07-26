/**
 * Metrics overview component for trading terminal
 * Displays key performance metrics in a card grid
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, TrendingDown, DollarSign, Activity, 
  Percent, Target, Shield, Brain 
} from 'lucide-react';
import { RealTimeMetrics } from '@/types/trading/trading-metrics';

interface MetricsOverviewProps {
  metrics: RealTimeMetrics;
  className?: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  format?: 'currency' | 'percent' | 'number';
  precision?: number;
}

function MetricCard({ title, value, change, icon, format = 'number', precision = 2 }: MetricCardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'currency':
        return `$${val.toLocaleString('en-US', { maximumFractionDigits: precision })}`;
      case 'percent':
        return `${(val * 100).toFixed(precision)}%`;
      default:
        return val.toFixed(precision);
    }
  };

  const isPositive = change !== undefined ? change >= 0 : true;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatValue(value)}</div>
        {change !== undefined && (
          <p className={`text-xs ${isPositive ? 'text-green-600' : 'text-red-600'} flex items-center`}>
            {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
            {Math.abs(change * 100).toFixed(1)}% from yesterday
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function MetricsOverview({ metrics, className = '' }: MetricsOverviewProps) {
  return (
    <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-4 ${className}`}>
      <MetricCard
        title="Total P&L"
        value={metrics.totalPnL}
        change={metrics.dailyPnL / (metrics.totalPnL - metrics.dailyPnL)}
        icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        format="currency"
      />
      
      <MetricCard
        title="Win Rate"
        value={metrics.winRate}
        icon={<Target className="h-4 w-4 text-muted-foreground" />}
        format="percent"
      />
      
      <MetricCard
        title="Sharpe Ratio"
        value={metrics.sharpeRatio}
        icon={<Activity className="h-4 w-4 text-muted-foreground" />}
        format="number"
      />
      
      <MetricCard
        title="Kelly %"
        value={metrics.actualKelly}
        icon={<Brain className="h-4 w-4 text-muted-foreground" />}
        format="percent"
      />
      
      <MetricCard
        title="Daily ROI"
        value={metrics.dailyROI}
        icon={<Percent className="h-4 w-4 text-muted-foreground" />}
        format="percent"
      />
      
      <MetricCard
        title="Current Drawdown"
        value={metrics.currentDrawdown}
        icon={<Shield className="h-4 w-4 text-muted-foreground" />}
        format="percent"
      />
      
      <MetricCard
        title="Daily Volume"
        value={metrics.dailyVolume}
        icon={<Activity className="h-4 w-4 text-muted-foreground" />}
        format="currency"
        precision={0}
      />
      
      <MetricCard
        title="Avg Position"
        value={metrics.avgPosition}
        icon={<Target className="h-4 w-4 text-muted-foreground" />}
        format="percent"
      />
    </div>
  );
}
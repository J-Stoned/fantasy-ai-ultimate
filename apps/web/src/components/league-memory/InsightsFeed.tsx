'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Eye,
  AlertTriangle,
  TrendingUp,
  Users,
  Brain,
  Zap,
  Clock,
  ChevronRight,
  Bell,
  BellOff
} from 'lucide-react';

interface Insight {
  id: string;
  title: string;
  description: string;
  type: 'trade' | 'behavior' | 'market' | 'anomaly' | 'prediction';
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  relatedManagers: string[];
  actionable: boolean;
  actions?: string[];
}

interface InsightsFeedProps {
  insights: Insight[];
  onInsightClick?: (insight: Insight) => void;
}

export default function InsightsFeed({ insights, onInsightClick }: InsightsFeedProps) {
  const [filter, setFilter] = useState<string>('all');
  const [notifications, setNotifications] = useState<Set<string>>(new Set());

  const mockInsights: Insight[] = [
    {
      id: '1',
      title: 'Coordinated Market Manipulation Detected',
      description: '3 managers simultaneously selling same player suggests collusion or shared intel source.',
      type: 'anomaly',
      severity: 'critical',
      timestamp: '2 minutes ago',
      relatedManagers: ['Trade Sharks', 'Dynasty Dominators', 'Waiver Warriors'],
      actionable: true,
      actions: ['Investigate trade patterns', 'Monitor player value', 'Alert league commissioner']
    },
    {
      id: '2',
      title: 'Behavioral Shift: Steady Eddies',
      description: 'Normally conservative manager showing increased trade activity. 300% above baseline.',
      type: 'behavior',
      severity: 'high',
      timestamp: '1 hour ago',
      relatedManagers: ['Steady Eddies'],
      actionable: true,
      actions: ['Review recent trades', 'Check roster changes', 'Predict next moves']
    },
    {
      id: '3',
      title: 'Elite RB Market Bubble Forming',
      description: 'RB1 valuations 35% above historical average. Correction likely within 2 weeks.',
      type: 'market',
      severity: 'medium',
      timestamp: '3 hours ago',
      relatedManagers: ['Analytics Army', 'Rookie Hunters'],
      actionable: true,
      actions: ['Sell high on RBs', 'Target undervalued positions', 'Wait for correction']
    },
    {
      id: '4',
      title: 'Alliance Pattern Strengthening',
      description: 'Dynasty Dominators and Waiver Warriors trading exclusively with each other. Win-win deals.',
      type: 'trade',
      severity: 'medium',
      timestamp: '6 hours ago',
      relatedManagers: ['Dynasty Dominators', 'Waiver Warriors'],
      actionable: false
    },
    {
      id: '5',
      title: 'Prediction Validated: Trade Sharks Move',
      description: 'Successfully predicted package deal for elite TE. 92% confidence prediction came true.',
      type: 'prediction',
      severity: 'low',
      timestamp: '1 day ago',
      relatedManagers: ['Trade Sharks'],
      actionable: false
    }
  ];

  const filteredInsights = filter === 'all' 
    ? mockInsights 
    : mockInsights.filter(i => i.type === filter);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'anomaly': return <AlertTriangle className="w-4 h-4" />;
      case 'behavior': return <Brain className="w-4 h-4" />;
      case 'market': return <TrendingUp className="w-4 h-4" />;
      case 'trade': return <Users className="w-4 h-4" />;
      case 'prediction': return <Eye className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-900/30 text-red-400 border-red-500/50';
      case 'high': return 'bg-orange-900/30 text-orange-400 border-orange-500/50';
      case 'medium': return 'bg-yellow-900/30 text-yellow-400 border-yellow-500/50';
      case 'low': return 'bg-green-900/30 text-green-400 border-green-500/50';
      default: return 'bg-gray-900/30 text-gray-400 border-gray-500/50';
    }
  };

  const toggleNotification = (id: string) => {
    setNotifications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
          className="text-xs"
        >
          All Insights
        </Button>
        {['anomaly', 'behavior', 'market', 'trade', 'prediction'].map(type => (
          <Button
            key={type}
            size="sm"
            variant={filter === type ? 'default' : 'outline'}
            onClick={() => setFilter(type)}
            className="text-xs capitalize"
          >
            {type}
          </Button>
        ))}
      </div>

      {/* Insights List */}
      <ScrollArea className="h-[600px] pr-4">
        <div className="space-y-3">
          {filteredInsights.map((insight) => (
            <Card 
              key={insight.id}
              className={`bg-black/40 backdrop-blur-lg border transition-all hover:border-opacity-70 cursor-pointer ${getSeverityColor(insight.severity)}`}
              onClick={() => onInsightClick?.(insight)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`p-2 rounded-lg ${getSeverityColor(insight.severity)}`}>
                    {getTypeIcon(insight.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-white">{insight.title}</h3>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleNotification(insight.id);
                        }}
                        className="h-6 w-6 p-0"
                      >
                        {notifications.has(insight.id) ? (
                          <Bell className="w-4 h-4 text-purple-400" />
                        ) : (
                          <BellOff className="w-4 h-4 text-gray-400" />
                        )}
                      </Button>
                    </div>

                    <p className="text-sm text-gray-300">{insight.description}</p>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1 text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>{insight.timestamp}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {insight.type}
                      </Badge>
                      {insight.actionable && (
                        <Badge className="bg-purple-600/30 text-purple-200 text-xs">
                          Actionable
                        </Badge>
                      )}
                    </div>

                    {/* Related Managers */}
                    {insight.relatedManagers.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {insight.relatedManagers.map((manager) => (
                          <Badge 
                            key={manager}
                            variant="secondary" 
                            className="text-xs bg-gray-800/50"
                          >
                            {manager}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    {insight.actionable && insight.actions && (
                      <div className="pt-2 border-t border-gray-700/50">
                        <p className="text-xs font-semibold text-purple-300 mb-1">
                          Recommended Actions:
                        </p>
                        <div className="space-y-1">
                          {insight.actions.map((action, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-xs text-gray-300">
                              <ChevronRight className="w-3 h-3 text-purple-400" />
                              <span>{action}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Summary Stats */}
      <Card className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 backdrop-blur-lg border-purple-500/30">
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-red-400">
                {mockInsights.filter(i => i.severity === 'critical').length}
              </p>
              <p className="text-xs text-gray-400">Critical</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-400">
                {mockInsights.filter(i => i.severity === 'high').length}
              </p>
              <p className="text-xs text-gray-400">High Priority</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-400">
                {mockInsights.filter(i => i.actionable).length}
              </p>
              <p className="text-xs text-gray-400">Actionable</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">
                {notifications.size}
              </p>
              <p className="text-xs text-gray-400">Notifications</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
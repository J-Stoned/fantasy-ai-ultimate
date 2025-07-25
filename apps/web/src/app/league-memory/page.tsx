'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Brain, TrendingUp, Users, Eye, Target, Activity, Flame, Network } from 'lucide-react';

// Import all the new components
import ManagerProfileCard from '@/components/league-memory/ManagerProfileCard';
import BehaviorPredictionPanel from '@/components/league-memory/BehaviorPredictionPanel';
import PatternVisualization from '@/components/league-memory/PatternVisualization';
import RivalryMap from '@/components/league-memory/RivalryMap';
import InsightsFeed from '@/components/league-memory/InsightsFeed';
import TradeHeatmap from '@/components/league-memory/TradeHeatmap';
import { logger } from '../../lib/logging/logger';

export default function LeagueMemoryDashboard() {
  const [managers, setManagers] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [managersRes, predictionsRes, patternsRes, insightsRes] = await Promise.all([
        fetch('/api/league-memory/profiles'),
        fetch('/api/league-memory/predictions'),
        fetch('/api/league-memory/patterns'),
        fetch('/api/league-memory/insights')
      ]);

      setManagers(await managersRes.json());
      setPredictions(await predictionsRes.json());
      setPatterns(await patternsRes.json());
      setInsights(await insightsRes.json());
    } catch (error) {
      logger.error('Error fetching dashboard data:', { error: error });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-purple-600">
          <Brain className="w-16 h-16 animate-spin" />
          <p className="mt-4">Analyzing league intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-blue-900 p-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-5xl font-bold text-white mb-2 flex items-center justify-center gap-3">
          <Brain className="w-12 h-12 text-purple-400" />
          League Memory Intelligence
        </h1>
        <p className="text-xl text-purple-200">Competitive Intelligence & Behavioral Analysis</p>
      </div>

      {/* Main Dashboard */}
      <div className="max-w-7xl mx-auto">
        <Tabs defaultValue="profiles" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-black/30 backdrop-blur-lg">
            <TabsTrigger value="profiles" className="text-white data-[state=active]:bg-purple-600">
              <Users className="w-4 h-4 mr-2" />
              Profiles
            </TabsTrigger>
            <TabsTrigger value="predictions" className="text-white data-[state=active]:bg-purple-600">
              <Target className="w-4 h-4 mr-2" />
              Predictions
            </TabsTrigger>
            <TabsTrigger value="patterns" className="text-white data-[state=active]:bg-purple-600">
              <Activity className="w-4 h-4 mr-2" />
              Patterns
            </TabsTrigger>
            <TabsTrigger value="network" className="text-white data-[state=active]:bg-purple-600">
              <Network className="w-4 h-4 mr-2" />
              Network
            </TabsTrigger>
            <TabsTrigger value="heatmap" className="text-white data-[state=active]:bg-purple-600">
              <Flame className="w-4 h-4 mr-2" />
              Heatmap
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-white data-[state=active]:bg-purple-600">
              <Eye className="w-4 h-4 mr-2" />
              Insights
            </TabsTrigger>
          </TabsList>

          {/* Manager Profiles Tab */}
          <TabsContent value="profiles" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Using mock enhanced profiles for the component */}
              {[
                {
                  id: '1',
                  team_name: 'Dynasty Dominators',
                  manager_name: 'Alex Thompson',
                  style: 'Aggressive',
                  traits: {
                    aggression: 95,
                    patience: 30,
                    analytics: 70,
                    risk_tolerance: 90,
                    social_influence: 85
                  },
                  stats: {
                    win_rate: 78,
                    trade_success: 82,
                    waiver_success: 65,
                    championship_odds: 28
                  },
                  patterns: ['Buy Low Expert', 'Deadline Warrior', 'Injury Capitalizer'],
                  weaknesses: ['Overpays for stars', 'Ignores bye weeks', 'Emotion-driven trades']
                },
                {
                  id: '2',
                  team_name: 'Steady Eddies',
                  manager_name: 'Sarah Chen',
                  style: 'Conservative',
                  traits: {
                    aggression: 20,
                    patience: 95,
                    analytics: 60,
                    risk_tolerance: 25,
                    social_influence: 40
                  },
                  stats: {
                    win_rate: 65,
                    trade_success: 88,
                    waiver_success: 55,
                    championship_odds: 15
                  },
                  patterns: ['Draft & Hold', 'Value Seeker', 'Long-term Builder'],
                  weaknesses: ['Misses opportunities', 'Too patient', 'Predictable strategy']
                },
                {
                  id: '3',
                  team_name: 'Analytics Army',
                  manager_name: 'Marcus Johnson',
                  style: 'Analytical',
                  traits: {
                    aggression: 60,
                    patience: 70,
                    analytics: 95,
                    risk_tolerance: 50,
                    social_influence: 30
                  },
                  stats: {
                    win_rate: 82,
                    trade_success: 91,
                    waiver_success: 78,
                    championship_odds: 32
                  },
                  patterns: ['Metrics Master', 'Efficiency Expert', 'Target Share Hunter'],
                  weaknesses: ['Over-relies on data', 'Misses intangibles', 'Slow decision maker']
                }
              ].map(profile => (
                <ManagerProfileCard 
                  key={profile.id} 
                  profile={profile}
                  onSelect={(p) => logger.info('Selected:', { data: p })}
                />
              ))}
            </div>
          </TabsContent>

          {/* Predictions Tab */}
          <TabsContent value="predictions" className="space-y-6">
            <BehaviorPredictionPanel 
              predictions={[
                {
                  id: '1',
                  manager: 'Dynasty Dominators',
                  action: 'Will target underperforming RB1s after Week 4',
                  confidence: 87,
                  timeframe: 'Next 2 weeks',
                  triggers: ['RB injury news', 'Team underperforming', '0-3 or 1-2 start'],
                  reasoning: 'Historical pattern shows aggressive buy-low strategy on elite players with slow starts. Has done this 8/10 times in similar situations.',
                  impact: 'high',
                  recommendations: [
                    'Monitor RB1s with slow starts',
                    'Prepare counter-offers if you own targets',
                    'Consider packaging RB2s for upgrades before they do'
                  ]
                },
                {
                  id: '2',
                  manager: 'Trade Sharks',
                  action: 'Likely to package mid-tier WRs for elite TE upgrade',
                  confidence: 92,
                  timeframe: 'Within 1 week',
                  triggers: ['TE underperformance', 'WR depth excess', 'Trade partner identified'],
                  reasoning: 'Currently rostering 8 WRs, only 1 startable TE. Has done this 3 times in past 2 seasons with 100% execution rate.',
                  impact: 'medium',
                  recommendations: [
                    'Target their WR depth in trades',
                    'Offer TE upgrades at premium price',
                    'Block trade by acquiring their targets'
                  ]
                },
                {
                  id: '3',
                  manager: 'Analytics Army',
                  action: 'Will sell aging veterans before Week 8 deadline',
                  confidence: 78,
                  timeframe: '3-4 weeks',
                  triggers: ['Player age 28+', 'Peak value reached', 'Dynasty calculator signals'],
                  reasoning: 'Consistent pattern of trading 28+ year old players while value remains high. Uses specific valuation models.',
                  impact: 'medium',
                  recommendations: [
                    'Target their aging stars now',
                    'Prepare win-now packages',
                    'Monitor their roster moves closely'
                  ]
                }
              ]}
              onPredictionSelect={(p) => logger.info('Selected prediction:', { data: p })}
            />
          </TabsContent>

          {/* Patterns Tab */}
          <TabsContent value="patterns" className="space-y-6">
            <PatternVisualization patterns={[]} />
          </TabsContent>

          {/* Network Tab */}
          <TabsContent value="network" className="space-y-6">
            <RivalryMap managers={[]} relationships={[]} />
          </TabsContent>

          {/* Heatmap Tab */}
          <TabsContent value="heatmap" className="space-y-6">
            <TradeHeatmap />
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights" className="space-y-6">
            <InsightsFeed 
              insights={[]}
              onInsightClick={(insight) => logger.info('Selected insight:', { data: insight })}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
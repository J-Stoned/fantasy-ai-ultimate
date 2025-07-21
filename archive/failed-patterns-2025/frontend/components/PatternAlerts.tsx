'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Bell, TrendingUp, AlertTriangle, Zap, Shield, Target } from 'lucide-react';

interface PatternAlert {
  id: string;
  pattern: string;
  confidence: number;
  players: string[];
  impact: 'high' | 'medium' | 'low';
  description: string;
  actionable: boolean;
  timestamp: Date;
}

const PATTERN_CONFIGS = {
  'back-to-back-fade': {
    name: 'Back-to-Back Fade',
    icon: Zap,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-900/20',
    borderColor: 'border-yellow-600/30',
    accuracy: 76.8,
  },
  'embarrassment-revenge': {
    name: 'Embarrassment Revenge',
    icon: Shield,
    color: 'text-red-400',
    bgColor: 'bg-red-900/20',
    borderColor: 'border-red-600/30',
    accuracy: 74.4,
  },
  'altitude-advantage': {
    name: 'Altitude Advantage',
    icon: TrendingUp,
    color: 'text-blue-400',
    bgColor: 'bg-blue-900/20',
    borderColor: 'border-blue-600/30',
    accuracy: 68.3,
  },
  'perfect-storm': {
    name: 'Perfect Storm',
    icon: AlertTriangle,
    color: 'text-purple-400',
    bgColor: 'bg-purple-900/20',
    borderColor: 'border-purple-600/30',
    accuracy: 67.0,
  },
  'division-dog-bite': {
    name: 'Division Dog Bite',
    icon: Target,
    color: 'text-green-400',
    bgColor: 'bg-green-900/20',
    borderColor: 'border-green-600/30',
    accuracy: 58.6,
  },
};

export function PatternAlerts() {
  const [alerts, setAlerts] = useState<PatternAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<'all' | 'high' | 'actionable'>('actionable');
  
  useEffect(() => {
    fetchPatternAlerts();
    const interval = setInterval(fetchPatternAlerts, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);
  
  const fetchPatternAlerts = async () => {
    try {
      const response = await fetch('/api/patterns/alerts');
      const data = await response.json();
      
      // Mock data for demonstration
      const mockAlerts: PatternAlert[] = [
        {
          id: '1',
          pattern: 'back-to-back-fade',
          confidence: 0.82,
          players: ['Patrick Mahomes', 'Travis Kelce'],
          impact: 'high',
          description: 'Chiefs playing 2nd game in 48 hours. Historical -23% performance drop.',
          actionable: true,
          timestamp: new Date(),
        },
        {
          id: '2',
          pattern: 'altitude-advantage',
          confidence: 0.71,
          players: ['Russell Wilson', 'Courtland Sutton'],
          impact: 'medium',
          description: 'Broncos at home in Denver. Opponents show -15% efficiency at altitude.',
          actionable: true,
          timestamp: new Date(),
        },
        {
          id: '3',
          pattern: 'embarrassment-revenge',
          confidence: 0.89,
          players: ['Dak Prescott'],
          impact: 'high',
          description: 'Cowboys lost by 30+ last week. Revenge game bounce-back rate: 74%.',
          actionable: false,
          timestamp: new Date(),
        },
      ];
      
      setAlerts(data.alerts || mockAlerts);
    } catch (error) {
      console.error('Failed to fetch pattern alerts:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'high') return alert.impact === 'high';
    if (filter === 'actionable') return alert.actionable;
    return true;
  });
  
  const displayedAlerts = showAll ? filteredAlerts : filteredAlerts.slice(0, 3);
  
  if (loading) {
    return (
      <Card className="bg-white/10 backdrop-blur-lg border-white/20 p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </Card>
    );
  }
  
  return (
    <Card className="bg-white/10 backdrop-blur-lg border-white/20">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Pattern Alerts</h3>
            <Badge variant="default" className="bg-yellow-600 text-xs">
              {filteredAlerts.length} Active
            </Badge>
          </div>
          
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={filter === 'actionable' ? 'default' : 'outline'}
              onClick={() => setFilter('actionable')}
              className="text-xs"
            >
              Actionable
            </Button>
            <Button
              size="sm"
              variant={filter === 'high' ? 'default' : 'outline'}
              onClick={() => setFilter('high')}
              className="text-xs"
            >
              High Impact
            </Button>
            <Button
              size="sm"
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
              className="text-xs"
            >
              All
            </Button>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <AnimatePresence mode="popLayout">
          {displayedAlerts.length === 0 ? (
            <p className="text-gray-400 text-center py-4">
              No pattern alerts at this time. Check back closer to game time.
            </p>
          ) : (
            <div className="space-y-3">
              {displayedAlerts.map((alert) => {
                const config = PATTERN_CONFIGS[alert.pattern as keyof typeof PATTERN_CONFIGS];
                const Icon = config?.icon || Bell;
                
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    whileHover={{ scale: 1.02 }}
                    className={`
                      relative rounded-lg p-4 border transition-all cursor-pointer
                      ${config?.bgColor || 'bg-gray-900/20'}
                      ${config?.borderColor || 'border-gray-600/30'}
                      hover:border-white/30
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${config?.color || 'text-gray-400'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-white">
                              {config?.name || 'Pattern Alert'}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  alert.impact === 'high' ? 'border-red-500 text-red-400' :
                                  alert.impact === 'medium' ? 'border-yellow-500 text-yellow-400' :
                                  'border-gray-500 text-gray-400'
                                }`}
                              >
                                {alert.impact} impact
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {(alert.confidence * 100).toFixed(0)}% confidence
                              </Badge>
                              {config?.accuracy && (
                                <Badge variant="outline" className="text-xs">
                                  {config.accuracy}% historical
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {alert.actionable && (
                            <Badge className="bg-green-600 text-xs">
                              Action Required
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-300 mb-2">
                          {alert.description}
                        </p>
                        
                        {alert.players.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {alert.players.map((player) => (
                              <Badge
                                key={player}
                                variant="secondary"
                                className="text-xs"
                              >
                                {player}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
        
        {filteredAlerts.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="w-full mt-4 text-gray-400 hover:text-white"
          >
            {showAll ? 'Show Less' : `Show ${filteredAlerts.length - 3} More Alerts`}
          </Button>
        )}
      </div>
    </Card>
  );
}
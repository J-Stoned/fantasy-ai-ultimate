'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  TrendingUp, 
  Shield, 
  Zap, 
  Target,
  Users,
  Trophy,
  Activity
} from 'lucide-react';

interface ManagerProfile {
  id: string;
  team_name: string;
  manager_name: string;
  style: string;
  traits: {
    aggression: number;
    patience: number;
    analytics: number;
    risk_tolerance: number;
    social_influence: number;
  };
  stats: {
    win_rate: number;
    trade_success: number;
    waiver_success: number;
    championship_odds: number;
  };
  patterns: string[];
  weaknesses: string[];
}

interface ManagerProfileCardProps {
  profile: ManagerProfile;
  onSelect?: (profile: ManagerProfile) => void;
}

export default function ManagerProfileCard({ profile, onSelect }: ManagerProfileCardProps) {
  const getStyleIcon = (style: string) => {
    switch (style.toLowerCase()) {
      case 'aggressive': return <Zap className="w-5 h-5" />;
      case 'conservative': return <Shield className="w-5 h-5" />;
      case 'analytical': return <Brain className="w-5 h-5" />;
      case 'opportunistic': return <Target className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  const getStyleColor = (style: string) => {
    switch (style.toLowerCase()) {
      case 'aggressive': return 'bg-red-600';
      case 'conservative': return 'bg-blue-600';
      case 'analytical': return 'bg-purple-600';
      case 'opportunistic': return 'bg-yellow-600';
      default: return 'bg-gray-600';
    }
  };

  return (
    <Card 
      className="bg-black/40 backdrop-blur-lg border-purple-500/30 hover:border-purple-400/50 transition-all cursor-pointer transform hover:scale-105"
      onClick={() => onSelect?.(profile)}
    >
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStyleIcon(profile.style)}
            <span>{profile.team_name}</span>
          </div>
          <Badge className={`${getStyleColor(profile.style)} text-white`}>
            {profile.style}
          </Badge>
        </CardTitle>
        <p className="text-sm text-gray-400">{profile.manager_name}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Personality Traits */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-purple-300">Personality Matrix</h4>
          <div className="space-y-2">
            {Object.entries(profile.traits).map(([trait, value]) => (
              <div key={trait} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-24 capitalize">
                  {trait.replace('_', ' ')}
                </span>
                <div className="flex-1 bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full"
                    style={{ width: `${value}%` }}
                  />
                </div>
                <span className="text-xs text-white w-8">{value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-2 bg-purple-900/30 rounded">
            <Trophy className="w-4 h-4 mx-auto text-yellow-400 mb-1" />
            <p className="text-xs text-gray-400">Win Rate</p>
            <p className="text-sm font-bold text-white">{profile.stats.win_rate}%</p>
          </div>
          <div className="text-center p-2 bg-purple-900/30 rounded">
            <TrendingUp className="w-4 h-4 mx-auto text-green-400 mb-1" />
            <p className="text-xs text-gray-400">Trade Success</p>
            <p className="text-sm font-bold text-white">{profile.stats.trade_success}%</p>
          </div>
        </div>

        {/* Behavioral Patterns */}
        <div>
          <h4 className="text-sm font-semibold text-purple-300 mb-2">Known Patterns</h4>
          <div className="flex flex-wrap gap-1">
            {profile.patterns.map((pattern, idx) => (
              <Badge 
                key={idx} 
                variant="outline" 
                className="text-xs border-purple-500/50 text-purple-200"
              >
                {pattern}
              </Badge>
            ))}
          </div>
        </div>

        {/* Weaknesses */}
        <div>
          <h4 className="text-sm font-semibold text-red-400 mb-2">Exploitable Weaknesses</h4>
          <ul className="text-xs text-gray-300 space-y-1">
            {profile.weaknesses.map((weakness, idx) => (
              <li key={idx} className="flex items-start gap-1">
                <span className="text-red-400">•</span>
                <span>{weakness}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Championship Odds */}
        <div className="mt-4 p-3 bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Championship Odds</span>
            <span className="text-lg font-bold text-white">
              {profile.stats.championship_odds}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
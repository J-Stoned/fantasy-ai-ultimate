'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlayerAvatar } from '@/components/avatars/PlayerAvatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Star, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface TopPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  rating: number;
  trend: 'up' | 'down' | 'stable';
  fantasyPoints: number;
  change: number;
}

// Mock data - in real app this would come from API
const mockTopPlayers: TopPlayer[] = [
  { id: 'mahomes-15', name: 'Patrick Mahomes', position: 'QB', team: 'KC', rating: 98, trend: 'up', fantasyPoints: 28.5, change: 3.2 },
  { id: 'mccaffrey-22', name: 'Christian McCaffrey', position: 'RB', team: 'SF', rating: 97, trend: 'stable', fantasyPoints: 26.3, change: 0.5 },
  { id: 'jefferson-18', name: 'Justin Jefferson', position: 'WR', team: 'MIN', rating: 96, trend: 'up', fantasyPoints: 24.8, change: 2.1 },
  { id: 'kelce-87', name: 'Travis Kelce', position: 'TE', team: 'KC', rating: 95, trend: 'down', fantasyPoints: 18.2, change: -1.3 },
  { id: 'hill-10', name: 'Tyreek Hill', position: 'WR', team: 'MIA', rating: 94, trend: 'up', fantasyPoints: 23.5, change: 4.2 },
];

export function TopPlayersWidget() {
  const [players, setPlayers] = useState<TopPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setPlayers(mockTopPlayers);
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <Card className="bg-white/10 backdrop-blur-lg border-white/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          Top Performers
        </CardTitle>
        <CardDescription className="text-gray-300">
          This week's hottest players with 3D avatars
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-16 h-16 bg-white/20 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/20 rounded w-3/4" />
                  <div className="h-3 bg-white/20 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {players.map((player, index) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="relative">
                  <PlayerAvatar
                    playerId={player.id}
                    size={64}
                    showBadge={true}
                    animate={true}
                  />
                  {player.rating >= 95 && (
                    <Star className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400 fill-yellow-400" />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-white">{player.name}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {player.position}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-300">{player.team}</p>
                </div>
                
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-bold text-white">
                      {player.fantasyPoints}
                    </span>
                    {player.trend === 'up' && (
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    )}
                    {player.trend === 'down' && (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                  <p className={`text-xs ${
                    player.change > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {player.change > 0 ? '+' : ''}{player.change}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        
        <Link
          href="/avatars"
          className="mt-4 block text-center text-sm text-purple-400 hover:text-purple-300 transition-colors"
        >
          View All Players →
        </Link>
      </CardContent>
    </Card>
  );
}
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlayerAvatar } from '@/components/avatars/PlayerAvatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Star, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCDN } from '@/hooks/useCDN';

interface TopPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  rating: number;
  trend: 'up' | 'down' | 'stable';
  fantasyPoints: number;
  change: number;
  imageUrl?: string; // Optional player image URL
}

// Mock data - in real app this would come from API
const mockTopPlayers: TopPlayer[] = [
  { id: 'mahomes-15', name: 'Patrick Mahomes', position: 'QB', team: 'KC', rating: 98, trend: 'up', fantasyPoints: 28.5, change: 3.2, imageUrl: '/images/players/mahomes.jpg' },
  { id: 'mccaffrey-22', name: 'Christian McCaffrey', position: 'RB', team: 'SF', rating: 97, trend: 'stable', fantasyPoints: 26.3, change: 0.5, imageUrl: '/images/players/mccaffrey.jpg' },
  { id: 'jefferson-18', name: 'Justin Jefferson', position: 'WR', team: 'MIN', rating: 96, trend: 'up', fantasyPoints: 24.8, change: 2.1, imageUrl: '/images/players/jefferson.jpg' },
  { id: 'kelce-87', name: 'Travis Kelce', position: 'TE', team: 'KC', rating: 95, trend: 'down', fantasyPoints: 18.2, change: -1.3, imageUrl: '/images/players/kelce.jpg' },
  { id: 'hill-10', name: 'Tyreek Hill', position: 'WR', team: 'MIA', rating: 94, trend: 'up', fantasyPoints: 23.5, change: 4.2, imageUrl: '/images/players/hill.jpg' },
];

export function TopPlayersWidget() {
  const [players, setPlayers] = useState<TopPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cdn = useCDN();

  useEffect(() => {
    const fetchTopPlayers = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch real data from our API
        const response = await fetch('/api/players/top-performers');
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch players');
        }
        
        // Process players with CDN optimization
        const playersWithCDN = result.data.map((player: TopPlayer) => ({
          ...player,
          // Optimize player images through CDN if they exist
          imageUrl: player.imageUrl ? cdn.getOptimizedImage(player.imageUrl, {
            width: 128, // 2x size for retina displays
            height: 128,
            format: 'webp',
            quality: 85
          }) : undefined
        }));
        
        setPlayers(playersWithCDN);
      } catch (err) {
        console.error('Error fetching top players:', err);
        setError('Failed to load top players');
        // Fallback to mock data if API fails
        const fallbackPlayers = mockTopPlayers.map(player => ({
          ...player,
          imageUrl: player.imageUrl ? cdn.getOptimizedImage(player.imageUrl, {
            width: 128,
            height: 128,
            format: 'webp',
            quality: 85
          }) : undefined
        }));
        setPlayers(fallbackPlayers);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTopPlayers();
  }, [cdn]);

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
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
        
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
                    imageUrl={player.imageUrl} // Pass CDN-optimized URL
                    priority={index < 3} // Prioritize loading for top 3 players
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
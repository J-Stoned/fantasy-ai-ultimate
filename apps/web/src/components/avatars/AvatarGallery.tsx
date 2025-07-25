'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayerAvatar } from './PlayerAvatar';
import { useAvatarStore } from '@/lib/stores/avatar-store';

// Mock types for build compatibility
interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
}

type SportType = 'NFL' | 'NBA' | 'MLB' | 'NHL';

const useInfiniteApi = () => ({
  data: [],
  loading: false,
  loadMore: () => {},
  hasMore: false,
});
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvatarGalleryProps {
  sport?: SportType;
  teamId?: string;
  onPlayerSelect?: (player: Player) => void;
  className?: string;
}

export function AvatarGallery({
  sport,
  teamId,
  onPlayerSelect,
  className = ''
}: AvatarGalleryProps) {
  const [selectedTier, setSelectedTier] = useState<'all' | 'star' | 'starter' | 'bench'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const preloadAvatars = useAvatarStore(state => state.preloadAvatars);
  
  // Use infinite scrolling for large player lists
  const { 
    items: players, 
    loadMore, 
    hasMore, 
    isLoading 
  } = useInfiniteApi<Player>('/api/players');
  
  // Preload visible avatars
  useEffect(() => {
    const visiblePlayerIds = players.slice(0, 20).map(p => p.id);
    preloadAvatars(visiblePlayerIds);
  }, [players, preloadAvatars]);
  
  const filteredPlayers = players.filter(player => {
    // Filter by tier
    if (selectedTier !== 'all') {
      if (selectedTier === 'star' && player.rating < 90) return false;
      if (selectedTier === 'starter' && (player.rating < 75 || player.rating >= 90)) return false;
      if (selectedTier === 'bench' && player.rating >= 75) return false;
    }
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        player.name.toLowerCase().includes(query) ||
        player.team.toLowerCase().includes(query) ||
        player.position.toLowerCase().includes(query)
      );
    }
    
    // Filter by sport
    if (sport && player.sport !== sport) return false;
    
    // Filter by team
    if (teamId && player.team !== teamId) return false;
    
    return true;
  });
  
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            Player Avatars
          </h2>
          
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              Grid
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              List
            </Button>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Tier Filter */}
        <Tabs value={selectedTier} onValueChange={(v) => setSelectedTier(v as any)}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="all">All Players</TabsTrigger>
            <TabsTrigger value="star" className="flex items-center gap-1">
              <span className="text-yellow-500">⭐</span> Stars
            </TabsTrigger>
            <TabsTrigger value="starter" className="flex items-center gap-1">
              <span className="text-gray-400">🥈</span> Starters
            </TabsTrigger>
            <TabsTrigger value="bench" className="flex items-center gap-1">
              <span className="text-orange-500">🥉</span> Bench
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Gallery */}
      <AnimatePresence mode="wait">
        {viewMode === 'grid' ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4"
          >
            {filteredPlayers.map((player, index) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                onClick={() => onPlayerSelect?.(player)}
              >
                <PlayerAvatar
                  playerId={player.id}
                  size={80}
                  showBadge={true}
                  animate={true}
                />
                <div className="text-center">
                  <p className="text-sm font-medium truncate max-w-[100px]">
                    {player.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {player.position} • {player.team}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-2"
          >
            {filteredPlayers.map((player, index) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                onClick={() => onPlayerSelect?.(player)}
              >
                <PlayerAvatar
                  playerId={player.id}
                  size={60}
                  showBadge={true}
                  animate={true}
                />
                <div className="flex-1">
                  <p className="font-medium">{player.name}</p>
                  <p className="text-sm text-gray-500">
                    {player.position} • {player.team} • {player.sport}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{player.rating}</p>
                  <p className="text-xs text-gray-500">Rating</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center pt-8">
          <Button
            onClick={loadMore}
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? 'Loading...' : 'Load More Players'}
          </Button>
        </div>
      )}
      
      {/* Empty State */}
      {filteredPlayers.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500">No players found matching your criteria</p>
        </div>
      )}
    </div>
  );
}
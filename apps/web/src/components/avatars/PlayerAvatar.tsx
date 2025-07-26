'use client';

import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useAvatarStore } from '@/lib/stores/avatar-store';
import { useUserStore } from '@/lib/stores/user-store';
import { Avatar2D } from './Avatar2D';
import { Skeleton } from '@/components/ui/skeleton';
import { playerDataService } from '@/lib/database/player-data-service';

// 2025 Best Practice: Lazy load 3D component only when needed
const Avatar3D = lazy(() => import('./Avatar3D').then(m => ({ default: m.Avatar3D })));

interface PlayerAvatarProps {
  playerId: string;
  size?: number;
  showBadge?: boolean;
  showStats?: boolean;
  animate?: boolean;
  force2D?: boolean; // Force 2D even for star players
  onClick?: () => void;
  className?: string;
  priority?: boolean;
  imageUrl?: string; // CDN-optimized image URL
}

export function PlayerAvatar({
  playerId,
  size = 80,
  showBadge = true,
  showStats = false,
  animate = true,
  force2D = false,
  onClick,
  className = '',
  priority = false,
  imageUrl
}: PlayerAvatarProps) {
  const avatar = useAvatarStore(state => state.avatars.get(playerId));
  const subscriptionTier = useUserStore(state => state.user?.subscription.tier || 'free');
  const [realPlayerData, setRealPlayerData] = useState<any>(null);
  const [isLoadingRealData, setIsLoadingRealData] = useState(false);
  
  // 🔥 ELITE: Load real player data from 1.57M game stats database!
  useEffect(() => {
    const loadRealPlayerData = async () => {
      if (!imageUrl && playerId && !isLoadingRealData) {
        setIsLoadingRealData(true);
        try {
          const playerIdNum = parseInt(playerId);
          if (!isNaN(playerIdNum)) {
            const { data } = await playerDataService.getPlayerById(playerIdNum);
            if (data) {
              setRealPlayerData(data);
              console.log(`🔥 Loaded real player data for ${data.name} from 1.57M game stats!`);
            }
          }
        } catch (error) {
          console.error('Error loading real player data:', error);
        } finally {
          setIsLoadingRealData(false);
        }
      }
    };
    
    loadRealPlayerData();
  }, [playerId, imageUrl, isLoadingRealData]);
  
  // Determine if we should render 3D
  const should3D = 
    !force2D && 
    avatar?.tier === 'star' && 
    avatar?.avatarAsset.type === '3d' &&
    subscriptionTier !== 'free';
  
  // For free tier, just show placeholder
  if (subscriptionTier === 'free') {
    return (
      <div 
        className={`bg-gray-200 rounded-full flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-gray-500 text-sm">
          {playerId.substring(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }
  
  // Show 3D for star players with 3D assets
  if (should3D) {
    return (
      <Suspense fallback={
        <Skeleton 
          className={`rounded-lg ${className}`} 
          style={{ width: size, height: size }} 
        />
      }>
        <Avatar3D
          playerId={playerId}
          size={size}
          showStats={showStats}
          animate={animate}
          onClick={onClick}
          className={className}
          playerData={realPlayerData} // 🔥 Pass real player data for enhanced 3D rendering!
        />
      </Suspense>
    );
  }
  
  // Default to 2D
  return (
    <Avatar2D
      playerId={playerId}
      size={size}
      showBadge={showBadge}
      showStats={showStats}
      animate={animate}
      onClick={onClick}
      className={className}
      priority={priority}
      imageUrl={imageUrl || realPlayerData?.avatar_url} // 🔥 Use real player image from database!
    />
  );
}
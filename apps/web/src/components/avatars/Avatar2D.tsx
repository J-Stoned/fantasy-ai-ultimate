'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useAvatarStore } from '@/lib/stores/avatar-store';

// Mock types for build compatibility
const TIER_THRESHOLDS = { elite: 90, star: 75, solid: 60 };
interface PlayerAvatarProfile {
  id: string;
  tier: string;
  colors: string[];
}
import { cn } from '@/lib/utils';

// 2025 Best Practice: Optimized 2D avatar with Next.js Image
interface Avatar2DProps {
  playerId: string;
  size?: number;
  showBadge?: boolean;
  showStats?: boolean;
  animate?: boolean;
  onClick?: () => void;
  className?: string;
  priority?: boolean;
  imageUrl?: string; // CDN-optimized image URL
}

export function Avatar2D({
  playerId,
  size = 80,
  showBadge = true,
  showStats = false,
  animate = true,
  onClick,
  className = '',
  priority = false,
  imageUrl
}: Avatar2DProps) {
  const avatar = useAvatarStore(state => state.avatars.get(playerId));
  const isLoading = useAvatarStore(state => state.loadingAvatars.has(playerId));
  const loadAvatar = useAvatarStore(state => state.loadAvatar);
  
  const [imageError, setImageError] = useState(false);
  const [realPlayerData, setRealPlayerData] = useState<any>(null);
  
  // 🔥 ELITE: Load real player data if not provided via imageUrl
  useEffect(() => {
    const loadRealData = async () => {
      if (!imageUrl && playerId) {
        try {
          const playerIdNum = parseInt(playerId);
          if (!isNaN(playerIdNum)) {
            const { data } = await import('@/lib/database/player-data-service').then(m => 
              m.playerDataService.getPlayerById(playerIdNum)
            );
            if (data) {
              setRealPlayerData(data);
            }
          }
        } catch (error) {
          console.error('Error loading player data in Avatar2D:', error);
        }
      }
    };
    loadRealData();
  }, [playerId, imageUrl]);
  
  useEffect(() => {
    if (!avatar && !isLoading) {
      loadAvatar(playerId);
    }
  }, [playerId, avatar, isLoading, loadAvatar]);
  
  const getTierColors = (tier: string) => {
    // 🔥 ELITE: Enhanced tier system based on real player ratings!
    const playerTier = tier || realPlayerData?.avatar_tier || 'bench';
    switch (playerTier) {
      case 'elite':
        return 'from-purple-400 via-pink-500 to-purple-400'; // Elite gradient
      case 'star':
        return 'from-yellow-400 via-amber-500 to-yellow-400'; // Gold gradient
      case 'solid':
        return 'from-blue-400 via-blue-500 to-blue-400'; // Blue gradient
      case 'starter':
        return 'from-gray-300 via-gray-100 to-gray-300'; // Silver gradient
      default:
        return 'from-orange-600 via-orange-400 to-orange-600'; // Bronze gradient
    }
  };
  
  const getTierGlow = (tier: string) => {
    const playerTier = tier || realPlayerData?.avatar_tier || 'bench';
    switch (playerTier) {
      case 'elite':
        return 'shadow-[0_0_40px_rgba(168,85,247,0.8)]'; // Purple glow
      case 'star':
        return 'shadow-[0_0_30px_rgba(255,215,0,0.6)]'; // Gold glow
      case 'solid':
        return 'shadow-[0_0_25px_rgba(59,130,246,0.5)]'; // Blue glow
      case 'starter':
        return 'shadow-[0_0_20px_rgba(192,192,192,0.4)]'; // Silver glow
      default:
        return '';
    }
  };
  
  const renderAvatar = () => {
    // If we have a CDN-optimized imageUrl, use it directly
    if (imageUrl && !imageError) {
      return (
        <div className="relative" style={{ width: size, height: size }}>
          <Image
            src={imageUrl}
            alt={playerId}
            width={size}
            height={size}
            className={cn("rounded-full object-cover", className)}
            onError={() => setImageError(true)}
            priority={priority}
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
          />
        </div>
      );
    }
    
    // Otherwise fall back to avatar store data or real player data
    if (!avatar || imageError) {
      // 🔥 ELITE: Use real player name initials if available!
      const playerName = realPlayerData?.name || '';
      const initials = playerName 
        ? playerName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
        : playerId.substring(0, 2).toUpperCase();
      
      // Use tier-based background color from real data
      const bgColor = realPlayerData?.avatar_tier === 'elite' ? 'bg-purple-500' :
                     realPlayerData?.avatar_tier === 'star' ? 'bg-yellow-500' :
                     realPlayerData?.avatar_tier === 'solid' ? 'bg-blue-500' :
                     realPlayerData?.avatar_tier === 'starter' ? 'bg-gray-400' :
                     'bg-orange-500';
      
      return (
        <div 
          className={cn(
            "flex items-center justify-center text-white font-bold",
            bgColor,
            className
          )}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        >
          <span style={{ fontSize: size * 0.4 }}>
            {initials}
          </span>
        </div>
      );
    }
    
    if (avatar.avatarAsset.type === '2d' || avatar.avatarAsset.type === 'photo') {
      return (
        <div className="relative" style={{ width: size, height: size }}>
          <Image
            src={avatar.avatarAsset.assetUrl}
            alt={avatar.playerName}
            width={size}
            height={size}
            className={cn("rounded-full object-cover", className)}
            onError={() => setImageError(true)}
            priority={priority}
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
          />
        </div>
      );
    }
    
    return null;
  };
  
  return (
    <motion.div
      className={cn(
        "relative cursor-pointer select-none",
        onClick && "hover:scale-105 active:scale-95",
        className
      )}
      style={{ width: size, height: size }}
      onClick={onClick}
      whileHover={onClick ? { scale: 1.05 } : {}}
      whileTap={onClick ? { scale: 0.95 } : {}}
    >
      {/* Border gradient for tier */}
      {(avatar || realPlayerData) && showBadge && (
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br p-[3px] rounded-full",
            getTierColors(avatar?.tier || realPlayerData?.avatar_tier),
            animate && ['elite', 'star', 'solid'].includes(avatar?.tier || realPlayerData?.avatar_tier || '') && 
            getTierGlow(avatar?.tier || realPlayerData?.avatar_tier)
          )}
        >
          <div className="relative w-full h-full bg-white rounded-full overflow-hidden">
            {renderAvatar()}
          </div>
        </div>
      )}
      
      {(!avatar || !showBadge) && renderAvatar()}
      
      {/* Animated glow for elite/star players */}
      <AnimatePresence>
        {['elite', 'star'].includes(avatar?.tier || realPlayerData?.avatar_tier || '') && animate && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: (avatar?.tier || realPlayerData?.avatar_tier) === 'elite' 
                ? 'radial-gradient(circle, rgba(168,85,247,0.4) 0%, transparent 70%)' // Purple glow for elite
                : 'radial-gradient(circle, rgba(255,215,0,0.3) 0%, transparent 70%)', // Gold glow for star
              filter: 'blur(20px)',
            }}
            animate={{
              opacity: [0, 0.6, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: (avatar?.tier || realPlayerData?.avatar_tier) === 'elite' ? 2.5 : 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
      </AnimatePresence>
      
      {/* Status indicator */}
      {(avatar || realPlayerData) && showStats && (
        <div className="absolute bottom-0 right-0 bg-white rounded-full p-[2px] shadow-md">
          <div 
            className={cn(
              "w-3 h-3 rounded-full",
              (avatar?.rating || realPlayerData?.overall_rating || 0) >= TIER_THRESHOLDS.elite && "bg-purple-500",
              (avatar?.rating || realPlayerData?.overall_rating || 0) >= TIER_THRESHOLDS.star && "bg-green-500",
              (avatar?.rating || realPlayerData?.overall_rating || 0) >= TIER_THRESHOLDS.solid && "bg-blue-500",
              (avatar?.rating || realPlayerData?.overall_rating || 0) < TIER_THRESHOLDS.solid && "bg-orange-500"
            )}
          />
        </div>
      )}
      
      {/* Loading animation */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      )}
      
      {/* Tier badge */}
      {(avatar || realPlayerData) && showBadge && (
        <div className={cn(
          "absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-xs font-bold text-white",
          (avatar?.tier || realPlayerData?.avatar_tier) === 'elite' && "bg-gradient-to-r from-purple-500 to-pink-500",
          (avatar?.tier || realPlayerData?.avatar_tier) === 'star' && "bg-gradient-to-r from-yellow-500 to-amber-500",
          (avatar?.tier || realPlayerData?.avatar_tier) === 'solid' && "bg-gradient-to-r from-blue-500 to-blue-600",
          (avatar?.tier || realPlayerData?.avatar_tier) === 'starter' && "bg-gradient-to-r from-gray-400 to-gray-500",
          (avatar?.tier || realPlayerData?.avatar_tier) === 'bench' && "bg-gradient-to-r from-orange-500 to-orange-600"
        )}>
          {(avatar?.tier || realPlayerData?.avatar_tier || 'bench').toUpperCase()}
        </div>
      )}
    </motion.div>
  );
}
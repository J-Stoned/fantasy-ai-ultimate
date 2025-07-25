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
}

export function Avatar2D({
  playerId,
  size = 80,
  showBadge = true,
  showStats = false,
  animate = true,
  onClick,
  className = '',
  priority = false
}: Avatar2DProps) {
  const avatar = useAvatarStore(state => state.avatars.get(playerId));
  const isLoading = useAvatarStore(state => state.loadingAvatars.has(playerId));
  const loadAvatar = useAvatarStore(state => state.loadAvatar);
  
  const [imageError, setImageError] = useState(false);
  
  useEffect(() => {
    if (!avatar && !isLoading) {
      loadAvatar(playerId);
    }
  }, [playerId, avatar, isLoading, loadAvatar]);
  
  const getTierColors = (tier: string) => {
    switch (tier) {
      case 'star':
        return 'from-yellow-400 via-amber-500 to-yellow-400'; // Gold gradient
      case 'starter':
        return 'from-gray-300 via-gray-100 to-gray-300'; // Silver gradient
      default:
        return 'from-orange-600 via-orange-400 to-orange-600'; // Bronze gradient
    }
  };
  
  const getTierGlow = (tier: string) => {
    switch (tier) {
      case 'star':
        return 'shadow-[0_0_30px_rgba(255,215,0,0.6)]';
      case 'starter':
        return 'shadow-[0_0_20px_rgba(192,192,192,0.4)]';
      default:
        return '';
    }
  };
  
  const renderAvatar = () => {
    if (!avatar || imageError) {
      // Fallback avatar
      return (
        <div 
          className={cn(
            "flex items-center justify-center bg-gray-300 text-gray-600 font-bold",
            className
          )}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        >
          <span style={{ fontSize: size * 0.4 }}>
            {playerId.substring(0, 2).toUpperCase()}
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
      {avatar && showBadge && (
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br p-[3px] rounded-full",
            getTierColors(avatar.tier),
            animate && avatar.tier === 'star' && getTierGlow(avatar.tier)
          )}
        >
          <div className="relative w-full h-full bg-white rounded-full overflow-hidden">
            {renderAvatar()}
          </div>
        </div>
      )}
      
      {(!avatar || !showBadge) && renderAvatar()}
      
      {/* Animated glow for star players */}
      <AnimatePresence>
        {avatar?.tier === 'star' && animate && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(255,215,0,0.3) 0%, transparent 70%)',
              filter: 'blur(20px)',
            }}
            animate={{
              opacity: [0, 0.6, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
      </AnimatePresence>
      
      {/* Status indicator */}
      {avatar && showStats && (
        <div className="absolute bottom-0 right-0 bg-white rounded-full p-[2px] shadow-md">
          <div 
            className={cn(
              "w-3 h-3 rounded-full",
              avatar.rating >= TIER_THRESHOLDS.star && "bg-green-500",
              avatar.rating >= TIER_THRESHOLDS.starter && avatar.rating < TIER_THRESHOLDS.star && "bg-orange-500",
              avatar.rating < TIER_THRESHOLDS.starter && "bg-red-500"
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
      {avatar && showBadge && (
        <div className={cn(
          "absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-xs font-bold text-white",
          avatar.tier === 'star' && "bg-gradient-to-r from-yellow-500 to-amber-500",
          avatar.tier === 'starter' && "bg-gradient-to-r from-gray-400 to-gray-500",
          avatar.tier === 'bench' && "bg-gradient-to-r from-orange-500 to-orange-600"
        )}>
          {avatar.tier.toUpperCase()}
        </div>
      )}
    </motion.div>
  );
}
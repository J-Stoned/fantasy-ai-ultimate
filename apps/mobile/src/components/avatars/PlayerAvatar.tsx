import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Avatar3D } from './Avatar3D';
import { Avatar2D } from './Avatar2D';
import { useAvatarStore } from '@fantasy-ai/shared';
import LottieView from 'lottie-react-native';
import { avatarPerformance } from '../services/avatar-performance';

// 🔥 UNIVERSAL PLAYER AVATAR COMPONENT - 2025 BEAST MODE
interface PlayerAvatarProps {
  playerId: string;
  size?: number;
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  showBadge?: boolean;
  showStats?: boolean;
  animate?: boolean;
  onPress?: () => void;
  // Force specific type (useful for performance optimization)
  forceType?: '3d' | '2d' | 'photo';
}

interface PlayerAvatarData {
  id: string;
  firstname: string;
  lastname: string;
  position: string;
  avatar_tier: 'star' | 'starter' | 'bench';
  avatar_3d_url?: string;
  avatar_2d_url?: string;
  avatar_photo_url?: string;
  overall_rating: number;
  team_abbreviation?: string;
}

export function PlayerAvatar({
  playerId,
  size = 80,
  quality = 'medium',
  showBadge = true,
  showStats = false,
  animate = true,
  onPress,
  forceType
}: PlayerAvatarProps) {
  const [playerData, setPlayerData] = useState<PlayerAvatarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const setAvatarData = useAvatarStore(state => state.setAvatarData);

  useEffect(() => {
    fetchPlayerData();
  }, [playerId]);

  const fetchPlayerData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 🔥 USE OPTIMIZED PERFORMANCE SYSTEM FOR 85K+ PLAYERS
      const data = await avatarPerformance.getPlayerAvatar(playerId);
      
      if (!data) {
        // Fallback to direct API call
        const response = await fetch(`/api/players/${playerId}/avatar`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch player data: ${response.status}`);
        }
        
        const fallbackData: PlayerAvatarData = await response.json();
        setPlayerData(fallbackData);
      } else {
        setPlayerData(data);
      }
      
      // 💀 POPULATE AVATAR STORE WITH OUR TIER SYSTEM DATA
      const avatarProfile = {
        playerId: data?.id || playerId,
        tier: data?.avatar_tier || 'bench',
        rating: data?.overall_rating || 60,
        avatarAsset: {
          type: getAvatarType(data || {} as PlayerAvatarData),
          assetUrl: getAvatarUrl(data || {} as PlayerAvatarData),
          quality: quality
        },
        customizations: {
          jerseyColor: getTeamColor(data?.team_abbreviation),
          playerName: data ? `${data.firstname} ${data.lastname}` : 'Unknown Player',
          position: data?.position || 'N/A'
        }
      };
      
      setAvatarData(playerId, avatarProfile);
      
    } catch (err) {
      console.error('PlayerAvatar fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load player data');
    } finally {
      setLoading(false);
    }
  };

  const getAvatarType = (data: PlayerAvatarData): '3d' | '2d' | 'photo' => {
    if (forceType) return forceType;
    
    // 🏆 INTELLIGENT ROUTING BASED ON OUR TIER SYSTEM
    switch (data.avatar_tier) {
      case 'star':
        return data.avatar_3d_url ? '3d' : '2d';
      case 'starter':
      case 'bench':
        return data.avatar_2d_url ? '2d' : 'photo';
      default:
        return 'photo';
    }
  };

  const getAvatarUrl = (data: PlayerAvatarData): string => {
    const avatarType = getAvatarType(data);
    
    switch (avatarType) {
      case '3d':
        return data.avatar_3d_url || data.avatar_2d_url || data.avatar_photo_url || '';
      case '2d':
        return data.avatar_2d_url || data.avatar_photo_url || '';
      case 'photo':
        return data.avatar_photo_url || generateFallbackAvatar(data);
      default:
        return generateFallbackAvatar(data);
    }
  };

  const generateFallbackAvatar = (data: PlayerAvatarData): string => {
    // Generate a fallback avatar URL or return a default
    return `https://ui-avatars.com/api/?name=${data.firstname}+${data.lastname}&size=200&background=random&color=fff`;
  };

  const getTeamColor = (teamAbbr?: string): string => {
    // 🎨 NFL TEAM COLORS MAPPING
    const teamColors: Record<string, string> = {
      'KC': '#E31837',  // Chiefs Red
      'SF': '#AA0000',  // 49ers Red
      'BUF': '#00338D', // Bills Blue
      'PHI': '#004C54', // Eagles Green
      'DAL': '#041E42', // Cowboys Navy
      'GB': '#203731',  // Packers Green
      'NE': '#002244',  // Patriots Navy
      'LAR': '#003594', // Rams Blue
      // Add more team colors as needed
    };
    
    return teamColors[teamAbbr || ''] || '#1a1a1a';
  };

  // 🔄 LOADING STATE
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { width: size, height: size }]}>
        <LottieView
          source={require('../../assets/animations/loading.json')}
          autoPlay
          loop
          style={{ width: size * 0.6, height: size * 0.6 }}
        />
      </View>
    );
  }

  // ❌ ERROR STATE
  if (error || !playerData) {
    return (
      <View style={[styles.errorContainer, { width: size, height: size }]}>
        <Text style={[styles.errorText, { fontSize: size * 0.2 }]}>
          {playerId.substring(0, 2).toUpperCase()}
        </Text>
      </View>
    );
  }

  // 💀 INTELLIGENT AVATAR ROUTING
  const avatarType = getAvatarType(playerData);
  
  // 🏆 STAR PLAYERS GET 3D TREATMENT (509 ELITE ATHLETES)
  if (avatarType === '3d' && playerData.avatar_tier === 'star') {
    return (
      <Avatar3D
        playerId={playerId}
        size={size}
        quality={quality}
        showStats={showStats}
        animate={animate}
        onPress={onPress}
      />
    );
  }

  // 🏃 STARTER & BENCH PLAYERS GET 2D/PHOTO TREATMENT (84K+ ATHLETES)
  return (
    <Avatar2D
      playerId={playerId}
      size={size}
      showBadge={showBadge}
      showStats={showStats}
      animate={animate}
      onPress={onPress}
    />
  );
}

// 🎨 TIER INDICATOR COMPONENT
export function AvatarTierBadge({ 
  tier, 
  size = 24 
}: { 
  tier: 'star' | 'starter' | 'bench'; 
  size?: number;
}) {
  const getBadgeConfig = () => {
    switch (tier) {
      case 'star':
        return { emoji: '⭐', color: '#FFD700', text: 'STAR' };
      case 'starter':
        return { emoji: '🏃', color: '#C0C0C0', text: 'STARTER' };
      case 'bench':
        return { emoji: '🏃‍♂️', color: '#CD7F32', text: 'BENCH' };
    }
  };

  const config = getBadgeConfig();

  return (
    <View style={[styles.tierBadge, { backgroundColor: config.color }]}>
      <Text style={[styles.tierEmoji, { fontSize: size * 0.6 }]}>
        {config.emoji}
      </Text>
      <Text style={[styles.tierText, { fontSize: size * 0.4 }]}>
        {config.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    backgroundColor: '#E0E0E0',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#666',
    fontWeight: 'bold',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  tierEmoji: {
    marginRight: 4,
  },
  tierText: {
    color: '#000',
    fontWeight: 'bold',
  },
});

// 🔥 PERFORMANCE OPTIMIZED WRAPPER FOR LISTS
export const MemoizedPlayerAvatar = React.memo(PlayerAvatar, (prevProps, nextProps) => {
  return (
    prevProps.playerId === nextProps.playerId &&
    prevProps.size === nextProps.size &&
    prevProps.quality === nextProps.quality &&
    prevProps.animate === nextProps.animate
  );
});
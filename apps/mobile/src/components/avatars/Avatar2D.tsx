import React, { useEffect, useState } from 'react';
import { 
  View, 
  Image, 
  StyleSheet, 
  Text, 
  Animated,
  Pressable 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PlayerAvatarProfile, TIER_THRESHOLDS } from '@fantasy-ai/shared';
import { useAvatarStore } from '@fantasy-ai/shared';
import LottieView from 'lottie-react-native';

// 2025 Best Practice: Optimized 2D avatar with animations
interface Avatar2DProps {
  playerId: string;
  size?: number;
  showBadge?: boolean;
  showStats?: boolean;
  animate?: boolean;
  onPress?: () => void;
}

export function Avatar2D({
  playerId,
  size = 80,
  showBadge = true,
  showStats = false,
  animate = true,
  onPress
}: Avatar2DProps) {
  const avatar = useAvatarStore(state => state.avatars.get(playerId));
  const isLoading = useAvatarStore(state => state.loadingAvatars.has(playerId));
  const loadAvatar = useAvatarStore(state => state.loadAvatar);
  
  const [imageError, setImageError] = useState(false);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const glowAnim = React.useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (!avatar && !isLoading) {
      loadAvatar(playerId);
    }
  }, [playerId, avatar, isLoading, loadAvatar]);
  
  useEffect(() => {
    // Animate star players
    if (animate && avatar?.tier === 'star') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [animate, avatar?.tier, glowAnim]);
  
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };
  
  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
    onPress?.();
  };
  
  const getTierColors = (tier: string) => {
    switch (tier) {
      case 'star':
        return ['#FFD700', '#FFA500', '#FFD700']; // Gold gradient
      case 'starter':
        return ['#C0C0C0', '#E5E5E5', '#C0C0C0']; // Silver gradient
      default:
        return ['#CD7F32', '#D2691E', '#CD7F32']; // Bronze gradient
    }
  };
  
  const renderAvatar = () => {
    if (!avatar || imageError) {
      // Fallback avatar
      return (
        <View style={[styles.fallbackAvatar, { width: size, height: size }]}>
          <Text style={[styles.fallbackText, { fontSize: size * 0.4 }]}>
            {playerId.substring(0, 2).toUpperCase()}
          </Text>
        </View>
      );
    }
    
    if (avatar.avatarAsset.type === '2d' || avatar.avatarAsset.type === 'photo') {
      return (
        <Image
          source={{ uri: avatar.avatarAsset.assetUrl }}
          style={[styles.avatarImage, { width: size, height: size }]}
          onError={() => setImageError(true)}
        />
      );
    }
    
    // Shouldn't reach here, but fallback just in case
    return null;
  };
  
  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onPress}
    >
      <Animated.View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Border gradient for tier */}
        {avatar && showBadge && (
          <LinearGradient
            colors={getTierColors(avatar.tier)}
            style={[styles.tierBorder, { borderRadius: size / 2 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={[styles.innerContainer, { borderRadius: (size - 6) / 2 }]}>
              {renderAvatar()}
            </View>
          </LinearGradient>
        )}
        
        {(!avatar || !showBadge) && renderAvatar()}
        
        {/* Glow effect for star players */}
        {avatar?.tier === 'star' && animate && (
          <Animated.View
            style={[
              styles.glowEffect,
              {
                opacity: glowAnim,
                width: size * 1.2,
                height: size * 1.2,
                borderRadius: size * 0.6,
              },
            ]}
            pointerEvents="none"
          />
        )}
        
        {/* Status indicator */}
        {avatar && showStats && (
          <View style={styles.statusContainer}>
            <View style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(avatar.rating) }
            ]} />
          </View>
        )}
        
        {/* Loading animation */}
        {isLoading && (
          <View style={[styles.loadingOverlay, { borderRadius: size / 2 }]}>
            <LottieView
              source={require('../../assets/animations/loading.json')}
              autoPlay
              loop
              style={{ width: size * 0.5, height: size * 0.5 }}
            />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

function getStatusColor(rating: number): string {
  if (rating >= TIER_THRESHOLDS.star) return '#00FF00'; // Green - hot
  if (rating >= TIER_THRESHOLDS.starter) return '#FFA500'; // Orange - warm
  return '#FF0000'; // Red - cold
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  tierBorder: {
    padding: 3,
  },
  innerContainer: {
    overflow: 'hidden',
    backgroundColor: '#FFF',
  },
  avatarImage: {
    resizeMode: 'cover',
  },
  fallbackAvatar: {
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 40,
  },
  fallbackText: {
    color: '#666',
    fontWeight: 'bold',
  },
  glowEffect: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    backgroundColor: '#FFD700',
    transform: [
      { translateX: -60 },
      { translateY: -60 },
    ],
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  statusContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
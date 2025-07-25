import React, { Suspense, useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, useFrame, useLoader } from '@react-three/fiber/native';
import { useGLTF, OrbitControls, Environment, Float } from '@react-three/drei/native';
import * as THREE from 'three';
import { PlayerAvatarProfile } from '@fantasy-ai/shared';
import { useAvatarStore } from '@fantasy-ai/shared';
import { useUserStore } from '@fantasy-ai/shared';

// 2025 Best Practice: Optimized 3D avatar component for React Native
interface Avatar3DProps {
  playerId: string;
  size?: number;
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  showStats?: boolean;
  animate?: boolean;
  onPress?: () => void;
}

// Avatar model component with animations
function AvatarModel({ 
  avatar, 
  animate 
}: { 
  avatar: PlayerAvatarProfile; 
  animate: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { scene, animations } = useGLTF(avatar.avatarAsset.assetUrl);
  
  // 2025: Optimized animation loop
  useFrame((state, delta) => {
    if (!meshRef.current || !animate) return;
    
    // Idle animation
    meshRef.current.rotation.y += delta * 0.5;
    
    // Floating effect for star players
    if (avatar.tier === 'star') {
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.1;
    }
  });
  
  useEffect(() => {
    // Apply customizations
    if (avatar.customizations) {
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Apply jersey color
          if (avatar.customizations?.jerseyColor && child.name.includes('jersey')) {
            const material = child.material as THREE.MeshStandardMaterial;
            material.color.set(avatar.customizations.jerseyColor);
          }
        }
      });
    }
  }, [scene, avatar.customizations]);
  
  return (
    <Float
      speed={avatar.tier === 'star' ? 1.5 : 0.5}
      rotationIntensity={avatar.tier === 'star' ? 0.5 : 0.2}
      floatIntensity={avatar.tier === 'star' ? 0.3 : 0.1}
    >
      <primitive 
        ref={meshRef} 
        object={scene} 
        scale={avatar.tier === 'star' ? 1.2 : 1}
      />
    </Float>
  );
}

// Loading fallback
function LoadingAvatar({ tier }: { tier: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime;
    }
  });
  
  const color = tier === 'star' ? '#FFD700' : tier === 'starter' ? '#C0C0C0' : '#CD7F32';
  
  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 2, 0.5]} />
      <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
    </mesh>
  );
}

export function Avatar3D({ 
  playerId, 
  size = 200,
  quality = 'high',
  showStats = false,
  animate = true,
  onPress 
}: Avatar3DProps) {
  const avatar = useAvatarStore(state => state.avatars.get(playerId));
  const isLoading = useAvatarStore(state => state.loadingAvatars.has(playerId));
  const loadAvatar = useAvatarStore(state => state.loadAvatar);
  const setQuality = useAvatarStore(state => state.setQuality);
  const subscriptionTier = useUserStore(state => state.user?.subscription.tier || 'free');
  
  useEffect(() => {
    // Don't load avatars for free tier
    if (subscriptionTier === 'free') return;
    
    // Set quality based on subscription and device capabilities
    const effectiveQuality = getEffectiveQuality(quality, subscriptionTier);
    setQuality(effectiveQuality);
    
    // Load avatar if not already loaded
    if (!avatar && !isLoading) {
      loadAvatar(playerId);
    }
  }, [playerId, avatar, isLoading, loadAvatar, setQuality, quality, subscriptionTier]);
  
  if (subscriptionTier === 'free') {
    return <View style={[styles.container, { width: size, height: size }]} />;
  }
  
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Canvas
        style={styles.canvas}
        camera={{ position: [0, 1, 5], fov: 50 }}
        gl={{ 
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance'
        }}
        onCreated={({ gl }) => {
          // 2025: Optimize WebGL context for mobile
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.2;
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
        
        {/* Environment lighting for better visuals */}
        <Environment preset="sunset" />
        
        <Suspense fallback={<LoadingAvatar tier={avatar?.tier || 'bench'} />}>
          {avatar && (
            <AvatarModel avatar={avatar} animate={animate} />
          )}
        </Suspense>
        
        {/* Only allow orbit controls for higher tiers */}
        {(subscriptionTier === 'pro' || subscriptionTier === 'elite') && (
          <OrbitControls 
            enablePan={false}
            enableZoom={subscriptionTier === 'elite'}
            minDistance={3}
            maxDistance={10}
          />
        )}
      </Canvas>
      
      {showStats && avatar && (
        <View style={styles.statsOverlay}>
          {/* Stats overlay implementation */}
        </View>
      )}
    </View>
  );
}

// Helper function to determine effective quality based on subscription
function getEffectiveQuality(
  requested: string, 
  subscription: string
): 'low' | 'medium' | 'high' | 'ultra' {
  const qualityMap = {
    free: 'low',
    basic: requested === 'ultra' ? 'high' : requested,
    pro: requested,
    elite: requested
  };
  
  return qualityMap[subscription as keyof typeof qualityMap] as any || 'medium';
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderRadius: 12,
  },
  canvas: {
    flex: 1,
  },
  statsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
  },
});
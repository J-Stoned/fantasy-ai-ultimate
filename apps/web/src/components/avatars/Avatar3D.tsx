'use client';

import React, { Suspense, useRef, useEffect } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment, Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useAvatarStore } from '@/lib/stores/avatar-store';
import { useUserStore } from '@/lib/stores/user-store';

// Mock types for build compatibility
interface PlayerAvatarProfile {
  id: string;
  tier: string;
  colors: string[];
}
import { motion } from 'framer-motion';

// 2025 Best Practice: Web-optimized 3D avatar component
interface Avatar3DProps {
  playerId: string;
  size?: number;
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  showStats?: boolean;
  animate?: boolean;
  onClick?: () => void;
  className?: string;
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
  
  // 2025: Optimized animation loop with performance monitoring
  useFrame((state, delta) => {
    if (!meshRef.current || !animate) return;
    
    // Cap delta to prevent large jumps
    const cappedDelta = Math.min(delta, 0.1);
    
    // Idle animation
    meshRef.current.rotation.y += cappedDelta * 0.5;
    
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
      
      {/* HTML overlay for stats */}
      {avatar.tier === 'star' && (
        <Html
          position={[0, 2, 0]}
          center
          distanceFactor={8}
          style={{
            transition: 'opacity 0.3s',
            pointerEvents: 'none',
          }}
        >
          <div className="bg-black/80 text-white px-2 py-1 rounded-md text-xs">
            ⭐ {avatar.rating} Rating
          </div>
        </Html>
      )}
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
  onClick,
  className = ''
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
    return (
      <div 
        className={`bg-gray-200 rounded-lg ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  
  return (
    <motion.div
      className={`relative overflow-hidden rounded-lg bg-gray-900 ${className}`}
      style={{ width: size, height: size }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
    >
      <Canvas
        camera={{ position: [0, 1, 5], fov: 50 }}
        gl={{ 
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          // 2025: Enable WebGPU if available
          // @ts-ignore
          backend: 'webgpu'
        }}
        onCreated={({ gl }) => {
          // 2025: Optimize WebGL/WebGPU context
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.2;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
        dpr={[1, 2]} // Pixel ratio optimization
        performance={{ min: 0.5 }} // Performance monitoring
      >
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[5, 5, 5]} 
          intensity={1} 
          castShadow 
          shadow-mapSize={[2048, 2048]}
        />
        
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
            dampingFactor={0.05}
            autoRotate={animate && avatar?.tier === 'star'}
            autoRotateSpeed={1}
          />
        )}
      </Canvas>
      
      {showStats && avatar && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm p-2">
          <div className="flex justify-between items-center">
            <span className="text-white text-sm font-semibold">
              {avatar.playerName}
            </span>
            <span className={`text-sm font-bold ${
              avatar.tier === 'star' ? 'text-yellow-400' :
              avatar.tier === 'starter' ? 'text-gray-300' :
              'text-orange-400'
            }`}>
              {avatar.rating}
            </span>
          </div>
          <div className="text-xs text-gray-300 mt-1">
            {avatar.position} • {avatar.team}
          </div>
        </div>
      )}
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
        </div>
      )}
    </motion.div>
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
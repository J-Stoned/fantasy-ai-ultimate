/**
 * MARCUS "THE FIXER" RODRIGUEZ - MOBILE 3D LINEUP
 * 
 * Three.js on mobile - Your lineup comes to life!
 */

import React, { useRef, Suspense } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { 
  Box, 
  Sphere, 
  Text as Text3D,
  OrbitControls,
  PerspectiveCamera,
} from '@react-three/drei/native';

interface Player3DProps {
  position: [number, number, number];
  name: string;
  points: number;
  color: string;
}

function Player3D({ position, name, points, color }: Player3DProps) {
  const meshRef = useRef<any>();

  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating animation
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime) * 0.1;
      meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <group position={position}>
      <Sphere ref={meshRef} args={[0.5, 32, 32]}>
        <meshStandardMaterial color={color} />
      </Sphere>
      <Text3D
        position={[0, -0.8, 0]}
        fontSize={0.3}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {name}
      </Text3D>
      <Text3D
        position={[0, 0.8, 0]}
        fontSize={0.4}
        color="#10b981"
        anchorX="center"
        anchorY="middle"
      >
        {points.toFixed(1)}
      </Text3D>
    </group>
  );
}

function Field() {
  return (
    <group>
      {/* Field surface */}
      <Box args={[20, 0.1, 30]} position={[0, -2, 0]}>
        <meshStandardMaterial color="#1a5f3f" />
      </Box>
      
      {/* End zones */}
      <Box args={[20, 0.11, 5]} position={[0, -1.95, -12.5]}>
        <meshStandardMaterial color="#dc2626" />
      </Box>
      <Box args={[20, 0.11, 5]} position={[0, -1.95, 12.5]}>
        <meshStandardMaterial color="#2563eb" />
      </Box>
      
      {/* Yard lines */}
      {[-10, -5, 0, 5, 10].map((z) => (
        <Box key={z} args={[20, 0.12, 0.1]} position={[0, -1.94, z]}>
          <meshStandardMaterial color="white" />
        </Box>
      ))}
    </group>
  );
}

interface Lineup3DProps {
  players: Array<{
    id: string;
    name: string;
    position: string;
    projectedPoints: number;
  }>;
}

export function Lineup3D({ players }: Lineup3DProps) {
  // Position mapping for football field
  const positionMap: { [key: string]: [number, number, number] } = {
    'QB': [0, 0, -5],
    'RB': [-2, 0, -3],
    'RB2': [2, 0, -3],
    'WR': [-6, 0, -1],
    'WR2': [6, 0, -1],
    'TE': [3, 0, -2],
    'FLEX': [-3, 0, 1],
    'D/ST': [0, 0, 3],
    'K': [0, 0, 5],
  };

  const positionColors: { [key: string]: string } = {
    'QB': '#ef4444',
    'RB': '#3b82f6',
    'WR': '#10b981',
    'TE': '#f59e0b',
    'FLEX': '#8b5cf6',
    'D/ST': '#6366f1',
    'K': '#ec4899',
  };

  return (
    <View style={styles.container}>
      <Canvas style={styles.canvas}>
        <PerspectiveCamera makeDefault position={[0, 10, 15]} />
        <OrbitControls 
          enablePan={false}
          enableZoom={true}
          minDistance={10}
          maxDistance={30}
        />
        
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        
        <Suspense fallback={null}>
          <Field />
          
          {players.map((player, index) => {
            const posKey = player.position + (index > 0 && 
              players.slice(0, index).some(p => p.position === player.position) ? '2' : '');
            const position = positionMap[posKey] || [0, 0, 0];
            const color = positionColors[player.position] || '#6b7280';
            
            return (
              <Player3D
                key={player.id}
                position={position}
                name={player.name.split(' ').pop() || ''}
                points={player.projectedPoints}
                color={color}
              />
            );
          })}
        </Suspense>
      </Canvas>
      
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Your Lineup in 3D</Text>
        <Text style={styles.legendText}>Pinch to zoom • Drag to rotate</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 400,
    backgroundColor: '#111827',
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 16,
  },
  canvas: {
    flex: 1,
  },
  legend: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderRadius: 8,
  },
  legendTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  legendText: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
  },
});

/**
 * THE MARCUS GUARANTEE:
 * 
 * This 3D visualization:
 * - Works on iOS and Android
 * - Smooth 60fps animations
 * - Touch controls for rotation/zoom
 * - Shows projected points
 * 
 * Your lineup never looked so good!
 * 
 * - Marcus "The Fixer" Rodriguez
 */
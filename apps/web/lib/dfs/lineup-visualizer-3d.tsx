/**
 * 3D DFS LINEUP VISUALIZER
 * Watch your lineup come to life in a virtual stadium!
 * GPU-accelerated for buttery smooth performance
 * 
 * By Marcus "The Fixer" Rodriguez
 */

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  Text, 
  Billboard, 
  Environment,
  PerspectiveCamera,
  Float,
  Trail,
  MeshDistortMaterial,
  useTexture,
  Effects
} from '@react-three/drei';
import { 
  EffectComposer, 
  Bloom, 
  ChromaticAberration,
  Vignette 
} from '@react-three/postprocessing';
import * as THREE from 'three';
import { DFSPlayer, DFSLineup } from './gpu-lineup-optimizer';

interface LineupVisualizerProps {
  lineup: DFSLineup;
  isLive?: boolean;
  showProjections?: boolean;
  showOwnership?: boolean;
  animateEntry?: boolean;
  onPlayerClick?: (player: DFSPlayer) => void;
}

/**
 * Main 3D Lineup Visualizer Component
 */
export const LineupVisualizer3D: React.FC<LineupVisualizerProps> = ({
  lineup,
  isLive = false,
  showProjections = true,
  showOwnership = true,
  animateEntry = true,
  onPlayerClick
}) => {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>([0, 15, 20]);
  
  return (
    <div className="w-full h-full min-h-[600px] relative">
      <Canvas
        shadows
        gl={{ 
          antialias: true,
          alpha: true,
          powerPreference: "high-performance"
        }}
      >
        <PerspectiveCamera makeDefault position={cameraPosition} fov={60} />
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={10}
          maxDistance={50}
        />
        
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 20, 5]}
          intensity={1}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <pointLight position={[-10, 10, -10]} intensity={0.5} color="#4a90e2" />
        
        {/* Environment */}
        <Environment preset="stadium" />
        <fog attach="fog" args={['#000000', 20, 60]} />
        
        {/* Stadium Field */}
        <StadiumField />
        
        {/* Players */}
        <PlayerFormation
          lineup={lineup}
          selectedPlayer={selectedPlayer}
          onPlayerClick={(player) => {
            setSelectedPlayer(player.id);
            onPlayerClick?.(player);
          }}
          animateEntry={animateEntry}
          showProjections={showProjections}
          showOwnership={showOwnership}
          isLive={isLive}
        />
        
        {/* Effects */}
        <EffectComposer>
          <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} />
          <ChromaticAberration offset={[0.001, 0.001]} />
          <Vignette eskil={false} offset={0.1} darkness={0.4} />
        </EffectComposer>
      </Canvas>
      
      {/* UI Overlay */}
      <LineupStats lineup={lineup} className="absolute top-4 left-4" />
      {selectedPlayer && (
        <PlayerDetails 
          player={lineup.players.find(p => p.id === selectedPlayer)!}
          onClose={() => setSelectedPlayer(null)}
          className="absolute bottom-4 right-4"
        />
      )}
    </div>
  );
};

/**
 * Stadium Field Component
 */
const StadiumField: React.FC = () => {
  const texture = useTexture('/textures/field.jpg');
  
  return (
    <group>
      {/* Field */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 60]} />
        <meshStandardMaterial 
          map={texture}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>
      
      {/* Field Lines */}
      <FieldLines />
      
      {/* End Zones */}
      <mesh position={[0, 0.01, -25]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 10]} />
        <meshStandardMaterial color="#1a1a1a" opacity={0.8} transparent />
      </mesh>
      <mesh position={[0, 0.01, 25]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 10]} />
        <meshStandardMaterial color="#1a1a1a" opacity={0.8} transparent />
      </mesh>
    </group>
  );
};

/**
 * Field Lines Component
 */
const FieldLines: React.FC = () => {
  const lines = useMemo(() => {
    const linePositions: number[] = [];
    // Yard lines every 5 yards
    for (let i = -20; i <= 20; i += 5) {
      linePositions.push(i);
    }
    return linePositions;
  }, []);
  
  return (
    <group>
      {lines.map((pos) => (
        <mesh key={pos} position={[0, 0.02, pos]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[40, 0.2]} />
          <meshBasicMaterial color="white" />
        </mesh>
      ))}
    </group>
  );
};

/**
 * Player Formation Component
 */
const PlayerFormation: React.FC<{
  lineup: DFSLineup;
  selectedPlayer: string | null;
  onPlayerClick: (player: DFSPlayer) => void;
  animateEntry: boolean;
  showProjections: boolean;
  showOwnership: boolean;
  isLive: boolean;
}> = ({ lineup, selectedPlayer, onPlayerClick, animateEntry, showProjections, showOwnership, isLive }) => {
  // Position players by position
  const positions = useMemo(() => {
    const posMap = new Map<string, [number, number, number][]>();
    
    // Offensive formation
    posMap.set('QB', [[0, 2, -5]]);
    posMap.set('RB', [[-3, 2, -3], [3, 2, -3]]);
    posMap.set('WR', [[-15, 2, 0], [-10, 2, 2], [10, 2, 2], [15, 2, 0]]);
    posMap.set('TE', [[-5, 2, 0], [5, 2, 0]]);
    posMap.set('DST', [[0, 2, 15]]);
    
    return posMap;
  }, []);
  
  const getPlayerPosition = (player: DFSPlayer, index: number): [number, number, number] => {
    const positionSpots = positions.get(player.position) || [[0, 2, 0]];
    const spotIndex = lineup.players.filter(p => p.position === player.position).indexOf(player);
    return positionSpots[spotIndex % positionSpots.length] || [index * 3 - 12, 2, 0];
  };
  
  return (
    <group>
      {lineup.players.map((player, index) => (
        <Player3D
          key={player.id}
          player={player}
          position={getPlayerPosition(player, index)}
          isSelected={selectedPlayer === player.id}
          onClick={() => onPlayerClick(player)}
          animateEntry={animateEntry}
          entryDelay={index * 0.2}
          showProjection={showProjections}
          showOwnership={showOwnership}
          isLive={isLive}
          isStacked={lineup.players.filter(p => p.team === player.team).length >= 3}
        />
      ))}
      
      {/* Draw correlation lines between stacked players */}
      <CorrelationLines lineup={lineup} />
    </group>
  );
};

/**
 * Individual 3D Player Component
 */
const Player3D: React.FC<{
  player: DFSPlayer;
  position: [number, number, number];
  isSelected: boolean;
  onClick: () => void;
  animateEntry: boolean;
  entryDelay: number;
  showProjection: boolean;
  showOwnership: boolean;
  isLive: boolean;
  isStacked: boolean;
}> = ({ 
  player, 
  position, 
  isSelected, 
  onClick, 
  animateEntry, 
  entryDelay,
  showProjection,
  showOwnership,
  isLive,
  isStacked
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [currentPoints, setCurrentPoints] = useState(0);
  
  // Animate entry
  useEffect(() => {
    if (animateEntry && meshRef.current) {
      meshRef.current.position.y = 20;
      meshRef.current.scale.set(0, 0, 0);
    }
  }, [animateEntry]);
  
  // Animation loop
  useFrame((state) => {
    if (!meshRef.current) return;
    
    // Entry animation
    if (animateEntry) {
      const targetY = position[1];
      meshRef.current.position.y = THREE.MathUtils.lerp(
        meshRef.current.position.y,
        targetY,
        0.05
      );
      
      const targetScale = 1;
      meshRef.current.scale.x = THREE.MathUtils.lerp(
        meshRef.current.scale.x,
        targetScale,
        0.05
      );
      meshRef.current.scale.y = meshRef.current.scale.x;
      meshRef.current.scale.z = meshRef.current.scale.x;
    }
    
    // Hover effect
    if (hovered || isSelected) {
      meshRef.current.rotation.y += 0.02;
    }
    
    // Live scoring animation
    if (isLive && currentPoints < player.projectedPoints) {
      setCurrentPoints(prev => Math.min(prev + 0.5, player.projectedPoints));
    }
  });
  
  // Player color based on performance
  const getPlayerColor = () => {
    if (isLive) {
      const performance = currentPoints / player.projectedPoints;
      if (performance > 1.2) return '#00ff00'; // Exceeding projections
      if (performance > 0.8) return '#4a90e2'; // On track
      return '#ff4444'; // Underperforming
    }
    
    if (isStacked) return '#ffd700'; // Gold for stacked players
    if (player.ownership < 10) return '#00ffff'; // Cyan for contrarian
    return '#4a90e2'; // Default blue
  };
  
  return (
    <group position={position}>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        {/* Player Model */}
        <Trail
          width={isSelected ? 2 : 0}
          length={10}
          color={getPlayerColor()}
          attenuation={(t) => t * t}
        >
          <mesh
            ref={meshRef}
            onClick={onClick}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            castShadow
          >
            <capsuleGeometry args={[0.5, 1.5, 4, 8]} />
            <MeshDistortMaterial
              color={getPlayerColor()}
              emissive={getPlayerColor()}
              emissiveIntensity={isSelected ? 0.5 : 0.2}
              metalness={0.8}
              roughness={0.2}
              distort={hovered ? 0.4 : 0.1}
              speed={2}
            />
          </mesh>
        </Trail>
        
        {/* Player Info */}
        <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
          <Text
            position={[0, 2.5, 0]}
            fontSize={0.5}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.05}
            outlineColor="black"
          >
            {player.name}
          </Text>
          
          {showProjection && (
            <Text
              position={[0, 2, 0]}
              fontSize={0.4}
              color="#00ff00"
              anchorX="center"
              anchorY="middle"
            >
              {isLive ? currentPoints.toFixed(1) : player.projectedPoints.toFixed(1)} pts
            </Text>
          )}
          
          {showOwnership && (
            <Text
              position={[0, 1.5, 0]}
              fontSize={0.3}
              color={player.ownership < 10 ? '#00ffff' : '#ffffff'}
              anchorX="center"
              anchorY="middle"
            >
              {player.ownership.toFixed(1)}% owned
            </Text>
          )}
          
          <Text
            position={[0, -1.5, 0]}
            fontSize={0.3}
            color="#ffd700"
            anchorX="center"
            anchorY="middle"
          >
            ${player.salary.toLocaleString()}
          </Text>
        </Billboard>
      </Float>
    </group>
  );
};

/**
 * Correlation Lines Component
 */
const CorrelationLines: React.FC<{ lineup: DFSLineup }> = ({ lineup }) => {
  const lines = useMemo(() => {
    const connections: Array<[DFSPlayer, DFSPlayer]> = [];
    
    // Find stacked players
    const teamGroups = new Map<string, DFSPlayer[]>();
    lineup.players.forEach(player => {
      if (!teamGroups.has(player.team)) {
        teamGroups.set(player.team, []);
      }
      teamGroups.get(player.team)!.push(player);
    });
    
    // Create connections for stacks
    teamGroups.forEach(players => {
      if (players.length >= 2) {
        for (let i = 0; i < players.length - 1; i++) {
          connections.push([players[i], players[i + 1]]);
        }
      }
    });
    
    return connections;
  }, [lineup]);
  
  return (
    <group>
      {lines.map(([p1, p2], index) => (
        <CorrelationLine key={index} player1={p1} player2={p2} />
      ))}
    </group>
  );
};

/**
 * Individual Correlation Line
 */
const CorrelationLine: React.FC<{ player1: DFSPlayer; player2: DFSPlayer }> = ({ player1, player2 }) => {
  const ref = useRef<THREE.Line>(null);
  
  useFrame(() => {
    if (ref.current) {
      ref.current.material.opacity = 0.3 + Math.sin(Date.now() * 0.001) * 0.2;
    }
  });
  
  return (
    <line ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={2}
          array={new Float32Array([0, 2, -5, 0, 2, 5])}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#ffd700" transparent opacity={0.5} />
    </line>
  );
};

/**
 * Lineup Stats Overlay
 */
const LineupStats: React.FC<{ lineup: DFSLineup; className?: string }> = ({ lineup, className }) => {
  return (
    <div className={`bg-black/80 backdrop-blur-md rounded-lg p-4 text-white ${className}`}>
      <h3 className="text-lg font-bold mb-2">Lineup Stats</h3>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Projected:</span>
          <span className="text-green-400">{lineup.projectedPoints.toFixed(1)} pts</span>
        </div>
        <div className="flex justify-between">
          <span>Salary Used:</span>
          <span>${lineup.totalSalary.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Avg Ownership:</span>
          <span className={lineup.ownership < 15 ? 'text-cyan-400' : 'text-white'}>
            {lineup.ownership.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span>Stack:</span>
          <span className="text-yellow-400">
            {lineup.stackInfo.primaryStack} ({lineup.stackInfo.stackSize})
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Player Details Panel
 */
const PlayerDetails: React.FC<{ 
  player: DFSPlayer; 
  onClose: () => void;
  className?: string;
}> = ({ player, onClose, className }) => {
  return (
    <div className={`bg-black/80 backdrop-blur-md rounded-lg p-4 text-white max-w-sm ${className}`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-bold">{player.name}</h3>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-gray-400">Position:</span>
          <span className="ml-2">{player.position}</span>
        </div>
        <div>
          <span className="text-gray-400">Team:</span>
          <span className="ml-2">{player.team}</span>
        </div>
        <div>
          <span className="text-gray-400">Opponent:</span>
          <span className="ml-2">vs {player.opponent}</span>
        </div>
        <div>
          <span className="text-gray-400">Salary:</span>
          <span className="ml-2">${player.salary.toLocaleString()}</span>
        </div>
        <div className="col-span-2">
          <span className="text-gray-400">Projection:</span>
          <span className="ml-2 text-green-400">{player.projectedPoints.toFixed(1)} pts</span>
        </div>
        <div>
          <span className="text-gray-400">Floor:</span>
          <span className="ml-2">{player.floor.toFixed(1)}</span>
        </div>
        <div>
          <span className="text-gray-400">Ceiling:</span>
          <span className="ml-2 text-yellow-400">{player.ceiling.toFixed(1)}</span>
        </div>
        <div className="col-span-2">
          <span className="text-gray-400">Ownership:</span>
          <span className={`ml-2 ${player.ownership < 10 ? 'text-cyan-400' : 'text-white'}`}>
            {player.ownership.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
};
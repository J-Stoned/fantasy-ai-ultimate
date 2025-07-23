'use client';

import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Box, Sphere, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Eye, 
  EyeOff, 
  Maximize2, 
  Filter,
  TrendingUp,
  TrendingDown,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PortfolioNode {
  id: string;
  name: string;
  value: number;
  sport: string;
  risk: number;
  correlation: number[];
  position: [number, number, number];
  color: string;
  change: number;
}

interface ConnectionLine {
  start: [number, number, number];
  end: [number, number, number];
  strength: number;
}

const SPORT_COLORS: Record<string, string> = {
  NFL: '#013369',
  NBA: '#C8102E',
  MLB: '#003831',
  NHL: '#041E42',
  PGA: '#00205B',
  UFC: '#D20A0A'
};

// Interactive 3D Sphere Component
const PortfolioSphere: React.FC<{
  node: PortfolioNode;
  isSelected: boolean;
  onClick: () => void;
}> = ({ node, isSelected, onClick }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.1;
      if (hovered || isSelected) {
        meshRef.current.scale.setScalar(1.2);
      } else {
        meshRef.current.scale.setScalar(1);
      }
    }
  });

  const radius = Math.sqrt(node.value / 1000) * 0.5;

  return (
    <group position={node.position}>
      <Sphere
        ref={meshRef}
        args={[radius, 32, 32]}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={hovered || isSelected ? 0.5 : 0.2}
          metalness={0.8}
          roughness={0.2}
        />
      </Sphere>
      
      {(hovered || isSelected) && (
        <Html distanceFactor={10}>
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 min-w-[200px] pointer-events-none">
            <h4 className="font-bold text-white">{node.name}</h4>
            <div className="text-sm text-gray-300 space-y-1">
              <div>Value: ${node.value.toLocaleString()}</div>
              <div className={cn(
                "font-medium",
                node.change > 0 ? "text-green-500" : "text-red-500"
              )}>
                {node.change > 0 ? '+' : ''}{node.change.toFixed(1)}%
              </div>
              <div>Risk: {node.risk}/10</div>
            </div>
          </div>
        </Html>
      )}
      
      <Text
        position={[0, radius + 0.3, 0]}
        fontSize={0.2}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {node.sport}
      </Text>
    </group>
  );
};

// 3D Scene Component
const Portfolio3DScene: React.FC<{
  nodes: PortfolioNode[];
  connections: ConnectionLine[];
  selectedNode: PortfolioNode | null;
  onNodeClick: (node: PortfolioNode) => void;
}> = ({ nodes, connections, selectedNode, onNodeClick }) => {
  const { camera } = useThree();

  React.useEffect(() => {
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />
      
      {/* Grid */}
      <gridHelper args={[10, 10, '#374151', '#1f2937']} />
      
      {/* Connections */}
      {connections.map((connection, index) => (
        <Line
          key={index}
          points={[connection.start, connection.end]}
          color={connection.strength > 0.7 ? '#ef4444' : connection.strength > 0.4 ? '#f59e0b' : '#6b7280'}
          lineWidth={connection.strength * 3}
          opacity={0.6}
        />
      ))}
      
      {/* Portfolio Nodes */}
      {nodes.map((node) => (
        <PortfolioSphere
          key={node.id}
          node={node}
          isSelected={selectedNode?.id === node.id}
          onClick={() => onNodeClick(node)}
        />
      ))}
      
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        zoomSpeed={0.5}
        rotateSpeed={0.5}
      />
    </>
  );
};

export const Portfolio3DVisualizer: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<PortfolioNode | null>(null);
  const [showConnections, setShowConnections] = useState(true);
  const [viewMode, setViewMode] = useState<'3d' | 'network' | 'bubble'>('3d');

  // Generate portfolio nodes with positions
  const portfolioNodes: PortfolioNode[] = useMemo(() => [
    {
      id: '1',
      name: 'NFL GPP Portfolio',
      value: 4250,
      sport: 'NFL',
      risk: 7,
      correlation: [0, 0.6, 0.3, 0.2, 0.1, 0.4],
      position: [0, 0, 0],
      color: SPORT_COLORS.NFL,
      change: 8.3
    },
    {
      id: '2',
      name: 'NBA Cash Games',
      value: 3100,
      sport: 'NBA',
      risk: 3,
      correlation: [0.6, 0, 0.2, 0.5, 0.1, 0.3],
      position: [3, 1, -2],
      color: SPORT_COLORS.NBA,
      change: -3.9
    },
    {
      id: '3',
      name: 'MLB Tournaments',
      value: 2800,
      sport: 'MLB',
      risk: 8,
      correlation: [0.3, 0.2, 0, 0.1, 0.4, 0.2],
      position: [-2, 0.5, 3],
      color: SPORT_COLORS.MLB,
      change: 19.1
    },
    {
      id: '4',
      name: 'NHL 50/50s',
      value: 1950,
      sport: 'NHL',
      risk: 4,
      correlation: [0.2, 0.5, 0.1, 0, 0.3, 0.6],
      position: [2, -1, 2],
      color: SPORT_COLORS.NHL,
      change: 4.0
    },
    {
      id: '5',
      name: 'PGA Majors',
      value: 1650,
      sport: 'PGA',
      risk: 9,
      correlation: [0.1, 0.1, 0.4, 0.3, 0, 0.2],
      position: [-3, 1.5, -1],
      color: SPORT_COLORS.PGA,
      change: -2.9
    },
    {
      id: '6',
      name: 'UFC Events',
      value: 1200,
      sport: 'UFC',
      risk: 10,
      correlation: [0.4, 0.3, 0.2, 0.6, 0.2, 0],
      position: [0, -1.5, -3],
      color: SPORT_COLORS.UFC,
      change: 17.6
    }
  ], []);

  // Generate connections based on correlations
  const connections: ConnectionLine[] = useMemo(() => {
    const lines: ConnectionLine[] = [];
    
    portfolioNodes.forEach((node, i) => {
      node.correlation.forEach((strength, j) => {
        if (i < j && strength > 0.3) {
          lines.push({
            start: node.position,
            end: portfolioNodes[j].position,
            strength
          });
        }
      });
    });
    
    return lines;
  }, [portfolioNodes]);

  const totalValue = portfolioNodes.reduce((sum, node) => sum + node.value, 0);
  const avgRisk = portfolioNodes.reduce((sum, node) => sum + node.risk, 0) / portfolioNodes.length;
  const totalChange = portfolioNodes.reduce((sum, node) => sum + (node.value * node.change / 100), 0);
  const changePercent = (totalChange / (totalValue - totalChange)) * 100;

  return (
    <Card className="bg-gray-900 border-gray-800 p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold">3D Portfolio Visualization</h2>
          <p className="text-gray-400">Interactive portfolio correlation network</p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConnections(!showConnections)}
          >
            {showConnections ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === '3d' ? 'network' : '3d')}
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold">${totalValue.toLocaleString()}</div>
          <div className="text-sm text-gray-400">Total Value</div>
        </div>
        <div className="text-center">
          <div className={cn(
            "text-2xl font-bold",
            changePercent > 0 ? "text-green-500" : "text-red-500"
          )}>
            {changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-400">Total Change</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{avgRisk.toFixed(1)}/10</div>
          <div className="text-sm text-gray-400">Avg Risk</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{portfolioNodes.length}</div>
          <div className="text-sm text-gray-400">Positions</div>
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="relative h-[500px] bg-gray-950 rounded-lg overflow-hidden">
        <Canvas camera={{ position: [5, 5, 5], fov: 60 }}>
          <Portfolio3DScene
            nodes={portfolioNodes}
            connections={showConnections ? connections : []}
            selectedNode={selectedNode}
            onNodeClick={setSelectedNode}
          />
        </Canvas>
        
        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-gray-900/90 rounded-lg p-3 space-y-2">
          <h4 className="text-sm font-bold mb-2">Sports</h4>
          {Object.entries(SPORT_COLORS).map(([sport, color]) => (
            <div key={sport} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs">{sport}</span>
            </div>
          ))}
        </div>

        {/* Selected Node Details */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute top-4 right-4 bg-gray-900/90 rounded-lg p-4 w-64"
            >
              <h3 className="font-bold text-lg mb-2">{selectedNode.name}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Value:</span>
                  <span className="font-bold">${selectedNode.value.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Change:</span>
                  <span className={cn(
                    "font-bold",
                    selectedNode.change > 0 ? "text-green-500" : "text-red-500"
                  )}>
                    {selectedNode.change > 0 ? '+' : ''}{selectedNode.change}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Risk Level:</span>
                  <Badge className={cn(
                    selectedNode.risk >= 8 ? "bg-red-500/20 text-red-500" :
                    selectedNode.risk >= 5 ? "bg-yellow-500/20 text-yellow-500" :
                    "bg-green-500/20 text-green-500"
                  )}>
                    {selectedNode.risk}/10
                  </Badge>
                </div>
                <div className="pt-2 border-t border-gray-700">
                  <p className="text-xs text-gray-400">
                    Click anywhere to deselect
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Correlation Warning */}
      {connections.some(c => c.strength > 0.7) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-3"
        >
          <Activity className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <div>
            <p className="font-semibold">High Correlation Detected</p>
            <p className="text-sm text-gray-400">
              Some positions show strong correlation. Consider diversifying to reduce risk.
            </p>
          </div>
        </motion.div>
      )}
    </Card>
  );
};

export default Portfolio3DVisualizer;
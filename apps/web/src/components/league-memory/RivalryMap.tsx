'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Swords, Heart, Ban, TrendingUp } from 'lucide-react';

interface Manager {
  id: string;
  name: string;
  x?: number;
  y?: number;
}

interface Relationship {
  source: string;
  target: string;
  type: 'rivalry' | 'alliance' | 'neutral' | 'avoided';
  strength: number;
  trades: number;
}

interface RivalryMapProps {
  managers: Manager[];
  relationships: Relationship[];
}

export default function RivalryMap({ managers, relationships }: RivalryMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mock data for demo
  const mockManagers: Manager[] = [
    { id: '1', name: 'Dynasty Dominators', x: 200, y: 150 },
    { id: '2', name: 'Trade Sharks', x: 400, y: 100 },
    { id: '3', name: 'Analytics Army', x: 500, y: 250 },
    { id: '4', name: 'Steady Eddies', x: 150, y: 300 },
    { id: '5', name: 'Waiver Warriors', x: 350, y: 350 },
    { id: '6', name: 'Rookie Hunters', x: 450, y: 400 }
  ];

  const mockRelationships: Relationship[] = [
    { source: '1', target: '2', type: 'rivalry', strength: 90, trades: 0 },
    { source: '2', target: '3', type: 'avoided', strength: 85, trades: 0 },
    { source: '1', target: '5', type: 'alliance', strength: 75, trades: 12 },
    { source: '3', target: '4', type: 'neutral', strength: 40, trades: 3 },
    { source: '4', target: '6', type: 'alliance', strength: 60, trades: 8 },
    { source: '5', target: '6', type: 'neutral', strength: 45, trades: 5 }
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 650;
    canvas.height = 500;

    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw relationships
    mockRelationships.forEach(rel => {
      const source = mockManagers.find(m => m.id === rel.source);
      const target = mockManagers.find(m => m.id === rel.target);
      
      if (!source || !target || !source.x || !source.y || !target.x || !target.y) return;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);

      // Set line style based on relationship type
      switch (rel.type) {
        case 'rivalry':
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = Math.max(2, rel.strength / 25);
          break;
        case 'alliance':
          ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
          ctx.setLineDash([]);
          ctx.lineWidth = Math.max(2, rel.strength / 25);
          break;
        case 'avoided':
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
          ctx.setLineDash([10, 10]);
          ctx.lineWidth = 2;
          break;
        default:
          ctx.strokeStyle = 'rgba(156, 163, 175, 0.4)';
          ctx.setLineDash([]);
          ctx.lineWidth = 1;
      }

      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Draw managers
    mockManagers.forEach(manager => {
      if (!manager.x || !manager.y) return;

      // Draw circle
      ctx.beginPath();
      ctx.arc(manager.x, manager.y, 30, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(147, 51, 234, 0.8)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw name
      ctx.fillStyle = 'white';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Split long names
      const words = manager.name.split(' ');
      if (words.length > 1) {
        ctx.fillText(words[0], manager.x, manager.y - 6);
        ctx.fillText(words[1], manager.x, manager.y + 6);
      } else {
        ctx.fillText(manager.name, manager.x, manager.y);
      }
    });
  }, [managers, relationships]);

  const relationshipStats = {
    rivalries: mockRelationships.filter(r => r.type === 'rivalry').length,
    alliances: mockRelationships.filter(r => r.type === 'alliance').length,
    avoided: mockRelationships.filter(r => r.type === 'avoided').length,
    totalTrades: mockRelationships.reduce((sum, r) => sum + r.trades, 0)
  };

  return (
    <Card className="bg-black/40 backdrop-blur-lg border-purple-500/30">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            League Relationship Network
          </div>
          <Badge className="bg-purple-600/30 text-purple-200">
            Social Dynamics
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Network Visualization */}
        <div className="bg-black/30 rounded-lg p-4">
          <canvas 
            ref={canvasRef}
            className="w-full h-auto"
            style={{ maxWidth: '650px', margin: '0 auto', display: 'block' }}
          />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 justify-center">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-red-500" style={{ borderTop: '2px dashed red' }} />
            <span className="text-sm text-gray-300">Rivalry</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-green-500" />
            <span className="text-sm text-gray-300">Alliance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-yellow-500" style={{ borderTop: '2px dashed yellow' }} />
            <span className="text-sm text-gray-300">Avoided</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-gray-500" />
            <span className="text-sm text-gray-300">Neutral</span>
          </div>
        </div>

        {/* Relationship Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-3 bg-red-900/30 rounded-lg">
            <Swords className="w-5 h-5 mx-auto text-red-400 mb-1" />
            <p className="text-xl font-bold text-white">{relationshipStats.rivalries}</p>
            <p className="text-xs text-gray-400">Rivalries</p>
          </div>
          <div className="text-center p-3 bg-green-900/30 rounded-lg">
            <Heart className="w-5 h-5 mx-auto text-green-400 mb-1" />
            <p className="text-xl font-bold text-white">{relationshipStats.alliances}</p>
            <p className="text-xs text-gray-400">Alliances</p>
          </div>
          <div className="text-center p-3 bg-yellow-900/30 rounded-lg">
            <Ban className="w-5 h-5 mx-auto text-yellow-400 mb-1" />
            <p className="text-xl font-bold text-white">{relationshipStats.avoided}</p>
            <p className="text-xs text-gray-400">Avoided</p>
          </div>
          <div className="text-center p-3 bg-purple-900/30 rounded-lg">
            <TrendingUp className="w-5 h-5 mx-auto text-purple-400 mb-1" />
            <p className="text-xl font-bold text-white">{relationshipStats.totalTrades}</p>
            <p className="text-xs text-gray-400">Total Trades</p>
          </div>
        </div>

        {/* Key Insights */}
        <div className="bg-purple-900/20 p-4 rounded-lg">
          <h4 className="text-sm font-semibold text-purple-300 mb-2">Network Insights</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Dynasty Dominators and Trade Sharks have the strongest rivalry (0 trades in 2 years)</li>
            <li>• Steady Eddies acts as a neutral broker between rival factions</li>
            <li>• Alliance between Dynasty Dominators and Waiver Warriors dominates trades</li>
            <li>• Analytics Army operates independently, avoiding Trade Sharks completely</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
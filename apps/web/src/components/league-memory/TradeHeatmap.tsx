'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Flame, TrendingUp, Users, Calendar } from 'lucide-react';

interface TradeData {
  fromManager: string;
  toManager: string;
  count: number;
  lastTrade: string;
  avgValue: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

interface TradeHeatmapProps {
  tradeData?: TradeData[];
}

export default function TradeHeatmap({ tradeData }: TradeHeatmapProps) {
  const managers = [
    'Dynasty Dom.',
    'Trade Sharks',
    'Analytics Army',
    'Steady Eddies',
    'Waiver War.',
    'Rookie Hunt.'
  ];

  // Generate mock trade matrix
  const generateHeatmapData = () => {
    const matrix: number[][] = [];
    for (let i = 0; i < managers.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < managers.length; j++) {
        if (i === j) {
          matrix[i][j] = -1; // No self-trades
        } else {
          // Generate realistic trade counts
          const baseCount = Math.random() * 10;
          // Some manager pairs trade more
          if ((i === 0 && j === 4) || (i === 4 && j === 0)) {
            matrix[i][j] = Math.floor(baseCount * 3); // Alliance
          } else if ((i === 1 && j === 2) || (i === 2 && j === 1)) {
            matrix[i][j] = 0; // Rivalry
          } else {
            matrix[i][j] = Math.floor(baseCount);
          }
        }
      }
    }
    return matrix;
  };

  const tradeMatrix = generateHeatmapData();

  const getHeatColor = (value: number, max: number) => {
    if (value === -1) return 'bg-gray-800/50';
    if (value === 0) return 'bg-gray-700/50';
    
    const intensity = value / max;
    if (intensity > 0.8) return 'bg-red-600/80';
    if (intensity > 0.6) return 'bg-orange-600/80';
    if (intensity > 0.4) return 'bg-yellow-600/80';
    if (intensity > 0.2) return 'bg-green-600/80';
    return 'bg-blue-600/80';
  };

  const maxTrades = Math.max(...tradeMatrix.flat().filter(v => v !== -1));

  // Calculate trade statistics
  const totalTrades = tradeMatrix.flat().filter(v => v > 0).reduce((a, b) => a + b, 0) / 2;
  const activePairs = tradeMatrix.flat().filter(v => v > 0).length / 2;
  const mostActiveManager = managers.reduce((max, manager, idx) => {
    const trades = tradeMatrix[idx].filter(v => v > 0).reduce((a, b) => a + b, 0);
    return trades > max.trades ? { manager, trades } : max;
  }, { manager: '', trades: 0 });

  return (
    <Card className="bg-black/40 backdrop-blur-lg border-purple-500/30">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            Trade Activity Heatmap
          </div>
          <Badge className="bg-orange-600/30 text-orange-200">
            Live Trading Patterns
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Heatmap Grid */}
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <TooltipProvider>
              <div className="grid grid-cols-7 gap-1">
                {/* Header Row */}
                <div className="h-12" /> {/* Empty corner */}
                {managers.map((manager) => (
                  <div key={`header-${manager}`} className="h-12 flex items-center justify-center">
                    <span className="text-xs text-gray-300 -rotate-45 whitespace-nowrap">
                      {manager}
                    </span>
                  </div>
                ))}

                {/* Data Rows */}
                {managers.map((fromManager, i) => (
                  <>
                    {/* Row Header */}
                    <div key={`row-${fromManager}`} className="h-12 flex items-center pr-2">
                      <span className="text-xs text-gray-300 text-right w-full">
                        {fromManager}
                      </span>
                    </div>
                    
                    {/* Data Cells */}
                    {managers.map((toManager, j) => (
                      <Tooltip key={`cell-${i}-${j}`}>
                        <TooltipTrigger asChild>
                          <div
                            className={`h-12 flex items-center justify-center rounded cursor-pointer transition-all hover:scale-110 ${
                              getHeatColor(tradeMatrix[i][j], maxTrades)
                            }`}
                          >
                            {tradeMatrix[i][j] > 0 && (
                              <span className="text-white font-bold text-sm">
                                {tradeMatrix[i][j]}
                              </span>
                            )}
                            {tradeMatrix[i][j] === 0 && i !== j && (
                              <span className="text-gray-500 text-xs">0</span>
                            )}
                          </div>
                        </TooltipTrigger>
                        {i !== j && (
                          <TooltipContent>
                            <div className="space-y-1">
                              <p className="font-semibold">
                                {fromManager} → {toManager}
                              </p>
                              <p className="text-sm">
                                Trades: {tradeMatrix[i][j]}
                              </p>
                              {tradeMatrix[i][j] === 0 && (
                                <p className="text-xs text-red-400">No trade history</p>
                              )}
                            </div>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    ))}
                  </>
                ))}
              </div>
            </TooltipProvider>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4">
          <span className="text-xs text-gray-400">Trade Frequency:</span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-4 bg-blue-600/80 rounded" />
            <span className="text-xs text-gray-300">Low</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-4 bg-yellow-600/80 rounded" />
            <span className="text-xs text-gray-300">Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-4 bg-red-600/80 rounded" />
            <span className="text-xs text-gray-300">High</span>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-purple-900/30 rounded-lg">
            <Users className="w-5 h-5 mx-auto text-purple-400 mb-1" />
            <p className="text-xl font-bold text-white">{totalTrades}</p>
            <p className="text-xs text-gray-400">Total Trades</p>
          </div>
          <div className="text-center p-3 bg-blue-900/30 rounded-lg">
            <TrendingUp className="w-5 h-5 mx-auto text-blue-400 mb-1" />
            <p className="text-xl font-bold text-white">{activePairs}</p>
            <p className="text-xs text-gray-400">Active Pairs</p>
          </div>
          <div className="text-center p-3 bg-orange-900/30 rounded-lg">
            <Flame className="w-5 h-5 mx-auto text-orange-400 mb-1" />
            <p className="text-sm font-bold text-white">{mostActiveManager.manager}</p>
            <p className="text-xs text-gray-400">Most Active ({mostActiveManager.trades} trades)</p>
          </div>
        </div>

        {/* Insights */}
        <div className="bg-gradient-to-r from-orange-900/20 to-red-900/20 p-4 rounded-lg">
          <h4 className="text-sm font-semibold text-orange-300 mb-2">Heatmap Insights</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Dynasty Dom. & Waiver War. show strongest trade relationship (alliance pattern)</li>
            <li>• Trade Sharks & Analytics Army have never traded (rivalry/avoidance)</li>
            <li>• Steady Eddies maintains balanced trade relationships with most managers</li>
            <li>• Trade activity increases 3x during weeks 6-10 (deadline approaching)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
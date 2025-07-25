'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CrossPlatformTradeAnalyzer } from '@/components/leagues/CrossPlatformTradeAnalyzer';
import { PlayerAvatar } from '@/components/avatars/PlayerAvatar';
import { 
  ArrowUpDown, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  BarChart3, 
  History,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Brain,
  Trophy,
  Target,
  Zap,
  Star
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { logger } from '../../lib/logging/logger';

interface TradeHistory {
  id: string;
  date: string;
  playersGiven: { id: string; name: string; position: string; team: string; rating?: number }[];
  playersReceived: { id: string; name: string; position: string; team: string; rating?: number }[];
  platform: string;
  leagueName: string;
  status: 'completed' | 'pending' | 'rejected';
  impact: {
    winProbChange: number;
    pointsGained: number;
    valueChange: number;
  };
  aiScore: number;
}

interface TradeRecommendation {
  id: string;
  targetPlayer: {
    id: string;
    name: string;
    position: string;
    team: string;
    value: number;
    rating?: number;
  };
  offeredPlayers: {
    id: string;
    name: string;
    position: string;
    team: string;
    value: number;
    rating?: number;
  }[];
  reasoning: string[];
  confidence: number;
  impact: {
    winProbChange: number;
    valueGain: number;
  };
}

export default function TradesPage() {
  const [activeTab, setActiveTab] = useState('analyzer');
  const [tradeHistory, setTradeHistory] = useState<TradeHistory[]>([]);
  const [recommendations, setRecommendations] = useState<TradeRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // Fetch trade history
  useEffect(() => {
    fetchTradeHistory();
    fetchTradeRecommendations();
  }, []);

  const fetchTradeHistory = async () => {
    try {
      const response = await fetch('/api/trades/history');
      if (response.ok) {
        const data = await response.json();
        setTradeHistory(data.trades || []);
      }
    } catch (error) {
      logger.error('Failed to fetch trade history:', { error: error });
    }
  };

  const fetchTradeRecommendations = async () => {
    try {
      const response = await fetch('/api/trades/recommendations');
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (error) {
      logger.error('Failed to fetch recommendations:', { error: error });
    }
  };

  const analyzeCustomTrade = async (tradeData: any) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/trades/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeData)
      });
      
      if (response.ok) {
        const result = await response.json();
        setAnalysisResult(result);
      }
    } catch (error) {
      logger.error('Trade analysis failed:', { error: error });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Trade Analyzer
              </h1>
              <p className="text-gray-400 mt-1">
                AI-powered trade analysis across all your fantasy platforms
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="border-purple-500/50 text-purple-400">
                <Brain className="w-3 h-3 mr-1" />
                AI Enhanced
              </Badge>
              <Badge variant="outline" className="border-blue-500/50 text-blue-400">
                <Users className="w-3 h-3 mr-1" />
                Multi-Platform
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-4 bg-gray-900/50 backdrop-blur-sm border border-gray-800">
            <TabsTrigger value="analyzer" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600">
              <ArrowUpDown className="w-4 h-4 mr-2" />
              Analyzer
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600">
              <Sparkles className="w-4 h-4 mr-2" />
              AI Picks
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600">
              <History className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
            <TabsTrigger value="insights" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600">
              <BarChart3 className="w-4 h-4 mr-2" />
              Insights
            </TabsTrigger>
          </TabsList>

          {/* Trade Analyzer Tab */}
          <TabsContent value="analyzer" className="space-y-6">
            <CrossPlatformTradeAnalyzer />
            
            {/* AI Analysis Results */}
            {analysisResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8"
              >
                <Card className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 backdrop-blur-lg border-purple-500/30">
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                      <Brain className="w-5 h-5 mr-2 text-purple-400" />
                      AI Trade Analysis
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-white/5 rounded-lg p-4">
                        <p className="text-gray-400 text-sm mb-1">Fairness Score</p>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-white">
                            {analysisResult.fairnessScore}%
                          </span>
                          {analysisResult.fairnessScore > 80 ? (
                            <CheckCircle2 className="w-5 h-5 text-green-400" />
                          ) : analysisResult.fairnessScore > 60 ? (
                            <AlertCircle className="w-5 h-5 text-yellow-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-400" />
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-white/5 rounded-lg p-4">
                        <p className="text-gray-400 text-sm mb-1">Win Probability Change</p>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-white">
                            {analysisResult.winProbChange > 0 ? '+' : ''}{analysisResult.winProbChange}%
                          </span>
                          {analysisResult.winProbChange > 0 ? (
                            <TrendingUp className="w-5 h-5 text-green-400" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-red-400" />
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-white/5 rounded-lg p-4">
                        <p className="text-gray-400 text-sm mb-1">Value Gain/Loss</p>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-white">
                            {analysisResult.valueChange > 0 ? '+' : ''}{analysisResult.valueChange}
                          </span>
                          <Zap className="w-5 h-5 text-yellow-400" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="font-medium text-white">AI Reasoning:</h4>
                      <ul className="space-y-2">
                        {analysisResult.reasoning?.map((reason: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-gray-300">
                            <Target className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                            <span className="text-sm">{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="mt-6 flex gap-3">
                      <Button className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Accept Trade
                      </Button>
                      <Button variant="outline" className="border-gray-600 hover:bg-gray-800">
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject Trade
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </TabsContent>

          {/* AI Recommendations Tab */}
          <TabsContent value="recommendations" className="space-y-6">
            <div className="grid gap-4">
              {recommendations.map((rec) => (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.02 }}
                  className="group"
                >
                  <Card className="bg-white/5 backdrop-blur-lg border-white/10 hover:border-purple-500/50 transition-all duration-300">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <PlayerAvatar
                            playerId={rec.targetPlayer.id || `player-${rec.id}`}
                            size={64}
                            showBadge={true}
                            animate={true}
                          />
                          <div>
                            <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                              Target: {rec.targetPlayer.name}
                              {rec.targetPlayer.rating && rec.targetPlayer.rating >= 95 && (
                                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                              )}
                            </h3>
                            <p className="text-gray-400 text-sm">
                              {rec.targetPlayer.position} - {rec.targetPlayer.team}
                            </p>
                          </div>
                        </div>
                        <Badge 
                          className={cn(
                            "text-xs",
                            rec.confidence > 80 ? "bg-green-900/50 text-green-400 border-green-500/50" :
                            rec.confidence > 60 ? "bg-yellow-900/50 text-yellow-400 border-yellow-500/50" :
                            "bg-red-900/50 text-red-400 border-red-500/50"
                          )}
                        >
                          {rec.confidence}% Confidence
                        </Badge>
                      </div>
                      
                      <div className="mb-4">
                        <p className="text-sm text-gray-400 mb-2">Offer:</p>
                        <div className="flex flex-wrap gap-3">
                          {rec.offeredPlayers.map((player, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                              <PlayerAvatar
                                playerId={player.id || `offered-${idx}`}
                                size={32}
                                showBadge={false}
                              />
                              <span className="text-sm text-gray-300">
                                {player.name} ({player.position})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-white/5 rounded-lg p-3">
                          <p className="text-xs text-gray-400">Win Prob Change</p>
                          <p className="text-lg font-semibold text-white flex items-center gap-1">
                            {rec.impact.winProbChange > 0 ? '+' : ''}{rec.impact.winProbChange}%
                            {rec.impact.winProbChange > 0 ? (
                              <TrendingUp className="w-4 h-4 text-green-400" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-red-400" />
                            )}
                          </p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3">
                          <p className="text-xs text-gray-400">Value Gain</p>
                          <p className="text-lg font-semibold text-white">
                            +{rec.impact.valueGain} pts
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        {rec.reasoning.slice(0, 2).map((reason, idx) => (
                          <p key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                            <span className="text-purple-400">•</span>
                            {reason}
                          </p>
                        ))}
                      </div>
                      
                      <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Propose This Trade
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* Trade History Tab */}
          <TabsContent value="history" className="space-y-6">
            <div className="space-y-4">
              {tradeHistory.map((trade) => (
                <motion.div
                  key={trade.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="bg-white/5 backdrop-blur-lg border-white/10">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-white">
                              {trade.platform} - {trade.leagueName}
                            </h3>
                            <Badge 
                              className={cn(
                                "text-xs",
                                trade.status === 'completed' ? "bg-green-900/50 text-green-400" :
                                trade.status === 'pending' ? "bg-yellow-900/50 text-yellow-400" :
                                "bg-red-900/50 text-red-400"
                              )}
                            >
                              {trade.status}
                            </Badge>
                          </div>
                          <p className="text-gray-400 text-sm">{trade.date}</p>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-sm text-gray-400">AI Score</p>
                          <p className="text-2xl font-bold text-white">{trade.aiScore}/100</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-red-900/20 rounded-lg p-4 border border-red-900/30">
                          <p className="text-sm font-medium text-red-400 mb-3">Traded Away</p>
                          <div className="space-y-2">
                            {trade.playersGiven.map((player, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <PlayerAvatar
                                  playerId={player.id || `given-${idx}`}
                                  size={40}
                                  showBadge={player.rating && player.rating >= 90}
                                />
                                <div>
                                  <p className="text-gray-300 text-sm font-medium">{player.name}</p>
                                  <p className="text-gray-500 text-xs">{player.position} - {player.team}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="bg-green-900/20 rounded-lg p-4 border border-green-900/30">
                          <p className="text-sm font-medium text-green-400 mb-3">Received</p>
                          <div className="space-y-2">
                            {trade.playersReceived.map((player, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <PlayerAvatar
                                  playerId={player.id || `received-${idx}`}
                                  size={40}
                                  showBadge={player.rating && player.rating >= 90}
                                />
                                <div>
                                  <p className="text-gray-300 text-sm font-medium">{player.name}</p>
                                  <p className="text-gray-500 text-xs">{player.position} - {player.team}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-yellow-400" />
                          <span className="text-gray-300">
                            Win Prob: {trade.impact.winProbChange > 0 ? '+' : ''}{trade.impact.winProbChange}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-blue-400" />
                          <span className="text-gray-300">
                            Points: {trade.impact.pointsGained > 0 ? '+' : ''}{trade.impact.pointsGained}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-purple-400" />
                          <span className="text-gray-300">
                            Value: {trade.impact.valueChange > 0 ? '+' : ''}{trade.impact.valueChange}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-green-900/20 to-green-800/20 backdrop-blur-lg border-green-500/30">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Trophy className="w-8 h-8 text-green-400" />
                    <Badge className="bg-green-900/50 text-green-400">+15%</Badge>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">87%</h3>
                  <p className="text-gray-400 text-sm">Trade Success Rate</p>
                </div>
              </Card>
              
              <Card className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 backdrop-blur-lg border-blue-500/30">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <TrendingUp className="w-8 h-8 text-blue-400" />
                    <Badge className="bg-blue-900/50 text-blue-400">+8.3%</Badge>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">+24.5</h3>
                  <p className="text-gray-400 text-sm">Avg Points Gained</p>
                </div>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 backdrop-blur-lg border-purple-500/30">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Brain className="w-8 h-8 text-purple-400" />
                    <Badge className="bg-purple-900/50 text-purple-400">AI</Badge>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">92%</h3>
                  <p className="text-gray-400 text-sm">AI Accuracy</p>
                </div>
              </Card>
              
              <Card className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/20 backdrop-blur-lg border-yellow-500/30">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Zap className="w-8 h-8 text-yellow-400" />
                    <Badge className="bg-yellow-900/50 text-yellow-400">Top 10%</Badge>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">156</h3>
                  <p className="text-gray-400 text-sm">Total Trades</p>
                </div>
              </Card>
            </div>
            
            <Card className="bg-white/5 backdrop-blur-lg border-white/10">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Trade Performance by Position</h3>
                <div className="space-y-3">
                  {['RB', 'WR', 'QB', 'TE'].map((position) => (
                    <div key={position} className="flex items-center gap-4">
                      <span className="text-gray-400 w-8">{position}</span>
                      <div className="flex-1 bg-gray-800 rounded-full h-8 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${60 + Math.random() * 40}%` }}
                          transition={{ duration: 1, delay: 0.2 }}
                          className="h-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-end pr-3"
                        >
                          <span className="text-xs text-white font-medium">
                            {(60 + Math.random() * 40).toFixed(0)}%
                          </span>
                        </motion.div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
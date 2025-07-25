'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Play, Pause, RefreshCw, Activity, AlertTriangle, CloudRain, TrendingUp, Star, Settings, Zap } from 'lucide-react';
import MidGameOptimizer from '@/components/live-scores/MidGameOptimizer';
import { logger } from '../../lib/logging/logger';

// Live Score Types
interface LiveGame {
  id: string;
  sport: 'NFL' | 'NBA' | 'MLB' | 'NHL';
  homeTeam: {
    name: string;
    abbreviation: string;
    score: number;
    logo: string;
  };
  awayTeam: {
    name: string;
    abbreviation: string;
    score: number;
    logo: string;
  };
  status: 'pre' | 'live' | 'final';
  clock: string;
  quarter?: number;
  inning?: number;
  period?: number;
  lastUpdate: string;
  weather?: {
    condition: string;
    temperature: number;
    windSpeed: number;
  };
}

interface LivePlayer {
  id: string;
  name: string;
  team: string;
  position: string;
  fantasyPoints: number;
  isActive: boolean;
  stats: Record<string, number>;
  projectedPoints: number;
  ownership: number;
  injury?: {
    status: string;
    description: string;
  };
}

interface FantasyAlert {
  id: string;
  type: 'touchdown' | 'injury' | 'weather' | 'lineup' | 'milestone';
  player: LivePlayer;
  game: LiveGame;
  message: string;
  impact: 'high' | 'medium' | 'low';
  timestamp: string;
}

interface ContestStanding {
  rank: number;
  username: string;
  points: number;
  lineup: LivePlayer[];
  change: number;
}

// Mock Data
const mockGames: LiveGame[] = [
  {
    id: '1',
    sport: 'NFL',
    homeTeam: { name: 'Kansas City Chiefs', abbreviation: 'KC', score: 21, logo: '/teams/kc.png' },
    awayTeam: { name: 'Buffalo Bills', abbreviation: 'BUF', score: 17, logo: '/teams/buf.png' },
    status: 'live',
    clock: '8:42',
    quarter: 3,
    lastUpdate: new Date().toISOString(),
    weather: { condition: 'Clear', temperature: 72, windSpeed: 5 }
  },
  {
    id: '2',
    sport: 'NBA',
    homeTeam: { name: 'Los Angeles Lakers', abbreviation: 'LAL', score: 98, logo: '/teams/lal.png' },
    awayTeam: { name: 'Boston Celtics', abbreviation: 'BOS', score: 102, logo: '/teams/bos.png' },
    status: 'live',
    clock: '6:24',
    quarter: 4,
    lastUpdate: new Date().toISOString()
  }
];

const mockPlayers: LivePlayer[] = [
  {
    id: '1',
    name: 'Josh Allen',
    team: 'BUF',
    position: 'QB',
    fantasyPoints: 18.4,
    isActive: true,
    stats: { completions: 15, attempts: 22, yards: 184, touchdowns: 2 },
    projectedPoints: 22.8,
    ownership: 23.4
  },
  {
    id: '2',
    name: 'Patrick Mahomes',
    team: 'KC',
    position: 'QB',
    fantasyPoints: 21.6,
    isActive: true,
    stats: { completions: 18, attempts: 25, yards: 216, touchdowns: 3 },
    projectedPoints: 25.2,
    ownership: 28.1
  }
];

const mockAlerts: FantasyAlert[] = [
  {
    id: '1',
    type: 'touchdown',
    player: mockPlayers[1],
    game: mockGames[0],
    message: 'Patrick Mahomes throws 15-yard TD pass to Travis Kelce',
    impact: 'high',
    timestamp: new Date(Date.now() - 120000).toISOString()
  }
];

export default function LiveScoresPage() {
  // State
  const [games, setGames] = useState<LiveGame[]>(mockGames);
  const [players, setPlayers] = useState<LivePlayer[]>(mockPlayers);
  const [alerts, setAlerts] = useState<FantasyAlert[]>(mockAlerts);
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [selectedGame, setSelectedGame] = useState<LiveGame | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [standings, setStandings] = useState<ContestStanding[]>([]);
  const [notifications, setNotifications] = useState(true);
  const [showOptimizer, setShowOptimizer] = useState(false);

  // WebSocket connection
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Initialize WebSocket connection
    connectWebSocket();
    
    // Set up periodic data refresh
    const refreshInterval = setInterval(() => {
      if (autoRefresh) {
        refreshData();
      }
    }, 5000);

    return () => {
      clearInterval(refreshInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [autoRefresh]);

  const connectWebSocket = () => {
    try {
      // Connect to WebSocket server
      const token = localStorage.getItem('auth_token');
      wsRef.current = new WebSocket(`ws://localhost:3001?token=${token}`);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        logger.info('WebSocket connected');
        
        // Subscribe to live score channels
        subscribeToChannels();
      };

      wsRef.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        logger.info('WebSocket disconnected');
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (autoRefresh) {
            connectWebSocket();
          }
        }, 3000);
      };

      wsRef.current.onerror = (error) => {
        logger.error('WebSocket error:', { error: error });
        setIsConnected(false);
      };
    } catch (error) {
      logger.error('Failed to connect WebSocket:', { error: error });
      setIsConnected(false);
    }
  };

  const subscribeToChannels = () => {
    if (!wsRef.current) return;

    // Subscribe to live score channels
    wsRef.current.send(JSON.stringify({
      type: 'subscribe',
      channel: 'live-scores/nfl'
    }));

    wsRef.current.send(JSON.stringify({
      type: 'subscribe',
      channel: 'live-scores/nba'
    }));

    wsRef.current.send(JSON.stringify({
      type: 'subscribe',
      channel: 'player-alerts/user123'
    }));

    wsRef.current.send(JSON.stringify({
      type: 'subscribe',
      channel: 'contests/main-slate'
    }));
  };

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'game:update':
        updateGame(message.data);
        break;
      case 'player:update':
        updatePlayer(message.data);
        break;
      case 'fantasy:alert':
        addAlert(message.data);
        break;
      case 'contest:standings':
        setStandings(message.data);
        break;
      case 'injury:alert':
        handleInjuryAlert(message.data);
        break;
      default:
        logger.info('Unknown message type:', { data: message.type });
    }
  };

  const updateGame = (gameData: any) => {
    setGames(prev => prev.map(game => 
      game.id === gameData.id ? { ...game, ...gameData } : game
    ));
  };

  const updatePlayer = (playerData: any) => {
    setPlayers(prev => prev.map(player => 
      player.id === playerData.id ? { ...player, ...playerData } : player
    ));
  };

  const addAlert = (alertData: FantasyAlert) => {
    setAlerts(prev => [alertData, ...prev.slice(0, 9)]); // Keep last 10 alerts
    
    // Show notification if enabled
    if (notifications && 'Notification' in window) {
      new Notification(`Fantasy Alert: ${alertData.message}`, {
        icon: '/logo.png',
        badge: '/logo.png'
      });
    }
  };

  const handleInjuryAlert = (injuryData: any) => {
    // Update player injury status
    updatePlayer({
      id: injuryData.playerId,
      injury: injuryData.injury
    });

    // Add injury alert
    addAlert({
      id: Date.now().toString(),
      type: 'injury',
      player: players.find(p => p.id === injuryData.playerId)!,
      game: games.find(g => g.id === injuryData.gameId)!,
      message: `${injuryData.playerName} - ${injuryData.injury.description}`,
      impact: 'high',
      timestamp: new Date().toISOString()
    });
  };

  const refreshData = async () => {
    try {
      // Fetch latest game data
      const gamesResponse = await fetch('/api/live-scores/games');
      if (gamesResponse.ok) {
        const gamesData = await gamesResponse.json();
        setGames(gamesData);
      }

      // Fetch latest player data
      const playersResponse = await fetch('/api/live-scores/players');
      if (playersResponse.ok) {
        const playersData = await playersResponse.json();
        setPlayers(playersData);
      }
    } catch (error) {
      logger.error('Failed to refresh data:', { error: error });
    }
  };

  const filteredGames = selectedSport === 'all' 
    ? games 
    : games.filter(game => game.sport.toLowerCase() === selectedSport);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-red-500';
      case 'pre': return 'bg-yellow-500';
      case 'final': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'touchdown': return <TrendingUp className="w-4 h-4" />;
      case 'injury': return <AlertTriangle className="w-4 h-4" />;
      case 'weather': return <CloudRain className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Live Scores</h1>
          <p className="text-gray-600">Real-time sports scores with fantasy impact</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            {isConnected ? 'Live' : 'Offline'}
          </div>

          {/* Auto Refresh Toggle */}
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            Auto Refresh
          </Button>

          {/* Manual Refresh */}
          <Button variant="outline" size="sm" onClick={refreshData}>
            <RefreshCw className="w-4 h-4" />
          </Button>

          {/* Notifications Toggle */}
          <Button
            variant={notifications ? 'default' : 'outline'}
            size="sm"
            onClick={() => setNotifications(!notifications)}
          >
            <Bell className="w-4 h-4" />
            Alerts
          </Button>

          {/* Lineup Optimizer */}
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowOptimizer(true)}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            <Zap className="w-4 h-4" />
            Optimize
          </Button>
        </div>
      </div>

      <Tabs value={selectedSport} onValueChange={setSelectedSport} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All Sports</TabsTrigger>
          <TabsTrigger value="nfl">NFL</TabsTrigger>
          <TabsTrigger value="nba">NBA</TabsTrigger>
          <TabsTrigger value="mlb">MLB</TabsTrigger>
          <TabsTrigger value="nhl">NHL</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedSport} className="space-y-6">
          {/* Live Games Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGames.map((game) => (
              <Card 
                key={game.id} 
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  selectedGame?.id === game.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setSelectedGame(game)}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className={`${getStatusColor(game.status)} text-white`}>
                      {game.status === 'live' ? 'LIVE' : game.status.toUpperCase()}
                    </Badge>
                    <div className="text-sm text-gray-500">
                      {game.sport} • {game.clock}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  {/* Teams and Scores */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-200 rounded"></div>
                        <div>
                          <div className="font-semibold">{game.awayTeam.abbreviation}</div>
                          <div className="text-sm text-gray-500">{game.awayTeam.name}</div>
                        </div>
                      </div>
                      <div className="text-2xl font-bold">{game.awayTeam.score}</div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-200 rounded"></div>
                        <div>
                          <div className="font-semibold">{game.homeTeam.abbreviation}</div>
                          <div className="text-sm text-gray-500">{game.homeTeam.name}</div>
                        </div>
                      </div>
                      <div className="text-2xl font-bold">{game.homeTeam.score}</div>
                    </div>
                  </div>

                  {/* Weather (if available) */}
                  {game.weather && (
                    <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm">
                        <CloudRain className="w-4 h-4" />
                        {game.weather.condition} • {game.weather.temperature}°F • Wind {game.weather.windSpeed}mph
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Selected Game Details */}
          {selectedGame && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Game Center: {selectedGame.awayTeam.abbreviation} @ {selectedGame.homeTeam.abbreviation}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Live Stats */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Live Player Stats</h3>
                    <div className="space-y-3">
                      {players
                        .filter(p => p.team === selectedGame.homeTeam.abbreviation || p.team === selectedGame.awayTeam.abbreviation)
                        .map((player) => (
                          <div key={player.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <div>
                              <div className="font-semibold">{player.name}</div>
                              <div className="text-sm text-gray-500">{player.position} • {player.team}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-green-600">{player.fantasyPoints} pts</div>
                              <div className="text-sm text-gray-500">Proj: {player.projectedPoints}</div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Play by Play */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Recent Plays</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {/* Mock play-by-play data */}
                      <div className="p-2 border-l-4 border-green-500 bg-green-50">
                        <div className="text-sm font-semibold">TOUCHDOWN</div>
                        <div className="text-sm">Patrick Mahomes 15-yard pass to Travis Kelce</div>
                        <div className="text-xs text-gray-500">2 minutes ago</div>
                      </div>
                      <div className="p-2 border-l-4 border-blue-500 bg-blue-50">
                        <div className="text-sm">1st & 10 at KC 25</div>
                        <div className="text-sm">Josh Allen pass incomplete to Stefon Diggs</div>
                        <div className="text-xs text-gray-500">3 minutes ago</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fantasy Alerts Feed */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Fantasy Impact Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {alerts.map((alert) => (
                  <div key={alert.id} className={`p-3 rounded-lg border-l-4 ${
                    alert.impact === 'high' ? 'border-red-500 bg-red-50' :
                    alert.impact === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                    'border-blue-500 bg-blue-50'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 ${
                        alert.impact === 'high' ? 'text-red-600' :
                        alert.impact === 'medium' ? 'text-yellow-600' :
                        'text-blue-600'
                      }`}>
                        {getAlertIcon(alert.type)}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{alert.message}</div>
                        <div className="text-sm text-gray-600">
                          {alert.player.name} • {alert.game.awayTeam.abbreviation} @ {alert.game.homeTeam.abbreviation}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                      <Badge variant={
                        alert.impact === 'high' ? 'destructive' :
                        alert.impact === 'medium' ? 'default' : 'secondary'
                      }>
                        {alert.impact}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Live Leaderboards */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5" />
                Contest Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {standings.slice(0, 10).map((standing) => (
                  <div key={standing.rank} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        standing.rank === 1 ? 'bg-yellow-500 text-white' :
                        standing.rank <= 3 ? 'bg-gray-300 text-gray-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {standing.rank}
                      </div>
                      <div>
                        <div className="font-semibold">{standing.username}</div>
                        <div className="text-sm text-gray-500">
                          {standing.lineup.slice(0, 3).map(p => p.name).join(', ')}...
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{standing.points.toFixed(1)} pts</div>
                      <div className={`text-sm ${
                        standing.change > 0 ? 'text-green-600' : 
                        standing.change < 0 ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {standing.change > 0 ? '+' : ''}{standing.change}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Mid-Game Optimizer Modal */}
      <MidGameOptimizer
        isOpen={showOptimizer}
        onClose={() => setShowOptimizer(false)}
      />
    </div>
  );
}
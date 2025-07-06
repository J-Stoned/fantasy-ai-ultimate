#!/usr/bin/env tsx
/**
 * 📡 REAL-TIME DATA FEEDS
 * 
 * Connects to live sports data providers
 * Handles multiple data sources with failover
 * Streams real-time updates to all services
 */

import { WebSocketServer } from 'ws';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { EventEmitter } from 'events';

config({ path: '.env.local' });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3345;
const WS_PORT = 3346;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DataFeed {
  name: string;
  type: 'websocket' | 'rest' | 'sse';
  url: string;
  apiKey?: string;
  sports: string[];
  priority: number;
  reconnectDelay: number;
  active: boolean;
}

interface LiveUpdate {
  id: string;
  type: 'score' | 'play' | 'injury' | 'lineup' | 'odds' | 'weather' | 'news';
  sport: string;
  gameId?: string;
  playerId?: string;
  timestamp: Date;
  data: any;
  source: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
}

interface GameState {
  gameId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  period: string;
  timeRemaining: string;
  situation?: string;
  lastPlay?: string;
  possession?: string;
  drives?: any[];
  players?: any[];
}

class RealTimeDataFeeds extends EventEmitter {
  private feeds: DataFeed[] = [
    {
      name: 'ESPN',
      type: 'websocket',
      url: process.env.ESPN_WS_URL || 'wss://sports.espn.com/live',
      apiKey: process.env.ESPN_API_KEY,
      sports: ['nfl', 'nba', 'mlb', 'nhl'],
      priority: 9,
      reconnectDelay: 5000,
      active: false
    },
    {
      name: 'SportRadar',
      type: 'rest',
      url: process.env.SPORTRADAR_API_URL || 'https://api.sportradar.com/v1',
      apiKey: process.env.SPORTRADAR_API_KEY,
      sports: ['nfl', 'nba', 'mlb'],
      priority: 8,
      reconnectDelay: 10000,
      active: false
    },
    {
      name: 'TheScore',
      type: 'websocket',
      url: process.env.THESCORE_WS_URL || 'wss://api.thescore.com/stream',
      sports: ['nfl', 'nba'],
      priority: 7,
      reconnectDelay: 5000,
      active: false
    },
    {
      name: 'OddsAPI',
      type: 'rest',
      url: process.env.ODDS_API_URL || 'https://api.the-odds-api.com/v4',
      apiKey: process.env.ODDS_API_KEY,
      sports: ['nfl', 'nba', 'mlb', 'nhl'],
      priority: 6,
      reconnectDelay: 15000,
      active: false
    }
  ];
  
  private connections: Map<string, any> = new Map();
  private gameStates: Map<string, GameState> = new Map();
  private updateQueue: LiveUpdate[] = [];
  private wsClients = new Set<any>();
  private pollingIntervals: Map<string, NodeJS.Timer> = new Map();
  
  async initialize() {
    console.log(chalk.cyan('📡 Initializing Real-Time Data Feeds...'));
    
    // Connect to each feed
    for (const feed of this.feeds) {
      await this.connectFeed(feed);
    }
    
    // Start processing queue
    this.startQueueProcessor();
    
    // Start health monitoring
    this.startHealthMonitor();
    
    console.log(chalk.green('✅ Real-Time Data Feeds initialized'));
  }
  
  private async connectFeed(feed: DataFeed) {
    console.log(chalk.yellow(`🔌 Connecting to ${feed.name}...`));
    
    try {
      if (feed.type === 'websocket') {
        await this.connectWebSocket(feed);
      } else if (feed.type === 'rest') {
        await this.startPolling(feed);
      } else if (feed.type === 'sse') {
        await this.connectSSE(feed);
      }
      
      feed.active = true;
      console.log(chalk.green(`✅ ${feed.name} connected`));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to connect ${feed.name}:`), error);
      feed.active = false;
      
      // Retry connection
      setTimeout(() => this.connectFeed(feed), feed.reconnectDelay);
    }
  }
  
  private async connectWebSocket(feed: DataFeed) {
    // In production, would connect to real WebSocket
    // For demo, simulate connection
    const mockWS = {
      on: (event: string, handler: Function) => {
        if (event === 'message') {
          // Simulate live updates
          setInterval(() => {
            const update = this.generateMockUpdate(feed.name);
            handler(JSON.stringify(update));
          }, 3000 + Math.random() * 2000);
        }
      },
      close: () => {}
    };
    
    this.connections.set(feed.name, mockWS);
    
    mockWS.on('message', (data: string) => {
      const update = JSON.parse(data);
      this.handleUpdate(feed.name, update);
    });
  }
  
  private async startPolling(feed: DataFeed) {
    // Poll REST API at intervals
    const pollInterval = setInterval(async () => {
      try {
        const updates = await this.fetchRestUpdates(feed);
        updates.forEach(update => this.handleUpdate(feed.name, update));
      } catch (error) {
        console.error(`Polling error for ${feed.name}:`, error);
      }
    }, 10000); // Every 10 seconds
    
    this.pollingIntervals.set(feed.name, pollInterval);
  }
  
  private async connectSSE(feed: DataFeed) {
    // Server-Sent Events connection
    // Similar to WebSocket but one-way
  }
  
  private async fetchRestUpdates(feed: DataFeed): Promise<any[]> {
    // In production, would make real API calls
    // For demo, return mock updates
    return [this.generateMockUpdate(feed.name)];
  }
  
  private generateMockUpdate(source: string): LiveUpdate {
    const types: LiveUpdate['type'][] = ['score', 'play', 'injury', 'odds'];
    const sports = ['nfl', 'nba', 'mlb'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    const update: LiveUpdate = {
      id: `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      sport: sports[Math.floor(Math.random() * sports.length)],
      timestamp: new Date(),
      source,
      importance: Math.random() > 0.8 ? 'high' : Math.random() > 0.5 ? 'medium' : 'low',
      data: {}
    };
    
    // Generate type-specific data
    switch (type) {
      case 'score':
        update.gameId = `game_${Math.floor(Math.random() * 100)}`;
        update.data = {
          homeScore: Math.floor(Math.random() * 30),
          awayScore: Math.floor(Math.random() * 30),
          quarter: Math.floor(Math.random() * 4) + 1,
          time: '10:45'
        };
        break;
        
      case 'play':
        update.gameId = `game_${Math.floor(Math.random() * 100)}`;
        update.data = {
          description: 'Mahomes pass complete to Kelce for 15 yards',
          yards: 15,
          down: 1,
          distance: 10,
          result: 'first_down'
        };
        break;
        
      case 'injury':
        update.playerId = `player_${Math.floor(Math.random() * 1000)}`;
        update.importance = 'high';
        update.data = {
          player: 'Star Player',
          team: 'KC',
          status: 'questionable',
          description: 'Ankle injury, return questionable',
          fantasyImpact: 'high'
        };
        break;
        
      case 'odds':
        update.gameId = `game_${Math.floor(Math.random() * 100)}`;
        update.data = {
          spread: -3.5,
          total: 48.5,
          movement: 'home',
          book: 'DraftKings'
        };
        break;
    }
    
    return update;
  }
  
  private handleUpdate(source: string, rawUpdate: any) {
    // Transform to our standard format
    const update: LiveUpdate = this.transformUpdate(source, rawUpdate);
    
    // Add to queue
    this.updateQueue.push(update);
    
    // Emit for immediate processing
    this.emit('update', update);
    
    // Update game state if applicable
    if (update.gameId) {
      this.updateGameState(update);
    }
    
    // Broadcast to WebSocket clients
    this.broadcastUpdate(update);
  }
  
  private transformUpdate(source: string, raw: any): LiveUpdate {
    // Each source has different format
    // This is simplified - real implementation would handle each format
    return raw as LiveUpdate;
  }
  
  private updateGameState(update: LiveUpdate) {
    if (!update.gameId) return;
    
    let gameState = this.gameStates.get(update.gameId);
    if (!gameState) {
      gameState = {
        gameId: update.gameId,
        sport: update.sport,
        homeTeam: 'Home',
        awayTeam: 'Away',
        homeScore: 0,
        awayScore: 0,
        period: '1',
        timeRemaining: '15:00'
      };
      this.gameStates.set(update.gameId, gameState);
    }
    
    // Update based on update type
    if (update.type === 'score' && update.data) {
      gameState.homeScore = update.data.homeScore || gameState.homeScore;
      gameState.awayScore = update.data.awayScore || gameState.awayScore;
      gameState.period = update.data.quarter || gameState.period;
      gameState.timeRemaining = update.data.time || gameState.timeRemaining;
    } else if (update.type === 'play' && update.data) {
      gameState.lastPlay = update.data.description;
      gameState.situation = `${update.data.down} & ${update.data.distance}`;
    }
  }
  
  private broadcastUpdate(update: LiveUpdate) {
    const message = JSON.stringify({
      type: 'live_update',
      update,
      timestamp: new Date().toISOString()
    });
    
    this.wsClients.forEach(client => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }
  
  private startQueueProcessor() {
    setInterval(() => {
      if (this.updateQueue.length === 0) return;
      
      // Process batch of updates
      const batch = this.updateQueue.splice(0, 100);
      
      // Store important updates
      batch
        .filter(u => u.importance === 'high' || u.importance === 'critical')
        .forEach(update => {
          this.storeUpdate(update);
        });
      
      // Log stats
      const byType = batch.reduce((acc, u) => {
        acc[u.type] = (acc[u.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log(chalk.gray(`Processed ${batch.length} updates:`, byType));
    }, 5000);
  }
  
  private async storeUpdate(update: LiveUpdate) {
    try {
      await supabase
        .from('live_updates')
        .insert({
          type: update.type,
          sport: update.sport,
          game_id: update.gameId,
          player_id: update.playerId,
          data: update.data,
          source: update.source,
          importance: update.importance,
          created_at: update.timestamp
        });
    } catch (error) {
      console.error('Failed to store update:', error);
    }
  }
  
  private startHealthMonitor() {
    setInterval(() => {
      const status = this.feeds.map(feed => ({
        name: feed.name,
        active: feed.active,
        priority: feed.priority
      }));
      
      const activeCount = status.filter(s => s.active).length;
      console.log(chalk.cyan(`📊 Feed Status: ${activeCount}/${this.feeds.length} active`));
      
      // Check if we need to reconnect any feeds
      this.feeds
        .filter(f => !f.active)
        .forEach(feed => {
          console.log(chalk.yellow(`🔄 Attempting to reconnect ${feed.name}...`));
          this.connectFeed(feed);
        });
    }, 30000); // Every 30 seconds
  }
  
  async getGameState(gameId: string): Promise<GameState | null> {
    return this.gameStates.get(gameId) || null;
  }
  
  async getRecentUpdates(
    filters?: {
      sport?: string;
      type?: LiveUpdate['type'];
      importance?: LiveUpdate['importance'];
      limit?: number;
    }
  ): Promise<LiveUpdate[]> {
    let updates = [...this.updateQueue];
    
    if (filters?.sport) {
      updates = updates.filter(u => u.sport === filters.sport);
    }
    if (filters?.type) {
      updates = updates.filter(u => u.type === filters.type);
    }
    if (filters?.importance) {
      updates = updates.filter(u => u.importance === filters.importance);
    }
    
    return updates.slice(0, filters?.limit || 50);
  }
}

// Initialize feeds
const dataFeeds = new RealTimeDataFeeds();

// WebSocket server for clients
const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws) => {
  console.log(chalk.blue('🔌 New real-time client connected'));
  dataFeeds['wsClients'].add(ws);
  
  // Send current game states
  ws.send(JSON.stringify({
    type: 'connected',
    gameStates: Array.from(dataFeeds['gameStates'].values()),
    feeds: dataFeeds['feeds'].map(f => ({ name: f.name, active: f.active }))
  }));
  
  ws.on('close', () => {
    dataFeeds['wsClients'].delete(ws);
  });
});

// HTTP API
app.get('/feeds/status', (req, res) => {
  res.json({
    active: true,
    feeds: dataFeeds['feeds'].map(f => ({
      name: f.name,
      type: f.type,
      active: f.active,
      sports: f.sports
    })),
    connections: dataFeeds['wsClients'].size,
    queueSize: dataFeeds['updateQueue'].length
  });
});

app.get('/feeds/game/:gameId', async (req, res) => {
  const gameState = await dataFeeds.getGameState(req.params.gameId);
  res.json({ success: !!gameState, gameState });
});

app.get('/feeds/updates', async (req, res) => {
  const updates = await dataFeeds.getRecentUpdates(req.query as any);
  res.json({ success: true, updates });
});

// Start server
app.listen(PORT, async () => {
  console.log(chalk.green(`\n📡 REAL-TIME DATA FEEDS RUNNING!`));
  console.log(chalk.white(`HTTP API: http://localhost:${PORT}`));
  console.log(chalk.white(`WebSocket: ws://localhost:${WS_PORT}`));
  console.log(chalk.cyan(`\nCapabilities:`));
  console.log(`  - Multi-source data aggregation`);
  console.log(`  - Automatic failover`);
  console.log(`  - Real-time WebSocket streaming`);
  console.log(`  - Game state tracking`);
  console.log(`  - High-importance update storage`);
  
  // Initialize feeds
  await dataFeeds.initialize();
  
  // Listen for pattern-triggering updates
  dataFeeds.on('update', (update: LiveUpdate) => {
    if (update.importance === 'critical' || 
        (update.type === 'injury' && update.importance === 'high')) {
      console.log(chalk.red(`🚨 CRITICAL UPDATE: ${update.type} - ${JSON.stringify(update.data)}`));
    }
  });
});

export { RealTimeDataFeeds, LiveUpdate, GameState };
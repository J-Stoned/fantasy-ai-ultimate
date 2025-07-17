/**
 * 🔥 FANTASY AI WEBSOCKET SERVER 🔥
 * Real-time pattern alerts and game updates
 * Port: 3338
 */

import { Server } from 'socket.io';
import { createServer } from 'http';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

// Initialize services
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD
});

// WebSocket channels
export const CHANNELS = {
  PATTERN_ALERTS: 'patterns:alerts',
  GAME_UPDATES: 'games:updates',  
  PREDICTIONS_NEW: 'predictions:new',
  USER_CHANNEL: (userId: string) => `users:${userId}`,
  SPORT_CHANNEL: (sport: string) => `sports:${sport}`
};

// Connected clients tracking
const clients = new Map<string, any>();

// Pattern API endpoints
const PATTERN_API_V4 = 'http://localhost:3337';
const UNIFIED_PATTERN_API = 'http://localhost:3336';
const API_GATEWAY = 'http://localhost:3000';

// Connection handling
io.on('connection', (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);
  clients.set(socket.id, { socket, userId: null, subscriptions: new Set() });

  // Authentication
  socket.on('authenticate', async (data) => {
    const { userId, apiKey } = data;
    
    // Verify user
    if (userId) {
      const client = clients.get(socket.id);
      if (client) {
        client.userId = userId;
        
        // Join user-specific room
        socket.join(CHANNELS.USER_CHANNEL(userId));
        
        // Send connection confirmation
        socket.emit('authenticated', {
          success: true,
          userId,
          channels: Object.keys(CHANNELS)
        });
        
        console.log(`✅ User ${userId} authenticated`);
      }
    } else {
      socket.emit('authenticated', { success: false, error: 'Invalid credentials' });
    }
  });

  // Channel subscriptions
  socket.on('subscribe', (channel: string) => {
    socket.join(channel);
    const client = clients.get(socket.id);
    if (client) {
      client.subscriptions.add(channel);
    }
    console.log(`📡 Client ${socket.id} subscribed to ${channel}`);
  });

  socket.on('unsubscribe', (channel: string) => {
    socket.leave(channel);
    const client = clients.get(socket.id);
    if (client) {
      client.subscriptions.delete(channel);
    }
  });

  // Request live patterns
  socket.on('get_live_patterns', async (sport?: string) => {
    try {
      const response = await axios.get(`${API_GATEWAY}/api/patterns/opportunities`, {
        params: { sport, minConfidence: 0.6 }
      });
      
      socket.emit('live_patterns', response.data);
    } catch (error) {
      socket.emit('error', { message: 'Failed to fetch live patterns' });
    }
  });

  // Request game analysis
  socket.on('analyze_game', async (gameData) => {
    try {
      const response = await axios.post(`${API_GATEWAY}/api/patterns/analyze`, gameData);
      socket.emit('game_analysis', response.data);
    } catch (error) {
      socket.emit('error', { message: 'Failed to analyze game' });
    }
  });

  // Disconnection
  socket.on('disconnect', () => {
    clients.delete(socket.id);
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Pattern scanning interval (every 30 seconds)
setInterval(async () => {
  try {
    // Get high-value opportunities
    const opportunities = await axios.get(`${API_GATEWAY}/api/patterns/opportunities`, {
      params: { minConfidence: 0.65 }
    }).then(r => r.data.opportunities);

    if (opportunities && opportunities.length > 0) {
      // Broadcast to pattern alerts channel
      io.to(CHANNELS.PATTERN_ALERTS).emit('new_patterns', {
        patterns: opportunities,
        timestamp: new Date().toISOString(),
        count: opportunities.length
      });

      // Send targeted alerts to users
      for (const opportunity of opportunities) {
        // Get users interested in this sport
        const { data: preferences } = await supabase
          .from('user_pattern_preferences')
          .select('user_id')
          .contains('preferences', { sports: [opportunity.sport] })
          .gte('preferences->minConfidence', opportunity.confidence);

        if (preferences) {
          preferences.forEach(pref => {
            io.to(CHANNELS.USER_CHANNEL(pref.user_id)).emit('pattern_alert', {
              opportunity,
              reason: 'High confidence pattern detected',
              timestamp: new Date().toISOString()
            });
          });
        }

        // Also broadcast to sport-specific channel
        io.to(CHANNELS.SPORT_CHANNEL(opportunity.sport)).emit('sport_pattern', opportunity);
      }

      console.log(`📢 Broadcasted ${opportunities.length} pattern alerts`);
    }
  } catch (error) {
    console.error('Pattern scanning error:', error);
  }
}, 30000);

// Game updates interval (every minute)
setInterval(async () => {
  try {
    // Get live games from database
    const { data: liveGames } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'live')
      .order('start_time', { ascending: true });

    if (liveGames && liveGames.length > 0) {
      io.to(CHANNELS.GAME_UPDATES).emit('live_games', {
        games: liveGames,
        timestamp: new Date().toISOString(),
        count: liveGames.length
      });

      console.log(`🏈 Broadcasted ${liveGames.length} live game updates`);
    }
  } catch (error) {
    console.error('Game update error:', error);
  }
}, 60000);

// Redis pub/sub for cross-server communication
const subscriber = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD
});

// Subscribe to Redis channels
subscriber.subscribe('predictions:new', 'alerts:critical');

subscriber.on('message', (channel, message) => {
  try {
    const data = JSON.parse(message);
    
    switch (channel) {
      case 'predictions:new':
        io.to(CHANNELS.PREDICTIONS_NEW).emit('new_prediction', data);
        break;
      case 'alerts:critical':
        io.emit('critical_alert', data); // Broadcast to all
        break;
    }
  } catch (error) {
    console.error('Redis message error:', error);
  }
});

// Health check endpoint
httpServer.on('request', (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'pattern-websocket-server',
      connected_clients: clients.size,
      timestamp: new Date().toISOString()
    }));
  }
});

// Admin functions
export function broadcastToAll(event: string, data: any) {
  io.emit(event, data);
}

export function broadcastToChannel(channel: string, event: string, data: any) {
  io.to(channel).emit(event, data);
}

export function getConnectedClients() {
  return Array.from(clients.entries()).map(([id, client]) => ({
    id,
    userId: client.userId,
    subscriptions: Array.from(client.subscriptions)
  }));
}

// Start server
const PORT = process.env.WEBSOCKET_PORT || 3338;
httpServer.listen(PORT, () => {
  console.log(`🔥 Fantasy AI WebSocket Server running on port ${PORT}`);
  console.log(`📡 Available channels:`);
  Object.entries(CHANNELS).forEach(([name, channel]) => {
    if (typeof channel === 'string') {
      console.log(`   - ${name}: ${channel}`);
    }
  });
  console.log(`🚀 Broadcasting pattern alerts every 30 seconds`);
  console.log(`🏈 Broadcasting game updates every 60 seconds`);
});

export { io };
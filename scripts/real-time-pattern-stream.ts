#!/usr/bin/env tsx
/**
 * 🔥 REAL-TIME PATTERN STREAMING
 * 
 * WebSocket server that streams live pattern updates
 * Integrates with Hey Fantasy voice commands
 * Pushes pattern alerts in real-time
 */

import { WebSocketServer } from 'ws';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';
import express from 'express';
import cors from 'cors';

config({ path: '.env.local' });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3339;
const WS_PORT = 3340;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Pattern stream types
interface PatternAlert {
  id: string;
  type: 'hot_pick' | 'value_play' | 'fade_alert' | 'injury_update' | 'line_movement';
  pattern: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  data: {
    players?: string[];
    teams?: string[];
    game?: string;
    reason: string;
    timestamp: string;
  };
  voiceAlert?: string;
}

// Active WebSocket connections
const clients = new Set<any>();

// Pattern detection engine (runs every 30 seconds)
class PatternStreamEngine {
  private patterns: PatternAlert[] = [];
  private lastCheck: Date = new Date();
  
  async detectPatterns(): Promise<PatternAlert[]> {
    const alerts: PatternAlert[] = [];
    
    // Simulate real-time pattern detection
    const patterns = [
      {
        type: 'hot_pick' as const,
        pattern: 'momentum_surge',
        confidence: 82,
        impact: 'high' as const,
        data: {
          players: ['Josh Allen', 'Stefon Diggs'],
          teams: ['BUF'],
          game: 'BUF vs MIA',
          reason: 'Historical dominance in division games + weather advantage'
        },
        voiceAlert: 'Hot pick alert! Josh Allen and Stefon Diggs stack showing 82% confidence pattern in Buffalo versus Miami.'
      },
      {
        type: 'value_play' as const,
        pattern: 'pricing_inefficiency',
        confidence: 78,
        impact: 'medium' as const,
        data: {
          players: ['Tony Pollard'],
          teams: ['DAL'],
          reason: 'Volume increase expected with Zeke limited'
        },
        voiceAlert: 'Value play detected! Tony Pollard priced at RB2 but projecting RB1 numbers.'
      },
      {
        type: 'fade_alert' as const,
        pattern: 'trap_game',
        confidence: 71,
        impact: 'high' as const,
        data: {
          players: ['Derrick Henry'],
          teams: ['TEN'],
          reason: 'Road favorite against strong run defense'
        },
        voiceAlert: 'Fade alert! Derrick Henry facing a trap game situation. Consider pivoting.'
      }
    ];
    
    // Add timestamp and generate IDs
    patterns.forEach(p => {
      alerts.push({
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...p,
        data: {
          ...p.data,
          timestamp: new Date().toISOString()
        }
      });
    });
    
    return alerts;
  }
  
  async streamToClients(alert: PatternAlert) {
    const message = JSON.stringify({
      type: 'pattern_alert',
      alert,
      timestamp: new Date().toISOString()
    });
    
    clients.forEach(client => {
      if (client.readyState === 1) { // OPEN
        client.send(message);
      }
    });
    
    console.log(chalk.green(`📡 Streamed ${alert.type} to ${clients.size} clients`));
  }
}

const engine = new PatternStreamEngine();

// WebSocket server
const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws) => {
  console.log(chalk.blue('🔌 New WebSocket connection'));
  clients.add(ws);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to Fantasy AI Pattern Stream',
    patterns: ['hot_pick', 'value_play', 'fade_alert', 'injury_update', 'line_movement']
  }));
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log(chalk.yellow('🔌 Client disconnected'));
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// HTTP endpoints for pattern queries
app.get('/stream/status', (req, res) => {
  res.json({
    active: true,
    connections: clients.size,
    lastCheck: engine['lastCheck'],
    capabilities: ['real-time alerts', 'voice integration', 'pattern detection']
  });
});

app.post('/stream/trigger', async (req, res) => {
  const { type, data } = req.body;
  
  const alert: PatternAlert = {
    id: `manual_${Date.now()}`,
    type: type || 'hot_pick',
    pattern: 'manual_trigger',
    confidence: 85,
    impact: 'high',
    data: {
      ...data,
      timestamp: new Date().toISOString()
    },
    voiceAlert: `Manual alert: ${data.reason || 'Pattern detected'}`
  };
  
  await engine.streamToClients(alert);
  
  res.json({ success: true, alert });
});

// Pattern detection loop
setInterval(async () => {
  try {
    const alerts = await engine.detectPatterns();
    
    // Stream each alert with slight delay for effect
    for (const alert of alerts) {
      await engine.streamToClients(alert);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
  } catch (error) {
    console.error('Pattern detection error:', error);
  }
}, 30000); // Every 30 seconds

// Start servers
app.listen(PORT, () => {
  console.log(chalk.green(`\n🚀 PATTERN STREAM API RUNNING!`));
  console.log(chalk.white(`HTTP API: http://localhost:${PORT}`));
  console.log(chalk.white(`WebSocket: ws://localhost:${WS_PORT}`));
  console.log(chalk.cyan(`\nCapabilities:`));
  console.log(`  - Real-time pattern alerts`);
  console.log(`  - Voice alert integration`);
  console.log(`  - Multi-client streaming`);
  console.log(`  - Manual alert triggers`);
  console.log(chalk.yellow(`\nEndpoints:`));
  console.log(`  GET  /stream/status - Connection status`);
  console.log(`  POST /stream/trigger - Manual alert`);
});

// Initial pattern check
setTimeout(async () => {
  console.log(chalk.cyan('\n🔍 Running initial pattern scan...'));
  const alerts = await engine.detectPatterns();
  for (const alert of alerts) {
    await engine.streamToClients(alert);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}, 3000);
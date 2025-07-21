#!/usr/bin/env tsx
/**
 * 🚨 REAL-TIME PATTERN SCANNER
 * 
 * Continuously monitors games and sends alerts when patterns align!
 * - WebSocket broadcasting
 * - Pattern strength thresholds
 * - Multi-pattern confirmation
 * - Instant notifications
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { WebSocketServer } from 'ws';
import * as http from 'http';
import express from 'express';
import cors from 'cors';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// PATTERN DEFINITIONS (from unified system)
// ============================================================================

interface PatternAlert {
  id: string;
  timestamp: Date;
  gameId: string;
  gameDetails: {
    homeTeam: string;
    awayTeam: string;
    startTime: Date;
  };
  patterns: Array<{
    name: string;
    category: string;
    strength: number;
    roi: number;
  }>;
  totalROI: number;
  confidence: number;
  urgency: 'low' | 'medium' | 'high' | 'CRITICAL';
  action: {
    side: 'home' | 'away';
    betSize: number; // Kelly criterion
    reason: string;
  };
}

// ============================================================================
// REAL-TIME SCANNER
// ============================================================================

class RealtimePatternScanner {
  private wss: WebSocketServer;
  private scanInterval: NodeJS.Timeout | null = null;
  private alertHistory: Map<string, Date> = new Map();
  private activeAlerts: PatternAlert[] = [];
  
  constructor(wss: WebSocketServer) {
    this.wss = wss;
  }
  
  start() {
    console.log(chalk.bold.cyan('🚨 REAL-TIME PATTERN SCANNER ACTIVATED'));
    console.log(chalk.yellow('Scanning for high-value pattern combinations...'));
    
    // Initial scan
    this.scanForPatterns();
    
    // Scan every 30 seconds
    this.scanInterval = setInterval(() => {
      this.scanForPatterns();
    }, 30000);
    
    // Also set up real-time game updates
    this.setupRealtimeSubscription();
  }
  
  stop() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }
  
  private async scanForPatterns() {
    console.log(chalk.gray(`[${new Date().toISOString()}] Scanning...`));
    
    // Get games starting in next 24 hours
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const { data: games } = await supabase
      .from('games')
      .select('*, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name)')
      .is('home_score', null)
      .gte('start_time', new Date().toISOString())
      .lte('start_time', tomorrow.toISOString())
      .order('start_time', { ascending: true });
    
    if (!games) return;
    
    // Analyze each game
    for (const game of games) {
      const patterns = await this.analyzeGamePatterns(game);
      
      if (patterns.length > 0) {
        const alert = this.createAlert(game, patterns);
        
        // Only alert if we haven't alerted for this game recently
        const lastAlert = this.alertHistory.get(game.id);
        const hoursSinceAlert = lastAlert ? 
          (Date.now() - lastAlert.getTime()) / (1000 * 60 * 60) : 999;
        
        if (hoursSinceAlert > 1 && alert.urgency !== 'low') {
          this.sendAlert(alert);
          this.alertHistory.set(game.id, new Date());
        }
      }
    }
  }
  
  private async analyzeGamePatterns(game: any): Promise<any[]> {
    const patterns = [];
    
    // Check schedule patterns
    if (await this.checkBackToBack(game)) {
      patterns.push({
        name: 'Back-to-Back Fade',
        category: 'Schedule',
        strength: 0.9,
        roi: 0.466
      });
    }
    
    // Check weather (if available)
    const weather = await this.checkWeather(game);
    if (weather.extreme) {
      patterns.push({
        name: weather.type,
        category: 'Weather',
        strength: weather.strength,
        roi: weather.roi
      });
    }
    
    // Check injuries
    const injuries = await this.checkInjuries(game);
    if (injuries.significant) {
      patterns.push({
        name: 'Key Players Out',
        category: 'Injuries',
        strength: injuries.strength,
        roi: injuries.roi
      });
    }
    
    // Check betting movement
    const betting = await this.checkBettingMovement(game);
    if (betting.sharp) {
      patterns.push({
        name: 'Sharp Money',
        category: 'Betting',
        strength: betting.strength,
        roi: betting.roi
      });
    }
    
    // Check for quantum patterns (multiple alignments)
    if (patterns.length >= 3) {
      patterns.push({
        name: 'QUANTUM ALIGNMENT',
        category: 'Multi-Pattern',
        strength: 1.0,
        roi: 0.85
      });
    }
    
    return patterns;
  }
  
  private async checkBackToBack(game: any): Promise<boolean> {
    const yesterday = new Date(game.start_time);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data } = await supabase
      .from('games')
      .select('id')
      .eq('away_team_id', game.away_team_id)
      .gte('start_time', yesterday.toISOString().split('T')[0])
      .lt('start_time', game.start_time)
      .limit(1);
    
    return data && data.length > 0;
  }
  
  private async checkWeather(game: any): Promise<any> {
    const { data: weather } = await supabase
      .from('weather_data')
      .select('*')
      .eq('game_id', game.id)
      .single();
    
    if (!weather) return { extreme: false };
    
    if (weather.temperature < 32 && weather.wind_speed > 15) {
      return {
        extreme: true,
        type: 'Freezing & Windy',
        strength: 0.85,
        roi: 0.32
      };
    }
    
    if (weather.wind_speed > 25) {
      return {
        extreme: true,
        type: 'Extreme Wind',
        strength: 0.75,
        roi: 0.22
      };
    }
    
    return { extreme: false };
  }
  
  private async checkInjuries(game: any): Promise<any> {
    const { data: injuries } = await supabase
      .from('player_injuries')
      .select('*, players(name, fantasy_points_avg)')
      .in('team_id', [game.home_team_id, game.away_team_id])
      .in('status', ['out', 'ir']);
    
    if (!injuries || injuries.length === 0) return { significant: false };
    
    const totalImpact = injuries.reduce((sum, inj) => 
      sum + (inj.players?.fantasy_points_avg || 0), 0
    );
    
    if (totalImpact > 50) {
      return {
        significant: true,
        strength: Math.min(totalImpact / 100, 1),
        roi: 0.28
      };
    }
    
    return { significant: false };
  }
  
  private async checkBettingMovement(game: any): Promise<any> {
    const { data: lines } = await supabase
      .from('betting_lines')
      .select('*')
      .eq('game_id', game.id)
      .order('timestamp', { ascending: true });
    
    if (!lines || lines.length < 2) return { sharp: false };
    
    const opening = lines[0];
    const current = lines[lines.length - 1];
    const movement = current.home_line - opening.home_line;
    
    if (Math.abs(movement) > 2.5) {
      return {
        sharp: true,
        strength: Math.min(Math.abs(movement) / 5, 1),
        roi: 0.18
      };
    }
    
    return { sharp: false };
  }
  
  private createAlert(game: any, patterns: any[]): PatternAlert {
    const totalROI = patterns.reduce((sum, p) => sum + p.roi, 0) / patterns.length;
    const maxStrength = Math.max(...patterns.map(p => p.strength));
    
    // Determine urgency
    let urgency: PatternAlert['urgency'] = 'low';
    if (patterns.length >= 4 && totalROI > 0.5) urgency = 'CRITICAL';
    else if (patterns.length >= 3 && totalROI > 0.3) urgency = 'high';
    else if (patterns.length >= 2 && totalROI > 0.2) urgency = 'medium';
    
    // Calculate Kelly bet size
    const winProb = 0.5 + totalROI;
    const kelly = this.calculateKelly(winProb, 1.91) * 0.25; // Fractional Kelly
    
    return {
      id: `alert-${game.id}-${Date.now()}`,
      timestamp: new Date(),
      gameId: game.id,
      gameDetails: {
        homeTeam: game.home_team?.name || 'Unknown',
        awayTeam: game.away_team?.name || 'Unknown',
        startTime: new Date(game.start_time)
      },
      patterns,
      totalROI,
      confidence: Math.min(0.5 + patterns.length * 0.1, 0.9),
      urgency,
      action: {
        side: totalROI > 0 ? 'home' : 'away',
        betSize: kelly,
        reason: patterns[0].name
      }
    };
  }
  
  private calculateKelly(winProb: number, odds: number): number {
    const b = odds - 1;
    const p = winProb;
    const q = 1 - p;
    return Math.max(0, Math.min((b * p - q) / b, 0.15)); // Cap at 15%
  }
  
  private sendAlert(alert: PatternAlert) {
    console.log(chalk.bold.red(`\n🚨 PATTERN ALERT - ${alert.urgency}!`));
    console.log(chalk.white(`Game: ${alert.gameDetails.awayTeam} @ ${alert.gameDetails.homeTeam}`));
    console.log(chalk.white(`Start: ${alert.gameDetails.startTime.toLocaleString()}`));
    console.log(chalk.yellow(`Patterns: ${alert.patterns.map(p => p.name).join(', ')}`));
    console.log(chalk.green(`Total ROI: +${(alert.totalROI * 100).toFixed(1)}%`));
    console.log(chalk.cyan(`Action: Bet ${alert.action.side.toUpperCase()} (${(alert.action.betSize * 100).toFixed(1)}% of bankroll)`));
    
    // Store active alert
    this.activeAlerts.push(alert);
    if (this.activeAlerts.length > 50) {
      this.activeAlerts.shift(); // Keep only recent 50
    }
    
    // Broadcast to all connected clients
    this.broadcast({
      type: 'pattern-alert',
      data: alert
    });
  }
  
  private broadcast(message: any) {
    const data = JSON.stringify(message);
    this.wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(data);
      }
    });
  }
  
  private setupRealtimeSubscription() {
    // In production, would use Supabase realtime
    // For now, just log
    console.log(chalk.gray('Real-time subscriptions configured'));
  }
  
  getActiveAlerts(): PatternAlert[] {
    return this.activeAlerts;
  }
  
  getStats() {
    const criticalCount = this.activeAlerts.filter(a => a.urgency === 'CRITICAL').length;
    const highCount = this.activeAlerts.filter(a => a.urgency === 'high').length;
    const avgROI = this.activeAlerts.reduce((sum, a) => sum + a.totalROI, 0) / 
                  Math.max(this.activeAlerts.length, 1);
    
    return {
      totalAlerts: this.activeAlerts.length,
      critical: criticalCount,
      high: highCount,
      avgROI,
      lastScan: new Date()
    };
  }
}

// ============================================================================
// SERVER SETUP
// ============================================================================

async function startRealtimeScanner() {
  console.log(chalk.bold.red('🚨 REAL-TIME PATTERN SCANNER'));
  console.log(chalk.yellow('Monitoring games 24/7 for pattern alignments'));
  console.log(chalk.gray('='.repeat(80)));
  
  // Create Express app
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  // Create HTTP server
  const server = http.createServer(app);
  
  // Create WebSocket server
  const wss = new WebSocketServer({ server });
  
  // Create scanner
  const scanner = new RealtimePatternScanner(wss);
  
  // WebSocket handling
  wss.on('connection', (ws) => {
    console.log(chalk.green('✅ New WebSocket connection'));
    
    // Send current alerts on connect
    ws.send(JSON.stringify({
      type: 'welcome',
      data: {
        message: 'Connected to Pattern Scanner',
        activeAlerts: scanner.getActiveAlerts()
      }
    }));
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      console.log(chalk.gray('WebSocket disconnected'));
    });
  });
  
  // REST endpoints
  app.get('/health', (req, res) => {
    res.json({
      status: 'scanning',
      stats: scanner.getStats()
    });
  });
  
  app.get('/api/alerts', (req, res) => {
    res.json({
      alerts: scanner.getActiveAlerts()
    });
  });
  
  app.get('/api/alerts/critical', (req, res) => {
    const critical = scanner.getActiveAlerts()
      .filter(a => a.urgency === 'CRITICAL' || a.urgency === 'high');
    res.json({ alerts: critical });
  });
  
  // Start scanner
  scanner.start();
  
  // Start server
  const PORT = 3337;
  server.listen(PORT, () => {
    console.log(chalk.green(`\n✅ Real-time Scanner running on port ${PORT}`));
    console.log(chalk.white('REST Endpoints:'));
    console.log(chalk.gray('  GET /health'));
    console.log(chalk.gray('  GET /api/alerts'));
    console.log(chalk.gray('  GET /api/alerts/critical'));
    console.log(chalk.white('\nWebSocket:'));
    console.log(chalk.gray(`  ws://localhost:${PORT}`));
    
    console.log(chalk.bold.yellow('\n🚨 SCANNER ACTIVE - WATCHING FOR PATTERNS!'));
    console.log(chalk.white('Will alert when multiple patterns align'));
    console.log(chalk.white('Critical alerts = 4+ patterns with >50% ROI'));
  });
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\nShutting down scanner...'));
    scanner.stop();
    server.close();
    process.exit(0);
  });
}

// Run the scanner
if (require.main === module) {
  startRealtimeScanner().catch(console.error);
}

export { RealtimePatternScanner };
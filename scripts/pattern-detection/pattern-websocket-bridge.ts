#!/usr/bin/env tsx
/**
 * Pattern Detection to WebSocket Bridge
 * Monitors pattern API for new opportunities and broadcasts to WebSocket clients
 */

import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const PATTERN_API_URL = 'http://localhost:3336';
const WEBSOCKET_URL = 'ws://localhost:8080';
const CHECK_INTERVAL = 30000; // 30 seconds

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

class PatternWebSocketBridge {
  private ws: WebSocket | null = null;
  private lastCheckTime: Date = new Date();
  private sentAlerts = new Set<string>();
  
  async start() {
    console.log(chalk.blue.bold('🌉 Starting Pattern-WebSocket Bridge...'));
    
    // Connect to WebSocket server
    await this.connectWebSocket();
    
    // Start monitoring loop
    this.startMonitoring();
  }
  
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(chalk.yellow('Connecting to WebSocket server...'));
      
      this.ws = new WebSocket(WEBSOCKET_URL);
      
      this.ws.on('open', () => {
        console.log(chalk.green('✅ Connected to WebSocket server'));
        
        // Subscribe to broadcast channel
        this.ws?.send(JSON.stringify({
          type: 'subscribe',
          channels: ['patterns', 'alerts']
        }));
        
        resolve();
      });
      
      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'welcome') {
          console.log(chalk.cyan('Received welcome from server:', message.data.clientId));
        }
      });
      
      this.ws.on('error', (error) => {
        console.error(chalk.red('WebSocket error:'), error);
        reject(error);
      });
      
      this.ws.on('close', () => {
        console.log(chalk.yellow('WebSocket disconnected, reconnecting...'));
        setTimeout(() => this.connectWebSocket(), 5000);
      });
    });
  }
  
  private async startMonitoring() {
    console.log(chalk.blue('🔍 Starting pattern monitoring...'));
    
    // Initial check
    await this.checkForPatterns();
    
    // Schedule regular checks
    setInterval(() => this.checkForPatterns(), CHECK_INTERVAL);
  }
  
  private async checkForPatterns() {
    try {
      // Get current games with upcoming start times
      const { data: upcomingGames } = await supabase
        .from('games')
        .select('*, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name)')
        .gte('start_time', new Date().toISOString())
        .lte('start_time', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
        .limit(20);
      
      if (!upcomingGames || upcomingGames.length === 0) {
        console.log(chalk.gray('No upcoming games to analyze'));
        return;
      }
      
      console.log(chalk.cyan(`Analyzing ${upcomingGames.length} upcoming games...`));
      
      // Analyze each game for patterns
      for (const game of upcomingGames) {
        await this.analyzeGame(game);
      }
      
      // Also check for top plays from pattern API
      await this.checkTopPlays();
      
    } catch (error) {
      console.error(chalk.red('Error checking patterns:'), error);
    }
  }
  
  private async analyzeGame(game: any) {
    const alertKey = `${game.id}-${new Date().toISOString().split('T')[0]}`;
    
    // Skip if we already sent an alert for this game today
    if (this.sentAlerts.has(alertKey)) {
      return;
    }
    
    try {
      const response = await fetch(`${PATTERN_API_URL}/api/unified/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          sport: game.sport_id || 'NFL'
        })
      });
      
      if (!response.ok) return;
      
      const analysis = await response.json();
      
      // Check if any high-confidence patterns triggered
      const triggeredPatterns = analysis.patterns?.filter((p: any) => 
        p.triggered && p.confidence > 0.65
      ) || [];
      
      if (triggeredPatterns.length > 0) {
        const alert = {
          id: alertKey,
          gameId: game.id,
          game: {
            homeTeam: game.home_team?.name || 'Unknown',
            awayTeam: game.away_team?.name || 'Unknown',
            startTime: game.start_time
          },
          patterns: triggeredPatterns.map((p: any) => ({
            name: p.pattern,
            confidence: p.confidence,
            expectedValue: p.expectedValue
          })),
          totalConfidence: analysis.confidence,
          recommendation: analysis.recommendation,
          timestamp: new Date().toISOString()
        };
        
        // Broadcast alert via WebSocket
        this.broadcastAlert(alert);
        
        // Mark as sent
        this.sentAlerts.add(alertKey);
        
        console.log(chalk.green(`🎯 Pattern alert sent for ${alert.game.homeTeam} vs ${alert.game.awayTeam}`));
      }
    } catch (error) {
      console.error(chalk.red(`Error analyzing game ${game.id}:`), error);
    }
  }
  
  private async checkTopPlays() {
    try {
      const response = await fetch(`${PATTERN_API_URL}/api/unified/top-plays`);
      if (!response.ok) return;
      
      const data = await response.json();
      
      if (data.plays && data.plays.length > 0) {
        // Broadcast top plays update
        this.broadcast('pattern:top-plays', {
          plays: data.plays.slice(0, 5), // Top 5 plays
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error(chalk.red('Error checking top plays:'), error);
    }
  }
  
  private broadcastAlert(alert: any) {
    this.broadcast('pattern:alert', alert);
  }
  
  private broadcast(channel: string, data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'broadcast',
        channel,
        data
      }));
    }
  }
}

// Start the bridge
const bridge = new PatternWebSocketBridge();
bridge.start().catch(console.error);

// Handle shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\nShutting down bridge...'));
  process.exit(0);
});
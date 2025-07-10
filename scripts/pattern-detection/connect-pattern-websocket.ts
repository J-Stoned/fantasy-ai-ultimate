#!/usr/bin/env tsx
/**
 * Connect Pattern Detection to WebSocket
 * Bridges pattern API with WebSocket for real-time updates
 */

import WebSocket from 'ws';
import axios from 'axios';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

class PatternWebSocketBridge {
  private ws: WebSocket | null = null;
  private reconnectInterval: any = null;
  private lastPatternCheck = new Date();
  
  async start() {
    console.log(chalk.blue.bold('🌉 PATTERN-WEBSOCKET BRIDGE\n'));
    
    // Connect to WebSocket server
    this.connectWebSocket();
    
    // Start pattern monitoring
    this.startPatternMonitoring();
  }
  
  private connectWebSocket() {
    console.log(chalk.yellow('Connecting to WebSocket server...'));
    
    this.ws = new WebSocket('ws://localhost:8080');
    
    this.ws.on('open', () => {
      console.log(chalk.green('✓ Connected to WebSocket server'));
      
      // Send initial connection message
      this.ws?.send(JSON.stringify({
        type: 'connection',
        source: 'pattern-bridge',
        timestamp: new Date()
      }));
      
      // Clear any reconnect interval
      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
      }
    });
    
    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(chalk.gray(`Received: ${message.type}`));
      } catch (err) {
        // Ignore parse errors
      }
    });
    
    this.ws.on('close', () => {
      console.log(chalk.red('✗ WebSocket disconnected'));
      this.scheduleReconnect();
    });
    
    this.ws.on('error', (err) => {
      console.log(chalk.red(`WebSocket error: ${err.message}`));
    });
  }
  
  private scheduleReconnect() {
    if (!this.reconnectInterval) {
      this.reconnectInterval = setInterval(() => {
        console.log(chalk.yellow('Attempting to reconnect...'));
        this.connectWebSocket();
      }, 5000);
    }
  }
  
  private async startPatternMonitoring() {
    console.log(chalk.cyan('Starting pattern monitoring...\n'));
    
    // Check for new patterns every 30 seconds
    setInterval(async () => {
      await this.checkPatterns();
    }, 30000);
    
    // Initial check
    await this.checkPatterns();
  }
  
  private async checkPatterns() {
    try {
      // Get upcoming games with patterns
      const response = await axios.get('http://localhost:3336/api/upcoming');
      const games = response.data.games || [];
      
      if (games.length > 0) {
        console.log(chalk.green(`Found ${games.length} games with patterns`));
        
        // Send games with high-confidence patterns
        for (const game of games) {
          if (game.patterns && game.patterns.length > 0) {
            for (const pattern of game.patterns) {
              if (pattern.confidence >= 60) { // Only high confidence
                this.broadcastPattern({
                  pattern: pattern.name,
                  game: game,
                  confidence: pattern.confidence,
                  expectedROI: pattern.roi,
                  recommendation: pattern.recommendation || `${pattern.name} detected`
                });
              }
            }
          }
        }
      }
      
      // Also get pattern summary
      const summaryResponse = await axios.get('http://localhost:3336/api/patterns/summary');
      const patterns = summaryResponse.data.patterns || [];
      
      // Broadcast pattern summary
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'pattern:stats',
          data: {
            totalPatterns: patterns.length,
            patterns: patterns.map((p: any) => ({
              name: p.name,
              accuracy: p.accuracy,
              occurrences: p.occurrences,
              avgROI: p.avgROI
            }))
          },
          timestamp: new Date()
        }));
      }
      
    } catch (error: any) {
      console.log(chalk.red(`Pattern check failed: ${error.message}`));
    }
  }
  
  private broadcastPattern(opportunity: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'pattern:alert',
        data: {
          id: opportunity.id || Date.now().toString(),
          pattern: opportunity.pattern,
          game: opportunity.game,
          confidence: opportunity.confidence,
          expectedROI: opportunity.expectedROI,
          recommendation: opportunity.recommendation,
          sport: opportunity.sport || 'NFL',
          timestamp: new Date()
        }
      };
      
      this.ws.send(JSON.stringify(message));
      console.log(chalk.cyan(`→ Broadcast: ${opportunity.pattern} (${opportunity.confidence}% confidence)`));
    }
  }
}

// Test functions
async function testConnections() {
  console.log(chalk.blue.bold('\n🧪 TESTING CONNECTIONS\n'));
  
  // Test Pattern API
  try {
    const patternTest = await axios.get('http://localhost:3336/health');
    console.log(chalk.green('✓ Pattern API is running'));
  } catch (err) {
    console.log(chalk.red('✗ Pattern API not accessible'));
  }
  
  // Test WebSocket
  const testWs = new WebSocket('ws://localhost:8080');
  
  return new Promise((resolve) => {
    testWs.on('open', () => {
      console.log(chalk.green('✓ WebSocket server is running'));
      testWs.close();
      resolve(true);
    });
    
    testWs.on('error', () => {
      console.log(chalk.red('✗ WebSocket server not accessible'));
      resolve(false);
    });
  });
}

// Main
async function main() {
  console.log(chalk.blue.bold('🚀 STARTING PATTERN-WEBSOCKET BRIDGE\n'));
  
  // Test connections first
  const connected = await testConnections();
  
  if (!connected) {
    console.log(chalk.red('\n⚠️  Please ensure both services are running:'));
    console.log('1. Pattern API: npx tsx scripts/unified-pattern-api-real.ts');
    console.log('2. WebSocket: npx tsx scripts/simple-websocket-server.ts');
    return;
  }
  
  console.log('');
  
  // Start bridge
  const bridge = new PatternWebSocketBridge();
  await bridge.start();
  
  console.log(chalk.green('\n✅ Bridge is running!'));
  console.log(chalk.gray('Pattern updates will be broadcast to WebSocket clients'));
}

main().catch(console.error);
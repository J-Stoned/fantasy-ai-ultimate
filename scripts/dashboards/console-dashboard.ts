#!/usr/bin/env tsx
/**
 * 📊 CONSOLE PREDICTION DASHBOARD
 * 
 * Simple console output of real-time predictions
 */

import WebSocket from 'ws';
import chalk from 'chalk';

const WS_URL = 'ws://localhost:8080';

interface Stats {
  totalPredictions: number;
  highConfidence: number;
  predictions: Array<{
    game: string;
    winner: string;
    confidence: number;
    time: string;
  }>;
}

class ConsoleDashboard {
  private ws: WebSocket | null = null;
  private stats: Stats = {
    totalPredictions: 0,
    highConfidence: 0,
    predictions: []
  };
  
  constructor() {
    this.connect();
  }
  
  private connect() {
    console.log(chalk.bold.cyan('\n📊 FANTASY AI CONSOLE DASHBOARD'));
    console.log(chalk.gray('='.repeat(50)));
    console.log(chalk.yellow('Connecting to WebSocket server...'));
    
    this.ws = new WebSocket(WS_URL);
    
    this.ws.on('open', () => {
      console.log(chalk.green('✅ Connected! Waiting for predictions...'));
      console.log(chalk.gray('Press Ctrl+C to exit\n'));
      
      // Subscribe to channels
      this.ws!.send(JSON.stringify({
        type: 'subscribe',
        channels: ['predictions', 'alerts', 'system', 'metrics']
      }));
      
      // Show stats every 10 seconds
      setInterval(() => this.showStats(), 10000);
    });
    
    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error(chalk.red('Error parsing message:'), error);
      }
    });
    
    this.ws.on('error', (error) => {
      console.error(chalk.red('❌ WebSocket error:'), error.message);
    });
    
    this.ws.on('close', () => {
      console.log(chalk.yellow('\n⚠️  Disconnected from server'));
      console.log(chalk.gray('Attempting to reconnect...'));
      
      // Reconnect after 5 seconds
      setTimeout(() => this.connect(), 5000);
    });
  }
  
  private handleMessage(message: any) {
    const timestamp = new Date().toLocaleTimeString();
    
    switch (message.type) {
      case 'predictions':
        if (message.data.type === 'new_prediction') {
          const pred = message.data.data;
          this.stats.totalPredictions++;
          
          if (pred.prediction.confidence > 0.75) {
            this.stats.highConfidence++;
          }
          
          // Add to recent predictions
          this.stats.predictions.unshift({
            game: `${pred.game.homeTeam} vs ${pred.game.awayTeam}`,
            winner: pred.prediction.winner,
            confidence: pred.prediction.confidence,
            time: timestamp
          });
          
          // Keep only last 10
          if (this.stats.predictions.length > 10) {
            this.stats.predictions.pop();
          }
          
          // Display prediction
          const icon = pred.prediction.confidence > 0.75 ? '🔥' : '🔮';
          const color = pred.prediction.confidence > 0.75 ? chalk.yellow : chalk.cyan;
          
          console.log(
            `${icon} ${chalk.gray(`[${timestamp}]`)} ${color(pred.game.homeTeam)} vs ${color(pred.game.awayTeam)} → ` +
            `${chalk.bold(pred.prediction.winner.toUpperCase())} wins ` +
            `(${chalk.green((pred.prediction.confidence * 100).toFixed(1) + '%')})`
          );
        }
        break;
        
      case 'alerts':
        if (message.data.type === 'high_confidence_prediction') {
          console.log(chalk.red.bold(`\n🚨 HIGH CONFIDENCE ALERT: ${message.data.data.message}\n`));
        }
        break;
        
      case 'system':
        if (message.data.type === 'batch_complete') {
          console.log(chalk.green.bold(
            `\n✅ Batch complete: ${message.data.data.predictions} predictions processed\n`
          ));
        }
        break;
        
      case 'metrics':
        if (message.data.type === 'model_accuracy') {
          console.log(chalk.magenta(
            `📈 Model Update: ${message.data.data.model} accuracy = ${(message.data.data.accuracy * 100).toFixed(1)}%`
          ));
        }
        break;
    }
  }
  
  private showStats() {
    console.log(chalk.bold.blue('\n📊 STATS UPDATE'));
    console.log(chalk.gray('='.repeat(30)));
    console.log(`Total Predictions: ${chalk.yellow(this.stats.totalPredictions)}`);
    console.log(`High Confidence: ${chalk.green(this.stats.highConfidence)}`);
    console.log(`Success Rate: ${chalk.cyan(
      this.stats.totalPredictions > 0 ?
        ((this.stats.highConfidence / this.stats.totalPredictions) * 100).toFixed(1) + '%' :
        'N/A'
    )}`);
    console.log(chalk.gray('='.repeat(30) + '\n'));
  }
}

// Start dashboard
const dashboard = new ConsoleDashboard();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Shutting down dashboard...'));
  process.exit(0);
});
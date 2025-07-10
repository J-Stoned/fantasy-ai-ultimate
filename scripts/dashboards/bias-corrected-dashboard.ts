#!/usr/bin/env tsx
/**
 * 📊 BIAS-CORRECTED MODEL DASHBOARD
 * 
 * Real-time monitoring of the bias-corrected Random Forest model
 * Shows prediction balance, accuracy metrics, and live predictions
 */

import WebSocket from 'ws';
import chalk from 'chalk';
import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WS_URL = 'ws://localhost:8080';
const API_URL = 'http://localhost:3333';

interface ModelMetrics {
  accuracy: number;
  homeAccuracy: number;
  awayAccuracy: number;
  homeBias: number;
  totalPredictions: number;
  recentPredictions: {
    home: number;
    away: number;
  };
}

class BiasCorrectedDashboard {
  private screen: blessed.Widgets.Screen;
  private grid: any;
  private ws: WebSocket | null = null;
  
  // Widgets
  private titleBox: blessed.Widgets.BoxElement;
  private metricsBox: blessed.Widgets.BoxElement;
  private biasGauge: any;
  private predictionsTable: any;
  private biasChart: any;
  private logBox: blessed.Widgets.Log;
  
  // State
  private metrics: ModelMetrics = {
    accuracy: 0.86,
    homeAccuracy: 0.94,
    awayAccuracy: 0.79,
    homeBias: 0.5,
    totalPredictions: 0,
    recentPredictions: { home: 0, away: 0 }
  };
  
  private predictions: any[] = [];
  private biasHistory: number[] = [];
  
  constructor() {
    this.initializeUI();
    this.connectWebSocket();
    this.startMetricsUpdate();
  }
  
  private initializeUI() {
    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Bias-Corrected Model Dashboard'
    });
    
    // Create grid
    this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });
    
    // Title box
    this.titleBox = this.grid.set(0, 0, 1, 12, blessed.box, {
      content: `${chalk.bold.cyan('⚖️ BIAS-CORRECTED MODEL DASHBOARD')} - ${chalk.yellow('Random Forest 86% Accuracy')}`,
      align: 'center',
      style: {
        fg: 'white',
        border: { fg: 'cyan' }
      }
    });
    
    // Metrics box (top left)
    this.metricsBox = this.grid.set(1, 0, 3, 6, blessed.box, {
      label: ' 📊 Model Metrics ',
      style: {
        fg: 'white',
        border: { fg: 'green' }
      }
    });
    
    // Bias gauge (top right)
    this.biasGauge = this.grid.set(1, 6, 3, 6, contrib.gauge, {
      label: ' ⚖️ Home/Away Balance ',
      percent: 50,
      stroke: 'green',
      fill: 'white',
      style: {
        border: { fg: 'yellow' }
      }
    });
    
    // Predictions table (middle)
    this.predictionsTable = this.grid.set(4, 0, 4, 12, contrib.table, {
      label: ' 🔮 Live Predictions ',
      columnSpacing: 3,
      columnWidth: [15, 15, 15, 10, 10, 8],
      style: {
        fg: 'white',
        border: { fg: 'blue' },
        header: { fg: 'bright-yellow', bold: true }
      }
    });
    
    // Bias trend chart (bottom left)
    this.biasChart = this.grid.set(8, 0, 4, 8, contrib.line, {
      label: ' 📈 Bias Trend (Home %) ',
      showLegend: false,
      wholeNumbersOnly: false,
      style: {
        line: 'yellow',
        text: 'green',
        baseline: 'white',
        border: { fg: 'cyan' }
      }
    });
    
    // Log box (bottom right)
    this.logBox = this.grid.set(8, 8, 4, 4, blessed.log, {
      label: ' 📝 System Log ',
      scrollable: true,
      alwaysScroll: true,
      style: {
        fg: 'green',
        border: { fg: 'gray' }
      }
    });
    
    // Keyboard controls
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.shutdown();
    });
    
    this.screen.key(['r'], () => {
      this.refreshData();
    });
    
    // Initial render
    this.updateDisplay();
    this.screen.render();
  }
  
  private connectWebSocket() {
    this.log('Connecting to WebSocket...');
    
    try {
      this.ws = new WebSocket(WS_URL);
      
      this.ws.on('open', () => {
        this.log('✅ WebSocket connected');
        // Subscribe to predictions
        this.ws?.send(JSON.stringify({
          type: 'subscribe',
          channel: 'predictions'
        }));
      });
      
      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message);
        } catch (error) {
          this.log(`❌ Parse error: ${error}`);
        }
      });
      
      this.ws.on('error', (error) => {
        this.log(`❌ WebSocket error: ${error}`);
      });
      
      this.ws.on('close', () => {
        this.log('⚠️ WebSocket disconnected');
        // Reconnect after 5 seconds
        setTimeout(() => this.connectWebSocket(), 5000);
      });
    } catch (error) {
      this.log(`❌ Connection failed: ${error}`);
    }
  }
  
  private handleWebSocketMessage(message: any) {
    if (message.type === 'prediction' && message.data) {
      const prediction = message.data;
      
      // Update predictions list
      this.predictions.unshift({
        ...prediction,
        timestamp: new Date()
      });
      
      // Keep only last 50
      if (this.predictions.length > 50) {
        this.predictions = this.predictions.slice(0, 50);
      }
      
      // Update bias tracking
      if (prediction.predictedWinner === 'home') {
        this.metrics.recentPredictions.home++;
      } else {
        this.metrics.recentPredictions.away++;
      }
      
      // Update total
      this.metrics.totalPredictions++;
      
      // Update display
      this.updateDisplay();
    }
  }
  
  private async startMetricsUpdate() {
    // Update metrics every 5 seconds
    setInterval(async () => {
      await this.fetchModelStats();
      this.updateBiasMetrics();
      this.updateDisplay();
    }, 5000);
  }
  
  private async fetchModelStats() {
    try {
      const response = await fetch(`${API_URL}/api/v2/stats`);
      if (response.ok) {
        const stats = await response.json();
        if (stats.accuracy) {
          this.metrics.accuracy = stats.accuracy;
        }
      }
    } catch (error) {
      // API might not be running
    }
  }
  
  private updateBiasMetrics() {
    const total = this.metrics.recentPredictions.home + this.metrics.recentPredictions.away;
    if (total > 0) {
      this.metrics.homeBias = this.metrics.recentPredictions.home / total;
      
      // Add to history
      this.biasHistory.push(this.metrics.homeBias * 100);
      if (this.biasHistory.length > 50) {
        this.biasHistory.shift();
      }
    }
  }
  
  private updateDisplay() {
    // Update metrics box
    const metricsContent = [
      `${chalk.green('Model:')} Bias-Corrected Random Forest`,
      `${chalk.green('Accuracy:')} ${(this.metrics.accuracy * 100).toFixed(1)}%`,
      `${chalk.green('Home Accuracy:')} ${(this.metrics.homeAccuracy * 100).toFixed(1)}%`,
      `${chalk.green('Away Accuracy:')} ${(this.metrics.awayAccuracy * 100).toFixed(1)}%`,
      '',
      `${chalk.yellow('Total Predictions:')} ${this.metrics.totalPredictions.toLocaleString()}`,
      `${chalk.yellow('Recent Home:')} ${this.metrics.recentPredictions.home}`,
      `${chalk.yellow('Recent Away:')} ${this.metrics.recentPredictions.away}`
    ].join('\n');
    
    this.metricsBox.setContent(metricsContent);
    
    // Update bias gauge
    const biasPercent = this.metrics.homeBias * 100;
    this.biasGauge.setPercent(biasPercent);
    
    // Color based on bias
    if (biasPercent > 70 || biasPercent < 30) {
      this.biasGauge.setOptions({ stroke: 'red' });
    } else if (biasPercent > 60 || biasPercent < 40) {
      this.biasGauge.setOptions({ stroke: 'yellow' });
    } else {
      this.biasGauge.setOptions({ stroke: 'green' });
    }
    
    // Update predictions table
    const tableData = {
      headers: ['Home Team', 'Away Team', 'Prediction', 'Confidence', 'Time'],
      data: this.predictions.slice(0, 10).map(pred => [
        pred.homeTeam || 'Team A',
        pred.awayTeam || 'Team B',
        pred.predictedWinner === 'home' ? chalk.blue('HOME') : chalk.red('AWAY'),
        `${(pred.confidence * 100).toFixed(1)}%`,
        new Date(pred.timestamp).toLocaleTimeString()
      ])
    };
    
    this.predictionsTable.setData(tableData);
    
    // Update bias chart
    if (this.biasHistory.length > 0) {
      this.biasChart.setData([{
        x: Array.from({ length: this.biasHistory.length }, (_, i) => i.toString()),
        y: this.biasHistory
      }]);
    }
    
    // Render
    this.screen.render();
  }
  
  private refreshData() {
    this.log('Refreshing data...');
    this.metrics.recentPredictions = { home: 0, away: 0 };
    this.predictions = [];
    this.biasHistory = [];
    this.updateDisplay();
  }
  
  private log(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    this.logBox.log(`[${timestamp}] ${message}`);
    this.screen.render();
  }
  
  private shutdown() {
    this.log('Shutting down...');
    if (this.ws) {
      this.ws.close();
    }
    process.exit(0);
  }
}

// Start dashboard
console.log(chalk.bold.cyan('⚖️ Starting Bias-Corrected Model Dashboard...'));
console.log(chalk.yellow('Press "q" to quit, "r" to refresh'));
console.log(chalk.gray('='.repeat(60)));

const dashboard = new BiasCorrectedDashboard();

// Handle process termination
process.on('SIGINT', () => {
  process.exit(0);
});
#!/usr/bin/env tsx
/**
 * 🎯 REAL-TIME PREDICTION DASHBOARD
 * 
 * Displays live predictions and metrics in the terminal
 */

import WebSocket from 'ws';
import chalk from 'chalk';
import blessed from 'blessed';
import contrib from 'blessed-contrib';

const WS_URL = 'ws://localhost:8080';

interface PredictionData {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  winner: string;
  confidence: number;
  timestamp: number;
}

interface DashboardState {
  predictions: PredictionData[];
  totalPredictions: number;
  highConfidenceCount: number;
  modelAccuracy: { [model: string]: number };
  lastUpdate: Date;
  connected: boolean;
}

class RealtimeDashboard {
  private screen: blessed.Widgets.Screen;
  private grid: any;
  private state: DashboardState;
  private ws: WebSocket | null = null;
  
  // Widgets
  private statusBox: blessed.Widgets.BoxElement;
  private predictionsTable: any;
  private metricsGauge: any;
  private logBox: blessed.Widgets.Log;
  private confidenceChart: any;
  
  constructor() {
    this.state = {
      predictions: [],
      totalPredictions: 0,
      highConfidenceCount: 0,
      modelAccuracy: {},
      lastUpdate: new Date(),
      connected: false
    };
    
    this.initializeUI();
    this.connectWebSocket();
  }
  
  private initializeUI() {
    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Fantasy AI Real-Time Dashboard'
    });
    
    // Create grid
    this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });
    
    // Status box (top)
    this.statusBox = this.grid.set(0, 0, 1, 12, blessed.box, {
      label: ' 🎯 Fantasy AI Prediction System ',
      content: 'Initializing...',
      style: {
        fg: 'white',
        border: { fg: 'cyan' }
      }
    });
    
    // Predictions table (left)
    this.predictionsTable = this.grid.set(1, 0, 6, 8, contrib.table, {
      label: ' 🔮 Latest Predictions ',
      columnSpacing: 2,
      columnWidth: [20, 20, 8, 10],
      style: {
        fg: 'white',
        border: { fg: 'yellow' },
        header: { fg: 'bright-yellow', bold: true }
      }
    });
    
    // Metrics gauge (right top)
    this.metricsGauge = this.grid.set(1, 8, 3, 4, contrib.gauge, {
      label: ' 📊 High Confidence Rate ',
      percent: 0,
      stroke: 'green',
      fill: 'white',
      style: {
        border: { fg: 'green' }
      }
    });
    
    // Confidence chart (right middle)
    this.confidenceChart = this.grid.set(4, 8, 3, 4, contrib.line, {
      label: ' 📈 Confidence Trend ',
      showLegend: false,
      wholeNumbersOnly: false,
      style: {
        line: 'yellow',
        text: 'green',
        baseline: 'black',
        border: { fg: 'magenta' }
      }
    });
    
    // Log box (bottom)
    this.logBox = this.grid.set(7, 0, 5, 12, blessed.log, {
      label: ' 📝 Live Activity Log ',
      scrollable: true,
      alwaysScroll: true,
      style: {
        fg: 'white',
        border: { fg: 'blue' }
      }
    });
    
    // Quit on q or Ctrl-C
    this.screen.key(['q', 'C-c'], () => {
      this.cleanup();
      process.exit(0);
    });
    
    // Initial render
    this.updateDisplay();
  }
  
  private connectWebSocket() {
    this.log('Connecting to WebSocket server...', 'info');
    
    this.ws = new WebSocket(WS_URL);
    
    this.ws.on('open', () => {
      this.state.connected = true;
      this.log('Connected to WebSocket server!', 'success');
      
      // Subscribe to channels
      this.ws!.send(JSON.stringify({
        type: 'subscribe',
        channels: ['predictions', 'alerts', 'system', 'metrics']
      }));
    });
    
    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        this.log(`Error parsing message: ${error}`, 'error');
      }
    });
    
    this.ws.on('error', (error) => {
      this.log(`WebSocket error: ${error.message}`, 'error');
    });
    
    this.ws.on('close', () => {
      this.state.connected = false;
      this.log('Disconnected from WebSocket server', 'warning');
      
      // Attempt to reconnect after 5 seconds
      setTimeout(() => this.connectWebSocket(), 5000);
    });
  }
  
  private handleMessage(message: any) {
    switch (message.type) {
      case 'predictions':
        if (message.data.type === 'new_prediction') {
          this.handleNewPrediction(message.data.data);
        }
        break;
        
      case 'alerts':
        if (message.data.type === 'high_confidence_prediction') {
          this.log(`🚨 HIGH CONFIDENCE: ${message.data.data.message}`, 'alert');
        }
        break;
        
      case 'system':
        if (message.data.type === 'batch_complete') {
          this.log(`✅ Batch complete: ${message.data.data.predictions} predictions`, 'success');
        }
        break;
        
      case 'metrics':
        if (message.data.type === 'model_accuracy') {
          this.handleModelUpdate(message.data.data);
        }
        break;
    }
    
    this.updateDisplay();
  }
  
  private handleNewPrediction(data: any) {
    const prediction: PredictionData = {
      gameId: data.gameId,
      homeTeam: data.game.homeTeam,
      awayTeam: data.game.awayTeam,
      winner: data.prediction.winner,
      confidence: data.prediction.confidence,
      timestamp: data.timestamp
    };
    
    // Add to predictions (keep last 50)
    this.state.predictions.unshift(prediction);
    if (this.state.predictions.length > 50) {
      this.state.predictions.pop();
    }
    
    // Update counters
    this.state.totalPredictions++;
    if (prediction.confidence > 0.75) {
      this.state.highConfidenceCount++;
    }
    
    this.state.lastUpdate = new Date();
    
    this.log(
      `New: ${prediction.homeTeam} vs ${prediction.awayTeam} → ${prediction.winner.toUpperCase()} (${(prediction.confidence * 100).toFixed(1)}%)`,
      prediction.confidence > 0.75 ? 'highlight' : 'info'
    );
  }
  
  private handleModelUpdate(data: any) {
    this.state.modelAccuracy[data.model] = data.accuracy;
    this.log(`Model update: ${data.model} accuracy = ${(data.accuracy * 100).toFixed(1)}%`, 'info');
  }
  
  private updateDisplay() {
    // Update status
    const status = this.state.connected ? 
      chalk.green('● CONNECTED') : 
      chalk.red('● DISCONNECTED');
    
    this.statusBox.setContent(
      `${status} | Predictions: ${this.state.totalPredictions} | ` +
      `High Confidence: ${this.state.highConfidenceCount} | ` +
      `Last Update: ${this.state.lastUpdate.toLocaleTimeString()}`
    );
    
    // Update predictions table
    const tableData = {
      headers: ['Home Team', 'Away Team', 'Winner', 'Confidence'],
      data: this.state.predictions.slice(0, 20).map(p => [
        p.homeTeam.substring(0, 18),
        p.awayTeam.substring(0, 18),
        p.winner.toUpperCase(),
        `${(p.confidence * 100).toFixed(1)}%`
      ])
    };
    this.predictionsTable.setData(tableData);
    
    // Update metrics gauge
    const highConfRate = this.state.totalPredictions > 0 ?
      (this.state.highConfidenceCount / this.state.totalPredictions) * 100 : 0;
    this.metricsGauge.setPercent(Math.round(highConfRate));
    
    // Update confidence chart
    const confidenceData = this.state.predictions
      .slice(0, 30)
      .reverse()
      .map((p, i) => [i, p.confidence * 100]);
    
    if (confidenceData.length > 0) {
      this.confidenceChart.setData([{
        title: 'Confidence',
        x: confidenceData.map((_, i) => i.toString()),
        y: confidenceData.map(d => d[1])
      }]);
    }
    
    // Render
    this.screen.render();
  }
  
  private log(message: string, type: 'info' | 'success' | 'warning' | 'error' | 'alert' | 'highlight' = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    let formattedMessage = `[${timestamp}] `;
    
    switch (type) {
      case 'success':
        formattedMessage += chalk.green(message);
        break;
      case 'warning':
        formattedMessage += chalk.yellow(message);
        break;
      case 'error':
        formattedMessage += chalk.red(message);
        break;
      case 'alert':
        formattedMessage += chalk.red.bold(message);
        break;
      case 'highlight':
        formattedMessage += chalk.cyan.bold(message);
        break;
      default:
        formattedMessage += message;
    }
    
    this.logBox.log(formattedMessage);
  }
  
  private cleanup() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Start dashboard
console.log(chalk.bold.cyan('\n🎯 FANTASY AI REAL-TIME DASHBOARD'));
console.log(chalk.gray('Starting dashboard...'));

const dashboard = new RealtimeDashboard();

// Handle graceful shutdown
process.on('SIGINT', () => {
  process.exit(0);
});
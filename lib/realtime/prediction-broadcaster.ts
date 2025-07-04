/**
 * 🔥 PREDICTION BROADCASTER
 * 
 * Integrates prediction service with WebSocket for real-time updates
 */

import WebSocket from 'ws';
import chalk from 'chalk';

export interface PredictionUpdate {
  gameId: string;
  prediction: {
    winner: 'home' | 'away';
    homeWinProbability: number;
    confidence: number;
    models: Record<string, number>;
  };
  game: {
    homeTeam: string;
    awayTeam: string;
    startTime: string;
    sport: string;
  };
  timestamp: number;
}

export class PredictionBroadcaster {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private predictionCount = 0;
  private messageQueue: any[] = [];
  
  constructor() {}
  
  /**
   * Initialize connection to WebSocket server
   */
  async initialize(port: number = 8080): Promise<void> {
    return new Promise((resolve) => {
      try {
        // Connect as a client to the WebSocket server
        this.ws = new WebSocket(`ws://localhost:${port}`);
        
        this.ws.on('open', () => {
          this.isConnected = true;
          console.log(chalk.green('✅ Connected to WebSocket broadcaster'));
          
          // Subscribe to system channel for server broadcasts
          this.ws!.send(JSON.stringify({
            type: 'subscribe',
            channels: ['system']
          }));
          
          // Process any queued messages
          this.processQueue();
          
          resolve();
        });
        
        this.ws.on('error', (error) => {
          console.log(chalk.yellow('⚠️  WebSocket connection error:', error.message));
          this.isConnected = false;
          resolve(); // Still resolve so service can continue
        });
        
        this.ws.on('close', () => {
          this.isConnected = false;
          console.log(chalk.yellow('⚠️  Disconnected from WebSocket server'));
        });
        
        // Set a timeout for connection
        setTimeout(() => {
          if (!this.isConnected) {
            console.log(chalk.yellow('⚠️  WebSocket connection timeout'));
            resolve();
          }
        }, 5000);
      } catch (error) {
        console.log(chalk.yellow('⚠️  WebSocket server not available'));
        this.isConnected = false;
        resolve();
      }
    });
  }
  
  /**
   * Process queued messages
   */
  private processQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      this.ws.send(JSON.stringify(message));
    }
  }
  
  /**
   * Broadcast a new prediction
   */
  broadcastPrediction(update: PredictionUpdate): void {
    if (!this.isConnected || !this.ws) {
      // Queue message if not connected
      this.messageQueue.push({
        type: 'broadcast',
        channel: 'predictions',
        data: {
          type: 'new_prediction',
          data: update
        }
      });
      return;
    }
    
    this.predictionCount++;
    
    // Send broadcast message to server
    const message = {
      type: 'broadcast',
      channel: 'predictions',
      data: {
        type: 'new_prediction',
        data: update
      }
    };
    
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      
      // Also broadcast game-specific update
      this.ws.send(JSON.stringify({
        type: 'broadcast',
        channel: `game_${update.gameId}`,
        data: {
          type: 'game_prediction',
          data: update
        }
      }));
      
      // If high confidence, send alert
      if (update.prediction.confidence > 0.75) {
        this.ws.send(JSON.stringify({
          type: 'broadcast',
          channel: 'alerts',
          data: {
            type: 'high_confidence_prediction',
            data: {
              ...update,
              message: `High confidence prediction: ${update.game.homeTeam} vs ${update.game.awayTeam}`
            }
          }
        }));
      }
    }
  }
  
  /**
   * Broadcast prediction batch complete
   */
  broadcastBatchComplete(count: number, sport?: string): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    this.ws.send(JSON.stringify({
      type: 'broadcast',
      channel: 'system',
      data: {
        type: 'batch_complete',
        data: {
          predictions: count,
          sport: sport || 'all',
          timestamp: Date.now()
        }
      }
    }));
  }
  
  /**
   * Broadcast model performance update
   */
  broadcastModelUpdate(accuracy: number, modelName: string): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    this.ws.send(JSON.stringify({
      type: 'broadcast',
      channel: 'metrics',
      data: {
        type: 'model_accuracy',
        data: {
          model: modelName,
          accuracy: accuracy,
          predictions: this.predictionCount,
          timestamp: Date.now()
        }
      }
    }));
  }
  
  /**
   * Get broadcaster metrics
   */
  getMetrics() {
    return {
      connected: this.isConnected,
      predictionsBroadcast: this.predictionCount,
      queueSize: this.messageQueue.length
    };
  }
  
  /**
   * Check if broadcaster is available
   */
  isAvailable(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const predictionBroadcaster = new PredictionBroadcaster();
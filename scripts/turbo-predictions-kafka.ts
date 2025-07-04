#!/usr/bin/env tsx
/**
 * 🚀 TURBO PREDICTIONS WITH KAFKA STREAMING
 * Publishes all predictions to Kafka for real-time consumption
 */

import { TurboPredictionService } from './turbo-prediction-service';
import { kafkaClient, PredictionEvent } from '../lib/kafka/kafka-client';
import { WebSocketManager } from '../lib/streaming/websocket-server';
import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';

class TurboPredictionKafkaService extends TurboPredictionService {
  private kafkaEnabled = true;
  private batchBuffer: PredictionEvent[] = [];
  private batchSize = 100;
  private batchInterval: NodeJS.Timer | null = null;
  
  async initialize() {
    console.log(chalk.bold.cyan('🚀 TURBO PREDICTIONS WITH KAFKA STREAMING\n'));
    
    // Initialize Kafka producer
    try {
      await kafkaClient.initProducer();
      console.log(chalk.green('✅ Kafka producer ready'));
      
      // Start batch interval
      this.batchInterval = setInterval(() => {
        this.flushBatch();
      }, 1000); // Flush every second
    } catch (error) {
      console.log(chalk.yellow('⚠️  Kafka not available, continuing without streaming'));
      this.kafkaEnabled = false;
    }
    
    // Initialize parent service
    await super.initialize();
  }
  
  // Override to add Kafka publishing
  async processBatch(games: any[]) {
    const startTime = Date.now();
    
    // Get predictions from parent
    const predictions = await super.processBatch(games);
    
    // Convert to Kafka events
    if (this.kafkaEnabled && predictions.length > 0) {
      const events: PredictionEvent[] = predictions.map(pred => ({
        eventId: uuidv4(),
        timestamp: Date.now(),
        gameId: pred.gameId,
        prediction: {
          winner: pred.prediction.winner,
          confidence: pred.prediction.confidence,
          homeWinProbability: pred.prediction.homeWinProbability,
          spread: pred.prediction.spread
        },
        model: {
          name: 'turbo_v1',
          version: '1.0.0',
          type: pred.prediction.model || 'ensemble'
        },
        features: pred.features
      }));
      
      // Add to batch buffer
      this.batchBuffer.push(...events);
      
      // Flush if buffer is full
      if (this.batchBuffer.length >= this.batchSize) {
        await this.flushBatch();
      }
    }
    
    return predictions;
  }
  
  // Flush batch to Kafka
  async flushBatch() {
    if (this.batchBuffer.length === 0) return;
    
    const batch = [...this.batchBuffer];
    this.batchBuffer = [];
    
    try {
      await kafkaClient.sendPredictionsBatch(batch);
      
      // Send metrics
      await kafkaClient.sendMLMetrics([{
        eventId: uuidv4(),
        timestamp: Date.now(),
        metric: 'predictions_published',
        value: batch.length,
        model: 'turbo_v1',
        metadata: {
          batchSize: batch.length,
          avgConfidence: batch.reduce((sum, e) => sum + e.prediction.confidence, 0) / batch.length
        }
      }]);
      
      // Check for hot predictions
      const hotPredictions = batch.filter(e => e.prediction.confidence > 0.85);
      for (const hot of hotPredictions) {
        await kafkaClient.sendNotification({
          eventId: uuidv4(),
          timestamp: Date.now(),
          type: 'hot_prediction',
          title: '🔥 Hot Prediction Alert!',
          message: `${hot.prediction.confidence * 100}% confidence on game ${hot.gameId}`,
          data: {
            gameId: hot.gameId,
            prediction: hot.prediction,
            model: hot.model
          }
        });
      }
    } catch (error) {
      console.error(chalk.red('Failed to publish to Kafka:'), error);
    }
  }
  
  // Show enhanced stats
  showStats() {
    super.showStats();
    
    if (this.kafkaEnabled) {
      console.log(chalk.bold.yellow('\n📡 KAFKA STREAMING:'));
      console.log(chalk.green(`   Buffer Size: ${this.batchBuffer.length}`));
      console.log(chalk.green(`   Events/Second: ${(this.stats.totalPredictions / (Date.now() - this.startTime) * 1000).toFixed(0)}`));
    }
  }
  
  // Graceful shutdown
  async shutdown() {
    // Flush remaining batch
    if (this.batchBuffer.length > 0) {
      await this.flushBatch();
    }
    
    // Clear interval
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
    }
    
    // Shutdown Kafka
    await kafkaClient.shutdown();
    
    // Parent shutdown
    process.exit(0);
  }
}

// Start service
const service = new TurboPredictionKafkaService();

// Handle shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\nShutting down gracefully...'));
  await service.shutdown();
});

// Initialize and run
service.initialize().catch(console.error);
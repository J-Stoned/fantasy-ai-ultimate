/**
 * 🚀 KAFKA CLIENT FOR FANTASY AI
 * High-performance event streaming
 */

import { Kafka, Producer, Consumer, EachMessagePayload, logLevel } from 'kafkajs';
import chalk from 'chalk';

// Kafka event types
export interface PredictionEvent {
  eventId: string;
  timestamp: number;
  gameId: string;
  prediction: {
    winner: 'home' | 'away';
    confidence: number;
    homeWinProbability: number;
    spread?: number;
  };
  model: {
    name: string;
    version: string;
    type: 'neural_network' | 'random_forest' | 'ensemble';
  };
  features?: Record<string, number>;
}

export interface GameEvent {
  eventId: string;
  timestamp: number;
  gameId: string;
  type: 'scheduled' | 'started' | 'completed' | 'cancelled';
  teams: {
    home: string;
    away: string;
  };
  score?: {
    home: number;
    away: number;
  };
}

export interface MLMetricEvent {
  eventId: string;
  timestamp: number;
  metric: string;
  value: number;
  model: string;
  metadata?: Record<string, any>;
}

export interface NotificationEvent {
  eventId: string;
  timestamp: number;
  userId?: string;
  type: 'hot_prediction' | 'high_confidence' | 'streak_alert' | 'model_update';
  title: string;
  message: string;
  data: Record<string, any>;
}

// Kafka client configuration
export class KafkaClient {
  private kafka: Kafka;
  private producer?: Producer;
  private consumers: Map<string, Consumer> = new Map();
  
  constructor() {
    this.kafka = new Kafka({
      clientId: 'fantasy-ai',
      brokers: process.env.KAFKA_BROKERS?.split(',') || [
        'localhost:9092',
        'localhost:9093',
        'localhost:9094'
      ],
      logLevel: logLevel.INFO,
      retry: {
        initialRetryTime: 100,
        retries: 8
      },
      connectionTimeout: 10000,
      requestTimeout: 30000,
    });
  }
  
  // Initialize producer
  async initProducer(): Promise<Producer> {
    if (!this.producer) {
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: false,
        transactionTimeout: 30000,
        compression: 1, // GZIP compression
        maxInFlightRequests: 5,
        idempotent: true,
        retry: {
          retries: 5
        }
      });
      
      await this.producer.connect();
      console.log(chalk.green('✅ Kafka producer connected'));
    }
    
    return this.producer;
  }
  
  // Initialize consumer
  async initConsumer(groupId: string, topics: string[]): Promise<Consumer> {
    const consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxBytesPerPartition: 1048576, // 1MB
      retry: {
        retries: 5
      }
    });
    
    await consumer.connect();
    await consumer.subscribe({ topics, fromBeginning: false });
    
    this.consumers.set(groupId, consumer);
    console.log(chalk.green(`✅ Kafka consumer '${groupId}' connected to topics: ${topics.join(', ')}`));
    
    return consumer;
  }
  
  // Send prediction event
  async sendPrediction(prediction: PredictionEvent): Promise<void> {
    const producer = await this.initProducer();
    
    await producer.send({
      topic: 'predictions',
      messages: [{
        key: prediction.gameId,
        value: JSON.stringify(prediction),
        timestamp: Date.now().toString(),
        headers: {
          'event-type': 'prediction',
          'model': prediction.model.name
        }
      }],
    });
  }
  
  // Send game event
  async sendGameEvent(event: GameEvent): Promise<void> {
    const producer = await this.initProducer();
    
    await producer.send({
      topic: 'game-events',
      messages: [{
        key: event.gameId,
        value: JSON.stringify(event),
        timestamp: Date.now().toString(),
        headers: {
          'event-type': event.type
        }
      }],
    });
  }
  
  // Send ML metrics
  async sendMLMetrics(metrics: MLMetricEvent[]): Promise<void> {
    const producer = await this.initProducer();
    
    await producer.send({
      topic: 'ml-metrics',
      messages: metrics.map(metric => ({
        key: metric.model,
        value: JSON.stringify(metric),
        timestamp: Date.now().toString()
      })),
    });
  }
  
  // Send notification
  async sendNotification(notification: NotificationEvent): Promise<void> {
    const producer = await this.initProducer();
    
    await producer.send({
      topic: 'notifications',
      messages: [{
        key: notification.userId || 'broadcast',
        value: JSON.stringify(notification),
        timestamp: Date.now().toString(),
        headers: {
          'notification-type': notification.type
        }
      }],
    });
  }
  
  // Batch send predictions (high performance)
  async sendPredictionsBatch(predictions: PredictionEvent[]): Promise<void> {
    const producer = await this.initProducer();
    
    const topicMessages = predictions.map(pred => ({
      key: pred.gameId,
      value: JSON.stringify(pred),
      timestamp: Date.now().toString(),
      headers: {
        'event-type': 'prediction',
        'model': pred.model.name
      }
    }));
    
    // Send in batches of 1000
    const batchSize = 1000;
    for (let i = 0; i < topicMessages.length; i += batchSize) {
      const batch = topicMessages.slice(i, i + batchSize);
      await producer.send({
        topic: 'predictions',
        messages: batch,
        compression: 1, // GZIP
      });
    }
    
    console.log(chalk.cyan(`📡 Sent ${predictions.length} predictions to Kafka`));
  }
  
  // Start consuming messages
  async startConsumer(
    groupId: string,
    topics: string[],
    messageHandler: (payload: EachMessagePayload) => Promise<void>
  ): Promise<void> {
    const consumer = await this.initConsumer(groupId, topics);
    
    await consumer.run({
      autoCommit: true,
      autoCommitInterval: 5000,
      eachMessage: async (payload) => {
        try {
          await messageHandler(payload);
        } catch (error) {
          console.error(chalk.red(`Error processing message: ${error}`));
        }
      },
    });
  }
  
  // Get consumer lag
  async getConsumerLag(groupId: string): Promise<Map<string, number>> {
    const consumer = this.consumers.get(groupId);
    if (!consumer) throw new Error(`Consumer ${groupId} not found`);
    
    const admin = this.kafka.admin();
    await admin.connect();
    
    try {
      const topics = await admin.listTopics();
      const offsets = await admin.fetchOffsets({ groupId, topics });
      
      const lag = new Map<string, number>();
      // Calculate lag per topic/partition
      
      return lag;
    } finally {
      await admin.disconnect();
    }
  }
  
  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log(chalk.yellow('Shutting down Kafka connections...'));
    
    if (this.producer) {
      await this.producer.disconnect();
    }
    
    for (const [groupId, consumer] of this.consumers) {
      await consumer.disconnect();
      console.log(chalk.gray(`Disconnected consumer: ${groupId}`));
    }
    
    console.log(chalk.green('✅ Kafka connections closed'));
  }
}

// Singleton instance
export const kafkaClient = new KafkaClient();
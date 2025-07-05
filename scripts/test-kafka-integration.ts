#!/usr/bin/env tsx
/**
 * 🧪 TEST KAFKA INTEGRATION
 * Verifies the entire event streaming pipeline
 */

import chalk from 'chalk';
import { kafkaClient, PredictionEvent, NotificationEvent } from '../lib/kafka/kafka-client';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class KafkaIntegrationTest {
  private testsPassed = 0;
  private testsFailed = 0;
  
  async run() {
    console.log(chalk.bold.cyan('\n🧪 KAFKA INTEGRATION TEST\n'));
    
    // Test 1: Check if Kafka is running
    await this.testKafkaRunning();
    
    // Test 2: Initialize producer
    await this.testProducer();
    
    // Test 3: Send test prediction
    await this.testSendPrediction();
    
    // Test 4: Send batch predictions
    await this.testBatchPredictions();
    
    // Test 5: Test consumer
    await this.testConsumer();
    
    // Test 6: Test notifications
    await this.testNotifications();
    
    // Show results
    this.showResults();
  }
  
  async testKafkaRunning() {
    console.log(chalk.yellow('1. Testing Kafka cluster...'));
    
    try {
      const { stdout } = await execAsync('docker ps | grep kafka | wc -l');
      const kafkaContainers = parseInt(stdout.trim());
      
      if (kafkaContainers >= 3) {
        console.log(chalk.green(`   ✅ Kafka cluster running (${kafkaContainers} brokers)`));
        this.testsPassed++;
      } else {
        console.log(chalk.red(`   ❌ Kafka not running (found ${kafkaContainers} brokers)`));
        console.log(chalk.gray('   Run: docker-compose -f docker-compose.kafka.yml up -d'));
        this.testsFailed++;
      }
    } catch (error) {
      console.log(chalk.red('   ❌ Docker check failed'));
      this.testsFailed++;
    }
  }
  
  async testProducer() {
    console.log(chalk.yellow('\n2. Testing Kafka producer...'));
    
    try {
      await kafkaClient.initProducer();
      console.log(chalk.green('   ✅ Producer initialized'));
      this.testsPassed++;
    } catch (error) {
      console.log(chalk.red(`   ❌ Producer failed: ${error}`));
      this.testsFailed++;
    }
  }
  
  async testSendPrediction() {
    console.log(chalk.yellow('\n3. Testing prediction event...'));
    
    try {
      const prediction: PredictionEvent = {
        eventId: uuidv4(),
        timestamp: Date.now(),
        gameId: 'test-game-123',
        prediction: {
          winner: 'home',
          confidence: 0.85,
          homeWinProbability: 0.85,
          spread: 7.5
        },
        model: {
          name: 'test_model',
          version: '1.0.0',
          type: 'ensemble'
        }
      };
      
      await kafkaClient.sendPrediction(prediction);
      console.log(chalk.green('   ✅ Prediction sent to Kafka'));
      this.testsPassed++;
    } catch (error) {
      console.log(chalk.red(`   ❌ Failed to send prediction: ${error}`));
      this.testsFailed++;
    }
  }
  
  async testBatchPredictions() {
    console.log(chalk.yellow('\n4. Testing batch predictions...'));
    
    try {
      const predictions: PredictionEvent[] = Array(100).fill(null).map((_, i) => ({
        eventId: uuidv4(),
        timestamp: Date.now(),
        gameId: `batch-game-${i}`,
        prediction: {
          winner: Math.random() > 0.5 ? 'home' : 'away',
          confidence: 0.5 + Math.random() * 0.5,
          homeWinProbability: Math.random()
        },
        model: {
          name: 'turbo_v1',
          version: '1.0.0',
          type: 'ensemble'
        }
      }));
      
      const start = Date.now();
      await kafkaClient.sendPredictionsBatch(predictions);
      const duration = Date.now() - start;
      
      console.log(chalk.green(`   ✅ Sent ${predictions.length} predictions in ${duration}ms`));
      console.log(chalk.gray(`   Throughput: ${(predictions.length / duration * 1000).toFixed(0)} events/sec`));
      this.testsPassed++;
    } catch (error) {
      console.log(chalk.red(`   ❌ Batch send failed: ${error}`));
      this.testsFailed++;
    }
  }
  
  async testConsumer() {
    console.log(chalk.yellow('\n5. Testing Kafka consumer...'));
    
    try {
      let messagesReceived = 0;
      
      // Start consumer
      const consumerPromise = kafkaClient.startConsumer(
        'test-consumer',
        ['predictions'],
        async ({ topic, message }) => {
          messagesReceived++;
          if (messagesReceived === 1) {
            console.log(chalk.green('   ✅ Consumer receiving messages'));
            console.log(chalk.gray(`   First message from topic: ${topic}`));
          }
        }
      );
      
      // Send a test message
      await kafkaClient.sendPrediction({
        eventId: uuidv4(),
        timestamp: Date.now(),
        gameId: 'consumer-test',
        prediction: {
          winner: 'home',
          confidence: 0.99,
          homeWinProbability: 0.99
        },
        model: {
          name: 'test',
          version: '1.0.0',
          type: 'neural_network'
        }
      });
      
      // Wait a bit for consumer
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (messagesReceived > 0) {
        console.log(chalk.green(`   ✅ Consumer working (${messagesReceived} messages)`));
        this.testsPassed++;
      } else {
        console.log(chalk.red('   ❌ Consumer not receiving messages'));
        this.testsFailed++;
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Consumer test failed: ${error}`));
      this.testsFailed++;
    }
  }
  
  async testNotifications() {
    console.log(chalk.yellow('\n6. Testing notifications...'));
    
    try {
      const notification: NotificationEvent = {
        eventId: uuidv4(),
        timestamp: Date.now(),
        type: 'hot_prediction',
        title: '🔥 Test Hot Prediction!',
        message: '95% confidence prediction detected',
        data: {
          gameId: 'hot-game-123',
          confidence: 0.95,
          teams: 'Lakers vs Warriors'
        }
      };
      
      await kafkaClient.sendNotification(notification);
      console.log(chalk.green('   ✅ Notification sent'));
      this.testsPassed++;
    } catch (error) {
      console.log(chalk.red(`   ❌ Notification failed: ${error}`));
      this.testsFailed++;
    }
  }
  
  showResults() {
    console.log(chalk.bold.cyan('\n📊 TEST RESULTS:\n'));
    console.log(chalk.green(`   Passed: ${this.testsPassed}`));
    console.log(chalk.red(`   Failed: ${this.testsFailed}`));
    
    if (this.testsFailed === 0) {
      console.log(chalk.bold.green('\n🎉 ALL TESTS PASSED! Kafka integration is working!'));
      console.log(chalk.cyan('\nNext steps:'));
      console.log('   1. Start Kafka UI: http://localhost:8090');
      console.log('   2. Run turbo predictions with Kafka: npx tsx scripts/turbo-predictions-kafka.ts');
      console.log('   3. Start WebSocket + Kafka: npx tsx lib/streaming/websocket-kafka-consumer.ts');
    } else {
      console.log(chalk.bold.red('\n⚠️  Some tests failed. Check Kafka setup.'));
      console.log(chalk.yellow('\nTo start Kafka:'));
      console.log('   docker-compose -f docker-compose.kafka.yml up -d');
      console.log('   ./scripts/kafka-setup.sh');
    }
    
    // Cleanup
    kafkaClient.shutdown();
  }
}

// Run tests
const test = new KafkaIntegrationTest();
test.run().catch(console.error);
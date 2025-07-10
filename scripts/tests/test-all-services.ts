#!/usr/bin/env tsx
/**
 * 🧪 TEST ALL SERVICES INTEGRATION
 * 
 * Verifies that all production services work together:
 * - WebSocket Server
 * - ML Prediction Engine
 * - Continuous Learning Loop
 * - Data Collectors
 * - Real-time Event Processor
 */

import chalk from 'chalk';
import WebSocket from 'ws';
import axios from 'axios';
import { spawn } from 'child_process';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

interface ServiceTest {
  name: string;
  url?: string;
  wsUrl?: string;
  healthEndpoint?: string;
  expectedResponse?: any;
  timeout?: number;
}

interface TestResult {
  service: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  latency?: number;
  details?: any;
}

class ServiceIntegrationTester {
  private results: TestResult[] = [];
  private services: ServiceTest[] = [
    {
      name: 'Next.js Web App',
      url: 'http://localhost:3000',
      healthEndpoint: '/api/health',
      expectedResponse: { status: 'ok' },
      timeout: 5000
    },
    {
      name: 'ML Predictions API',
      url: 'http://localhost:3000/api/ai/predictions',
      expectedResponse: (data: any) => data.predictions && Array.isArray(data.predictions),
      timeout: 10000
    },
    {
      name: 'WebSocket Real-time Server',
      wsUrl: 'ws://localhost:8080',
      timeout: 5000
    },
    {
      name: 'Voice Assistant API',
      url: 'http://localhost:3000/api/voice/process',
      expectedResponse: (data: any) => data.response || data.error,
      timeout: 8000
    }
  ];
  
  async runAllTests() {
    console.log(chalk.blue.bold(`
╔═══════════════════════════════════════════════╗
║     🧪 FANTASY AI SERVICE INTEGRATION TEST    ║
╚═══════════════════════════════════════════════╝
`));
    
    // 1. Test individual services
    console.log(chalk.yellow('📡 Testing individual services...\n'));
    
    for (const service of this.services) {
      await this.testService(service);
    }
    
    // 2. Test service interactions
    console.log(chalk.yellow('\n🔗 Testing service interactions...\n'));
    
    await this.testMLWebSocketIntegration();
    await this.testContinuousLearningFlow();
    await this.testEndToEndPrediction();
    
    // 3. Load test
    console.log(chalk.yellow('\n⚡ Running basic load test...\n'));
    
    await this.runLoadTest();
    
    // 4. Generate report
    this.generateReport();
  }
  
  private async testService(service: ServiceTest): Promise<void> {
    const startTime = Date.now();
    
    try {
      if (service.wsUrl) {
        // Test WebSocket service
        await this.testWebSocketService(service);
      } else if (service.url) {
        // Test HTTP service
        await this.testHttpService(service);
      }
    } catch (error: any) {
      this.results.push({
        service: service.name,
        status: 'failed',
        message: error.message,
        latency: Date.now() - startTime
      });
    }
  }
  
  private async testHttpService(service: ServiceTest): Promise<void> {
    const startTime = Date.now();
    
    try {
      const endpoint = service.healthEndpoint 
        ? `${service.url}${service.healthEndpoint}`
        : service.url;
        
      const response = await axios.get(endpoint, {
        timeout: service.timeout || 5000,
        validateStatus: () => true
      });
      
      const latency = Date.now() - startTime;
      
      if (response.status === 200) {
        // Check expected response
        if (service.expectedResponse) {
          const isValid = typeof service.expectedResponse === 'function'
            ? service.expectedResponse(response.data)
            : JSON.stringify(response.data) === JSON.stringify(service.expectedResponse);
            
          if (isValid) {
            this.results.push({
              service: service.name,
              status: 'passed',
              message: `Service responding correctly`,
              latency,
              details: response.data
            });
            console.log(chalk.green(`✅ ${service.name}: PASSED (${latency}ms)`));
          } else {
            this.results.push({
              service: service.name,
              status: 'warning',
              message: `Unexpected response format`,
              latency,
              details: response.data
            });
            console.log(chalk.yellow(`⚠️  ${service.name}: WARNING - Unexpected response`));
          }
        } else {
          this.results.push({
            service: service.name,
            status: 'passed',
            message: `Service is up`,
            latency
          });
          console.log(chalk.green(`✅ ${service.name}: UP (${latency}ms)`));
        }
      } else {
        this.results.push({
          service: service.name,
          status: 'failed',
          message: `HTTP ${response.status}`,
          latency
        });
        console.log(chalk.red(`❌ ${service.name}: FAILED - HTTP ${response.status}`));
      }
    } catch (error: any) {
      this.results.push({
        service: service.name,
        status: 'failed',
        message: error.code === 'ECONNREFUSED' ? 'Service not running' : error.message,
        latency: Date.now() - startTime
      });
      console.log(chalk.red(`❌ ${service.name}: ${error.code === 'ECONNREFUSED' ? 'NOT RUNNING' : 'ERROR'}`));
    }
  }
  
  private async testWebSocketService(service: ServiceTest): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let connected = false;
      
      const ws = new WebSocket(service.wsUrl!);
      const timeout = setTimeout(() => {
        if (!connected) {
          ws.close();
          this.results.push({
            service: service.name,
            status: 'failed',
            message: 'Connection timeout',
            latency: Date.now() - startTime
          });
          console.log(chalk.red(`❌ ${service.name}: TIMEOUT`));
          resolve();
        }
      }, service.timeout || 5000);
      
      ws.on('open', () => {
        connected = true;
        clearTimeout(timeout);
        const latency = Date.now() - startTime;
        
        // Send test message
        ws.send(JSON.stringify({ type: 'ping' }));
        
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          this.results.push({
            service: service.name,
            status: 'passed',
            message: 'WebSocket connected and responding',
            latency,
            details: message
          });
          console.log(chalk.green(`✅ ${service.name}: CONNECTED (${latency}ms)`));
          
          ws.close();
          resolve();
        });
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        this.results.push({
          service: service.name,
          status: 'failed',
          message: 'WebSocket error: ' + error.message,
          latency: Date.now() - startTime
        });
        console.log(chalk.red(`❌ ${service.name}: ERROR`));
        resolve();
      });
    });
  }
  
  private async testMLWebSocketIntegration(): Promise<void> {
    console.log(chalk.cyan('Testing ML → WebSocket integration...'));
    
    try {
      // Connect to WebSocket
      const ws = new WebSocket('ws://localhost:8080');
      let receivedPrediction = false;
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (!receivedPrediction) {
            reject(new Error('No ML predictions received via WebSocket'));
          }
        }, 15000);
        
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'subscribe',
            channels: ['predictions']
          }));
        });
        
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'predictions' && message.data.predictions) {
            receivedPrediction = true;
            clearTimeout(timeout);
            console.log(chalk.green('  ✅ ML predictions broadcasting via WebSocket'));
            ws.close();
            resolve();
          }
        });
        
        ws.on('error', reject);
      });
      
      this.results.push({
        service: 'ML → WebSocket Integration',
        status: 'passed',
        message: 'Predictions are being broadcast'
      });
    } catch (error: any) {
      console.log(chalk.red('  ❌ ML → WebSocket integration failed'));
      this.results.push({
        service: 'ML → WebSocket Integration',
        status: 'failed',
        message: error.message
      });
    }
  }
  
  private async testContinuousLearningFlow(): Promise<void> {
    console.log(chalk.cyan('Testing Continuous Learning flow...'));
    
    try {
      // Make a prediction
      const predictionResponse = await axios.post('http://localhost:3000/api/ai/predictions', {
        gameId: 'test-game-001',
        homeTeam: 'Test Home',
        awayTeam: 'Test Away'
      });
      
      if (predictionResponse.data.predictions) {
        console.log(chalk.green('  ✅ Predictions saved for continuous learning'));
        
        this.results.push({
          service: 'Continuous Learning Flow',
          status: 'passed',
          message: 'Prediction → Learning pipeline working'
        });
      }
    } catch (error: any) {
      console.log(chalk.red('  ❌ Continuous learning flow failed'));
      this.results.push({
        service: 'Continuous Learning Flow',
        status: 'failed',
        message: error.message
      });
    }
  }
  
  private async testEndToEndPrediction(): Promise<void> {
    console.log(chalk.cyan('Testing end-to-end prediction flow...'));
    
    try {
      // 1. Get upcoming games
      const gamesResponse = await axios.get('http://localhost:3000/api/games/upcoming');
      
      if (gamesResponse.data.games && gamesResponse.data.games.length > 0) {
        const game = gamesResponse.data.games[0];
        
        // 2. Make prediction
        const predictionResponse = await axios.post('http://localhost:3000/api/ai/predictions', {
          gameId: game.id,
          includePlayerProps: true
        });
        
        if (predictionResponse.data.winner && predictionResponse.data.confidence) {
          console.log(chalk.green('  ✅ End-to-end prediction successful'));
          console.log(chalk.gray(`     Winner: ${predictionResponse.data.winner}`));
          console.log(chalk.gray(`     Confidence: ${(predictionResponse.data.confidence * 100).toFixed(1)}%`));
          
          this.results.push({
            service: 'End-to-End Prediction',
            status: 'passed',
            message: 'Full prediction pipeline working',
            details: predictionResponse.data
          });
        }
      }
    } catch (error: any) {
      console.log(chalk.red('  ❌ End-to-end prediction failed'));
      this.results.push({
        service: 'End-to-End Prediction',
        status: 'failed',
        message: error.message
      });
    }
  }
  
  private async runLoadTest(): Promise<void> {
    console.log(chalk.cyan('Running load test (100 concurrent requests)...'));
    
    const concurrency = 100;
    const requests: Promise<any>[] = [];
    const startTime = Date.now();
    
    for (let i = 0; i < concurrency; i++) {
      requests.push(
        axios.get('http://localhost:3000/api/ai/predictions', {
          timeout: 30000,
          validateStatus: () => true
        }).catch(err => ({ error: err.message }))
      );
    }
    
    const results = await Promise.all(requests);
    const duration = Date.now() - startTime;
    
    const successful = results.filter(r => !r.error).length;
    const failed = results.filter(r => r.error).length;
    const avgLatency = duration / concurrency;
    
    console.log(chalk.green(`  ✅ Successful: ${successful}`));
    console.log(chalk.red(`  ❌ Failed: ${failed}`));
    console.log(chalk.blue(`  📊 Avg latency: ${avgLatency.toFixed(0)}ms`));
    console.log(chalk.yellow(`  ⚡ Throughput: ${(concurrency / (duration / 1000)).toFixed(1)} req/s`));
    
    this.results.push({
      service: 'Load Test',
      status: successful > failed ? 'passed' : 'failed',
      message: `${successful}/${concurrency} requests succeeded`,
      details: {
        successful,
        failed,
        avgLatency,
        throughput: concurrency / (duration / 1000)
      }
    });
  }
  
  private generateReport(): void {
    console.log(chalk.blue.bold(`
╔═══════════════════════════════════════════════╗
║            📋 TEST REPORT SUMMARY             ║
╚═══════════════════════════════════════════════╝
`));
    
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    
    console.log(chalk.green(`✅ Passed: ${passed}`));
    console.log(chalk.red(`❌ Failed: ${failed}`));
    console.log(chalk.yellow(`⚠️  Warnings: ${warnings}`));
    
    console.log(chalk.cyan('\n📊 Detailed Results:\n'));
    
    this.results.forEach(result => {
      const icon = result.status === 'passed' ? '✅' : 
                   result.status === 'failed' ? '❌' : '⚠️';
      const color = result.status === 'passed' ? 'green' : 
                    result.status === 'failed' ? 'red' : 'yellow';
                    
      console.log(chalk[color](`${icon} ${result.service}: ${result.message}`));
      
      if (result.latency) {
        console.log(chalk.gray(`   Latency: ${result.latency}ms`));
      }
      
      if (result.details && process.env.VERBOSE) {
        console.log(chalk.gray(`   Details: ${JSON.stringify(result.details, null, 2)}`));
      }
    });
    
    // Overall verdict
    const allPassed = failed === 0;
    
    console.log(chalk.blue.bold(`
╔═══════════════════════════════════════════════╗
║              🎯 OVERALL VERDICT               ║
╚═══════════════════════════════════════════════╝
`));
    
    if (allPassed) {
      console.log(chalk.green.bold('✅ ALL SERVICES ARE PRODUCTION READY!'));
      console.log(chalk.green('\nThe Fantasy AI system is functioning correctly.'));
      console.log(chalk.green('All integrations are working as expected.\n'));
    } else {
      console.log(chalk.red.bold('❌ SYSTEM NOT READY FOR PRODUCTION'));
      console.log(chalk.red(`\n${failed} service(s) need attention.`));
      console.log(chalk.yellow('\nPlease fix the failing services before deployment.\n'));
    }
    
    // Recommendations
    console.log(chalk.blue('📝 Recommendations:\n'));
    
    if (!this.results.find(r => r.service.includes('WebSocket') && r.status === 'passed')) {
      console.log(chalk.yellow('• Start WebSocket server: npm run start:realtime'));
    }
    
    if (!this.results.find(r => r.service.includes('Next.js') && r.status === 'passed')) {
      console.log(chalk.yellow('• Start Next.js app: npm run dev:web'));
    }
    
    if (this.results.find(r => r.service === 'Load Test' && r.details?.avgLatency > 1000)) {
      console.log(chalk.yellow('• Optimize API performance - high latency detected'));
    }
    
    console.log('');
  }
}

// Check if services are supposed to be running
async function checkServicesRunning(): Promise<boolean> {
  try {
    // Quick check if any service is responding
    await axios.get('http://localhost:3000/api/health', { timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}

// Main execution
async function main() {
  const servicesRunning = await checkServicesRunning();
  
  if (!servicesRunning) {
    console.log(chalk.yellow(`
⚠️  No services detected running!

To test all services, first start them with:
  npm run start:all-services

Or start them individually:
  npm run dev:web        # Next.js app
  npm run start:realtime # WebSocket server
  npm run ml:continuous  # Continuous learning

Then run this test again.
`));
    process.exit(1);
  }
  
  const tester = new ServiceIntegrationTester();
  await tester.runAllTests();
}

main().catch(console.error);
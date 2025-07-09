#!/usr/bin/env node
/**
 * Integration Test Suite for Fantasy AI Ultimate
 * Verifies all fixed components are working together
 */

import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import chalk from 'chalk';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3000';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  message?: string;
  duration?: number;
}

class IntegrationTestSuite {
  private results: TestResult[] = [];
  private socket: Socket | null = null;

  async run() {
    console.log(chalk.bold.blue('\n🧪 Fantasy AI Ultimate - Integration Test Suite\n'));
    
    // Test categories
    await this.testDatabaseConnection();
    await this.testPatternDetection();
    await this.testWebSocketConnection();
    await this.testAIAssistant();
    await this.testLineupOptimizer();
    await this.testDashboardStats();
    await this.testAPIEndpoints();
    
    // Print results
    this.printResults();
    
    // Cleanup
    await this.cleanup();
  }

  private async testDatabaseConnection() {
    console.log(chalk.yellow('\n📊 Testing Database Connection...'));
    
    const start = Date.now();
    try {
      const gameCount = await prisma.game.count();
      const playerCount = await prisma.player.count();
      
      this.results.push({
        name: 'Database Connection',
        status: 'pass',
        message: `Connected! Games: ${gameCount}, Players: ${playerCount}`,
        duration: Date.now() - start
      });
    } catch (error: any) {
      this.results.push({
        name: 'Database Connection',
        status: 'fail',
        message: error.message,
        duration: Date.now() - start
      });
    }
  }

  private async testPatternDetection() {
    console.log(chalk.yellow('\n🎯 Testing Pattern Detection...'));
    
    const start = Date.now();
    try {
      // Test the pattern API (internal endpoint)
      const response = await axios.post(`${API_BASE}/api/patterns/analyze`, {
        gameIds: [1, 2, 3] // Array of game IDs
      });
      
      if (response.data.success && response.data.results) {
        const { summary } = response.data;
        this.results.push({
          name: 'Pattern Detection API',
          status: 'pass',
          message: `Analyzed ${summary.gamesAnalyzed} games, found ${summary.patternsDetected} patterns`,
          duration: Date.now() - start
        });
      } else {
        throw new Error('No pattern results returned');
      }
    } catch (error: any) {
      this.results.push({
        name: 'Pattern Detection API',
        status: 'fail',
        message: error.response?.data?.error || error.message,
        duration: Date.now() - start
      });
    }
  }

  private async testWebSocketConnection() {
    console.log(chalk.yellow('\n🔌 Testing WebSocket Connection...'));
    
    const start = Date.now();
    try {
      await new Promise<void>((resolve, reject) => {
        this.socket = io('ws://localhost:3000', {
          transports: ['websocket'],
          timeout: 5000
        });
        
        this.socket.on('connect', () => {
          this.results.push({
            name: 'WebSocket Connection',
            status: 'pass',
            message: `Connected with ID: ${this.socket?.id}`,
            duration: Date.now() - start
          });
          resolve();
        });
        
        this.socket.on('connect_error', (error) => {
          reject(error);
        });
        
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
    } catch (error: any) {
      this.results.push({
        name: 'WebSocket Connection',
        status: 'fail',
        message: error.message,
        duration: Date.now() - start
      });
    }
  }

  private async testAIAssistant() {
    console.log(chalk.yellow('\n🤖 Testing AI Assistant...'));
    
    const start = Date.now();
    try {
      const response = await axios.post(`${API_BASE}/api/ai/chat`, {
        messages: [
          { role: 'user', content: 'What are the top patterns for NFL games today?' }
        ]
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.message) {
        this.results.push({
          name: 'AI Assistant (Anthropic)',
          status: 'pass',
          message: 'Successfully generated response',
          duration: Date.now() - start
        });
      } else {
        throw new Error('No response from AI');
      }
    } catch (error: any) {
      this.results.push({
        name: 'AI Assistant (Anthropic)',
        status: 'fail',
        message: error.response?.data?.error || error.message,
        duration: Date.now() - start
      });
    }
  }

  private async testLineupOptimizer() {
    console.log(chalk.yellow('\n🚀 Testing Lineup Optimizer...'));
    
    const start = Date.now();
    try {
      const response = await axios.post(`${API_BASE}/api/optimize/lineup`, {
        sport: 'NFL',
        contest: {
          type: 'classic',
          positions: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1, DST: 1 },
          salaryCap: 50000
        },
        budget: 50000
      });
      
      if (response.data.players && response.data.players.length > 0) {
        const totalSalary = response.data.totalSalary;
        const totalProjection = response.data.totalProjection;
        
        this.results.push({
          name: 'Lineup Optimizer',
          status: 'pass',
          message: `Generated lineup: ${response.data.players.length} players, $${totalSalary} salary, ${totalProjection.toFixed(1)} pts`,
          duration: Date.now() - start
        });
      } else {
        throw new Error('No lineup generated');
      }
    } catch (error: any) {
      this.results.push({
        name: 'Lineup Optimizer',
        status: 'fail',
        message: error.response?.data?.error || error.message,
        duration: Date.now() - start
      });
    }
  }

  private async testDashboardStats() {
    console.log(chalk.yellow('\n📈 Testing Dashboard Statistics...'));
    
    const start = Date.now();
    try {
      const response = await axios.get(`${API_BASE}/api/stats/overview`);
      
      if (response.data.database && response.data.patterns) {
        const { database, patterns } = response.data;
        
        this.results.push({
          name: 'Dashboard Stats API',
          status: 'pass',
          message: `Games: ${database.completedGames}, Accuracy: ${patterns.averageAccuracy}%`,
          duration: Date.now() - start
        });
      } else {
        throw new Error('Invalid stats response');
      }
    } catch (error: any) {
      this.results.push({
        name: 'Dashboard Stats API',
        status: 'fail',
        message: error.response?.data?.error || error.message,
        duration: Date.now() - start
      });
    }
  }

  private async testAPIEndpoints() {
    console.log(chalk.yellow('\n🔗 Testing API Endpoints...'));
    
    const endpoints = [
      { name: 'Health Check', method: 'GET', path: '/api/health' },
      { name: 'Predictions V2', method: 'GET', path: '/api/v2/predictions' },
      { name: 'Player Search', method: 'GET', path: '/api/players?q=mahomes' },
    ];
    
    for (const endpoint of endpoints) {
      const start = Date.now();
      try {
        const response = await axios({
          method: endpoint.method,
          url: `${API_BASE}${endpoint.path}`,
          validateStatus: (status) => status < 500
        });
        
        this.results.push({
          name: endpoint.name,
          status: response.status < 400 ? 'pass' : 'fail',
          message: `Status: ${response.status}`,
          duration: Date.now() - start
        });
      } catch (error: any) {
        this.results.push({
          name: endpoint.name,
          status: 'fail',
          message: error.message,
          duration: Date.now() - start
        });
      }
    }
  }

  private printResults() {
    console.log(chalk.bold.blue('\n📊 Test Results:\n'));
    
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    
    for (const result of this.results) {
      const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⏭️';
      const color = result.status === 'pass' ? chalk.green : result.status === 'fail' ? chalk.red : chalk.gray;
      
      console.log(`${icon} ${color(result.name)}`);
      if (result.message) {
        console.log(`   ${chalk.gray(result.message)}`);
      }
      if (result.duration !== undefined) {
        console.log(`   ${chalk.gray(`Duration: ${result.duration}ms`)}`);
      }
      console.log();
      
      if (result.status === 'pass') passed++;
      else if (result.status === 'fail') failed++;
      else skipped++;
    }
    
    console.log(chalk.bold('\n📈 Summary:'));
    console.log(chalk.green(`✅ Passed: ${passed}`));
    console.log(chalk.red(`❌ Failed: ${failed}`));
    if (skipped > 0) console.log(chalk.gray(`⏭️  Skipped: ${skipped}`));
    
    const successRate = (passed / (passed + failed)) * 100;
    console.log(chalk.bold(`\n🎯 Success Rate: ${successRate.toFixed(1)}%`));
    
    if (failed === 0) {
      console.log(chalk.bold.green('\n🎉 All tests passed! The system is working correctly.\n'));
    } else {
      console.log(chalk.bold.yellow('\n⚠️  Some tests failed. Please check the errors above.\n'));
    }
  }

  private async cleanup() {
    if (this.socket) {
      this.socket.disconnect();
    }
    await prisma.$disconnect();
  }
}

// Run the test suite
async function main() {
  const suite = new IntegrationTestSuite();
  
  try {
    await suite.run();
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('\n❌ Test suite failed:'), error);
    process.exit(1);
  }
}

// Check if running directly
if (require.main === module) {
  main();
}

export { IntegrationTestSuite };
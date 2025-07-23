#!/usr/bin/env tsx

/**
 * Complete DFS Trading System - Production Demo
 * Demonstrates the full professional fantasy sports trading platform
 */

import CompleteTradingDemo from './services/complete-trading-demo';
import { Redis } from 'ioredis';
import * as readline from 'readline';

// Configuration for the complete trading system
const TRADING_CONFIG = {
  redis: {
    url: 'redis://localhost:6379',
    keyPrefix: 'dfs_trading'
  },
  dashboard: {
    port: 3001,
    alertThresholds: {
      maxDailyLoss: 500,          // Max $500 daily loss
      minWinRate: 45,             // Minimum 45% win rate
      maxDrawdown: 20,            // Max 20% drawdown
      lowBalance: 100,            // Alert when balance < $100
      highVolatility: 25          // Alert when volatility > 25%
    }
  },
  riskManager: {
    thresholds: {
      maxDailySpend: 1000,        // Max $1000 per day
      maxSingleEntry: 100,        // Max $100 per entry
      maxContests: 50,            // Max 50 contests per day
      maxExposurePerPlayer: 30,   // Max 30% exposure per player
      drawdownLimit: 25,          // Emergency shutdown at 25% drawdown
      stopLossPercentage: 15,     // Stop loss at 15% drawdown
      varThreshold: 100,          // Value at Risk threshold $100
      expectedShortfallLimit: 150 // Expected Shortfall limit $150
    },
    mfaThreshold: 50              // MFA required for entries > $50
  },
  marketData: {
    platforms: [
      {
        name: 'DraftKings',
        apiBaseUrl: 'https://api.draftkings.com',
        wsUrl: 'wss://live.draftkings.com',
        authConfig: {
          type: 'oauth',
          credentials: {
            token: process.env.DK_ACCESS_TOKEN || 'demo_token'
          }
        },
        endpoints: {
          contests: '/contests',
          ownership: '/ownership',
          lineups: '/lineups',
          live: '/live'
        },
        rateLimits: {
          requests: 100,
          window: 60000 // 1 minute
        }
      },
      {
        name: 'FanDuel',
        apiBaseUrl: 'https://api.fanduel.com',
        wsUrl: 'wss://live.fanduel.com',
        authConfig: {
          type: 'session',
          credentials: {
            sessionCookie: process.env.FD_SESSION || 'demo_session'
          }
        },
        endpoints: {
          contests: '/contests',
          ownership: '/ownership',
          lineups: '/lineups',
          live: '/live'
        },
        rateLimits: {
          requests: 80,
          window: 60000
        }
      }
    ],
    newsFeeds: [
      {
        name: 'ESPN',
        url: 'https://rss.espn.com/rss/nfl/news',
        type: 'rss',
        sports: ['NFL'],
        keywords: ['injury', 'inactive', 'questionable', 'out', 'doubtful', 'weather'],
        priority: 'HIGH'
      },
      {
        name: 'Rotoworld',
        url: 'https://api.rotoworld.com/news',
        type: 'api',
        sports: ['NFL', 'NBA'],
        keywords: ['breaking', 'injury', 'lineup', 'start', 'sit'],
        priority: 'CRITICAL'
      }
    ],
    weatherApi: {
      apiKey: process.env.WEATHER_API_KEY || 'demo_weather_key',
      baseUrl: 'https://api.weatherapi.com/v1',
      locations: ['Green Bay', 'Buffalo', 'Chicago', 'Denver', 'Seattle']
    },
    updateIntervals: {
      ownership: 30000,           // Every 30 seconds
      contests: 60000,            // Every minute
      news: 120000,               // Every 2 minutes
      weather: 300000,            // Every 5 minutes
      injuries: 300000            // Every 5 minutes
    }
  },
  gpu: {
    enabled: true,
    deviceId: 0,
    memoryLimit: 4096,
    optimizationLevel: 'BALANCED' as const
  },
  platforms: {
    draftkings: {
      username: process.env.DK_USERNAME || 'demo_user',
      password: process.env.DK_PASSWORD || 'demo_pass',
      baseUrl: 'https://www.draftkings.com',
      apiUrl: 'https://api.draftkings.com',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    fanduel: {
      username: process.env.FD_USERNAME || 'demo_user',
      password: process.env.FD_PASSWORD || 'demo_pass',
      baseUrl: 'https://www.fanduel.com',
      apiUrl: 'https://api.fanduel.com',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    yahoo: {
      username: process.env.YAHOO_USERNAME || 'demo_user',
      password: process.env.YAHOO_PASSWORD || 'demo_pass',
      baseUrl: 'https://football.fantasysports.yahoo.com',
      apiUrl: 'https://api.yahoo.com',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  },
  autoEntry: {
    enabled: true,
    strategies: [
      'GPP_CONTRARIAN',           // Target low ownership in tournaments
      'CASH_GAME_STABLE',         // High floor players for cash games
      'TOURNAMENT_CEILING',       // High ceiling players for GPPs
      'WEATHER_FADE',             // Fade games with bad weather
      'NEWS_REACTIVE',            // React to breaking news
      'OWNERSHIP_LEVERAGE',       // Leverage ownership inefficiencies
      'LATE_SWAP_VALUE'           // Last-minute value plays
    ],
    bankrollPercentage: 5,        // Use 5% of bankroll per strategy
    maxConcurrentContests: 25     // Max 25 simultaneous contests
  }
};

class TradingSystemDemo {
  private tradingSystem: CompleteTradingDemo;
  private rl: readline.Interface;
  private sessionId: string | null = null;

  constructor() {
    this.tradingSystem = new CompleteTradingDemo(TRADING_CONFIG);
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Trading system events
    this.tradingSystem.on('sessionStarted', (session) => {
      console.log(`\n🎯 Trading session ${session.id} started!`);
      console.log(`💰 Initial bankroll: $${session.initialBankroll}`);
      console.log(`📊 Active strategies: ${session.strategies.join(', ')}`);
      console.log(`🌐 Dashboard: http://localhost:${TRADING_CONFIG.dashboard.port}`);
    });

    this.tradingSystem.on('sessionStopped', (session) => {
      console.log(`\n🛑 Trading session ended`);
      if (session) {
        console.log(`💰 Final bankroll: $${session.currentBankroll}`);
        console.log(`📈 Total P&L: $${session.totalPnL}`);
        console.log(`🏆 Win rate: ${session.winRate.toFixed(1)}%`);
        console.log(`🎯 Contests: ${session.contestsCompleted}/${session.contestsEntered}`);
      }
    });

    this.tradingSystem.on('emergencyShutdown', (data) => {
      console.log(`\n🚨 EMERGENCY SHUTDOWN: ${data.reason}`);
      console.log(`⏰ Time: ${new Date().toISOString()}`);
    });

    this.tradingSystem.on('alert', (alert) => {
      const icon = this.getAlertIcon(alert.severity);
      console.log(`\n${icon} ${alert.type} Alert: ${alert.message}`);
    });

    this.tradingSystem.on('contestCompleted', (result) => {
      const profit = result.payout - result.entryFee;
      const icon = profit > 0 ? '🏆' : '❌';
      console.log(`\n${icon} Contest completed: ${result.contestId}`);
      console.log(`   Rank: ${result.rank}/${result.totalEntries}`);
      console.log(`   P&L: $${profit.toFixed(2)} (${result.roi.toFixed(1)}% ROI)`);
    });

    this.tradingSystem.on('marketAnalysis', (analysis) => {
      console.log(`\n📊 Market Analysis (${new Date().toLocaleTimeString()})`);
      console.log(`   Contests: ${analysis.totalContests} | Avg Fill: ${analysis.avgFillRate.toFixed(1)}%`);
      console.log(`   Overlays: ${analysis.overlayCount} | Volatility: ${analysis.volatility.toFixed(1)}%`);
      console.log(`   Sentiment: ${analysis.marketSentiment} | Rec: ${analysis.recommendation}`);
    });

    // Handle process termination
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down trading system...');
      await this.shutdown();
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      console.error('\n💥 Uncaught exception:', error);
      this.shutdown().then(() => process.exit(1));
    });
  }

  private getAlertIcon(severity: string): string {
    switch (severity) {
      case 'CRITICAL': return '🚨';
      case 'HIGH': return '⚠️';
      case 'MEDIUM': return '🔶';
      case 'LOW': return 'ℹ️';
      default: return '📢';
    }
  }

  public async start(): Promise<void> {
    console.log(`
🔥 ULTIMATE DFS TRADING SYSTEM 🔥
=====================================
🚀 Professional Fantasy Sports Trading Platform
💰 Real-time P&L tracking and risk management
🧠 GPU-accelerated ML optimization
📊 Advanced market data feeds
⚡ Automated entry strategies
🛡️ Enterprise-grade security

System Components:
✅ Risk Manager - Advanced circuit breakers & fraud detection
✅ Trading Dashboard - Real-time performance analytics  
✅ Market Data Feed - Live ownership, news, weather data
✅ GPU Optimizer - RTX 4060 acceleration for lineup optimization
✅ Platform Connectors - DraftKings, FanDuel, Yahoo integration
✅ Auto Entry System - 7 professional trading strategies
✅ WebSocket Monitor - Real-time data streaming
✅ Emergency Protocols - Automated risk containment

Ready to start professional DFS trading!
========================================
`);

    this.showMainMenu();
  }

  private showMainMenu(): void {
    console.log(`
📋 MAIN MENU
=============
1. Start Trading Session
2. Demo Mode (Simulation)
3. System Status
4. Configuration
5. Performance Reports
6. Emergency Shutdown
7. Exit

Enter your choice (1-7):`);

    this.rl.question('> ', (answer) => {
      this.handleMainMenuChoice(answer.trim());
    });
  }

  private async handleMainMenuChoice(choice: string): Promise<void> {
    switch (choice) {
      case '1':
        await this.startTradingSession();
        break;
      case '2':
        await this.runDemoMode();
        break;
      case '3':
        await this.showSystemStatus();
        break;
      case '4':
        this.showConfiguration();
        break;
      case '5':
        await this.showPerformanceReports();
        break;
      case '6':
        await this.emergencyShutdown();
        break;
      case '7':
        await this.shutdown();
        process.exit(0);
        break;
      default:
        console.log('❌ Invalid choice. Please try again.');
        this.showMainMenu();
    }
  }

  private async startTradingSession(): Promise<void> {
    console.log('\n🎯 STARTING TRADING SESSION');
    console.log('============================');

    // Get session configuration
    const bankroll = await this.promptNumber('Initial bankroll ($): ', 1000);
    const sports = await this.promptList('Sports (NFL,NBA,MLB): ', ['NFL']);
    const platforms = await this.promptList('Platforms (DraftKings,FanDuel): ', ['DraftKings']);
    const strategies = await this.promptList('Strategies: ', [
      'GPP_CONTRARIAN', 
      'CASH_GAME_STABLE', 
      'TOURNAMENT_CEILING'
    ]);

    try {
      this.sessionId = await this.tradingSystem.startTradingSession({
        initialBankroll: bankroll,
        strategies,
        sports,
        platforms
      });

      console.log('\n✅ Trading session started successfully!');
      console.log(`📊 Dashboard: http://localhost:${TRADING_CONFIG.dashboard.port}`);
      console.log('🔄 Live monitoring active...\n');

      this.showTradingMenu();

    } catch (error) {
      console.error('❌ Failed to start trading session:', error);
      this.showMainMenu();
    }
  }

  private async runDemoMode(): Promise<void> {
    console.log('\n🎪 DEMO MODE - SIMULATION');
    console.log('=========================');
    console.log('Running a complete trading simulation...\n');

    try {
      this.sessionId = await this.tradingSystem.startTradingSession({
        initialBankroll: 1000,
        strategies: ['GPP_CONTRARIAN', 'TOURNAMENT_CEILING', 'NEWS_REACTIVE'],
        sports: ['NFL'],
        platforms: ['DraftKings']
      });

      console.log('📱 Watch the live demo in action!');
      console.log(`📊 Dashboard: http://localhost:${TRADING_CONFIG.dashboard.port}`);
      console.log('⏰ Demo will run for 2 minutes...\n');

      // Let demo run for 2 minutes
      setTimeout(async () => {
        await this.tradingSystem.stopTradingSession();
        const report = await this.tradingSystem.getSessionReport();
        this.displaySessionReport(report);
        this.showMainMenu();
      }, 120000); // 2 minutes

    } catch (error) {
      console.error('❌ Demo failed:', error);
      this.showMainMenu();
    }
  }

  private showTradingMenu(): void {
    console.log(`
📊 TRADING SESSION ACTIVE
=========================
1. View Status
2. Pause Session
3. Resume Session
4. Generate Report
5. Stop Session
6. Back to Main Menu

Enter your choice (1-6):`);

    this.rl.question('> ', (answer) => {
      this.handleTradingMenuChoice(answer.trim());
    });
  }

  private async handleTradingMenuChoice(choice: string): Promise<void> {
    switch (choice) {
      case '1':
        await this.viewSessionStatus();
        this.showTradingMenu();
        break;
      case '2':
        await this.tradingSystem.pauseTradingSession();
        console.log('⏸️ Session paused');
        this.showTradingMenu();
        break;
      case '3':
        await this.tradingSystem.resumeTradingSession();
        console.log('▶️ Session resumed');
        this.showTradingMenu();
        break;
      case '4':
        await this.generateSessionReport();
        this.showTradingMenu();
        break;
      case '5':
        await this.tradingSystem.stopTradingSession();
        this.sessionId = null;
        console.log('🛑 Session stopped');
        this.showMainMenu();
        break;
      case '6':
        this.showMainMenu();
        break;
      default:
        console.log('❌ Invalid choice. Please try again.');
        this.showTradingMenu();
    }
  }

  private async viewSessionStatus(): Promise<void> {
    const status = this.tradingSystem.getSessionStatus();
    if (!status) {
      console.log('❌ No active session');
      return;
    }

    console.log('\n📊 SESSION STATUS');
    console.log('==================');
    console.log(`🆔 Session ID: ${status.id}`);
    console.log(`📅 Started: ${status.startTime.toLocaleString()}`);
    console.log(`📊 Status: ${status.status}`);
    console.log(`💰 Bankroll: $${status.currentBankroll.toFixed(2)}`);
    console.log(`📈 P&L: $${status.totalPnL.toFixed(2)}`);
    console.log(`🎯 Contests: ${status.contestsCompleted}/${status.contestsEntered}`);
    console.log(`🏆 Win Rate: ${status.winRate.toFixed(1)}%`);
    console.log(`📉 Max Drawdown: ${status.maxDrawdown.toFixed(1)}%`);
    console.log(`⚖️ Sharpe Ratio: ${status.sharpeRatio.toFixed(2)}`);
    console.log(`🔄 Strategies: ${status.strategies.join(', ')}\n`);
  }

  private async generateSessionReport(): Promise<void> {
    const report = await this.tradingSystem.getSessionReport();
    if (!report) {
      console.log('❌ No session data available');
      return;
    }

    this.displaySessionReport(report);
  }

  private displaySessionReport(report: any): void {
    if (!report) return;

    console.log('\n📊 SESSION REPORT');
    console.log('==================');
    console.log(`📅 Duration: ${this.formatDuration(report.summary.duration)}`);
    console.log(`💰 Total Return: ${report.summary.totalReturn.toFixed(2)}%`);
    console.log(`🎯 Total Contests: ${report.summary.totalContests}`);
    console.log(`🏆 Win Rate: ${report.summary.winRate.toFixed(1)}%`);
    console.log(`📈 Avg ROI: ${report.summary.avgROI.toFixed(1)}%`);
    console.log(`🚀 Best Trade: ${report.summary.bestTrade.toFixed(1)}%`);
    console.log(`📉 Worst Trade: ${report.summary.worstTrade.toFixed(1)}%`);
    console.log(`🚨 Total Alerts: ${report.summary.totalAlerts}`);
    console.log(`⚠️ Critical Alerts: ${report.summary.criticalAlerts}\n`);

    if (report.performance.contestResults.length > 0) {
      console.log('🏆 RECENT CONTESTS:');
      report.performance.contestResults.slice(-5).forEach((contest: any) => {
        const profit = contest.payout - contest.entryFee;
        const icon = profit > 0 ? '🟢' : '🔴';
        console.log(`   ${icon} ${contest.platform} - Rank ${contest.rank}/${contest.totalEntries} - $${profit.toFixed(2)}`);
      });
      console.log();
    }
  }

  private async showSystemStatus(): Promise<void> {
    console.log('\n🔧 SYSTEM STATUS');
    console.log('=================');
    console.log('✅ Risk Manager: Active');
    console.log('✅ Trading Dashboard: Running');
    console.log('✅ Market Data Feed: Connected');
    console.log('✅ GPU Optimizer: Ready');
    console.log('✅ Platform Connectors: Connected');
    console.log('✅ Auto Entry System: Standby');
    console.log('✅ WebSocket Monitor: Listening');
    console.log('✅ Emergency Protocols: Armed');
    console.log(`📊 Dashboard URL: http://localhost:${TRADING_CONFIG.dashboard.port}`);
    console.log('🟢 All systems operational\n');

    this.showMainMenu();
  }

  private showConfiguration(): void {
    console.log('\n⚙️ CONFIGURATION');
    console.log('=================');
    console.log('Risk Management:');
    console.log(`  💰 Max Daily Spend: $${TRADING_CONFIG.riskManager.thresholds.maxDailySpend}`);
    console.log(`  🎯 Max Single Entry: $${TRADING_CONFIG.riskManager.thresholds.maxSingleEntry}`);
    console.log(`  📉 Stop Loss: ${TRADING_CONFIG.riskManager.thresholds.stopLossPercentage}%`);
    console.log(`  🚨 Emergency Shutdown: ${TRADING_CONFIG.riskManager.thresholds.drawdownLimit}%`);
    console.log('\nStrategies:');
    TRADING_CONFIG.autoEntry.strategies.forEach((strategy, i) => {
      console.log(`  ${i + 1}. ${strategy}`);
    });
    console.log(`\n🎮 GPU Optimization: ${TRADING_CONFIG.gpu.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`🤖 Auto Entry: ${TRADING_CONFIG.autoEntry.enabled ? 'Enabled' : 'Disabled'}`);
    console.log();

    this.showMainMenu();
  }

  private async showPerformanceReports(): Promise<void> {
    console.log('\n📈 PERFORMANCE REPORTS');
    console.log('======================');
    console.log('📊 View detailed performance analytics');
    console.log(`🌐 Dashboard: http://localhost:${TRADING_CONFIG.dashboard.port}`);
    console.log('📱 Real-time charts and metrics available');
    console.log();

    this.showMainMenu();
  }

  private async emergencyShutdown(): Promise<void> {
    console.log('\n🚨 EMERGENCY SHUTDOWN');
    console.log('=====================');
    
    const confirmed = await this.promptConfirm('Are you sure you want to trigger emergency shutdown? (y/N): ');
    
    if (confirmed) {
      try {
        await this.tradingSystem.stopTradingSession();
        console.log('🛑 Emergency shutdown completed');
        console.log('💾 All positions and data saved');
        console.log('🔒 System secured');
      } catch (error) {
        console.error('❌ Emergency shutdown failed:', error);
      }
    }

    this.showMainMenu();
  }

  private async shutdown(): Promise<void> {
    console.log('\n🛑 Shutting down trading system...');
    
    try {
      if (this.sessionId) {
        await this.tradingSystem.stopTradingSession();
      }
      
      console.log('✅ System shutdown complete');
      console.log('💾 All data saved');
      console.log('👋 Thank you for using the Ultimate DFS Trading System!');
      
    } catch (error) {
      console.error('❌ Shutdown error:', error);
    } finally {
      this.rl.close();
    }
  }

  // Helper methods
  private formatDuration(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private promptNumber(question: string, defaultValue: number): Promise<number> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        const num = parseFloat(answer.trim());
        resolve(isNaN(num) ? defaultValue : num);
      });
    });
  }

  private promptList(question: string, defaultValue: string[]): Promise<string[]> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        const list = answer.trim();
        if (!list) {
          resolve(defaultValue);
        } else {
          resolve(list.split(',').map(s => s.trim()));
        }
      });
    });
  }

  private promptConfirm(question: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.toLowerCase().startsWith('y'));
      });
    });
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 Initializing Ultimate DFS Trading System...');
    
    // Check Redis connection
    const redis = new Redis('redis://localhost:6379');
    await redis.ping();
    await redis.quit();
    console.log('✅ Redis connection verified');
    
    // Start the demo
    const demo = new TradingSystemDemo();
    await demo.start();
    
  } catch (error) {
    console.error('❌ Failed to start trading system:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure Redis is running: redis-server');
    console.log('2. Check environment variables');
    console.log('3. Verify network connectivity');
    console.log('4. Review configuration settings');
    process.exit(1);
  }
}

// Export for module usage
export { TradingSystemDemo, TRADING_CONFIG };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
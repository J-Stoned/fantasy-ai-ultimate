# 🔧 Pattern Detection Integration Examples

## Complete Integration Solutions

This document provides real-world examples for integrating the Fantasy AI Pattern Detection System into various applications and betting platforms.

## Table of Contents
1. [DraftKings Integration](#draftkings-integration)
2. [Discord Bot Implementation](#discord-bot-implementation)
3. [Automated Betting System](#automated-betting-system)
4. [Mobile App Integration](#mobile-app-integration)
5. [Telegram Alerts](#telegram-alerts)
6. [Portfolio Management Dashboard](#portfolio-management-dashboard)

## DraftKings Integration

### Complete Betting Workflow
```typescript
import { PatternAPI } from './lib/pattern-api';
import { DraftKingsAPI } from './lib/draftkings-api';

class DraftKingsPatternBot {
  private patternAPI: PatternAPI;
  private dkAPI: DraftKingsAPI;
  private bankroll: number;
  
  constructor(bankroll: number) {
    this.patternAPI = new PatternAPI('http://localhost:3337');
    this.dkAPI = new DraftKingsAPI(process.env.DK_API_KEY);
    this.bankroll = bankroll;
  }
  
  async scanAndBet() {
    console.log('🔍 Scanning for pattern opportunities...');
    
    // Get today's patterns
    const patterns = await this.patternAPI.getTodaysPatterns();
    
    // Filter high-confidence opportunities
    const opportunities = patterns.filter(p => 
      p.confidence > 0.70 && 
      p.expected_roi > 0.30
    );
    
    console.log(`Found ${opportunities.length} betting opportunities`);
    
    for (const pattern of opportunities) {
      await this.processBettingOpportunity(pattern);
    }
  }
  
  private async processBettingOpportunity(pattern: PatternAlert) {
    try {
      // Get DraftKings odds for this game
      const odds = await this.dkAPI.getGameOdds(pattern.game_id);
      
      if (!odds) {
        console.log(`No odds available for game ${pattern.game_id}`);
        return;
      }
      
      // Calculate optimal bet size using Kelly Criterion
      const betSize = this.calculateKellyBet(
        pattern.confidence,
        odds[pattern.bet_recommendation.type],
        this.bankroll
      );
      
      // Minimum bet check
      if (betSize < 10) {
        console.log(`Bet size too small: $${betSize}`);
        return;
      }
      
      // Place the bet
      const betResult = await this.placeBet({
        gameId: pattern.game_id,
        betType: pattern.bet_recommendation.type,
        team: pattern.bet_recommendation.team,
        amount: betSize,
        odds: odds[pattern.bet_recommendation.type],
        pattern: pattern.pattern_type,
        confidence: pattern.confidence
      });
      
      console.log(`✅ Bet placed: $${betSize} on ${pattern.pattern_type}`);
      this.bankroll -= betSize;
      
      // Log for tracking
      await this.logBet(pattern, betResult, betSize);
      
    } catch (error) {
      console.error(`Error processing ${pattern.pattern_type}:`, error);
    }
  }
  
  private calculateKellyBet(
    confidence: number,
    odds: number,
    bankroll: number
  ): number {
    const p = confidence;
    const q = 1 - p;
    const b = odds - 1;
    
    // Kelly percentage
    const kelly = (p * b - q) / b;
    
    // Use quarter Kelly for safety
    const safeKelly = kelly * 0.25;
    
    // Cap at 3% of bankroll
    const maxBet = bankroll * 0.03;
    
    return Math.min(Math.max(safeKelly * bankroll, 0), maxBet);
  }
  
  private async placeBet(betInfo: BetInfo): Promise<BetResult> {
    // DraftKings API call
    const result = await this.dkAPI.placeBet({
      event_id: betInfo.gameId,
      market_type: betInfo.betType,
      selection: betInfo.team,
      stake: betInfo.amount,
      odds: betInfo.odds
    });
    
    return result;
  }
  
  private async logBet(pattern: PatternAlert, result: BetResult, amount: number) {
    // Store bet for performance tracking
    const betLog = {
      timestamp: new Date(),
      pattern_type: pattern.pattern_type,
      game_id: pattern.game_id,
      confidence: pattern.confidence,
      bet_amount: amount,
      bet_id: result.bet_id,
      expected_roi: pattern.expected_roi,
      status: 'pending'
    };
    
    // Save to database
    await this.saveBetLog(betLog);
  }
}

// Usage
const bot = new DraftKingsPatternBot(10000); // $10K bankroll
await bot.scanAndBet();
```

### Real-Time Monitoring
```typescript
class DraftKingsRealTimeBot extends DraftKingsPatternBot {
  private ws: WebSocket;
  
  startRealTimeMonitoring() {
    this.ws = new WebSocket('ws://localhost:3338/patterns');
    
    this.ws.onmessage = async (event) => {
      const alert = JSON.parse(event.data);
      
      if (alert.confidence > 0.75) {
        console.log(`🚨 High-confidence alert: ${alert.pattern_type}`);
        await this.processBettingOpportunity(alert);
      }
    };
    
    // Heartbeat to maintain connection
    setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }
}
```

## Discord Bot Implementation

### Discord Alert Bot
```typescript
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';

class PatternDiscordBot {
  private client: Client;
  private patternAPI: PatternAPI;
  private channelId: string;
  
  constructor(token: string, channelId: string) {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
    });
    
    this.patternAPI = new PatternAPI('http://localhost:3337');
    this.channelId = channelId;
    this.client.login(token);
  }
  
  async start() {
    this.client.once('ready', () => {
      console.log('Discord bot is ready!');
      this.startPatternMonitoring();
    });
    
    // Slash commands
    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      
      switch (interaction.commandName) {
        case 'patterns':
          await this.handlePatternsCommand(interaction);
          break;
        case 'performance':
          await this.handlePerformanceCommand(interaction);
          break;
        case 'bankroll':
          await this.handleBankrollCommand(interaction);
          break;
      }
    });
  }
  
  private async startPatternMonitoring() {
    const ws = new WebSocket('ws://localhost:3338/patterns');
    
    ws.onmessage = async (event) => {
      const alert = JSON.parse(event.data);
      
      if (alert.confidence > 0.70) {
        await this.sendPatternAlert(alert);
      }
    };
  }
  
  private async sendPatternAlert(alert: PatternAlert) {
    const channel = this.client.channels.cache.get(this.channelId);
    if (!channel?.isTextBased()) return;
    
    const embed = new EmbedBuilder()
      .setTitle(`🎯 ${alert.pattern_type.toUpperCase()} DETECTED`)
      .setColor(this.getConfidenceColor(alert.confidence))
      .addFields(
        { name: 'Game', value: `${alert.teams.away} @ ${alert.teams.home}`, inline: true },
        { name: 'Confidence', value: `${(alert.confidence * 100).toFixed(1)}%`, inline: true },
        { name: 'Expected ROI', value: `${(alert.expected_roi * 100).toFixed(1)}%`, inline: true },
        { name: 'Recommendation', value: alert.bet_recommendation.description, inline: false },
        { name: 'Bet Size', value: `$${this.calculateBetSize(alert.confidence)}`, inline: true },
        { name: 'Pattern Details', value: alert.pattern_explanation, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'Fantasy AI Pattern Detection' });
    
    await channel.send({ embeds: [embed] });
  }
  
  private async handlePatternsCommand(interaction: any) {
    const patterns = await this.patternAPI.getTodaysPatterns();
    
    const embed = new EmbedBuilder()
      .setTitle('📊 Today\'s Pattern Opportunities')
      .setColor(0x00AE86);
    
    if (patterns.length === 0) {
      embed.setDescription('No high-confidence patterns detected today.');
    } else {
      const description = patterns
        .slice(0, 5) // Show top 5
        .map(p => `**${p.pattern_type}** - ${(p.confidence * 100).toFixed(1)}% confidence`)
        .join('\n');
      
      embed.setDescription(description);
    }
    
    await interaction.reply({ embeds: [embed] });
  }
  
  private async handlePerformanceCommand(interaction: any) {
    const stats = await this.patternAPI.getPerformanceStats();
    
    const embed = new EmbedBuilder()
      .setTitle('📈 Pattern Performance Stats')
      .setColor(0x00AE86)
      .addFields(
        { name: 'Overall Win Rate', value: `${stats.win_rate}%`, inline: true },
        { name: 'Total Profit', value: `$${stats.total_profit}`, inline: true },
        { name: 'ROI', value: `${stats.roi}%`, inline: true },
        { name: 'Best Pattern', value: stats.best_pattern, inline: false },
        { name: 'Current Streak', value: `${stats.current_streak} wins`, inline: true }
      );
    
    await interaction.reply({ embeds: [embed] });
  }
  
  private getConfidenceColor(confidence: number): number {
    if (confidence >= 0.80) return 0x00FF00; // Green
    if (confidence >= 0.70) return 0xFFFF00; // Yellow
    return 0xFF6600; // Orange
  }
}

// Bot setup
const bot = new PatternDiscordBot(
  process.env.DISCORD_TOKEN!,
  process.env.DISCORD_CHANNEL_ID!
);
bot.start();
```

## Automated Betting System

### Complete Autonomous System
```typescript
class AutonomousBettingSystem {
  private patternAPI: PatternAPI;
  private bettingPlatforms: Map<string, BettingAPI>;
  private bankrollManager: BankrollManager;
  private riskManager: RiskManager;
  private performance: PerformanceTracker;
  
  constructor(config: SystemConfig) {
    this.patternAPI = new PatternAPI(config.patternApiUrl);
    this.bettingPlatforms = new Map();
    this.bankrollManager = new BankrollManager(config.initialBankroll);
    this.riskManager = new RiskManager(config.riskLimits);
    this.performance = new PerformanceTracker();
  }
  
  async initialize() {
    // Add betting platforms
    this.bettingPlatforms.set('draftkings', new DraftKingsAPI());
    this.bettingPlatforms.set('fanduel', new FanDuelAPI());
    this.bettingPlatforms.set('betmgm', new BetMGMAPI());
    
    // Start real-time monitoring
    this.startPatternStream();
    
    // Schedule daily analysis
    this.scheduleDailyAnalysis();
    
    console.log('🤖 Autonomous betting system initialized');
  }
  
  private startPatternStream() {
    const ws = new WebSocket('ws://localhost:3338/patterns');
    
    ws.onmessage = async (event) => {
      const alert = JSON.parse(event.data);
      await this.evaluateAndExecute(alert);
    };
  }
  
  private async evaluateAndExecute(alert: PatternAlert) {
    try {
      // Risk assessment
      const riskAssessment = await this.riskManager.assessAlert(alert);
      if (!riskAssessment.approved) {
        console.log(`❌ Risk check failed: ${riskAssessment.reason}`);
        return;
      }
      
      // Find best odds across platforms
      const bestOdds = await this.findBestOdds(alert);
      if (!bestOdds) {
        console.log(`❌ No suitable odds found for ${alert.pattern_type}`);
        return;
      }
      
      // Calculate optimal bet size
      const betSize = this.bankrollManager.calculateBetSize(
        alert.confidence,
        bestOdds.odds,
        alert.expected_roi
      );
      
      // Execute the bet
      await this.executeBet({
        alert,
        platform: bestOdds.platform,
        odds: bestOdds.odds,
        betSize
      });
      
    } catch (error) {
      console.error('Error in evaluate and execute:', error);
    }
  }
  
  private async findBestOdds(alert: PatternAlert): Promise<BestOdds | null> {
    const oddsPromises = Array.from(this.bettingPlatforms.entries())
      .map(async ([name, api]) => {
        try {
          const odds = await api.getGameOdds(alert.game_id);
          return { platform: name, odds: odds[alert.bet_recommendation.type] };
        } catch {
          return null;
        }
      });
    
    const allOdds = (await Promise.all(oddsPromises))
      .filter(Boolean)
      .sort((a, b) => b!.odds - a!.odds);
    
    return allOdds[0] || null;
  }
  
  private async executeBet(params: BetParams) {
    const { alert, platform, odds, betSize } = params;
    
    try {
      const api = this.bettingPlatforms.get(platform)!;
      
      const result = await api.placeBet({
        gameId: alert.game_id,
        betType: alert.bet_recommendation.type,
        selection: alert.bet_recommendation.team,
        amount: betSize,
        odds
      });
      
      // Update bankroll
      this.bankrollManager.recordBet(betSize);
      
      // Track performance
      await this.performance.recordBet({
        pattern: alert.pattern_type,
        confidence: alert.confidence,
        amount: betSize,
        odds,
        betId: result.bet_id,
        platform
      });
      
      console.log(`✅ Bet executed: $${betSize} on ${alert.pattern_type} @ ${platform}`);
      
    } catch (error) {
      console.error(`❌ Bet execution failed:`, error);
    }
  }
  
  private scheduleDailyAnalysis() {
    // Run at 6 AM every day
    cron.schedule('0 6 * * *', async () => {
      await this.runDailyAnalysis();
    });
  }
  
  private async runDailyAnalysis() {
    console.log('📊 Running daily analysis...');
    
    // Get yesterday's results
    const results = await this.performance.getYesterdayResults();
    
    // Update bankroll with winnings
    await this.bankrollManager.processResults(results);
    
    // Adjust strategy if needed
    await this.adjustStrategy(results);
    
    // Generate report
    await this.generateDailyReport(results);
  }
  
  private async adjustStrategy(results: DailyResults) {
    // If performance is declining, reduce bet sizes
    if (results.roi < 0.20) {
      this.bankrollManager.setConservativeMode(true);
      console.log('⚠️ Switching to conservative betting mode');
    }
    
    // If performance is exceptional, slightly increase aggression
    if (results.roi > 0.50 && results.win_rate > 0.75) {
      this.bankrollManager.setConservativeMode(false);
      console.log('🚀 Increasing betting aggression');
    }
  }
}

// System configuration
const config: SystemConfig = {
  patternApiUrl: 'http://localhost:3337',
  initialBankroll: 50000,
  riskLimits: {
    maxDailyLoss: 1000,
    maxBetSize: 2500,
    maxOpenBets: 10
  }
};

const system = new AutonomousBettingSystem(config);
await system.initialize();
```

## Mobile App Integration

### React Native Pattern Monitor
```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { PatternAPI } from '../services/PatternAPI';

const PatternMonitorScreen: React.FC = () => {
  const [patterns, setPatterns] = useState<PatternAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [bankroll, setBankroll] = useState(10000);
  
  const patternAPI = new PatternAPI('https://api.fantasyai.com');
  
  useEffect(() => {
    loadTodaysPatterns();
    
    // Real-time updates
    const ws = new WebSocket('wss://api.fantasyai.com/patterns');
    ws.onmessage = (event) => {
      const alert = JSON.parse(event.data);
      setPatterns(prev => [alert, ...prev.slice(0, 9)]); // Keep latest 10
    };
    
    return () => ws.close();
  }, []);
  
  const loadTodaysPatterns = async () => {
    try {
      const todaysPatterns = await patternAPI.getTodaysPatterns();
      setPatterns(todaysPatterns);
    } catch (error) {
      console.error('Failed to load patterns:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const calculateBetSize = (confidence: number, roi: number): number => {
    const kelly = (confidence * roi - (1 - confidence)) / roi;
    const safeKelly = kelly * 0.25; // Quarter Kelly
    return Math.min(safeKelly * bankroll, bankroll * 0.03);
  };
  
  const renderPattern = ({ item }: { item: PatternAlert }) => (
    <TouchableOpacity 
      style={[styles.patternCard, { borderColor: getConfidenceColor(item.confidence) }]}
      onPress={() => navigateToPatternDetail(item)}
    >
      <View style={styles.patternHeader}>
        <Text style={styles.patternType}>{item.pattern_type}</Text>
        <Text style={[styles.confidence, { color: getConfidenceColor(item.confidence) }]}>
          {(item.confidence * 100).toFixed(1)}%
        </Text>
      </View>
      
      <Text style={styles.gameInfo}>
        {item.teams.away} @ {item.teams.home}
      </Text>
      
      <View style={styles.patternDetails}>
        <Text style={styles.roi}>ROI: {(item.expected_roi * 100).toFixed(1)}%</Text>
        <Text style={styles.betSize}>
          Bet: ${calculateBetSize(item.confidence, item.expected_roi).toFixed(0)}
        </Text>
      </View>
      
      <Text style={styles.recommendation}>
        {item.bet_recommendation.description}
      </Text>
    </TouchableOpacity>
  );
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pattern Opportunities</Text>
        <Text style={styles.bankroll}>Bankroll: ${bankroll.toLocaleString()}</Text>
      </View>
      
      {loading ? (
        <Text>Loading patterns...</Text>
      ) : (
        <FlatList
          data={patterns}
          renderItem={renderPattern}
          keyExtractor={(item) => item.game_id.toString()}
          refreshing={loading}
          onRefresh={loadTodaysPatterns}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  bankroll: {
    fontSize: 16,
    color: '#4CAF50',
  },
  patternCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
  },
  patternHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  patternType: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  confidence: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // ... more styles
});
```

## Telegram Alerts

### Telegram Bot Implementation
```typescript
import TelegramBot from 'node-telegram-bot-api';

class PatternTelegramBot {
  private bot: TelegramBot;
  private patternAPI: PatternAPI;
  private subscribers: Set<number> = new Set();
  
  constructor(token: string) {
    this.bot = new TelegramBot(token, { polling: true });
    this.patternAPI = new PatternAPI('http://localhost:3337');
    this.setupCommands();
    this.startPatternMonitoring();
  }
  
  private setupCommands() {
    // Subscribe to alerts
    this.bot.onText(/\/subscribe/, (msg) => {
      const chatId = msg.chat.id;
      this.subscribers.add(chatId);
      this.bot.sendMessage(chatId, '✅ Subscribed to pattern alerts!');
    });
    
    // Get today's patterns
    this.bot.onText(/\/patterns/, async (msg) => {
      const chatId = msg.chat.id;
      const patterns = await this.patternAPI.getTodaysPatterns();
      
      if (patterns.length === 0) {
        this.bot.sendMessage(chatId, '📊 No high-confidence patterns today.');
        return;
      }
      
      let message = '🎯 *Today\'s Pattern Opportunities*\n\n';
      
      patterns.slice(0, 5).forEach((pattern, index) => {
        message += `${index + 1}. *${pattern.pattern_type}*\n`;
        message += `   Game: ${pattern.teams.away} @ ${pattern.teams.home}\n`;
        message += `   Confidence: ${(pattern.confidence * 100).toFixed(1)}%\n`;
        message += `   ROI: ${(pattern.expected_roi * 100).toFixed(1)}%\n\n`;
      });
      
      this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });
    
    // Performance stats
    this.bot.onText(/\/stats/, async (msg) => {
      const chatId = msg.chat.id;
      const stats = await this.patternAPI.getPerformanceStats();
      
      const message = `📈 *Performance Statistics*\n\n` +
        `Overall Win Rate: ${stats.win_rate}%\n` +
        `Total ROI: ${stats.roi}%\n` +
        `Best Pattern: ${stats.best_pattern}\n` +
        `Current Streak: ${stats.current_streak} wins`;
      
      this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });
  }
  
  private startPatternMonitoring() {
    const ws = new WebSocket('ws://localhost:3338/patterns');
    
    ws.onmessage = async (event) => {
      const alert = JSON.parse(event.data);
      
      if (alert.confidence > 0.70) {
        await this.broadcastAlert(alert);
      }
    };
  }
  
  private async broadcastAlert(alert: PatternAlert) {
    const message = this.formatAlert(alert);
    
    for (const chatId of this.subscribers) {
      try {
        await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error(`Failed to send alert to ${chatId}:`, error);
      }
    }
  }
  
  private formatAlert(alert: PatternAlert): string {
    const confidence = (alert.confidence * 100).toFixed(1);
    const roi = (alert.expected_roi * 100).toFixed(1);
    
    return `🚨 *PATTERN ALERT*\n\n` +
      `*${alert.pattern_type.toUpperCase()}*\n` +
      `Game: ${alert.teams.away} @ ${alert.teams.home}\n` +
      `Confidence: ${confidence}%\n` +
      `Expected ROI: ${roi}%\n\n` +
      `*Recommendation:*\n${alert.bet_recommendation.description}\n\n` +
      `*Pattern Details:*\n${alert.pattern_explanation}`;
  }
}

// Start the bot
const bot = new PatternTelegramBot(process.env.TELEGRAM_BOT_TOKEN!);
```

## Portfolio Management Dashboard

### Web Dashboard with Real-Time Updates
```typescript
// React Dashboard Component
import React, { useState, useEffect } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

const PatternDashboard: React.FC = () => {
  const [patterns, setPatterns] = useState<PatternAlert[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio>({
    bankroll: 50000,
    activeBets: [],
    performance: null
  });
  
  useEffect(() => {
    // Load initial data
    loadDashboardData();
    
    // WebSocket for real-time updates
    const ws = new WebSocket('ws://localhost:3338/patterns');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'pattern_alert') {
        setPatterns(prev => [data.alert, ...prev.slice(0, 19)]);
      } else if (data.type === 'portfolio_update') {
        setPortfolio(data.portfolio);
      }
    };
    
    return () => ws.close();
  }, []);
  
  const loadDashboardData = async () => {
    const [patternsData, portfolioData] = await Promise.all([
      fetch('/api/patterns/recent').then(r => r.json()),
      fetch('/api/portfolio').then(r => r.json())
    ]);
    
    setPatterns(patternsData);
    setPortfolio(portfolioData);
  };
  
  const performanceData = {
    labels: portfolio.performance?.dates || [],
    datasets: [{
      label: 'Portfolio Value',
      data: portfolio.performance?.values || [],
      borderColor: '#4CAF50',
      backgroundColor: 'rgba(76, 175, 80, 0.1)',
      fill: true
    }]
  };
  
  const patternDistribution = {
    labels: ['Back-to-Back', 'Revenge', 'Altitude', 'Primetime', 'Division'],
    datasets: [{
      data: [30, 25, 20, 15, 10],
      backgroundColor: [
        '#FF6384',
        '#36A2EB',
        '#FFCE56',
        '#4BC0C0',
        '#9966FF'
      ]
    }]
  };
  
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Fantasy AI Pattern Dashboard</h1>
        <div className="bankroll-display">
          <span>Bankroll: ${portfolio.bankroll.toLocaleString()}</span>
        </div>
      </header>
      
      <div className="dashboard-grid">
        {/* Performance Chart */}
        <div className="chart-card">
          <h3>Portfolio Performance</h3>
          <Line data={performanceData} />
        </div>
        
        {/* Pattern Distribution */}
        <div className="chart-card">
          <h3>Pattern Distribution</h3>
          <Doughnut data={patternDistribution} />
        </div>
        
        {/* Live Patterns */}
        <div className="patterns-card">
          <h3>Live Pattern Alerts</h3>
          <div className="patterns-list">
            {patterns.map((pattern, index) => (
              <div key={index} className="pattern-item">
                <div className="pattern-header">
                  <span className="pattern-type">{pattern.pattern_type}</span>
                  <span className="confidence">
                    {(pattern.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="pattern-details">
                  <span>{pattern.teams.away} @ {pattern.teams.home}</span>
                  <span className="roi">
                    ROI: {(pattern.expected_roi * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Active Bets */}
        <div className="bets-card">
          <h3>Active Bets</h3>
          <div className="bets-list">
            {portfolio.activeBets.map((bet, index) => (
              <div key={index} className="bet-item">
                <div className="bet-info">
                  <span className="bet-pattern">{bet.pattern}</span>
                  <span className="bet-amount">${bet.amount}</span>
                </div>
                <div className="bet-status">
                  <span className={`status ${bet.status}`}>{bet.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .dashboard {
          min-height: 100vh;
          background: #121212;
          color: white;
          padding: 20px;
        }
        
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        
        .bankroll-display {
          font-size: 24px;
          font-weight: bold;
          color: #4CAF50;
        }
        
        .dashboard-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 20px;
          height: calc(100vh - 120px);
        }
        
        .chart-card, .patterns-card, .bets-card {
          background: #1E1E1E;
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #333;
        }
        
        .patterns-list, .bets-list {
          max-height: 400px;
          overflow-y: auto;
        }
        
        .pattern-item, .bet-item {
          background: #2A2A2A;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 8px;
        }
        
        .pattern-header, .bet-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        
        .confidence {
          color: #4CAF50;
          font-weight: bold;
        }
        
        .roi {
          color: #FF9800;
        }
        
        .status.pending { color: #FFC107; }
        .status.won { color: #4CAF50; }
        .status.lost { color: #F44336; }
      `}</style>
    </div>
  );
};

export default PatternDashboard;
```

## Conclusion

These integration examples demonstrate the versatility and power of the Fantasy AI Pattern Detection System. Whether you're building a simple Discord bot or a sophisticated automated betting system, the patterns APIs provide the foundation for profitable sports betting applications.

### Key Integration Points:
1. **Real-time WebSocket connections** for live alerts
2. **RESTful APIs** for historical analysis
3. **Kelly Criterion calculations** for optimal bet sizing
4. **Multi-platform betting** for best odds
5. **Performance tracking** for continuous improvement

### Best Practices:
- Always implement proper error handling
- Use exponential backoff for WebSocket reconnections
- Implement circuit breakers for external API calls
- Log all bets for performance analysis
- Never bet more than you can afford to lose

Choose the integration approach that best fits your technical requirements and risk tolerance. Remember: the patterns provide an edge, but proper bankroll management and discipline are essential for long-term success.
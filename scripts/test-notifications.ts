#!/usr/bin/env tsx
/**
 * 🔔 TEST PUSH NOTIFICATION SYSTEM
 * Demonstrates all notification types
 */

import chalk from 'chalk';
import { PushNotificationService } from '../lib/notifications/push-service';
import WebSocket from 'ws';

async function testNotifications() {
  console.log(chalk.bold.cyan('🔔 PUSH NOTIFICATION SYSTEM TEST\n'));
  
  // Initialize service
  const pushService = new PushNotificationService();
  
  // Simulate user preferences
  await pushService.updateUserPreferences('user_123', {
    enabledTypes: ['prediction', 'arbitrage', 'game_start', 'outcome', 'streak'],
    minConfidence: 0.75,
    minArbitrageProfit: 1,
    favoriteTeams: ['Lakers', 'Warriors'],
    notificationHours: { start: 0, end: 23 }, // All day for testing
    channels: {
      push: true,
      email: true,
      sms: false,
      inApp: true
    }
  });
  
  console.log(chalk.green('✅ User preferences configured\n'));
  
  // 1. High Confidence Prediction
  console.log(chalk.bold.yellow('1️⃣ High Confidence Prediction Alert'));
  await pushService.sendPredictionAlert({
    gameId: 'game_001',
    homeTeam: 'Lakers',
    awayTeam: 'Celtics',
    winner: 'home',
    confidence: 0.82,
    modelCount: 4
  });
  
  // 2. Urgent Prediction
  console.log(chalk.bold.yellow('\n2️⃣ Urgent Prediction Alert (90%+ confidence)'));
  await pushService.sendPredictionAlert({
    gameId: 'game_002',
    homeTeam: 'Warriors',
    awayTeam: 'Nets',
    winner: 'home',
    confidence: 0.91,
    modelCount: 4
  });
  
  // 3. Arbitrage Opportunity
  console.log(chalk.bold.yellow('\n3️⃣ Arbitrage Opportunity Alert'));
  await pushService.sendArbitrageAlert({
    gameId: 'game_003',
    homeTeam: 'Heat',
    awayTeam: 'Knicks',
    profit: 3.5,
    timeWindow: 10,
    investment: 1000,
    returns: 1035
  });
  
  // 4. Game Start Reminder
  console.log(chalk.bold.yellow('\n4️⃣ Game Start Reminder'));
  await pushService.sendGameStartAlert({
    id: 'game_004',
    homeTeam: 'Lakers',
    awayTeam: 'Clippers',
    startTime: new Date(Date.now() + 15 * 60 * 1000)
  });
  
  // 5. Prediction Outcome (Correct)
  console.log(chalk.bold.yellow('\n5️⃣ Prediction Outcome - Correct'));
  await pushService.sendOutcomeAlert(
    { winner: 'home', confidence: 0.78 },
    { 
      winner: 'home',
      homeTeam: 'Lakers',
      awayTeam: 'Celtics',
      homeScore: 110,
      awayScore: 105
    }
  );
  
  // 6. Prediction Outcome (Incorrect)
  console.log(chalk.bold.yellow('\n6️⃣ Prediction Outcome - Incorrect'));
  await pushService.sendOutcomeAlert(
    { winner: 'home', confidence: 0.65 },
    { 
      winner: 'away',
      homeTeam: 'Nets',
      awayTeam: 'Bucks',
      homeScore: 98,
      awayScore: 102
    }
  );
  
  // 7. Hot Streak Alert
  console.log(chalk.bold.yellow('\n7️⃣ Hot Streak Alert'));
  await pushService.sendStreakAlert({
    team: 'Warriors',
    wins: 7,
    lastGame: 'vs Spurs (W 115-102)'
  });
  
  // Get statistics
  const stats = await pushService.getStats();
  console.log(chalk.bold.cyan('\n📊 Notification Statistics:'));
  console.log(`  Sent (24h): ${stats.sent24h}`);
  console.log(`  Queued: ${stats.queued}`);
  console.log(`  Active Users: ${stats.activeUsers}`);
  console.log(`  User Preferences: ${stats.preferences}`);
  
  // Simulate WebSocket client
  console.log(chalk.bold.cyan('\n🌐 Simulating WebSocket Client...\n'));
  
  const ws = {
    readyState: WebSocket.OPEN,
    send: (data: string) => {
      const msg = JSON.parse(data);
      console.log(chalk.green('📱 In-App Notification Received:'));
      console.log(`   ${msg.data.title}`);
      console.log(`   ${msg.data.body}`);
      console.log('');
    },
    on: () => {}
  } as any;
  
  pushService.registerClient('user_123', ws);
  
  // Send another notification to show WebSocket delivery
  await pushService.sendPredictionAlert({
    gameId: 'game_005',
    homeTeam: 'Lakers',
    awayTeam: 'Mavericks',
    winner: 'home',
    confidence: 0.88,
    modelCount: 4
  });
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 6000));
  
  console.log(chalk.bold.green('\n✅ Notification system test complete!'));
  
  // Show sample notification UI
  console.log(chalk.bold.cyan('\n📱 Sample Notification UI:\n'));
  
  console.log(chalk.bgGreen.black(' 🎯 High Confidence Pick!                    '));
  console.log(chalk.bgGreen.black(' Lakers vs Celtics                          '));
  console.log(chalk.bgGreen.black(' Lakers to win (82.0% confidence)           '));
  console.log(chalk.bgGreen.black(' Tap to view details                        '));
  
  console.log('');
  
  console.log(chalk.bgYellow.black(' 💰 Arbitrage Opportunity!                  '));
  console.log(chalk.bgYellow.black(' 3.5% guaranteed profit                     '));
  console.log(chalk.bgYellow.black(' Heat vs Knicks                             '));
  console.log(chalk.bgYellow.black(' Act within 10 minutes!                     '));
  
  console.log('');
  
  console.log(chalk.bgBlue.white(' 🏀 Game Starting Soon!                     '));
  console.log(chalk.bgBlue.white(' Lakers vs Clippers                         '));
  console.log(chalk.bgBlue.white(' Starts in 15 minutes                       '));
  console.log(chalk.bgBlue.white(' View your prediction                       '));
}

testNotifications().catch(console.error);
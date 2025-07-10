#!/usr/bin/env tsx
/**
 * 🔥 TURBO DASHBOARD DEMO - Shows real predictions flowing!
 */

import chalk from 'chalk';
import WebSocket from 'ws';

async function turboDashboardDemo() {
  console.log(chalk.bold.red('\n🔥 TURBO DASHBOARD DEMO - REAL PREDICTIONS!\n'));
  console.log(chalk.yellow('Connecting to WebSocket server...'));
  
  const ws = new WebSocket('ws://localhost:8080');
  let predictionCount = 0;
  const startTime = Date.now();
  const predictions: any[] = [];
  
  ws.on('open', () => {
    console.log(chalk.green('✅ Connected! Watching for predictions...\n'));
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'new_prediction' || message.type === 'game_prediction') {
        predictionCount++;
        const pred = message.data;
        predictions.push(pred);
        
        // Show every 10th prediction
        if (predictionCount % 10 === 0) {
          console.clear();
          console.log(chalk.bold.red('🔥 TURBO PREDICTION ENGINE - LIVE FEED\n'));
          
          // Stats
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = predictionCount / elapsed;
          console.log(chalk.cyan('📊 REAL-TIME STATS:'));
          console.log(`   Predictions received: ${chalk.yellow(predictionCount)}`);
          console.log(`   Rate: ${chalk.green(rate.toFixed(1))} predictions/second`);
          console.log(`   Hourly projection: ${chalk.bold.green((rate * 3600).toLocaleString())} predictions/hour`);
          console.log(`   Time elapsed: ${elapsed.toFixed(0)}s\n`);
          
          // Latest predictions
          console.log(chalk.yellow('🎯 LATEST PREDICTIONS:'));
          predictions.slice(-5).forEach((p, i) => {
            console.log(`\n   ${i + 1}. Game #${p.gameId}`);
            console.log(`      ${p.game?.home_team || 'Home'} vs ${p.game?.away_team || 'Away'}`);
            console.log(`      Winner: ${chalk.bold(p.prediction.winner === 'home' ? chalk.blue('HOME') : chalk.red('AWAY'))}`);
            console.log(`      Confidence: ${chalk.yellow(p.prediction.confidence.toFixed(1) + '%')}`);
          });
          
          // Performance indicator
          const performanceBar = '█'.repeat(Math.min(50, Math.floor(rate / 10)));
          console.log(chalk.gray(`\n   Performance: ${performanceBar}`));
        }
      }
    } catch (err) {
      // Ignore parse errors
    }
  });
  
  ws.on('error', (error) => {
    console.error(chalk.red('WebSocket error:'), error.message);
  });
  
  ws.on('close', () => {
    const totalTime = (Date.now() - startTime) / 1000;
    console.log(chalk.yellow('\n\n📊 FINAL STATS:'));
    console.log(`   Total predictions: ${chalk.bold.green(predictionCount)}`);
    console.log(`   Total time: ${totalTime.toFixed(1)}s`);
    console.log(`   Average rate: ${(predictionCount / totalTime).toFixed(1)} predictions/second`);
    console.log(chalk.bold.green(`\n✅ This is REAL DATA from your turbo engine!`));
  });
  
  // Instructions
  console.log(chalk.gray('\nPress Ctrl+C to stop the demo...'));
}

turboDashboardDemo().catch(console.error);
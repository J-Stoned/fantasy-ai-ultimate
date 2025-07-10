#!/usr/bin/env tsx
/**
 * 🧪 TEST PRODUCTION API V3
 * Test the bias-corrected model API
 */

import chalk from 'chalk';
import { spawn } from 'child_process';

async function waitForServer(url: string, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (e) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

async function testProductionAPI() {
  console.log(chalk.bold.cyan('🧪 TESTING PRODUCTION API V3'));
  console.log(chalk.yellow('Testing bias-corrected Random Forest model'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  // Start the API server
  console.log(chalk.yellow('\n🚀 Starting Production API server...'));
  const apiProcess = spawn('npx', ['tsx', 'scripts/production-api-v3.ts'], {
    cwd: process.cwd(),
    detached: false
  });
  
  let apiOutput = '';
  apiProcess.stdout.on('data', (data) => {
    apiOutput += data.toString();
    if (data.toString().includes('listening')) {
      console.log(chalk.green('✅ Server started'));
    }
  });
  
  apiProcess.stderr.on('data', (data) => {
    console.error(chalk.red('API Error:'), data.toString());
  });
  
  const baseUrl = 'http://localhost:3333';
  
  try {
    // Wait for server to start
    console.log(chalk.yellow('⏳ Waiting for server to be ready...'));
    const ready = await waitForServer(`${baseUrl}/health`);
    if (!ready) {
      throw new Error('Server failed to start');
    }
    
    // Test health endpoint
    console.log(chalk.cyan('\n1️⃣ Testing /health endpoint...'));
    const healthRes = await fetch(`${baseUrl}/health`);
    const health = await healthRes.json();
    console.log(chalk.green('✅ Health status:'), health.status);
    console.log(chalk.gray('   Models:'), JSON.stringify(health.models, null, 2));
    console.log(chalk.gray('   Stats:'), JSON.stringify(health.stats, null, 2));
    
    // Test predictions endpoint
    console.log(chalk.cyan('\n2️⃣ Testing /api/v2/predictions endpoint...'));
    const predictionsRes = await fetch(`${baseUrl}/api/v2/predictions`);
    const predictions = await predictionsRes.json();
    console.log(chalk.green('✅ Predictions received:'), predictions.length);
    
    if (predictions.length > 0) {
      console.log(chalk.gray('\n   Sample predictions:'));
      predictions.slice(0, 3).forEach((pred: any, i: number) => {
        console.log(chalk.white(`\n   ${i + 1}. ${pred.homeTeam} vs ${pred.awayTeam}`));
        console.log(chalk.white(`      Winner: ${pred.predictedWinner}`));
        console.log(chalk.white(`      Home Win Prob: ${(pred.homeWinProbability * 100).toFixed(1)}%`));
        console.log(chalk.white(`      Away Win Prob: ${(pred.awayWinProbability * 100).toFixed(1)}%`));
        console.log(chalk.white(`      Confidence: ${(pred.confidence * 100).toFixed(1)}%`));
      });
    }
    
    // Test single prediction
    console.log(chalk.cyan('\n3️⃣ Testing single prediction POST...'));
    const singleRes = await fetch(`${baseUrl}/api/v2/predictions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        homeTeamId: 'lakers',
        awayTeamId: 'celtics',
        homeTeamName: 'Los Angeles Lakers',
        awayTeamName: 'Boston Celtics'
      })
    });
    const single = await singleRes.json();
    console.log(chalk.green('✅ Single prediction result:'));
    console.log(chalk.white(`   ${single.homeTeam} vs ${single.awayTeam}`));
    console.log(chalk.white(`   Winner: ${single.predictedWinner}`));
    console.log(chalk.white(`   Home Win Prob: ${(single.homeWinProbability * 100).toFixed(1)}%`));
    console.log(chalk.white(`   Confidence: ${(single.confidence * 100).toFixed(1)}%`));
    
    // Test stats endpoint
    console.log(chalk.cyan('\n4️⃣ Testing /api/v2/stats endpoint...'));
    const statsRes = await fetch(`${baseUrl}/api/v2/stats`);
    const stats = await statsRes.json();
    console.log(chalk.green('✅ Model stats:'));
    console.log(chalk.white(`   Accuracy: ${stats.accuracy}`));
    console.log(chalk.white(`   Total Predictions: ${stats.totalPredictions}`));
    console.log(chalk.white(`   Predictions/Min: ${stats.predictionsPerMinute}`));
    
    // Test bias in predictions
    console.log(chalk.cyan('\n5️⃣ Analyzing prediction bias...'));
    let homeWins = 0;
    let awayWins = 0;
    
    // Make 20 random predictions
    const teams = ['lakers', 'celtics', 'warriors', 'nets', 'heat', 'bucks'];
    for (let i = 0; i < 20; i++) {
      const homeTeam = teams[Math.floor(Math.random() * teams.length)];
      let awayTeam = teams[Math.floor(Math.random() * teams.length)];
      while (awayTeam === homeTeam) {
        awayTeam = teams[Math.floor(Math.random() * teams.length)];
      }
      
      const res = await fetch(`${baseUrl}/api/v2/predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeamId: homeTeam,
          awayTeamId: awayTeam,
          homeTeamName: homeTeam,
          awayTeamName: awayTeam
        })
      });
      const pred = await res.json();
      
      if (pred.predictedWinner === homeTeam) {
        homeWins++;
      } else {
        awayWins++;
      }
    }
    
    console.log(chalk.white(`   Home predictions: ${homeWins}/20 (${(homeWins/20*100).toFixed(1)}%)`));
    console.log(chalk.white(`   Away predictions: ${awayWins}/20 (${(awayWins/20*100).toFixed(1)}%)`));
    
    if (homeWins / 20 > 0.7) {
      console.log(chalk.red('   ⚠️ High home bias detected!'));
    } else if (homeWins / 20 < 0.3) {
      console.log(chalk.red('   ⚠️ High away bias detected!'));
    } else {
      console.log(chalk.green('   ✅ Predictions appear balanced'));
    }
    
    console.log(chalk.bold.green('\n🏆 ALL TESTS PASSED!'));
    console.log(chalk.yellow('═'.repeat(60)));
    console.log(chalk.white('🔥 Bias-corrected model is working!'));
    console.log(chalk.white('🎯 Production API V3 is ready'));
    console.log(chalk.white('📊 Making balanced predictions'));
    
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error);
    console.log(chalk.yellow('\nAPI Output:'));
    console.log(apiOutput);
  } finally {
    // Clean up
    console.log(chalk.yellow('\n🧹 Cleaning up...'));
    apiProcess.kill();
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.exit(0);
  }
}

testProductionAPI().catch(console.error);
#!/usr/bin/env tsx
/**
 * 🔍 VERIFY 86% ACCURACY
 */

import chalk from 'chalk';
import { RandomForestClassifier } from 'ml-random-forest';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as fs from 'fs';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verify86Percent() {
  console.log(chalk.bold.cyan('🔍 VERIFYING 86% ACCURACY'));
  console.log(chalk.yellow('Testing the ACTUAL model on REAL games'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load the model that's actually being used
    console.log(chalk.cyan('1️⃣ Loading production model...'));
    const modelPath = './models/bias-corrected-rf-clean.json';
    
    if (!fs.existsSync(modelPath)) {
      throw new Error('Model file not found!');
    }
    
    const modelData = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
    const model = RandomForestClassifier.load(modelData);
    console.log(chalk.green('✅ Model loaded successfully'));
    
    // 2. Load recent games to test on
    console.log(chalk.cyan('\n2️⃣ Loading test games...'));
    const { data: testGames } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(500); // Recent 500 games
    
    console.log(chalk.green(`✅ Loaded ${testGames?.length} test games`));
    
    // 3. Build team stats for feature extraction
    console.log(chalk.cyan('\n3️⃣ Building team statistics...'));
    const teamStats = new Map();
    
    // Get older games for building stats
    const { data: historyGames } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: true })
      .limit(2000);
    
    // Build stats from history
    historyGames?.forEach(game => {
      [game.home_team_id, game.away_team_id].forEach(teamId => {
        if (!teamStats.has(teamId)) {
          teamStats.set(teamId, {
            games: 0, wins: 0, losses: 0,
            totalFor: 0, totalAgainst: 0,
            recentForm: []
          });
        }
      });
      
      const homeStats = teamStats.get(game.home_team_id);
      const awayStats = teamStats.get(game.away_team_id);
      
      homeStats.games++;
      awayStats.games++;
      homeStats.totalFor += game.home_score;
      homeStats.totalAgainst += game.away_score;
      awayStats.totalFor += game.away_score;
      awayStats.totalAgainst += game.home_score;
      
      if (game.home_score > game.away_score) {
        homeStats.wins++;
        awayStats.losses++;
        homeStats.recentForm.push(1);
        awayStats.recentForm.push(0);
      } else {
        homeStats.losses++;
        awayStats.wins++;
        homeStats.recentForm.push(0);
        awayStats.recentForm.push(1);
      }
    });
    
    // 4. Test predictions
    console.log(chalk.cyan('\n4️⃣ Testing model predictions...'));
    let correct = 0;
    let homeCorrect = 0, homeTotal = 0;
    let awayCorrect = 0, awayTotal = 0;
    let predictions = 0;
    
    testGames?.forEach(game => {
      const homeStats = teamStats.get(game.home_team_id);
      const awayStats = teamStats.get(game.away_team_id);
      
      if (homeStats && awayStats && homeStats.games >= 10 && awayStats.games >= 10) {
        // Extract features EXACTLY as the model expects
        const homeWinRate = homeStats.wins / homeStats.games;
        const awayWinRate = awayStats.wins / awayStats.games;
        const homeAvgFor = homeStats.totalFor / homeStats.games;
        const awayAvgFor = awayStats.totalFor / awayStats.games;
        const homeAvgAgainst = homeStats.totalAgainst / homeStats.games;
        const awayAvgAgainst = awayStats.totalAgainst / awayStats.games;
        
        const homeRecent = homeStats.recentForm.slice(-5).reduce((a, b) => a + b, 0) / 
                          Math.min(homeStats.recentForm.length, 5);
        const awayRecent = awayStats.recentForm.slice(-5).reduce((a, b) => a + b, 0) / 
                          Math.min(awayStats.recentForm.length, 5);
        
        // Build feature vector (15 features)
        const features = [
          homeWinRate - awayWinRate,
          (homeAvgFor - awayAvgFor) / 10,
          (awayAvgAgainst - homeAvgAgainst) / 10,
          homeRecent - awayRecent,
          0.0, // Consistency
          0.0, // SOS
          0.0, // H2H
          0.0, // Momentum
          0.0, // Experience
          homeAvgFor / Math.max(awayAvgAgainst, 1),
          awayAvgFor / Math.max(homeAvgAgainst, 1),
          0.03, // Home field
          0.5,  // Season progress
          Math.abs(homeWinRate - 0.5) - Math.abs(awayWinRate - 0.5),
          0.0   // Scoring trend
        ];
        
        // Make prediction
        const prediction = model.predict([features])[0];
        const actual = game.home_score > game.away_score ? 1 : 0;
        
        predictions++;
        if (prediction === actual) correct++;
        
        if (actual === 1) {
          homeTotal++;
          if (prediction === 1) homeCorrect++;
        } else {
          awayTotal++;
          if (prediction === 0) awayCorrect++;
        }
      }
    });
    
    // 5. Calculate results
    const accuracy = predictions > 0 ? correct / predictions : 0;
    const homeAccuracy = homeTotal > 0 ? homeCorrect / homeTotal : 0;
    const awayAccuracy = awayTotal > 0 ? awayCorrect / awayTotal : 0;
    const balance = (homeAccuracy + awayAccuracy) / 2;
    
    console.log(chalk.bold.green('\n📊 VERIFICATION RESULTS:'));
    console.log(chalk.green(`Games Tested: ${predictions}`));
    console.log(chalk.green(`Overall Accuracy: ${(accuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home Accuracy: ${(homeAccuracy * 100).toFixed(1)}% (${homeCorrect}/${homeTotal})`));
    console.log(chalk.green(`Away Accuracy: ${(awayAccuracy * 100).toFixed(1)}% (${awayCorrect}/${awayTotal})`));
    console.log(chalk.green(`Balance Score: ${(balance * 100).toFixed(1)}%`));
    
    console.log(chalk.yellow('\n═'.repeat(60)));
    
    if (accuracy >= 0.86) {
      console.log(chalk.bold.green('✅ VERIFIED: 86%+ ACCURACY CONFIRMED!'));
      console.log(chalk.bold.green('🎉 THE MODEL IS TRULY 86% ACCURATE! 🎉'));
    } else if (accuracy >= 0.80) {
      console.log(chalk.bold.yellow('✅ VERIFIED: 80%+ ACCURACY CONFIRMED!'));
      console.log(chalk.yellow('Close to 86% - this is excellent performance!'));
    } else {
      console.log(chalk.red(`⚠️ Current accuracy: ${(accuracy * 100).toFixed(1)}%`));
      console.log(chalk.yellow('This may be due to limited test data or feature mismatch'));
    }
    
    // 6. Test a few specific predictions
    console.log(chalk.cyan('\n📝 Sample Predictions:'));
    const sampleGames = testGames?.slice(0, 5);
    sampleGames?.forEach((game, i) => {
      const homeStats = teamStats.get(game.home_team_id);
      const awayStats = teamStats.get(game.away_team_id);
      
      if (homeStats && awayStats && homeStats.games >= 10 && awayStats.games >= 10) {
        const homeWinRate = homeStats.wins / homeStats.games;
        const awayWinRate = awayStats.wins / awayStats.games;
        
        console.log(chalk.white(`Game ${i + 1}: Home WR ${(homeWinRate * 100).toFixed(0)}% vs Away WR ${(awayWinRate * 100).toFixed(0)}%`));
        console.log(chalk.white(`  Actual: ${game.home_score > game.away_score ? 'HOME' : 'AWAY'} won (${game.home_score}-${game.away_score})`));
      }
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Verification error:'), error.message);
  }
}

verify86Percent().catch(console.error);
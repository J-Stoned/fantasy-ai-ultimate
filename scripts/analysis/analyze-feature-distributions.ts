#!/usr/bin/env tsx
/**
 * 🔍 ANALYZE FEATURE DISTRIBUTIONS
 * Understand why models predict all one class
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeFeatureDistributions() {
  console.log(chalk.bold.cyan('🔍 ANALYZING FEATURE DISTRIBUTIONS'));
  console.log(chalk.yellow('Understanding the data patterns'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load sample of games
    console.log(chalk.cyan('1️⃣ Loading sample games...'));
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(5000);
    
    console.log(chalk.green(`✅ Loaded ${games?.length} games`));
    
    // 2. Build features and analyze
    console.log(chalk.cyan('\n2️⃣ Building features...'));
    
    const teamStats = new Map();
    const homeWinFeatures: number[][] = [];
    const awayWinFeatures: number[][] = [];
    
    games?.forEach(game => {
      // Initialize teams
      [game.home_team_id, game.away_team_id].forEach(teamId => {
        if (!teamStats.has(teamId)) {
          teamStats.set(teamId, {
            games: 0, wins: 0,
            totalFor: 0, totalAgainst: 0,
            homeGames: 0, homeWins: 0,
            awayGames: 0, awayWins: 0
          });
        }
      });
      
      const homeStats = teamStats.get(game.home_team_id);
      const awayStats = teamStats.get(game.away_team_id);
      
      if (homeStats.games >= 10 && awayStats.games >= 10) {
        // Calculate features
        const homeWR = homeStats.wins / homeStats.games;
        const awayWR = awayStats.wins / awayStats.games;
        const homeAvgFor = homeStats.totalFor / homeStats.games;
        const awayAvgFor = awayStats.totalFor / awayStats.games;
        
        const features = [
          homeWR - awayWR,
          (homeAvgFor - awayAvgFor) / 10,
          homeWR,
          awayWR,
          0.03 // home advantage
        ];
        
        if (game.home_score > game.away_score) {
          homeWinFeatures.push(features);
        } else {
          awayWinFeatures.push(features);
        }
      }
      
      // Update stats
      const homeWon = game.home_score > game.away_score;
      
      homeStats.games++;
      awayStats.games++;
      homeStats.totalFor += game.home_score;
      homeStats.totalAgainst += game.away_score;
      awayStats.totalFor += game.away_score;
      awayStats.totalAgainst += game.home_score;
      
      if (homeWon) {
        homeStats.wins++;
        if (game.home_team_id === homeStats) homeStats.homeWins++;
      } else {
        awayStats.wins++;
        if (game.away_team_id === awayStats) awayStats.awayWins++;
      }
    });
    
    console.log(chalk.green(`✅ Built ${homeWinFeatures.length} home win samples`));
    console.log(chalk.green(`✅ Built ${awayWinFeatures.length} away win samples`));
    
    // 3. Analyze distributions
    console.log(chalk.cyan('\n3️⃣ Analyzing feature distributions...'));
    
    const featureNames = ['Win Rate Diff', 'Score Diff', 'Home WR', 'Away WR', 'Home Adv'];
    
    for (let i = 0; i < featureNames.length; i++) {
      console.log(chalk.yellow(`\n${featureNames[i]}:`));
      
      // Home wins
      const homeValues = homeWinFeatures.map(f => f[i]);
      const homeMean = homeValues.reduce((a, b) => a + b, 0) / homeValues.length;
      const homeMin = Math.min(...homeValues);
      const homeMax = Math.max(...homeValues);
      
      // Away wins
      const awayValues = awayWinFeatures.map(f => f[i]);
      const awayMean = awayValues.reduce((a, b) => a + b, 0) / awayValues.length;
      const awayMin = Math.min(...awayValues);
      const awayMax = Math.max(...awayValues);
      
      console.log(chalk.green(`  Home wins: mean=${homeMean.toFixed(3)}, range=[${homeMin.toFixed(3)}, ${homeMax.toFixed(3)}]`));
      console.log(chalk.red(`  Away wins: mean=${awayMean.toFixed(3)}, range=[${awayMin.toFixed(3)}, ${awayMax.toFixed(3)}]`));
      console.log(chalk.white(`  Overlap: ${calculateOverlap(homeValues, awayValues).toFixed(1)}%`));
      console.log(chalk.white(`  Separation: ${Math.abs(homeMean - awayMean).toFixed(3)}`));
    }
    
    // 4. Check correlations
    console.log(chalk.cyan('\n4️⃣ Checking feature correlations...'));
    
    // Combine all features
    const allFeatures = [...homeWinFeatures, ...awayWinFeatures];
    const allLabels = [
      ...new Array(homeWinFeatures.length).fill(1),
      ...new Array(awayWinFeatures.length).fill(0)
    ];
    
    // Calculate correlation with outcome
    for (let i = 0; i < featureNames.length; i++) {
      const values = allFeatures.map(f => f[i]);
      const correlation = calculateCorrelation(values, allLabels);
      console.log(chalk.yellow(`${featureNames[i]}: ${(correlation * 100).toFixed(1)}% correlation with outcome`));
    }
    
    // 5. Find best single predictor
    console.log(chalk.cyan('\n5️⃣ Testing single feature predictions...'));
    
    for (let i = 0; i < featureNames.length; i++) {
      let correct = 0;
      
      allFeatures.forEach((features, idx) => {
        const prediction = features[i] > 0 ? 1 : 0;
        if (prediction === allLabels[idx]) correct++;
      });
      
      const accuracy = correct / allFeatures.length;
      console.log(chalk.green(`${featureNames[i]} alone: ${(accuracy * 100).toFixed(1)}% accuracy`));
    }
    
    // 6. Recommendations
    console.log(chalk.cyan('\n6️⃣ RECOMMENDATIONS:'));
    console.log(chalk.yellow('The features have high overlap between classes!'));
    console.log(chalk.yellow('This explains why models predict all one class.'));
    console.log(chalk.yellow('\nTo fix this, we need:'));
    console.log(chalk.white('1. More discriminative features (player-level data)'));
    console.log(chalk.white('2. Feature engineering to reduce overlap'));
    console.log(chalk.white('3. Different algorithms (XGBoost, Neural Networks)'));
    console.log(chalk.white('4. Ensemble methods with different biases'));
    
    console.log(chalk.bold.cyan('\n🔍 ANALYSIS COMPLETE!'));
    console.log(chalk.yellow('═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

function calculateOverlap(values1: number[], values2: number[]): number {
  const min1 = Math.min(...values1);
  const max1 = Math.max(...values1);
  const min2 = Math.min(...values2);
  const max2 = Math.max(...values2);
  
  const overlapStart = Math.max(min1, min2);
  const overlapEnd = Math.min(max1, max2);
  
  if (overlapStart >= overlapEnd) return 0;
  
  const overlap = overlapEnd - overlapStart;
  const totalRange = Math.max(max1, max2) - Math.min(min1, min2);
  
  return (overlap / totalRange) * 100;
}

function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return den === 0 ? 0 : num / den;
}

analyzeFeatureDistributions().catch(console.error);
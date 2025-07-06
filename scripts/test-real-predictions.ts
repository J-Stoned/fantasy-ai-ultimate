#!/usr/bin/env tsx
/**
 * Test real predictions with proper features
 */

import chalk from 'chalk';
import { RandomForestClassifier } from 'ml-random-forest';
import * as fs from 'fs';

async function testRealPredictions() {
  console.log(chalk.bold.cyan('🧪 TESTING REAL PREDICTIONS'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // Load the model
    const modelData = JSON.parse(fs.readFileSync('./models/bias-corrected-rf-clean.json', 'utf8'));
    const model = RandomForestClassifier.load(modelData);
    console.log(chalk.green('✅ Model loaded'));
    
    // Test with realistic game scenarios
    const testGames = [
      {
        name: 'Patriots (6-4) vs Browns (3-7)',
        // Features matching training: [winRateDiff, scoringDiff, defensiveDiff, recentFormDiff, ...]
        features: [
          0.3,    // Win rate difference (Patriots better)
          0.8,    // Scoring difference
          -0.3,   // Defensive difference
          0.2,    // Recent form difference
          0.1,    // Consistency difference
          0.0,    // Strength of schedule
          0.0,    // Head to head
          0.1,    // Momentum difference
          0.0,    // Experience difference
          1.1,    // Offensive efficiency
          0.9,    // Defensive efficiency
          0.03,   // Home field factor
          0.5,    // Season progress
          0.0,    // Competitive difference
          0.1     // Scoring trend
        ]
      },
      {
        name: 'Cowboys (8-2) vs Lions (9-1)',
        features: [
          -0.1,   // Win rate difference (Lions slightly better)
          -0.2,   // Scoring difference
          0.1,    // Defensive difference
          -0.1,   // Recent form difference
          0.0,    // Consistency difference
          0.0,    // Strength of schedule
          0.0,    // Head to head
          -0.1,   // Momentum difference
          0.0,    // Experience difference
          0.95,   // Offensive efficiency
          1.05,   // Defensive efficiency
          0.03,   // Home field factor
          0.6,    // Season progress
          0.0,    // Competitive difference
          0.0     // Scoring trend
        ]
      },
      {
        name: 'Jets (2-8) vs Chiefs (9-1)',
        features: [
          -0.7,   // Win rate difference (Chiefs much better)
          -2.5,   // Scoring difference
          1.8,    // Defensive difference
          -0.6,   // Recent form difference
          -0.3,   // Consistency difference
          -0.2,   // Strength of schedule
          -0.3,   // Head to head
          -0.4,   // Momentum difference
          -0.1,   // Experience difference
          0.7,    // Offensive efficiency
          1.3,    // Defensive efficiency
          0.03,   // Home field factor
          0.6,    // Season progress
          -1.0,   // Competitive difference
          -0.2    // Scoring trend
        ]
      },
      {
        name: 'Even Match (5-5 vs 5-5)',
        features: [
          0.0,    // Win rate difference
          0.1,    // Scoring difference
          -0.1,   // Defensive difference
          0.0,    // Recent form difference
          0.0,    // Consistency difference
          0.0,    // Strength of schedule
          0.0,    // Head to head
          0.0,    // Momentum difference
          0.0,    // Experience difference
          1.0,    // Offensive efficiency
          1.0,    // Defensive efficiency
          0.03,   // Home field factor
          0.5,    // Season progress
          0.0,    // Competitive difference
          0.0     // Scoring trend
        ]
      }
    ];
    
    console.log(chalk.cyan('\nPredictions:'));
    testGames.forEach(game => {
      const prediction = model.predict([game.features])[0];
      const winner = prediction === 1 ? 'HOME' : 'AWAY';
      console.log(chalk.white(`${game.name} → ${winner} wins`));
    });
    
    // Test with actual values from API
    console.log(chalk.cyan('\n\nTesting API-style features:'));
    const apiFeatures = [
      0.05,  // Win rate diff
      0.5,   // Scoring diff
      -0.3,  // Defensive diff
      0.1,   // Recent form
      0.0,   // Consistency
      0.0,   // SOS
      0.0,   // H2H
      0.0,   // Momentum
      0.0,   // Experience
      1.0,   // Off efficiency
      1.0,   // Def efficiency
      0.03,  // Home field
      0.5,   // Season progress
      0.0,   // Competitive
      0.0    // Trend
    ];
    
    const apiPred = model.predict([apiFeatures])[0];
    console.log(chalk.yellow(`API features prediction: ${apiPred === 1 ? 'HOME' : 'AWAY'}`));
    
    // Show what features matter
    console.log(chalk.cyan('\n\nFeature importance test:'));
    for (let i = 0; i < 15; i++) {
      const testFeatures = Array(15).fill(0);
      testFeatures[i] = 0.5; // Set one feature high
      testFeatures[11] = 0.03; // Keep home field constant
      
      const pred = model.predict([testFeatures])[0];
      console.log(`Feature ${i}: ${pred === 1 ? 'HOME' : 'AWAY'}`);
    }
    
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
  }
}

testRealPredictions();
#!/usr/bin/env tsx
/**
 * 🔍 DEBUG MODEL BALANCE
 * Figure out why models keep predicting all one class
 */

import chalk from 'chalk';
import { RandomForestClassifier } from 'ml-random-forest';
import * as fs from 'fs';

async function debugModelBalance() {
  console.log(chalk.bold.cyan('🔍 DEBUGGING MODEL BALANCE'));
  console.log(chalk.yellow('Testing with synthetic data'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Create perfectly separable synthetic data
    console.log(chalk.cyan('1️⃣ Creating synthetic data...'));
    
    const features: number[][] = [];
    const labels: number[] = [];
    
    // Create clear patterns
    // Home wins: feature[0] > 0.5
    // Away wins: feature[0] < -0.5
    
    // Home wins
    for (let i = 0; i < 500; i++) {
      features.push([
        0.6 + Math.random() * 0.4,  // 0.6 to 1.0
        Math.random() - 0.5,
        Math.random() - 0.5,
        0.1,
        Math.random() * 0.2
      ]);
      labels.push(1);
    }
    
    // Away wins
    for (let i = 0; i < 500; i++) {
      features.push([
        -1.0 + Math.random() * 0.4,  // -1.0 to -0.6
        Math.random() - 0.5,
        Math.random() - 0.5,
        0.1,
        Math.random() * 0.2
      ]);
      labels.push(0);
    }
    
    console.log(chalk.green(`✅ Created ${features.length} samples (perfectly balanced)`));
    
    // 2. Shuffle data
    const indices = Array.from({ length: features.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    const shuffledFeatures = indices.map(i => features[i]);
    const shuffledLabels = indices.map(i => labels[i]);
    
    // 3. Split 80/20
    const splitIdx = Math.floor(shuffledFeatures.length * 0.8);
    const xTrain = shuffledFeatures.slice(0, splitIdx);
    const yTrain = shuffledLabels.slice(0, splitIdx);
    const xTest = shuffledFeatures.slice(splitIdx);
    const yTest = shuffledLabels.slice(splitIdx);
    
    // 4. Test different configurations
    console.log(chalk.cyan('\n2️⃣ Testing different Random Forest configurations...'));
    
    const configs = [
      { name: 'Minimal', nEstimators: 10, maxDepth: 3, minSamplesLeaf: 1 },
      { name: 'Small', nEstimators: 20, maxDepth: 5, minSamplesLeaf: 5 },
      { name: 'Medium', nEstimators: 50, maxDepth: 8, minSamplesLeaf: 10 },
      { name: 'Large', nEstimators: 100, maxDepth: 10, minSamplesLeaf: 20 },
      { name: 'MaxFeatures50', nEstimators: 50, maxDepth: 8, minSamplesLeaf: 10, maxFeatures: 0.5 },
      { name: 'MaxFeatures30', nEstimators: 50, maxDepth: 8, minSamplesLeaf: 10, maxFeatures: 0.3 }
    ];
    
    for (const config of configs) {
      console.log(chalk.yellow(`\nTesting ${config.name}...`));
      
      try {
        const model = new RandomForestClassifier({
          nEstimators: config.nEstimators,
          maxDepth: config.maxDepth,
          minSamplesLeaf: config.minSamplesLeaf,
          maxFeatures: config.maxFeatures || 1.0,
          replacement: false,  // Try without replacement
          seed: 42
        });
        
        model.train(xTrain, yTrain);
        const predictions = model.predict(xTest);
        
        // Analyze predictions
        let homeCorrect = 0, homeTotal = 0;
        let awayCorrect = 0, awayTotal = 0;
        const homePredCount = predictions.filter(p => p === 1).length;
        const awayPredCount = predictions.filter(p => p === 0).length;
        
        for (let i = 0; i < predictions.length; i++) {
          if (yTest[i] === 1) {
            homeTotal++;
            if (predictions[i] === 1) homeCorrect++;
          } else {
            awayTotal++;
            if (predictions[i] === 0) awayCorrect++;
          }
        }
        
        const accuracy = (homeCorrect + awayCorrect) / predictions.length;
        const homeAcc = homeTotal > 0 ? homeCorrect / homeTotal : 0;
        const awayAcc = awayTotal > 0 ? awayCorrect / awayTotal : 0;
        
        console.log(chalk.green(`Accuracy: ${(accuracy * 100).toFixed(1)}%`));
        console.log(chalk.green(`Home: ${(homeAcc * 100).toFixed(1)}% (${homeCorrect}/${homeTotal})`));
        console.log(chalk.green(`Away: ${(awayAcc * 100).toFixed(1)}% (${awayCorrect}/${awayTotal})`));
        console.log(chalk.gray(`Predicted: ${homePredCount} home, ${awayPredCount} away`));
        
        // Test individual predictions
        if (accuracy > 0.8) {
          console.log(chalk.cyan('\nTesting individual predictions:'));
          const testCases = [
            { name: 'Strong Home', features: [0.8, 0, 0, 0.1, 0] },
            { name: 'Strong Away', features: [-0.8, 0, 0, 0.1, 0] },
            { name: 'Neutral', features: [0, 0, 0, 0.1, 0] },
            { name: 'Slight Home', features: [0.3, 0, 0, 0.1, 0] },
            { name: 'Slight Away', features: [-0.3, 0, 0, 0.1, 0] }
          ];
          
          for (const test of testCases) {
            const pred = model.predict([test.features])[0];
            console.log(chalk.white(`${test.name}: ${pred === 1 ? 'HOME' : 'AWAY'}`));
          }
        }
        
      } catch (error) {
        console.error(chalk.red(`Error with ${config.name}:`), error.message);
      }
    }
    
    // 5. Test with real data pattern
    console.log(chalk.cyan('\n3️⃣ Testing with realistic data pattern...'));
    
    const realisticFeatures: number[][] = [];
    const realisticLabels: number[] = [];
    
    // More realistic: overlapping distributions
    for (let i = 0; i < 1000; i++) {
      const homeStrength = Math.random();
      const awayStrength = Math.random();
      const diff = homeStrength - awayStrength;
      
      // Add some noise but maintain pattern
      const features = [
        diff + (Math.random() - 0.5) * 0.3,
        homeStrength,
        awayStrength,
        0.05,  // Small home advantage
        Math.random() - 0.5
      ];
      
      // Probabilistic outcome based on difference
      const homeWinProb = 1 / (1 + Math.exp(-diff * 3));
      const homeWins = Math.random() < homeWinProb;
      
      realisticFeatures.push(features);
      realisticLabels.push(homeWins ? 1 : 0);
    }
    
    // Check distribution
    const realHomeWins = realisticLabels.filter(l => l === 1).length;
    console.log(chalk.yellow(`Realistic data: ${realHomeWins} home wins, ${1000 - realHomeWins} away wins`));
    
    // Train simple model
    const simpleModel = new RandomForestClassifier({
      nEstimators: 30,
      maxDepth: 6,
      minSamplesLeaf: 15,
      maxFeatures: 0.6,
      seed: 42
    });
    
    simpleModel.train(
      realisticFeatures.slice(0, 800),
      realisticLabels.slice(0, 800)
    );
    
    const realPredictions = simpleModel.predict(realisticFeatures.slice(800));
    const realLabelsTest = realisticLabels.slice(800);
    
    let realCorrect = 0;
    let realHomePred = 0;
    let realAwayPred = 0;
    
    for (let i = 0; i < realPredictions.length; i++) {
      if (realPredictions[i] === realLabelsTest[i]) realCorrect++;
      if (realPredictions[i] === 1) realHomePred++;
      else realAwayPred++;
    }
    
    console.log(chalk.green(`\nRealistic accuracy: ${(realCorrect / realPredictions.length * 100).toFixed(1)}%`));
    console.log(chalk.green(`Predicted: ${realHomePred} home, ${realAwayPred} away`));
    
    console.log(chalk.bold.cyan('\n🔍 DEBUG COMPLETE!'));
    console.log(chalk.yellow('═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

debugModelBalance().catch(console.error);
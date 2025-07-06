#!/usr/bin/env tsx
/**
 * Test the model directly
 */

import { RandomForestClassifier } from 'ml-random-forest';
import * as fs from 'fs';
import chalk from 'chalk';

async function testModel() {
  console.log(chalk.cyan('Testing bias-corrected model directly...'));
  
  try {
    // Load the model
    const modelData = JSON.parse(fs.readFileSync('./models/bias-corrected-rf-clean.json', 'utf8'));
    const model = RandomForestClassifier.load(modelData);
    
    console.log(chalk.green('✅ Model loaded'));
    console.log('Model info:', {
      trees: modelData.trees?.length || 'unknown',
      options: modelData.options
    });
    
    // Test with different feature vectors
    const testFeatures = [
      [0.2, 0.1, 0.1, 0.1, 0.2, 0.1, 1.1, 0.9, 0.5, 0.5, 0.1, -0.1, 0.03, 0, 0], // Slightly favor home
      [-0.2, -0.1, -0.1, -0.1, 0.2, -0.1, 0.9, 1.1, 0.5, 0.5, -0.1, 0.1, 0.03, 0, 1], // Slightly favor away
      [0.5, 0.3, 0.2, 0.4, 0.5, 0.3, 1.3, 0.7, 0.8, 0.3, 0.3, -0.3, 0.03, 1, 0], // Strong home
      [-0.5, -0.3, -0.2, -0.4, 0.5, -0.3, 0.7, 1.3, 0.3, 0.8, -0.3, 0.3, 0.03, 0, 1], // Strong away
      [0, 0, 0, 0, 0, 0, 1, 1, 0.5, 0.5, 0, 0, 0.03, 0, 0] // Even match
    ];
    
    console.log(chalk.cyan('\nTesting predictions:'));
    testFeatures.forEach((features, i) => {
      const prediction = model.predict([features])[0];
      console.log(`Test ${i + 1}: Features[0]=${features[0].toFixed(2)} → Prediction: ${prediction} (${prediction === 1 ? 'Home' : 'Away'})`);
    });
    
    // Test with actual game-like features
    console.log(chalk.cyan('\nTesting with realistic features:'));
    const realisticTests = [
      { name: 'Strong home team', features: [0.3, 2.5, -1.8, 0.4, 0.3, 0.2, 1.2, 0.8, 0.6, 0.4, 0.2, -0.1, 0.05, 1, 0] },
      { name: 'Strong away team', features: [-0.3, -2.5, 1.8, -0.4, 0.3, -0.2, 0.8, 1.2, 0.4, 0.6, -0.2, 0.1, 0.05, 0, 1] },
      { name: 'Even match', features: [0.05, 0.5, -0.3, 0.1, 0.1, 0.05, 1.05, 0.95, 0.5, 0.5, 0.05, -0.05, 0.05, 0, 0] }
    ];
    
    realisticTests.forEach(test => {
      const prediction = model.predict([test.features])[0];
      const confidence = model.predict([test.features]);
      console.log(`${test.name}: ${prediction === 1 ? 'Home wins' : 'Away wins'}`);
    });
    
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
  }
}

testModel();
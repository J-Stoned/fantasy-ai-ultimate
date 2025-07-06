#!/usr/bin/env tsx
import { RandomForestClassifier } from 'ml-random-forest';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

async function fixRandomForest() {
  console.log(chalk.bold.cyan('🌲 FIXING RANDOM FOREST LOADER'));
  console.log(chalk.gray('='.repeat(40)));
  
  try {
    // Read the JSON file
    const rfPath = path.join(process.cwd(), 'models/production_ensemble_v2/random_forest.json');
    console.log(chalk.yellow('Loading from:'), rfPath);
    
    const rfData = fs.readFileSync(rfPath, 'utf8');
    const rfJson = JSON.parse(rfData);
    
    console.log(chalk.green('✅ JSON loaded successfully'));
    console.log(chalk.gray(`  Trees: ${rfJson.length}`));
    console.log(chalk.gray(`  First tree type: ${rfJson[0]?.tree?.type}`));
    
    // The JSON is an array of trees, but RandomForestClassifier.load expects a different format
    // Let's check what format it expects
    console.log(chalk.yellow('\nChecking RandomForestClassifier format...'));
    
    // Create a dummy classifier to see its structure
    const dummy = new RandomForestClassifier({
      nEstimators: 1,
      maxDepth: 5
    });
    
    // Train with minimal data
    dummy.train([[1, 2]], [1]);
    
    // Convert to JSON to see format
    const dummyJson = dummy.toJSON();
    console.log(chalk.gray('Expected format:'), Object.keys(dummyJson));
    
    // The ml-random-forest expects a specific format
    // Let's create a compatible format
    const compatibleFormat = {
      trees: rfJson,
      nEstimators: rfJson.length,
      replacement: true,
      maxFeatures: 1.0,
      nClasses: 2,
      classes: [0, 1],
      isClassifier: true
    };
    
    // Save in compatible format
    const newPath = path.join(process.cwd(), 'models/production_ensemble_v2/random_forest_fixed.json');
    fs.writeFileSync(newPath, JSON.stringify(compatibleFormat, null, 2));
    console.log(chalk.green(`\n✅ Saved compatible format to: ${newPath}`));
    
    // Test loading
    console.log(chalk.yellow('\nTesting load...'));
    const loaded = RandomForestClassifier.load(compatibleFormat);
    console.log(chalk.green('✅ Successfully loaded!'));
    
    // Test prediction
    const testFeatures = new Array(50).fill(0.5);
    const prediction = loaded.predict([testFeatures]);
    console.log(chalk.green('✅ Test prediction:', prediction[0]));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  }
}

fixRandomForest().catch(console.error);
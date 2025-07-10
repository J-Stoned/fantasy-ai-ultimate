#!/usr/bin/env tsx
/**
 * Test Advanced Feature Engineering
 */

import { config } from 'dotenv';
import { AdvancedFeatureEngineering } from '../lib/ml/AdvancedFeatureEngineering';
import chalk from 'chalk';

config({ path: '.env.local' });

async function testAdvancedFeatures() {
  console.log(chalk.bold.cyan('\n🧪 TESTING ADVANCED FEATURE ENGINEERING\n'));
  
  const featureEngineering = new AdvancedFeatureEngineering();
  
  // Mock game data
  const mockGame = {
    id: 'test-001',
    home_team_id: 'team-1',
    away_team_id: 'team-2',
    created_at: new Date().toISOString()
  };
  
  // Mock historical data
  const mockHistoricalData = {
    games: [
      {
        id: 'game-1',
        home_team_id: 'team-1',
        away_team_id: 'team-3',
        home_score: 24,
        away_score: 17,
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'game-2',
        home_team_id: 'team-2',
        away_team_id: 'team-1',
        home_score: 21,
        away_score: 28,
        created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      }
    ]
  };
  
  try {
    console.log(chalk.yellow('Extracting enhanced features...'));
    
    const features = await featureEngineering.extractEnhancedFeatures(
      mockGame,
      mockHistoricalData,
      {}
    );
    
    console.log(chalk.green(`\n✅ Successfully extracted features!`));
    console.log(`Basic features: ${features.basic.length}`);
    console.log(`Advanced features: ${features.advanced.length}`);
    console.log(`Temporal features: ${features.temporal.length}`);
    console.log(`Contextual features: ${features.contextual.length}`);
    console.log(`Ensemble features: ${features.ensemble.length}`);
    console.log(`Total features: ${features.featureNames.length}`);
    
    // Show some sample features
    console.log(chalk.cyan('\nSample feature values:'));
    features.featureNames.slice(0, 10).forEach((name, i) => {
      const value = features.basic[i] || features.advanced[i] || 0;
      console.log(`  ${name}: ${value.toFixed(3)}`);
    });
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

testAdvancedFeatures().catch(console.error);
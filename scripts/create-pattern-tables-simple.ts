#!/usr/bin/env tsx
/**
 * 🔥 CREATE PATTERN TABLES - SIMPLE VERSION
 * 
 * Creates tables by inserting test data
 */

import { enhancedDb } from '../lib/services/enhanced-database-service';
import chalk from 'chalk';

async function createPatternTables() {
  console.log(chalk.bold.cyan('🔧 CREATING PATTERN TABLES...'));
  console.log(chalk.gray('='.repeat(60)));

  try {
    // Test pattern_predictions table by inserting data
    console.log(chalk.yellow('Testing pattern_predictions table...'));
    
    const testPrediction = {
      game_id: 22, // Known game ID
      pattern_name: 'back_to_back_fade',
      confidence: 0.8,
      detected: true,
      reasoning: 'Test pattern detection',
      bet_recommendation: 'Under',
      predicted_outcome: 'Under hits',
      actual_outcome: null,
      is_correct: null
    };

    const { error: predError } = await enhancedDb.getClient()
      .from('pattern_predictions')
      .insert(testPrediction);

    if (predError) {
      const errorMsg = predError.message || predError.toString();
      if (errorMsg.includes('does not exist')) {
        console.log(chalk.red('❌ pattern_predictions table does not exist'));
        console.log(chalk.yellow('Please create it manually in Supabase dashboard'));
      } else {
        console.log(chalk.yellow('⚠️  pattern_predictions exists but error:', errorMsg));
      }
    } else {
      console.log(chalk.green('✅ pattern_predictions table exists and working!'));
    }

    // Test accuracy_metrics table
    console.log(chalk.yellow('\nTesting accuracy_metrics table...'));
    
    const testMetric = {
      pattern_name: 'back_to_back_fade',
      total_predictions: 100,
      correct_predictions: 80,
      accuracy: 80.0,
      confidence_avg: 0.75
    };

    const { error: accError } = await enhancedDb.getClient()
      .from('accuracy_metrics')
      .upsert(testMetric, { onConflict: 'pattern_name' });

    if (accError) {
      const errorMsg = accError.message || accError.toString();
      if (errorMsg.includes('does not exist')) {
        console.log(chalk.red('❌ accuracy_metrics table does not exist'));
        console.log(chalk.yellow('Please create it manually in Supabase dashboard'));
      } else {
        console.log(chalk.yellow('⚠️  accuracy_metrics exists but error:', errorMsg));
      }
    } else {
      console.log(chalk.green('✅ accuracy_metrics table exists and working!'));
    }

    // Check what we have
    console.log(chalk.cyan('\n📊 Checking data...'));
    
    const { data: predictions } = await enhancedDb.getClient()
      .from('pattern_predictions')
      .select('*')
      .limit(5);
      
    const { data: metrics } = await enhancedDb.getClient()
      .from('accuracy_metrics')
      .select('*');

    if (predictions) {
      console.log(chalk.white(`\nPattern predictions: ${predictions.length} records`));
    }
    
    if (metrics) {
      console.log(chalk.white(`Accuracy metrics: ${metrics.length} patterns tracked`));
      metrics.forEach(m => {
        console.log(chalk.gray(`  • ${m.pattern_name}: ${m.accuracy}% (${m.total_predictions} predictions)`));
      });
    }

    console.log(chalk.bold.yellow('\n📋 SQL TO CREATE TABLES (if needed):'));
    console.log(chalk.gray(`
-- Pattern Predictions Table
CREATE TABLE pattern_predictions (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  pattern_name VARCHAR(100) NOT NULL,
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  detected BOOLEAN NOT NULL,
  reasoning TEXT,
  bet_recommendation VARCHAR(50),
  predicted_outcome VARCHAR(50),
  actual_outcome VARCHAR(50),
  is_correct BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pattern_predictions_game_id ON pattern_predictions(game_id);
CREATE INDEX idx_pattern_predictions_pattern_name ON pattern_predictions(pattern_name);

-- Accuracy Metrics Table
CREATE TABLE accuracy_metrics (
  id SERIAL PRIMARY KEY,
  pattern_name VARCHAR(100) NOT NULL UNIQUE,
  total_predictions INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  accuracy DECIMAL(5,2) DEFAULT 0,
  confidence_avg DECIMAL(3,2) DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial patterns
INSERT INTO accuracy_metrics (pattern_name) VALUES 
  ('back_to_back_fade'),
  ('revenge_game'),
  ('altitude_advantage'),
  ('perfect_storm'),
  ('division_dog_bite'),
  ('overall')
ON CONFLICT (pattern_name) DO NOTHING;
    `));

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

createPatternTables().catch(console.error);
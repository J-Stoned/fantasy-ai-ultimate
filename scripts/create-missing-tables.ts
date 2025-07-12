#!/usr/bin/env tsx
/**
 * Create missing tables for pattern predictions and accuracy tracking
 */

import { enhancedDb } from '../lib/services/enhanced-database-service';
import chalk from 'chalk';

async function createMissingTables() {
  console.log(chalk.bold.cyan('🔧 Creating missing tables...'));

  try {
    // Create pattern_predictions table
    const { error: patternError } = await enhancedDb.getClient()
      .from('pattern_predictions')
      .select('id')
      .limit(1);

    if (patternError?.code === '42P01') {
      console.log(chalk.yellow('Creating pattern_predictions table...'));
      
      const { error: createError } = await enhancedDb.getClient().rpc('create_pattern_predictions_table', {
        table_sql: `
          CREATE TABLE IF NOT EXISTS pattern_predictions (
            id SERIAL PRIMARY KEY,
            game_id INTEGER REFERENCES games(id),
            patterns JSONB NOT NULL,
            predicted_outcome TEXT,
            confidence DECIMAL(3,2),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(game_id)
          );
        `
      });

      if (createError) {
        console.log(chalk.red('Failed to create pattern_predictions via RPC'));
        // Try alternative approach
        console.log(chalk.yellow('Note: Table creation needs to be done via Supabase dashboard'));
      } else {
        console.log(chalk.green('✅ pattern_predictions table created'));
      }
    } else {
      console.log(chalk.green('✅ pattern_predictions table already exists'));
    }

    // Create accuracy_metrics table
    const { error: accuracyError } = await enhancedDb.getClient()
      .from('accuracy_metrics')
      .select('id')
      .limit(1);

    if (accuracyError?.code === '42P01') {
      console.log(chalk.yellow('Creating accuracy_metrics table...'));
      console.log(chalk.yellow('Note: Table creation needs to be done via Supabase dashboard'));
    } else {
      console.log(chalk.green('✅ accuracy_metrics table already exists'));
    }

    console.log(chalk.cyan('\n📋 SQL to create tables in Supabase:'));
    console.log(chalk.gray(`
-- Pattern Predictions Table
CREATE TABLE pattern_predictions (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  patterns JSONB NOT NULL,
  predicted_outcome TEXT,
  confidence DECIMAL(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(game_id)
);

-- Accuracy Metrics Table  
CREATE TABLE accuracy_metrics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  overall_accuracy DECIMAL(4,1),
  total_predictions INTEGER,
  correct_predictions INTEGER,
  pattern_stats JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date)
);
    `));

  } catch (error) {
    console.error(chalk.red('Error checking tables:'), error);
  }
}

createMissingTables().catch(console.error);
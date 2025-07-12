#!/usr/bin/env tsx
/**
 * 🔥 CREATE PATTERN TABLES
 * 
 * Creates pattern_predictions and accuracy_metrics tables
 */

import { enhancedDb } from '../lib/services/enhanced-database-service';
import chalk from 'chalk';

async function createPatternTables() {
  console.log(chalk.bold.cyan('🔧 CREATING PATTERN TABLES...'));
  console.log(chalk.gray('='.repeat(60)));

  try {
    // Create pattern_predictions table
    console.log(chalk.yellow('Creating pattern_predictions table...'));
    
    const { error: predError } = await enhancedDb.getClient().rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS pattern_predictions (
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
        CREATE INDEX idx_pattern_predictions_created_at ON pattern_predictions(created_at);
      `
    });

    if (predError) {
      console.error(chalk.red('Error creating pattern_predictions:'), predError);
    } else {
      console.log(chalk.green('✅ pattern_predictions table created!'));
    }

    // Create accuracy_metrics table
    console.log(chalk.yellow('\nCreating accuracy_metrics table...'));
    
    const { error: accError } = await enhancedDb.getClient().rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS accuracy_metrics (
          id SERIAL PRIMARY KEY,
          pattern_name VARCHAR(100) NOT NULL,
          total_predictions INTEGER DEFAULT 0,
          correct_predictions INTEGER DEFAULT 0,
          accuracy DECIMAL(5,2) DEFAULT 0,
          confidence_avg DECIMAL(3,2) DEFAULT 0,
          last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(pattern_name)
        );
        
        CREATE INDEX idx_accuracy_metrics_pattern_name ON accuracy_metrics(pattern_name);
        
        -- Insert initial patterns
        INSERT INTO accuracy_metrics (pattern_name) VALUES 
          ('back_to_back_fade'),
          ('revenge_game'),
          ('altitude_advantage'),
          ('perfect_storm'),
          ('division_dog_bite'),
          ('overall')
        ON CONFLICT (pattern_name) DO NOTHING;
      `
    });

    if (accError) {
      console.error(chalk.red('Error creating accuracy_metrics:'), accError);
    } else {
      console.log(chalk.green('✅ accuracy_metrics table created!'));
    }

    // Create trigger to update timestamps
    console.log(chalk.yellow('\nCreating update trigger...'));
    
    const { error: triggerError } = await enhancedDb.getClient().rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
        
        DROP TRIGGER IF EXISTS update_pattern_predictions_updated_at ON pattern_predictions;
        
        CREATE TRIGGER update_pattern_predictions_updated_at 
          BEFORE UPDATE ON pattern_predictions 
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column();
      `
    });

    if (triggerError) {
      console.error(chalk.red('Error creating trigger:'), triggerError);
    } else {
      console.log(chalk.green('✅ Update trigger created!'));
    }

    // Verify tables exist
    console.log(chalk.cyan('\n🔍 Verifying tables...'));
    
    const { data: tables } = await enhancedDb.getClient().rpc('exec_sql', {
      sql: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('pattern_predictions', 'accuracy_metrics');
      `
    });

    console.log(chalk.green('\nTables found:'));
    tables?.forEach((table: any) => {
      console.log(chalk.white(`  • ${table.table_name}`));
    });

    console.log(chalk.bold.green('\n✅ PATTERN TABLES CREATED SUCCESSFULLY!'));
    console.log(chalk.yellow('\nNext steps:'));
    console.log(chalk.white('1. Run pattern predictions to populate data'));
    console.log(chalk.white('2. Track accuracy over time'));
    console.log(chalk.white('3. Optimize patterns based on results'));

  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
  }
}

createPatternTables().catch(console.error);
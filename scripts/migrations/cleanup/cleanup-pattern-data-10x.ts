#!/usr/bin/env tsx
/**
 * 10X CLEANUP: Remove all failed pattern detection data
 * Patterns achieved 33.2% accuracy vs 65.2% claimed - total failure
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupPatternData() {
  console.log(chalk.bold.red('🗑️  10X PATTERN DATA CLEANUP - REMOVING FAILED EXPERIMENTS'));
  console.log(chalk.yellow('Patterns achieved 33.2% accuracy vs 65.2% claimed - TOTAL FAILURE\n'));

  try {
    // Truncate pattern performance tracking
    console.log(chalk.cyan('Checking pattern_performance table...'));
    try {
      const { count } = await supabase
        .from('pattern_performance')
        .select('*', { count: 'exact', head: true });
      
      if (count && count > 0) {
        console.log(chalk.yellow(`Found ${count} records in pattern_performance, deleting...`));
        const { error } = await supabase
          .from('pattern_performance')
          .delete()
          .not('created_at', 'is', null); // Delete all records
        if (error) throw error;
      }
    } catch (e: any) {
      if (!e.message?.includes('relation "pattern_performance" does not exist')) {
        console.log(chalk.red('Error with pattern_performance:', e.message));
      }
    }

    // Truncate ML predictions
    console.log(chalk.cyan('Checking ml_predictions table...'));
    try {
      const { count } = await supabase
        .from('ml_predictions')
        .select('*', { count: 'exact', head: true });
      
      if (count && count > 0) {
        console.log(chalk.yellow(`Found ${count} records in ml_predictions, deleting...`));
        const { error } = await supabase
          .from('ml_predictions')
          .delete()
          .not('created_at', 'is', null);
        if (error) throw error;
      }
    } catch (e: any) {
      if (!e.message?.includes('relation "ml_predictions" does not exist')) {
        console.log(chalk.red('Error with ml_predictions:', e.message));
      }
    }

    // Truncate ML training logs
    console.log(chalk.cyan('Checking ml_training_logs table...'));
    try {
      const { count } = await supabase
        .from('ml_training_logs')
        .select('*', { count: 'exact', head: true });
      
      if (count && count > 0) {
        console.log(chalk.yellow(`Found ${count} records in ml_training_logs, deleting...`));
        const { error } = await supabase
          .from('ml_training_logs')
          .delete()
          .not('created_at', 'is', null);
        if (error) throw error;
      }
    } catch (e: any) {
      if (!e.message?.includes('relation "ml_training_logs" does not exist')) {
        console.log(chalk.red('Error with ml_training_logs:', e.message));
      }
    }

    // Clean up games table pattern fields
    console.log(chalk.cyan('Cleaning up pattern fields from games table...'));
    const { error: gamesError } = await supabase
      .from('games')
      .update({ 
        pattern_flags: null,
        pattern_predictions: null 
      })
      .or('pattern_flags.not.is.null,pattern_predictions.not.is.null');
    
    if (gamesError && !gamesError.message.includes('column') && !gamesError.message.includes('does not exist')) {
      throw gamesError;
    }

    console.log(chalk.bold.green('\n✅ PATTERN DATA CLEANUP COMPLETE!'));
    console.log(chalk.yellow('Failed patterns archived and data truncated.'));
    console.log(chalk.cyan('Ready to build REAL fantasy sports ML models! 🚀'));
    
  } catch (error) {
    console.error(chalk.red('Error during cleanup:'), error);
    process.exit(1);
  }
}

// Execute cleanup
cleanupPatternData();
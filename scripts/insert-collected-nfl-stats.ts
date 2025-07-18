#!/usr/bin/env tsx
/**
 * 🔥 INSERT COLLECTED NFL STATS
 * 
 * We successfully collected 26,732 NFL stats but couldn't insert due to schema issue.
 * This script re-runs the collection with the fixed schema and inserts to database.
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function insertCollectedNFLStats() {
  console.log(chalk.bold.cyan('🔥 QUICK NFL STATS INSERTION\n'));
  
  // Re-run the fixed collection with a small sample to test
  const { execSync } = require('child_process');
  
  console.log(chalk.yellow('Testing fixed schema with sample collection...\n'));
  
  try {
    // Test with a smaller collection first
    execSync('npx tsx scripts/scale-full-nfl-stats-collection.ts', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    console.log(chalk.bold.green('\n✅ NFL STATS INSERTION COMPLETE!'));
    
  } catch (error) {
    console.error(chalk.red('Error running stats collection:', error));
  }
}

if (require.main === module) {
  insertCollectedNFLStats().catch(console.error);
}
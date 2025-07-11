#!/usr/bin/env tsx
/**
 * ⚾ MLB COLLECTION MONITOR - Track MLB progress specifically
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import fs from 'fs/promises';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function monitorMLB() {
  console.clear();
  console.log(chalk.bold.red('⚾ MLB COLLECTION MONITOR\n'));
  
  // Check log file for MLB progress
  try {
    const log = await fs.readFile('2023-collection.log', 'utf-8');
    const lines = log.split('\n');
    
    // Find MLB section
    const mlbStart = lines.findIndex(l => l.includes('COLLECTING MLB'));
    const mlbLines = lines.slice(mlbStart);
    
    // Get progress
    const progressLines = mlbLines.filter(l => l.includes('Progress:'));
    const lastProgress = progressLines[progressLines.length - 1];
    
    if (lastProgress) {
      console.log('Collection progress:', lastProgress.trim());
      
      // Parse the numbers
      const match = lastProgress.match(/(\d+)\/(\d+).*?(\d+) with stats/);
      if (match) {
        const [_, current, total, withStats] = match;
        const pct = (parseInt(current) / parseInt(total) * 100).toFixed(1);
        console.log(`Games processed: ${current}/${total} (${pct}%)`);
        console.log(`Games with stats: ${withStats}`);
        
        if (parseInt(withStats) === 0 && parseInt(current) > 100) {
          console.log(chalk.yellow('\n⚠️  No stats being collected - possible API issue'));
          console.log('This might be due to:');
          console.log('- MLB API different format than NBA');
          console.log('- Games might be too old (2023 season)');
          console.log('- Need different endpoint for historical data');
        }
      }
    }
    
    // Check database
    const { count: mlbLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('game:games(sport_id)', 'mlb');
    
    console.log(chalk.cyan(`\nMLB logs in database: ${mlbLogs || 0}`));
    
  } catch (e) {
    console.log('Could not read log file');
  }
  
  // Check if we have MLB teams and players
  const { count: mlbTeams } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'mlb');
  
  const { count: mlbPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'mlb');
  
  console.log(chalk.gray(`\nMLB teams: ${mlbTeams}`));
  console.log(chalk.gray(`MLB players: ${mlbPlayers}`));
}

// Run immediately
monitorMLB();
#!/usr/bin/env tsx
/**
 * 🔧 FIX ALL SPORTS DATA - Standardize sport names
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixAllSportsData() {
  console.log(chalk.bold.cyan('\n🔧 FIXING ALL SPORTS DATA STANDARDIZATION\n'));

  const sportMappings = [
    { old: 'baseball', new: 'mlb' },
    { old: 'basketball', new: 'nba' },
    { old: 'hockey', new: 'nhl' },
    { old: 'football', new: 'nfl' }
  ];

  for (const mapping of sportMappings) {
    console.log(chalk.yellow(`\nChecking ${mapping.old} → ${mapping.new}...`));

    // Check players
    const { count: oldPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', mapping.old);

    if (oldPlayers && oldPlayers > 0) {
      console.log(`Found ${oldPlayers} players with sport='${mapping.old}'`);
      
      const { error } = await supabase
        .from('players')
        .update({ sport: mapping.new })
        .eq('sport', mapping.old);
      
      if (!error) {
        console.log(chalk.green(`✅ Updated ${oldPlayers} players to '${mapping.new}'`));
      } else {
        console.error(chalk.red('Error updating players:'), error);
      }
    } else {
      console.log(`No players found with sport='${mapping.old}'`);
    }

    // Check teams
    const { count: oldTeams } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', mapping.old);

    if (oldTeams && oldTeams > 0) {
      console.log(`Found ${oldTeams} teams with sport='${mapping.old}'`);
      
      const { error } = await supabase
        .from('teams')
        .update({ sport: mapping.new })
        .eq('sport', mapping.old);
      
      if (!error) {
        console.log(chalk.green(`✅ Updated ${oldTeams} teams to '${mapping.new}'`));
      } else {
        console.error(chalk.red('Error updating teams:'), error);
      }
    }
  }

  // Verify final counts
  console.log(chalk.bold.cyan('\n📊 FINAL PLAYER COUNTS:\n'));
  
  for (const sport of ['nfl', 'nba', 'mlb', 'nhl']) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
    
    console.log(`${sport.toUpperCase()}: ${count?.toLocaleString() || 0} players`);
  }

  console.log(chalk.bold.green('\n✅ Sports data standardization complete!'));
}

fixAllSportsData();
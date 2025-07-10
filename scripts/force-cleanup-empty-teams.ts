#!/usr/bin/env tsx
/**
 * 🧹 FORCE CLEANUP EMPTY TEAMS
 * Delete empty professional sport teams
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function forceCleanupEmptyTeams() {
  console.log(chalk.bold.blue('\n🧹 FORCE CLEANUP EMPTY TEAMS\n'));
  
  // Get all professional sport teams without players
  const proSports = ['nba', 'nfl', 'mlb', 'nhl'];
  const toDelete: any[] = [];
  
  for (const sport of proSports) {
    const { data: teams } = await supabase
      .from('teams')
      .select('*')
      .eq('sport_id', sport);
    
    if (!teams) continue;
    
    for (const team of teams) {
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', team.id);
      
      if (!count || count === 0) {
        toDelete.push(team);
      }
    }
  }
  
  console.log(chalk.yellow(`Found ${toDelete.length} empty professional sport teams\n`));
  
  // Delete them one by one
  let deleted = 0;
  let hasGames = 0;
  
  for (const team of toDelete) {
    console.log(chalk.cyan(`\nProcessing ${team.sport_id} - ${team.name}:`));
    
    // Check games
    const { count: homeCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('home_team_id', team.id);
    
    const { count: awayCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('away_team_id', team.id);
    
    console.log(chalk.gray(`  Home games: ${homeCount || 0}`));
    console.log(chalk.gray(`  Away games: ${awayCount || 0}`));
    
    if ((homeCount || 0) > 0 || (awayCount || 0) > 0) {
      hasGames++;
      console.log(chalk.yellow(`  ⚠️  Has games - skipping`));
      continue;
    }
    
    // Delete the team
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', team.id);
    
    if (error) {
      console.log(chalk.red(`  ❌ Error: ${error.message}`));
    } else {
      deleted++;
      console.log(chalk.green(`  ✅ Deleted`));
    }
  }
  
  console.log(chalk.bold.green(`\n✅ Deleted ${deleted} teams`));
  console.log(chalk.yellow(`⚠️  ${hasGames} teams had games and were skipped`));
  
  // Final count
  const sportCounts: { [key: string]: number } = {};
  for (const sport of proSports) {
    const { count } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', sport);
    
    if (count) sportCounts[sport] = count;
  }
  
  console.log(chalk.cyan('\n📊 FINAL PROFESSIONAL SPORT TEAMS:'));
  Object.entries(sportCounts).forEach(([sport, count]) => {
    console.log(chalk.white(`  ${sport.toUpperCase()}: ${count} teams`));
  });
}

forceCleanupEmptyTeams().catch(console.error);
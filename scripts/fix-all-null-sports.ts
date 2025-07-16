#!/usr/bin/env tsx
/**
 * 🔧 FIX ALL NULL SPORT FIELDS
 * Update NULL sport fields based on external_id patterns
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixAllNullSports() {
  console.log(chalk.bold.blue('🔧 FIXING ALL NULL SPORT FIELDS\n'));
  
  // Sport patterns to fix
  const sportPatterns = [
    { pattern: 'espn_nhl_%', sport: 'NHL', emoji: '🏒' },
    { pattern: 'espn_nba_%', sport: 'NBA', emoji: '🏀' },
    { pattern: 'espn_nfl_%', sport: 'NFL', emoji: '🏈' },
    { pattern: 'espn_ncaaf_%', sport: 'NCAA_FB', emoji: '🏈' },
    { pattern: 'espn_ncaabb_%', sport: 'NCAA_BB', emoji: '🏀' }
  ];
  
  let totalFixed = 0;
  
  // Fix games
  console.log(chalk.yellow('1. FIXING GAMES WITH NULL SPORT:\n'));
  
  for (const { pattern, sport, emoji } of sportPatterns) {
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .is('sport', null)
      .ilike('external_id', pattern);
    
    if (count && count > 0) {
      console.log(`${emoji} Found ${count} ${sport} games with NULL sport`);
      
      const { error, count: updatedCount } = await supabase
        .from('games')
        .update({ sport })
        .is('sport', null)
        .ilike('external_id', pattern);
      
      if (error) {
        console.error(chalk.red(`   ❌ Error: ${error.message}`));
      } else {
        console.log(chalk.green(`   ✅ Updated ${updatedCount} games to sport = '${sport}'`));
        totalFixed += updatedCount || 0;
      }
    }
  }
  
  // Fix teams
  console.log(chalk.yellow('\n2. FIXING TEAMS WITH NULL SPORT:\n'));
  
  for (const { pattern, sport, emoji } of sportPatterns) {
    const { count } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .is('sport', null)
      .ilike('external_id', pattern);
    
    if (count && count > 0) {
      console.log(`${emoji} Found ${count} ${sport} teams with NULL sport`);
      
      const { error, count: updatedCount } = await supabase
        .from('teams')
        .update({ sport })
        .is('sport', null)
        .ilike('external_id', pattern);
      
      if (error) {
        console.error(chalk.red(`   ❌ Error: ${error.message}`));
      } else {
        console.log(chalk.green(`   ✅ Updated ${updatedCount} teams to sport = '${sport}'`));
      }
    }
  }
  
  // Fix players
  console.log(chalk.yellow('\n3. FIXING PLAYERS WITH NULL SPORT:\n'));
  
  // MLB players
  const { count: mlbPlayersCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .is('sport', null)
    .ilike('external_id', 'mlb_%');
  
  if (mlbPlayersCount && mlbPlayersCount > 0) {
    console.log(`⚾ Found ${mlbPlayersCount} MLB players with NULL sport`);
    
    const { error, count: updatedCount } = await supabase
      .from('players')
      .update({ sport: 'MLB' })
      .is('sport', null)
      .ilike('external_id', 'mlb_%');
    
    if (error) {
      console.error(chalk.red(`   ❌ Error: ${error.message}`));
    } else {
      console.log(chalk.green(`   ✅ Updated ${updatedCount} players to sport = 'MLB'`));
    }
  }
  
  // NBA players
  const { count: nbaPlayersCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .is('sport', null)
    .ilike('external_id', 'espn_nba_%');
  
  if (nbaPlayersCount && nbaPlayersCount > 0) {
    console.log(`🏀 Found ${nbaPlayersCount} NBA players with NULL sport`);
    
    const { error, count: updatedCount } = await supabase
      .from('players')
      .update({ sport: 'NBA' })
      .is('sport', null)
      .ilike('external_id', 'espn_nba_%');
    
    if (error) {
      console.error(chalk.red(`   ❌ Error: ${error.message}`));
    } else {
      console.log(chalk.green(`   ✅ Updated ${updatedCount} players to sport = 'NBA'`));
    }
  }
  
  // Final verification
  console.log(chalk.yellow('\n4. FINAL VERIFICATION:\n'));
  
  const { count: remainingNullGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('sport', null);
  
  const { count: remainingNullTeams } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .is('sport', null);
  
  const { count: remainingNullPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .is('sport', null);
  
  console.log(`Remaining NULL sport counts:`);
  console.log(`  Games: ${remainingNullGames || 0}`);
  console.log(`  Teams: ${remainingNullTeams || 0}`);
  console.log(`  Players: ${remainingNullPlayers || 0}`);
  
  // Show sport distribution
  console.log(chalk.yellow('\n5. SPORT DISTRIBUTION:\n'));
  
  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB'];
  
  for (const sport of sports) {
    const { count: gamesCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
    
    const { count: teamsCount } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
    
    const { count: playersCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
    
    console.log(`${sport}:`);
    console.log(`  Games: ${gamesCount?.toLocaleString()}`);
    console.log(`  Teams: ${teamsCount?.toLocaleString()}`);
    console.log(`  Players: ${playersCount?.toLocaleString()}`);
  }
  
  console.log(chalk.bold.green('\n✅ ALL NULL SPORT FIXES COMPLETE!'));
  console.log(chalk.green(`Total games fixed: ${totalFixed}`));
}

fixAllNullSports().catch(console.error);
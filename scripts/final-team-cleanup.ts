#!/usr/bin/env tsx
/**
 * 🔧 FINAL TEAM CLEANUP
 * 
 * Identifies and fixes remaining team issues
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanupSport(sport: string) {
  console.log(chalk.bold.cyan(`\n🔧 CLEANING UP ${sport}`));
  console.log(chalk.gray('='.repeat(50)));
  
  // Get all teams for this sport
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, abbreviation, external_id')
    .eq('sport', sport)
    .order('name');
    
  const withoutEspn = teams?.filter(t => !t.external_id) || [];
  const withEspn = teams?.filter(t => t.external_id) || [];
  
  console.log(chalk.white(`Total: ${teams?.length}, With ESPN: ${withEspn.length}, Without: ${withoutEspn.length}`));
  
  if (withoutEspn.length > 0) {
    console.log(chalk.yellow('\nTeams without ESPN IDs:'));
    
    for (const team of withoutEspn) {
      console.log(chalk.red(`  - ${team.name} (ID: ${team.id})`));
      
      // Try to find a matching team with ESPN ID
      const match = withEspn.find(t => {
        const name1 = team.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const name2 = t.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return name1.includes(name2) || name2.includes(name1);
      });
      
      if (match) {
        console.log(chalk.green(`    → Found match: ${match.name} (${match.external_id})`));
        console.log(chalk.blue(`    → Migrating data and deleting duplicate...`));
        
        // Migrate all references
        await supabase.from('players').update({ team_id: match.id }).eq('team_id', team.id);
        await supabase.from('player_game_logs').update({ team_id: match.id }).eq('team_id', team.id);
        await supabase.from('games').update({ home_team_id: match.id }).eq('home_team_id', team.id);
        await supabase.from('games').update({ away_team_id: match.id }).eq('away_team_id', team.id);
        await supabase.from('team_synergy_stats').update({ team_id: match.id }).eq('team_id', team.id);
        
        // Delete the team without ESPN ID
        const { error } = await supabase.from('teams').delete().eq('id', team.id);
        if (!error) {
          console.log(chalk.green(`    → ✅ Deleted duplicate`));
        }
      } else {
        // Check if this team has any data
        const { count: playerCount } = await supabase
          .from('players')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', team.id);
          
        const { count: gameCount } = await supabase
          .from('games')
          .select('*', { count: 'exact', head: true })
          .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`);
          
        if (!playerCount && !gameCount) {
          console.log(chalk.yellow(`    → No data found, safe to delete`));
          const { error } = await supabase.from('teams').delete().eq('id', team.id);
          if (!error) {
            console.log(chalk.green(`    → ✅ Deleted orphan team`));
          }
        } else {
          console.log(chalk.yellow(`    → Has data: ${playerCount} players, ${gameCount} games`));
        }
      }
    }
  }
}

async function fixSpecialCases() {
  console.log(chalk.bold.cyan('\n🔧 FIXING SPECIAL CASES'));
  console.log(chalk.gray('='.repeat(50)));
  
  // NHL: Handle Seattle Kraken (might have 2 ESPN IDs)
  const { data: krakenTeams } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .eq('sport', 'NHL')
    .eq('name', 'Seattle Kraken');
    
  if (krakenTeams && krakenTeams.length > 1) {
    console.log(chalk.yellow('Found multiple Seattle Kraken teams'));
    // Keep the one with ID 30 (newer)
    const keeper = krakenTeams.find(t => t.external_id?.includes('30'));
    const old = krakenTeams.find(t => t.external_id?.includes('124292'));
    
    if (keeper && old) {
      console.log(chalk.blue('Consolidating Seattle Kraken...'));
      await supabase.from('teams').delete().eq('id', old.id);
    }
  }
  
  // NHL: Handle Vegas Golden Knights
  const { data: vegasTeams } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .eq('sport', 'NHL')
    .eq('name', 'Vegas Golden Knights');
    
  if (vegasTeams && vegasTeams.length > 1) {
    console.log(chalk.yellow('Found multiple Vegas Golden Knights teams'));
    // Keep the one with standard ID
    const keeper = vegasTeams.find(t => t.external_id === 'espn_nhl_37');
    const others = vegasTeams.filter(t => t.id !== keeper?.id);
    
    for (const other of others) {
      await supabase.from('teams').delete().eq('id', other.id);
    }
  }
}

async function finalCleanup() {
  console.log(chalk.bold.cyan('🧹 FINAL TEAM CLEANUP\n'));
  
  // Clean each sport
  for (const sport of ['NBA', 'MLB', 'NHL']) {
    await cleanupSport(sport);
  }
  
  // Fix special cases
  await fixSpecialCases();
  
  // Final report
  console.log(chalk.bold.cyan('\n\n📊 FINAL REPORT'));
  console.log(chalk.gray('='.repeat(50)));
  
  for (const sport of ['NFL', 'NBA', 'MLB', 'NHL']) {
    const { count: total } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
      
    const { count: withEspn } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .not('external_id', 'is', null);
      
    const expectedCounts: Record<string, number> = {
      'NFL': 32,
      'NBA': 30,
      'MLB': 30,
      'NHL': 32
    };
    
    const expected = expectedCounts[sport];
    const status = total === withEspn && total === expected ? '✅' : '❌';
    console.log(chalk.white(`${status} ${sport}: ${total} teams (${withEspn} with ESPN IDs, expected ${expected})`));
  }
}

finalCleanup().catch(console.error);
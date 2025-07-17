#!/usr/bin/env tsx
/**
 * 🔧 FINAL FIX FOR ALL SPORTS
 * 
 * Clean up all remaining team issues
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixNHL() {
  console.log(chalk.bold.cyan('🏒 FIXING NHL\n'));
  
  // Check current NHL status
  const { data: nhlTeams } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .eq('sport', 'NHL')
    .order('name');
    
  // Find duplicates
  console.log(chalk.yellow('Checking for duplicates...'));
  const teamsByName: Record<string, any[]> = {};
  nhlTeams?.forEach(team => {
    if (!teamsByName[team.name]) teamsByName[team.name] = [];
    teamsByName[team.name].push(team);
  });
  
  for (const [name, teams] of Object.entries(teamsByName)) {
    if (teams.length > 1) {
      console.log(chalk.red(`\nDuplicate found: ${name}`));
      teams.forEach(t => {
        console.log(chalk.gray(`  - ID: ${t.id}, ESPN: ${t.external_id}`));
      });
      
      // For Vegas, keep the one with ID 37 (correct NHL ID)
      if (name === 'Vegas Golden Knights') {
        const keeper = teams.find(t => t.external_id === 'espn_nhl_37');
        const toDelete = teams.find(t => t.external_id === 'espn_nhl_32');
        
        if (keeper && toDelete) {
          // First check what references the old ID
          const { count: oppCount } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .eq('opponent_id', toDelete.id);
            
          if (oppCount && oppCount > 0) {
            console.log(chalk.blue(`  Updating ${oppCount} opponent references...`));
            await supabase
              .from('player_game_logs')
              .update({ opponent_id: keeper.id })
              .eq('opponent_id', toDelete.id);
          }
          
          // Now try to delete
          const { error } = await supabase
            .from('teams')
            .delete()
            .eq('id', toDelete.id);
            
          if (!error) {
            console.log(chalk.green('  ✅ Consolidated Vegas Golden Knights'));
          } else {
            console.error(chalk.red(`  Error: ${error.message}`));
          }
        }
      }
    }
  }
  
  // Handle Florida Panthers if still an issue
  const panthersWithoutEspn = nhlTeams?.find(t => t.name === 'Florida Panthers' && !t.external_id);
  const panthersWithEspn = nhlTeams?.find(t => t.name === 'Florida Panthers' && t.external_id);
  
  if (panthersWithoutEspn && panthersWithEspn) {
    console.log(chalk.yellow('\nConsolidating Florida Panthers...'));
    
    // Migrate all references
    await supabase.from('players').update({ team_id: panthersWithEspn.id }).eq('team_id', panthersWithoutEspn.id);
    await supabase.from('player_game_logs').update({ team_id: panthersWithEspn.id }).eq('team_id', panthersWithoutEspn.id);
    await supabase.from('player_game_logs').update({ opponent_id: panthersWithEspn.id }).eq('opponent_id', panthersWithoutEspn.id);
    await supabase.from('games').update({ home_team_id: panthersWithEspn.id }).eq('home_team_id', panthersWithoutEspn.id);
    await supabase.from('games').update({ away_team_id: panthersWithEspn.id }).eq('away_team_id', panthersWithoutEspn.id);
    
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', panthersWithoutEspn.id);
      
    if (!error) {
      console.log(chalk.green('  ✅ Consolidated Florida Panthers'));
    }
  } else if (panthersWithoutEspn && !panthersWithEspn) {
    // Just add the ESPN ID
    await supabase
      .from('teams')
      .update({ external_id: 'espn_nhl_13' })
      .eq('id', panthersWithoutEspn.id);
    console.log(chalk.green('  ✅ Added ESPN ID to Florida Panthers'));
  }
}

async function fixNBA() {
  console.log(chalk.bold.cyan('\n🏀 FIXING NBA\n'));
  
  // Get all NBA teams
  const { data: nbaTeams } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .eq('sport', 'NBA')
    .order('name');
    
  const withEspn = nbaTeams?.filter(t => t.external_id) || [];
  const withoutEspn = nbaTeams?.filter(t => !t.external_id) || [];
  
  console.log(chalk.white(`Total: ${nbaTeams?.length}, With ESPN: ${withEspn.length}, Without: ${withoutEspn.length}`));
  
  // For each team without ESPN ID, find its match
  for (const oldTeam of withoutEspn) {
    const match = withEspn.find(t => {
      const name1 = oldTeam.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const name2 = t.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return name1.includes(name2) || name2.includes(name1) ||
             (oldTeam.name.includes('Clippers') && t.name.includes('Clippers')) ||
             (oldTeam.name.includes('76ers') && t.name.includes('76ers'));
    });
    
    if (match) {
      console.log(chalk.yellow(`Migrating ${oldTeam.name} → ${match.name}...`));
      
      // Migrate all references
      await supabase.from('players').update({ team_id: match.id }).eq('team_id', oldTeam.id);
      await supabase.from('player_game_logs').update({ team_id: match.id }).eq('team_id', oldTeam.id);
      await supabase.from('player_game_logs').update({ opponent_id: match.id }).eq('opponent_id', oldTeam.id);
      await supabase.from('games').update({ home_team_id: match.id }).eq('home_team_id', oldTeam.id);
      await supabase.from('games').update({ away_team_id: match.id }).eq('away_team_id', oldTeam.id);
      await supabase.from('team_synergy_stats').update({ team_id: match.id }).eq('team_id', oldTeam.id);
      
      // Delete the old team
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', oldTeam.id);
        
      if (!error) {
        console.log(chalk.green(`  ✅ Deleted ${oldTeam.name}`));
      } else {
        console.error(chalk.red(`  Error: ${error.message}`));
      }
    }
  }
}

async function finalVerification() {
  console.log(chalk.bold.cyan('\n\n📊 FINAL VERIFICATION'));
  console.log(chalk.gray('='.repeat(50)));
  
  const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
  const expected: Record<string, number> = {
    'NFL': 32,
    'NBA': 30,
    'MLB': 30,
    'NHL': 32
  };
  
  for (const sport of sports) {
    const { count: total } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
      
    const { count: withEspn } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .not('external_id', 'is', null);
      
    const isCorrect = total === expected[sport] && total === withEspn;
    const status = isCorrect ? '✅' : '❌';
    
    console.log(chalk.white(`${status} ${sport}: ${total} teams (${withEspn} with ESPN IDs, expected ${expected[sport]})`));
  }
}

async function fixAllSports() {
  console.log(chalk.bold.cyan('🔧 FINAL SPORTS TEAM CLEANUP\n'));
  
  await fixNHL();
  await fixNBA();
  await finalVerification();
}

fixAllSports().catch(console.error);
#!/usr/bin/env tsx
/**
 * Fast cleanup of teams with NULL external_ids
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fastCleanNullTeams() {
  console.log(chalk.bold.blue('FAST CLEANING TEAMS WITH NULL EXTERNAL_IDS\n'));
  
  // Get all teams with NULL external_id
  const { data: nullTeams, count } = await supabase
    .from('teams')
    .select('id', { count: 'exact' })
    .is('external_id', null);
    
  console.log(`Found ${count} teams with NULL external_id`);
  
  if (!nullTeams || nullTeams.length === 0) {
    console.log('No teams to clean!');
    return;
  }
  
  const teamIds = nullTeams.map(t => t.id);
  
  // Check which teams are referenced in parallel
  console.log(chalk.yellow('\nChecking references in parallel...'));
  
  const checkPromises = [
    // Get all team IDs referenced in players
    supabase.from('players').select('team_id').in('team_id', teamIds).then(({ data }) => 
      new Set(data?.map(p => p.team_id) || [])),
    
    // Get all team IDs referenced in games (home)
    supabase.from('games').select('home_team_id').in('home_team_id', teamIds).then(({ data }) => 
      new Set(data?.map(g => g.home_team_id) || [])),
    
    // Get all team IDs referenced in games (away)
    supabase.from('games').select('away_team_id').in('away_team_id', teamIds).then(({ data }) => 
      new Set(data?.map(g => g.away_team_id) || [])),
    
    // Get all team IDs referenced in player_game_logs (team)
    supabase.from('player_game_logs').select('team_id').in('team_id', teamIds).then(({ data }) => 
      new Set(data?.map(s => s.team_id) || [])),
    
    // Get all team IDs referenced in player_game_logs (opponent)
    supabase.from('player_game_logs').select('opponent_id').in('opponent_id', teamIds).then(({ data }) => 
      new Set(data?.map(s => s.opponent_id) || []))
  ];
  
  const [playerRefs, homeGameRefs, awayGameRefs, statsTeamRefs, statsOppRefs] = await Promise.all(checkPromises);
  
  // Combine all referenced team IDs
  const referencedTeamIds = new Set<number>();
  [playerRefs, homeGameRefs, awayGameRefs, statsTeamRefs, statsOppRefs].forEach(set => {
    set.forEach(id => referencedTeamIds.add(id));
  });
  
  // Find teams that can be deleted (not referenced anywhere)
  const teamsToDelete = teamIds.filter(id => !referencedTeamIds.has(id));
  
  console.log(chalk.green(`\n✅ Can safely delete: ${teamsToDelete.length} teams`));
  console.log(chalk.yellow(`⚠️  Must keep: ${referencedTeamIds.size} teams (have references)`));
  
  // Delete unreferenced teams
  if (teamsToDelete.length > 0) {
    console.log(chalk.yellow(`\nDeleting ${teamsToDelete.length} teams...`));
    
    // Delete in batches of 100
    const batchSize = 100;
    let deleted = 0;
    
    for (let i = 0; i < teamsToDelete.length; i += batchSize) {
      const batch = teamsToDelete.slice(i, i + batchSize);
      
      const { count: deleteCount } = await supabase
        .from('teams')
        .delete()
        .in('id', batch);
        
      deleted += deleteCount || 0;
      console.log(`  Progress: ${deleted}/${teamsToDelete.length} deleted...`);
    }
    
    console.log(chalk.green(`✅ Successfully deleted ${deleted} teams`));
  }
  
  // Final count
  const { count: remaining } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null);
    
  console.log(chalk.cyan(`\n📊 Remaining teams with NULL external_id: ${remaining}`));
}

fastCleanNullTeams().catch(console.error);
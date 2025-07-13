#!/usr/bin/env tsx
/**
 * 🧹 CLEANUP DUPLICATE NBA TEAMS V2
 * Consolidate duplicate teams and update all references
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanupDuplicatesV2() {
  console.log(chalk.bold.blue('\n🧹 NBA TEAM CLEANUP V2\n'));
  
  // Get all NBA teams
  const { data: nbaTeams } = await supabase
    .from('teams')
    .select('*')
    .eq('sport_id', 'nba')
    .order('created_at');
  
  if (!nbaTeams) return;
  
  console.log(chalk.yellow(`Found ${nbaTeams.length} NBA teams\n`));
  
  // Separate ESPN and non-ESPN teams
  const espnTeams = nbaTeams.filter(t => t.external_id?.startsWith('espn_nba_'));
  const otherTeams = nbaTeams.filter(t => !t.external_id?.startsWith('espn_nba_'));
  
  console.log(`ESPN teams: ${espnTeams.length}`);
  console.log(`Other teams: ${otherTeams.length}\n`);
  
  // Map old team IDs to new team IDs
  const teamMapping: { [key: number]: number } = {};
  
  // Build mapping
  for (const oldTeam of otherTeams) {
    // Find matching ESPN team by abbreviation or name similarity
    const espnTeam = espnTeams.find(t => 
      t.abbreviation === oldTeam.abbreviation ||
      t.name.includes(oldTeam.name) || 
      oldTeam.name.includes(t.name)
    );
    
    if (espnTeam) {
      teamMapping[oldTeam.id] = espnTeam.id;
      console.log(chalk.cyan(`Mapping: ${oldTeam.name} (${oldTeam.id}) → ${espnTeam.name} (${espnTeam.id})`));
    }
  }
  
  // Update all game references
  console.log(chalk.yellow('\n\nUpdating game references...'));
  
  for (const [oldId, newId] of Object.entries(teamMapping)) {
    // Update home team references
    const { error: homeError, count: homeCount } = await supabase
      .from('games')
      .update({ home_team_id: parseInt(newId) })
      .eq('home_team_id', parseInt(oldId));
    
    if (!homeError && homeCount) {
      console.log(chalk.green(`  ✓ Updated ${homeCount} home games for team ${oldId} → ${newId}`));
    }
    
    // Update away team references
    const { error: awayError, count: awayCount } = await supabase
      .from('games')
      .update({ away_team_id: parseInt(newId) })
      .eq('away_team_id', parseInt(oldId));
    
    if (!awayError && awayCount) {
      console.log(chalk.green(`  ✓ Updated ${awayCount} away games for team ${oldId} → ${newId}`));
    }
  }
  
  // Update player_game_logs references
  console.log(chalk.yellow('\n\nUpdating player game log references...'));
  
  for (const [oldId, newId] of Object.entries(teamMapping)) {
    // Update team_id
    const { error: teamError, count: teamCount } = await supabase
      .from('player_game_logs')
      .update({ team_id: parseInt(newId) })
      .eq('team_id', parseInt(oldId));
    
    if (!teamError && teamCount) {
      console.log(chalk.green(`  ✓ Updated ${teamCount} game logs for team ${oldId} → ${newId}`));
    }
    
    // Update opponent_id
    const { error: oppError, count: oppCount } = await supabase
      .from('player_game_logs')
      .update({ opponent_id: parseInt(newId) })
      .eq('opponent_id', parseInt(oldId));
    
    if (!oppError && oppCount) {
      console.log(chalk.green(`  ✓ Updated ${oppCount} opponent references for team ${oldId} → ${newId}`));
    }
  }
  
  // Now try to delete the duplicate teams
  console.log(chalk.yellow('\n\nDeleting duplicate teams...'));
  
  let deletedCount = 0;
  for (const oldTeam of otherTeams) {
    if (teamMapping[oldTeam.id]) {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', oldTeam.id);
      
      if (error) {
        console.error(chalk.red(`  ❌ Failed to delete ${oldTeam.name}: ${error.message}`));
      } else {
        deletedCount++;
        console.log(chalk.green(`  ✓ Deleted ${oldTeam.name} (${oldTeam.id})`));
      }
    }
  }
  
  // Final count
  const { count: finalCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nba');
  
  console.log(chalk.bold.green(`\n✅ Cleanup complete!`));
  console.log(chalk.green(`  Deleted ${deletedCount} duplicate teams`));
  console.log(chalk.green(`  NBA teams remaining: ${finalCount}`));
}

cleanupDuplicatesV2().catch(console.error);
#!/usr/bin/env tsx
/**
 * 🔧 CONSOLIDATE NFL TEAMS
 * 
 * Merges duplicate NFL teams, keeping the ones with ESPN IDs
 * and migrating all references (games, players, stats)
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function consolidateNFLTeams() {
  console.log(chalk.bold.cyan('🔧 CONSOLIDATING NFL TEAMS\n'));
  
  // Get all NFL teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, abbreviation, external_id')
    .eq('sport', 'NFL')
    .order('name');
    
  // Group by team name
  const teamsByName: Record<string, any[]> = {};
  teams?.forEach(team => {
    if (!teamsByName[team.name]) teamsByName[team.name] = [];
    teamsByName[team.name].push(team);
  });
  
  // Process each duplicate
  let totalMigrated = 0;
  
  for (const [name, teamList] of Object.entries(teamsByName)) {
    if (teamList.length > 1) {
      // Find the team with ESPN ID (keeper) and without (to migrate)
      const keeperTeam = teamList.find(t => t.external_id);
      const oldTeam = teamList.find(t => !t.external_id);
      
      if (keeperTeam && oldTeam) {
        console.log(chalk.blue(`\nProcessing ${name}:`));
        console.log(chalk.gray(`  Keep: ID ${keeperTeam.id} (${keeperTeam.external_id})`));
        console.log(chalk.gray(`  Migrate: ID ${oldTeam.id} (no external_id)`));
        
        // 1. Update players
        const { count: playerCount } = await supabase
          .from('players')
          .update({ team_id: keeperTeam.id })
          .eq('team_id', oldTeam.id);
          
        console.log(chalk.green(`  ✅ Migrated ${playerCount || 0} players`));
        
        // 2. Update player_game_logs
        const { count: statsCount } = await supabase
          .from('player_game_logs')
          .update({ team_id: keeperTeam.id })
          .eq('team_id', oldTeam.id);
          
        console.log(chalk.green(`  ✅ Migrated ${statsCount || 0} player stats`));
        
        // 3. Update games (home team)
        const { count: homeGameCount } = await supabase
          .from('games')
          .update({ home_team_id: keeperTeam.id })
          .eq('home_team_id', oldTeam.id);
          
        console.log(chalk.green(`  ✅ Migrated ${homeGameCount || 0} home games`));
        
        // 4. Update games (away team)
        const { count: awayGameCount } = await supabase
          .from('games')
          .update({ away_team_id: keeperTeam.id })
          .eq('away_team_id', oldTeam.id);
          
        console.log(chalk.green(`  ✅ Migrated ${awayGameCount || 0} away games`));
        
        // 5. Update team_synergy_stats
        const { count: synergyCount } = await supabase
          .from('team_synergy_stats')
          .update({ team_id: keeperTeam.id })
          .eq('team_id', oldTeam.id);
          
        console.log(chalk.green(`  ✅ Migrated ${synergyCount || 0} synergy stats`));
        
        // 6. Delete the old team
        const { error } = await supabase
          .from('teams')
          .delete()
          .eq('id', oldTeam.id);
          
        if (error) {
          console.error(chalk.red(`  ❌ Error deleting old team: ${error.message}`));
        } else {
          console.log(chalk.green(`  ✅ Deleted old team record`));
          totalMigrated++;
        }
      }
    }
  }
  
  // Final verification
  console.log(chalk.bold.cyan('\n\nFINAL VERIFICATION:'));
  
  const { count: finalTeamCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL');
    
  const { count: teamsWithExternal } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL')
    .not('external_id', 'is', null);
    
  console.log(chalk.green(`✅ Total NFL teams: ${finalTeamCount}`));
  console.log(chalk.green(`✅ Teams with ESPN IDs: ${teamsWithExternal}`));
  console.log(chalk.green(`✅ Teams migrated: ${totalMigrated}`));
}

consolidateNFLTeams().catch(console.error);
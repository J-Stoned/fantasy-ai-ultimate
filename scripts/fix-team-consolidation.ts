#!/usr/bin/env tsx
/**
 * 🔧 FIX TEAM CONSOLIDATION
 * 
 * Properly consolidates duplicate teams by matching on name
 * and migrating all data to the team with ESPN ID
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function consolidateTeamsBySport(sport: string) {
  console.log(chalk.bold.cyan(`\n🔧 CONSOLIDATING ${sport} TEAMS`));
  console.log(chalk.gray('='.repeat(50)));
  
  // Get all teams for this sport
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .eq('sport', sport)
    .order('name');
    
  // Group by name
  const teamsByName: Record<string, any[]> = {};
  teams?.forEach(team => {
    if (!teamsByName[team.name]) teamsByName[team.name] = [];
    teamsByName[team.name].push(team);
  });
  
  let totalMigrated = 0;
  let totalDeleted = 0;
  
  // Process each group of teams with same name
  for (const [name, teamList] of Object.entries(teamsByName)) {
    if (teamList.length > 1) {
      // Find the team with ESPN ID (keeper)
      const keeperTeam = teamList.find(t => t.external_id);
      const oldTeams = teamList.filter(t => !t.external_id);
      
      if (keeperTeam && oldTeams.length > 0) {
        console.log(chalk.blue(`\nProcessing ${name}:`));
        console.log(chalk.gray(`  Keep: ID ${keeperTeam.id} (${keeperTeam.external_id})`));
        
        for (const oldTeam of oldTeams) {
          console.log(chalk.gray(`  Migrate from: ID ${oldTeam.id} (no external_id)`));
          
          // 1. Update players
          const { count: playerCount } = await supabase
            .from('players')
            .update({ team_id: keeperTeam.id })
            .eq('team_id', oldTeam.id);
          if (playerCount) console.log(chalk.green(`    ✅ Migrated ${playerCount} players`));
          
          // 2. Update player_game_logs
          const { count: statsCount } = await supabase
            .from('player_game_logs')
            .update({ team_id: keeperTeam.id })
            .eq('team_id', oldTeam.id);
          if (statsCount) console.log(chalk.green(`    ✅ Migrated ${statsCount} stats`));
          
          // 3. Update games (home)
          const { count: homeCount } = await supabase
            .from('games')
            .update({ home_team_id: keeperTeam.id })
            .eq('home_team_id', oldTeam.id);
          if (homeCount) console.log(chalk.green(`    ✅ Migrated ${homeCount} home games`));
          
          // 4. Update games (away)
          const { count: awayCount } = await supabase
            .from('games')
            .update({ away_team_id: keeperTeam.id })
            .eq('away_team_id', oldTeam.id);
          if (awayCount) console.log(chalk.green(`    ✅ Migrated ${awayCount} away games`));
          
          // 5. Update team_synergy_stats
          const { count: synergyCount } = await supabase
            .from('team_synergy_stats')
            .update({ team_id: keeperTeam.id })
            .eq('team_id', oldTeam.id);
          if (synergyCount) console.log(chalk.green(`    ✅ Migrated ${synergyCount} synergies`));
          
          // 6. Delete the old team
          const { error } = await supabase
            .from('teams')
            .delete()
            .eq('id', oldTeam.id);
            
          if (!error) {
            console.log(chalk.green(`    ✅ Deleted old team record`));
            totalDeleted++;
          } else {
            console.error(chalk.red(`    ❌ Error deleting: ${error.message}`));
          }
          
          totalMigrated++;
        }
      } else if (!keeperTeam) {
        console.log(chalk.yellow(`\n⚠️  ${name} has duplicates but none have ESPN IDs`));
      }
    }
  }
  
  // Final verification
  const { count: finalCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', sport);
    
  const { count: withExternal } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', sport)
    .not('external_id', 'is', null);
    
  console.log(chalk.cyan('\nFINAL STATUS:'));
  console.log(chalk.white(`  Total teams: ${finalCount}`));
  console.log(chalk.white(`  With ESPN IDs: ${withExternal}`));
  console.log(chalk.white(`  Migrated: ${totalMigrated}`));
  console.log(chalk.white(`  Deleted: ${totalDeleted}`));
}

async function fixAllTeams() {
  console.log(chalk.bold.cyan('🔧 FIXING TEAM CONSOLIDATION\n'));
  
  // Process each sport
  for (const sport of ['NBA', 'MLB', 'NHL']) {
    await consolidateTeamsBySport(sport);
  }
  
  console.log(chalk.bold.green('\n✅ TEAM CONSOLIDATION COMPLETE!'));
  
  // Final summary
  console.log(chalk.cyan('\nFINAL DATABASE STATUS:'));
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
      
    const status = total === withEspn ? '✅' : '❌';
    console.log(chalk.white(`  ${status} ${sport}: ${total} teams (${withEspn} with ESPN IDs)`));
  }
}

fixAllTeams().catch(console.error);
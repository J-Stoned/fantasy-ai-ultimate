#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTeamConsistency() {
  console.log(chalk.bold.cyan('🔍 CHECKING NFL TEAM CONSISTENCY\n'));
  
  // Get all NFL teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, abbreviation, external_id')
    .eq('sport', 'NFL')
    .order('name');
    
  // Group by external_id status
  const withExternal = teams?.filter(t => t.external_id) || [];
  const withoutExternal = teams?.filter(t => !t.external_id) || [];
  
  console.log(chalk.blue(`Teams WITH external_id: ${withExternal.length}`));
  console.log(chalk.yellow(`Teams WITHOUT external_id: ${withoutExternal.length}`));
  
  // Check for duplicates
  const teamsByName: Record<string, any[]> = {};
  teams?.forEach(team => {
    if (!teamsByName[team.name]) teamsByName[team.name] = [];
    teamsByName[team.name].push(team);
  });
  
  console.log(chalk.cyan('\nDUPLICATE TEAMS:'));
  let duplicateCount = 0;
  Object.entries(teamsByName).forEach(([name, teams]) => {
    if (teams.length > 1) {
      duplicateCount++;
      console.log(chalk.red(`  ${name}:`));
      teams.forEach(t => {
        console.log(chalk.white(`    - ID: ${t.id}, external_id: ${t.external_id || 'NULL'}`));
      });
    }
  });
  
  if (duplicateCount === 0) {
    console.log(chalk.green('  No duplicate teams found!'));
  }
  
  // Check if games reference teams without external_ids
  console.log(chalk.cyan('\nCHECKING GAME REFERENCES:'));
  const teamIds = withoutExternal.map(t => t.id);
  
  if (teamIds.length > 0) {
    const { count: gamesWithOldTeams } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .or(`home_team_id.in.(${teamIds.join(',')}),away_team_id.in.(${teamIds.join(',')})`);
      
    console.log(chalk.yellow(`Games referencing teams WITHOUT external_id: ${gamesWithOldTeams}`));
    
    // Get sample games
    const { data: sampleGames } = await supabase
      .from('games')
      .select('id, sport, home_team_id, away_team_id, start_time')
      .or(`home_team_id.in.(${teamIds.join(',')}),away_team_id.in.(${teamIds.join(',')})`)
      .limit(5);
      
    if (sampleGames && sampleGames.length > 0) {
      console.log(chalk.yellow('Sample games using old team IDs:'));
      sampleGames.forEach(g => {
        console.log(chalk.gray(`  - Game ${g.id}: teams ${g.home_team_id} vs ${g.away_team_id}`));
      });
    }
  }
  
  // Show teams without external_id
  if (withoutExternal.length > 0) {
    console.log(chalk.cyan('\nTEAMS WITHOUT EXTERNAL_ID:'));
    withoutExternal.forEach(t => {
      console.log(chalk.white(`  - ${t.name} (ID: ${t.id}, abbr: ${t.abbreviation})`));
    });
  }
  
  // Check player references
  console.log(chalk.cyan('\nCHECKING PLAYER REFERENCES:'));
  for (const team of withoutExternal.slice(0, 3)) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id);
      
    if (count && count > 0) {
      console.log(chalk.yellow(`  ${team.name} (ID: ${team.id}) has ${count} players`));
    }
  }
  
  // Summary
  console.log(chalk.bold.cyan('\nSUMMARY:'));
  console.log(chalk.white(`- Total NFL teams: ${teams?.length}`));
  console.log(chalk.white(`- Teams with ESPN IDs: ${withExternal.length}`));
  console.log(chalk.white(`- Teams without ESPN IDs: ${withoutExternal.length}`));
  console.log(chalk.white(`- Duplicate teams: ${duplicateCount}`));
}

checkTeamConsistency().catch(console.error);
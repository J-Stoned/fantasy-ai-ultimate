#!/usr/bin/env tsx
/**
 * 🎯 CONSOLIDATE TO LONG NAMES
 * Keep teams with full names and migrate everything to them
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Mapping of short names to full names
const SHORT_TO_LONG: { [key: string]: string } = {
  'Hawks': 'Atlanta Hawks',
  'Celtics': 'Boston Celtics',
  'Nets': 'Brooklyn Nets',
  'Hornets': 'Charlotte Hornets',
  'Bulls': 'Chicago Bulls',
  'Cavaliers': 'Cleveland Cavaliers',
  'Mavericks': 'Dallas Mavericks',
  'Nuggets': 'Denver Nuggets',
  'Pistons': 'Detroit Pistons',
  'Warriors': 'Golden State Warriors',
  'Rockets': 'Houston Rockets',
  'Pacers': 'Indiana Pacers',
  'Clippers': 'LA Clippers',
  'Lakers': 'Los Angeles Lakers',
  'Grizzlies': 'Memphis Grizzlies',
  'Heat': 'Miami Heat',
  'Bucks': 'Milwaukee Bucks',
  'Timberwolves': 'Minnesota Timberwolves',
  'Pelicans': 'New Orleans Pelicans',
  'Knicks': 'New York Knicks',
  'Thunder': 'Oklahoma City Thunder',
  'Magic': 'Orlando Magic',
  '76ers': 'Philadelphia 76ers',
  'Suns': 'Phoenix Suns',
  'Trail Blazers': 'Portland Trail Blazers',
  'Kings': 'Sacramento Kings',
  'Spurs': 'San Antonio Spurs',
  'Raptors': 'Toronto Raptors',
  'Jazz': 'Utah Jazz',
  'Wizards': 'Washington Wizards'
};

async function consolidateToLongNames() {
  console.log(chalk.bold.blue('\n🎯 CONSOLIDATING TO LONG TEAM NAMES\n'));
  
  // Get all NBA teams
  const { data: nbaTeams } = await supabase
    .from('teams')
    .select('*')
    .eq('sport_id', 'nba')
    .order('name');
  
  if (!nbaTeams) return;
  
  console.log(chalk.yellow(`Found ${nbaTeams.length} NBA teams\n`));
  
  // Build mappings
  const shortNameTeams: { [key: string]: any } = {};
  const longNameTeams: { [key: string]: any } = {};
  
  nbaTeams.forEach(team => {
    if (SHORT_TO_LONG[team.name]) {
      // This is a short name team
      shortNameTeams[team.name] = team;
    } else if (Object.values(SHORT_TO_LONG).includes(team.name)) {
      // This is a long name team
      longNameTeams[team.name] = team;
    }
  });
  
  console.log(chalk.cyan('Team mappings:'));
  console.log(`  Short name teams: ${Object.keys(shortNameTeams).length}`);
  console.log(`  Long name teams: ${Object.keys(longNameTeams).length}\n`);
  
  // Process each short/long pair
  for (const [shortName, longName] of Object.entries(SHORT_TO_LONG)) {
    const shortTeam = shortNameTeams[shortName];
    const longTeam = longNameTeams[longName];
    
    if (shortTeam && longTeam) {
      console.log(chalk.yellow(`\nProcessing: ${shortName} → ${longName}`));
      console.log(chalk.gray(`  Short team ID: ${shortTeam.id}`));
      console.log(chalk.gray(`  Long team ID: ${longTeam.id}`));
      
      // 1. Update the long team with ESPN data if needed
      if (shortTeam.external_id?.startsWith('espn_nba_') && !longTeam.external_id?.startsWith('espn_nba_')) {
        console.log(chalk.cyan('  Updating long team with ESPN data...'));
        const { error } = await supabase
          .from('teams')
          .update({
            external_id: shortTeam.external_id,
            logo_url: shortTeam.logo_url || longTeam.logo_url
          })
          .eq('id', longTeam.id);
        
        if (!error) {
          console.log(chalk.green('  ✓ Updated ESPN data'));
        }
      }
      
      // 2. Migrate players
      const { count: playerCount } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', shortTeam.id);
      
      if (playerCount && playerCount > 0) {
        console.log(chalk.cyan(`  Migrating ${playerCount} players...`));
        const { error } = await supabase
          .from('players')
          .update({ team_id: longTeam.id })
          .eq('team_id', shortTeam.id);
        
        if (!error) {
          console.log(chalk.green(`  ✓ Migrated ${playerCount} players`));
        }
      }
      
      // 3. Update games
      const { error: homeError, count: homeCount } = await supabase
        .from('games')
        .update({ home_team_id: longTeam.id })
        .eq('home_team_id', shortTeam.id);
      
      if (homeCount) {
        console.log(chalk.green(`  ✓ Updated ${homeCount} home games`));
      }
      
      const { error: awayError, count: awayCount } = await supabase
        .from('games')
        .update({ away_team_id: longTeam.id })
        .eq('away_team_id', shortTeam.id);
      
      if (awayCount) {
        console.log(chalk.green(`  ✓ Updated ${awayCount} away games`));
      }
      
      // 4. Update player_game_logs
      const { count: logTeamCount } = await supabase
        .from('player_game_logs')
        .update({ team_id: longTeam.id })
        .eq('team_id', shortTeam.id);
      
      if (logTeamCount) {
        console.log(chalk.green(`  ✓ Updated ${logTeamCount} game log team references`));
      }
      
      const { count: logOppCount } = await supabase
        .from('player_game_logs')
        .update({ opponent_id: longTeam.id })
        .eq('opponent_id', shortTeam.id);
      
      if (logOppCount) {
        console.log(chalk.green(`  ✓ Updated ${logOppCount} game log opponent references`));
      }
      
      // 5. Delete the short name team
      console.log(chalk.yellow('  Deleting short name team...'));
      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('id', shortTeam.id);
      
      if (deleteError) {
        console.error(chalk.red(`  ❌ Error deleting: ${deleteError.message}`));
      } else {
        console.log(chalk.green('  ✓ Deleted short name team'));
      }
    }
  }
  
  // Final count
  const { count: finalCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nba');
  
  console.log(chalk.bold.green(`\n✅ Consolidation complete! NBA teams: ${finalCount}`));
  
  // Show final teams
  const { data: finalTeams } = await supabase
    .from('teams')
    .select('name, abbreviation, external_id')
    .eq('sport_id', 'nba')
    .order('name');
  
  if (finalTeams) {
    console.log(chalk.cyan('\nFinal NBA teams:'));
    finalTeams.forEach(team => {
      console.log(`  ${team.name} (${team.abbreviation})`);
    });
  }
}

consolidateToLongNames().catch(console.error);
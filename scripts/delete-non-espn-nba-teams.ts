#!/usr/bin/env tsx
/**
 * 🗑️ DELETE NON-ESPN NBA TEAMS
 * Remove teams without espn_nba_ prefix (they have no players)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deleteNonEspnTeams() {
  console.log(chalk.bold.blue('\n🗑️ DELETING NON-ESPN NBA TEAMS\n'));
  
  // Get all NBA teams
  const { data: nbaTeams } = await supabase
    .from('teams')
    .select('*')
    .eq('sport_id', 'nba')
    .order('name');
  
  if (!nbaTeams) return;
  
  // Separate ESPN and non-ESPN teams
  const espnTeams = nbaTeams.filter(t => t.external_id?.startsWith('espn_nba_'));
  const nonEspnTeams = nbaTeams.filter(t => !t.external_id?.startsWith('espn_nba_'));
  
  console.log(chalk.yellow(`ESPN teams: ${espnTeams.length}`));
  console.log(chalk.yellow(`Non-ESPN teams to delete: ${nonEspnTeams.length}\n`));
  
  // Check each non-ESPN team for dependencies
  for (const team of nonEspnTeams) {
    console.log(chalk.cyan(`\nChecking ${team.name} (ID: ${team.id})...`));
    
    // Check for players
    const { count: playerCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id);
    
    // Check for games
    const { count: homeGameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('home_team_id', team.id);
    
    const { count: awayGameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('away_team_id', team.id);
    
    console.log(`  Players: ${playerCount || 0}`);
    console.log(`  Home games: ${homeGameCount || 0}`);
    console.log(`  Away games: ${awayGameCount || 0}`);
    
    if ((playerCount || 0) === 0 && (homeGameCount || 0) === 0 && (awayGameCount || 0) === 0) {
      // Safe to delete
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', team.id);
      
      if (error) {
        console.error(chalk.red(`  ❌ Error deleting: ${error.message}`));
      } else {
        console.log(chalk.green(`  ✓ Deleted successfully`));
      }
    } else {
      console.log(chalk.yellow(`  ⚠️  Has dependencies, skipping`));
    }
  }
  
  // Now update ESPN teams to full names
  console.log(chalk.cyan('\n\nUpdating ESPN teams to full names...\n'));
  
  const NBA_FULL_NAMES: { [key: string]: string } = {
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
  
  for (const team of espnTeams) {
    const fullName = NBA_FULL_NAMES[team.name];
    if (fullName && team.name !== fullName) {
      console.log(chalk.yellow(`Updating "${team.name}" → "${fullName}"`));
      
      const { error } = await supabase
        .from('teams')
        .update({ name: fullName })
        .eq('id', team.id);
      
      if (error) {
        console.error(chalk.red(`  Error: ${error.message}`));
      } else {
        console.log(chalk.green(`  ✓ Updated`));
      }
    }
  }
  
  // Final count
  const { count: finalCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nba');
  
  console.log(chalk.bold.green(`\n✅ Cleanup complete! NBA teams: ${finalCount}`));
}

deleteNonEspnTeams().catch(console.error);
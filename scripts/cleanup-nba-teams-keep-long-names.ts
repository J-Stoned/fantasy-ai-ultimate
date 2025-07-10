#!/usr/bin/env tsx
/**
 * 🧹 CLEANUP NBA TEAMS - KEEP LONG NAMES
 * Keep the full team names (e.g., "Los Angeles Lakers")
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
const NBA_FULL_NAMES: { [key: string]: { city: string, name: string } } = {
  'Hawks': { city: 'Atlanta', name: 'Atlanta Hawks' },
  'Celtics': { city: 'Boston', name: 'Boston Celtics' },
  'Nets': { city: 'Brooklyn', name: 'Brooklyn Nets' },
  'Hornets': { city: 'Charlotte', name: 'Charlotte Hornets' },
  'Bulls': { city: 'Chicago', name: 'Chicago Bulls' },
  'Cavaliers': { city: 'Cleveland', name: 'Cleveland Cavaliers' },
  'Mavericks': { city: 'Dallas', name: 'Dallas Mavericks' },
  'Nuggets': { city: 'Denver', name: 'Denver Nuggets' },
  'Pistons': { city: 'Detroit', name: 'Detroit Pistons' },
  'Warriors': { city: 'Golden State', name: 'Golden State Warriors' },
  'Rockets': { city: 'Houston', name: 'Houston Rockets' },
  'Pacers': { city: 'Indiana', name: 'Indiana Pacers' },
  'Clippers': { city: 'LA', name: 'LA Clippers' },
  'Lakers': { city: 'Los Angeles', name: 'Los Angeles Lakers' },
  'Grizzlies': { city: 'Memphis', name: 'Memphis Grizzlies' },
  'Heat': { city: 'Miami', name: 'Miami Heat' },
  'Bucks': { city: 'Milwaukee', name: 'Milwaukee Bucks' },
  'Timberwolves': { city: 'Minnesota', name: 'Minnesota Timberwolves' },
  'Pelicans': { city: 'New Orleans', name: 'New Orleans Pelicans' },
  'Knicks': { city: 'New York', name: 'New York Knicks' },
  'Thunder': { city: 'Oklahoma City', name: 'Oklahoma City Thunder' },
  'Magic': { city: 'Orlando', name: 'Orlando Magic' },
  '76ers': { city: 'Philadelphia', name: 'Philadelphia 76ers' },
  'Suns': { city: 'Phoenix', name: 'Phoenix Suns' },
  'Trail Blazers': { city: 'Portland', name: 'Portland Trail Blazers' },
  'Kings': { city: 'Sacramento', name: 'Sacramento Kings' },
  'Spurs': { city: 'San Antonio', name: 'San Antonio Spurs' },
  'Raptors': { city: 'Toronto', name: 'Toronto Raptors' },
  'Jazz': { city: 'Utah', name: 'Utah Jazz' },
  'Wizards': { city: 'Washington', name: 'Washington Wizards' }
};

async function cleanupKeepLongNames() {
  console.log(chalk.bold.blue('\n🧹 NBA TEAM CLEANUP - KEEPING FULL NAMES\n'));
  
  // Get all NBA teams
  const { data: nbaTeams } = await supabase
    .from('teams')
    .select('*')
    .eq('sport_id', 'nba')
    .order('name');
  
  if (!nbaTeams) return;
  
  console.log(chalk.yellow(`Found ${nbaTeams.length} NBA teams\n`));
  
  // Update ESPN teams to have full names
  const espnTeams = nbaTeams.filter(t => t.external_id?.startsWith('espn_nba_'));
  
  console.log(chalk.cyan('Updating ESPN teams to full names...\n'));
  
  for (const team of espnTeams) {
    const fullNameInfo = NBA_FULL_NAMES[team.name];
    
    if (fullNameInfo) {
      console.log(chalk.yellow(`Updating "${team.name}" → "${fullNameInfo.name}"`));
      
      const { error } = await supabase
        .from('teams')
        .update({
          name: fullNameInfo.name,
          city: fullNameInfo.city
        })
        .eq('id', team.id);
      
      if (error) {
        console.error(chalk.red(`  Error: ${error.message}`));
      } else {
        console.log(chalk.green(`  ✓ Updated successfully`));
      }
    }
  }
  
  // Now find and remove duplicates
  console.log(chalk.cyan('\n\nFinding duplicates to remove...\n'));
  
  // Re-fetch teams after updates
  const { data: updatedTeams } = await supabase
    .from('teams')
    .select('*')
    .eq('sport_id', 'nba')
    .order('name');
  
  if (!updatedTeams) return;
  
  // Group by name to find duplicates
  const teamsByName: { [key: string]: any[] } = {};
  updatedTeams.forEach(team => {
    const key = team.name;
    if (!teamsByName[key]) teamsByName[key] = [];
    teamsByName[key].push(team);
  });
  
  // Process duplicates
  for (const [name, teams] of Object.entries(teamsByName)) {
    if (teams.length > 1) {
      console.log(chalk.yellow(`\nFound ${teams.length} teams named "${name}"`));
      
      // Keep the one with ESPN external_id
      const espnTeam = teams.find(t => t.external_id?.startsWith('espn_nba_'));
      const othersToDelete = teams.filter(t => t.id !== espnTeam?.id);
      
      if (espnTeam && othersToDelete.length > 0) {
        console.log(chalk.cyan(`  Keeping team ID ${espnTeam.id} (ESPN)`));
        
        for (const oldTeam of othersToDelete) {
          console.log(chalk.gray(`  Removing duplicate ID ${oldTeam.id}`));
          
          // First, update any game references
          await supabase.from('games').update({ home_team_id: espnTeam.id }).eq('home_team_id', oldTeam.id);
          await supabase.from('games').update({ away_team_id: espnTeam.id }).eq('away_team_id', oldTeam.id);
          
          // Update player_game_logs
          await supabase.from('player_game_logs').update({ team_id: espnTeam.id }).eq('team_id', oldTeam.id);
          await supabase.from('player_game_logs').update({ opponent_id: espnTeam.id }).eq('opponent_id', oldTeam.id);
          
          // Delete the duplicate
          const { error } = await supabase
            .from('teams')
            .delete()
            .eq('id', oldTeam.id);
          
          if (!error) {
            console.log(chalk.green(`    ✓ Deleted duplicate`));
          }
        }
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

cleanupKeepLongNames().catch(console.error);
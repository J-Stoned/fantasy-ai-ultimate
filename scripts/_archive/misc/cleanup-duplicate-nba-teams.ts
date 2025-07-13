#!/usr/bin/env tsx
/**
 * 🧹 CLEANUP DUPLICATE NBA TEAMS
 * Consolidate duplicate teams and update player references
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Mapping of team names to keep the ESPN versions
const NBA_TEAM_MAPPING = {
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

async function cleanupDuplicates() {
  console.log(chalk.bold.blue('\n🧹 NBA TEAM CLEANUP\n'));
  
  // Get all NBA teams
  const { data: nbaTeams, error } = await supabase
    .from('teams')
    .select('*')
    .eq('sport_id', 'nba')
    .order('created_at');
  
  if (error || !nbaTeams) {
    console.error('Error fetching teams:', error);
    return;
  }
  
  console.log(chalk.yellow(`Found ${nbaTeams.length} NBA teams\n`));
  
  // Separate ESPN and non-ESPN teams
  const espnTeams = nbaTeams.filter(t => t.external_id?.startsWith('espn_nba_'));
  const otherTeams = nbaTeams.filter(t => !t.external_id?.startsWith('espn_nba_'));
  
  console.log(`ESPN teams: ${espnTeams.length}`);
  console.log(`Other teams: ${otherTeams.length}\n`);
  
  // For each non-ESPN team, find its ESPN equivalent and migrate players
  for (const oldTeam of otherTeams) {
    // Find matching ESPN team
    let espnTeam = null;
    
    // Try exact name match first
    espnTeam = espnTeams.find(t => t.name === oldTeam.name);
    
    // If not found, try mapping
    if (!espnTeam && NBA_TEAM_MAPPING[oldTeam.name]) {
      const mappedName = NBA_TEAM_MAPPING[oldTeam.name];
      espnTeam = espnTeams.find(t => t.name === mappedName);
    }
    
    // If still not found, try partial match
    if (!espnTeam) {
      espnTeam = espnTeams.find(t => 
        t.name.includes(oldTeam.name) || 
        oldTeam.name.includes(t.name) ||
        t.abbreviation === oldTeam.abbreviation
      );
    }
    
    if (espnTeam) {
      console.log(chalk.cyan(`\nMigrating "${oldTeam.name}" (ID: ${oldTeam.id}) → "${espnTeam.name}" (ID: ${espnTeam.id})`));
      
      // Check how many players to migrate
      const { count: playerCount } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', oldTeam.id);
      
      if (playerCount && playerCount > 0) {
        console.log(chalk.yellow(`  Migrating ${playerCount} players...`));
        
        // Update players to point to ESPN team
        const { error: updateError } = await supabase
          .from('players')
          .update({ team_id: espnTeam.id })
          .eq('team_id', oldTeam.id);
        
        if (updateError) {
          console.error(chalk.red(`  Error updating players: ${updateError.message}`));
        } else {
          console.log(chalk.green(`  ✓ Migrated ${playerCount} players`));
        }
      } else {
        console.log(chalk.gray(`  No players to migrate`));
      }
      
      // Delete the old team
      console.log(chalk.yellow(`  Deleting duplicate team...`));
      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('id', oldTeam.id);
      
      if (deleteError) {
        console.error(chalk.red(`  Error deleting team: ${deleteError.message}`));
      } else {
        console.log(chalk.green(`  ✓ Deleted duplicate team`));
      }
    } else {
      console.log(chalk.red(`\n❌ No ESPN match found for "${oldTeam.name}" (ID: ${oldTeam.id})`));
    }
  }
  
  // Final count
  const { count: finalCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nba');
  
  console.log(chalk.bold.green(`\n✅ Cleanup complete! NBA teams: ${finalCount}`));
}

cleanupDuplicates().catch(console.error);
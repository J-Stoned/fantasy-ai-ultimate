#!/usr/bin/env tsx
/**
 * Update NCAA team external_ids with correct ESPN IDs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Common NCAA team name to ESPN ID mappings
const KNOWN_NCAA_TEAMS: Record<string, string> = {
  // Top teams
  'Duke Blue Devils': '150',
  'North Carolina Tar Heels': '153',
  'Kentucky Wildcats': '96',
  'Kansas Jayhawks': '2305',
  'UCLA Bruins': '26',
  'Gonzaga Bulldogs': '2250',
  'Michigan State Spartans': '127',
  'Arizona Wildcats': '12',
  'Louisville Cardinals': '97',
  'Indiana Hoosiers': '84',
  'Syracuse Orange': '183',
  'Villanova Wildcats': '222',
  'Connecticut Huskies': '41',
  'Michigan Wolverines': '130',
  'Florida Gators': '57',
  'Ohio State Buckeyes': '194',
  'Wisconsin Badgers': '275',
  'Maryland Terrapins': '120',
  'Purdue Boilermakers': '2509',
  'Texas Longhorns': '251',
  // Add more as needed
  'Alabama Crimson Tide': '333',
  'Auburn Tigers': '2',
  'Baylor Bears': '239',
  'Illinois Fighting Illini': '356',
  'Iowa Hawkeyes': '2294',
  'Oregon Ducks': '2483',
  'Tennessee Volunteers': '2633',
  'Virginia Cavaliers': '258',
  'Houston Cougars': '248',
  'Creighton Bluejays': '156'
};

async function updateNCAATeamESPNIds() {
  console.log(chalk.bold.blue('🏀 UPDATING NCAA TEAM ESPN IDS\n'));
  
  // Get all NCAA teams without external_id
  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .eq('sport_id', 'ncaab')
    .is('external_id', null)
    .order('name');
    
  if (error) {
    console.error('Error fetching teams:', error);
    return;
  }
  
  console.log(`Found ${teams?.length || 0} NCAA teams without external_id\n`);
  
  let updated = 0;
  let notFound = [];
  
  // First, try to update known teams
  for (const team of teams || []) {
    const espnId = KNOWN_NCAA_TEAMS[team.name];
    
    if (espnId) {
      const { error: updateError } = await supabase
        .from('teams')
        .update({ external_id: espnId })
        .eq('id', team.id);
        
      if (!updateError) {
        console.log(chalk.green(`✅ Updated ${team.name} with ESPN ID: ${espnId}`));
        updated++;
      } else {
        console.error(chalk.red(`Failed to update ${team.name}:`, updateError));
      }
    } else {
      notFound.push(team);
    }
  }
  
  console.log(chalk.yellow(`\n📊 Summary:`));
  console.log(`- Updated: ${updated} teams`);
  console.log(`- Not found in mapping: ${notFound.length} teams`);
  
  if (notFound.length > 0) {
    console.log(chalk.cyan('\nTeams still needing ESPN IDs:'));
    notFound.forEach(team => {
      console.log(`  - ${team.name}`);
    });
    
    console.log(chalk.yellow('\n💡 To find ESPN IDs for remaining teams:'));
    console.log('1. Go to https://www.espn.com/mens-college-basketball/teams');
    console.log('2. Click on a team');
    console.log('3. The URL will contain the team ID (e.g., /team/_/id/150/duke-blue-devils)');
    console.log('4. Add the mapping to KNOWN_NCAA_TEAMS above');
  }
  
  // Let's also try searching for some teams dynamically
  if (notFound.length > 0) {
    console.log(chalk.cyan('\nAttempting to fetch ESPN IDs for remaining teams...'));
    
    for (const team of notFound.slice(0, 5)) { // Try first 5
      try {
        // Search by trying different ID ranges
        for (let id = 1; id <= 500; id += 50) {
          const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${id}`;
          const response = await axios.get(url, { timeout: 2000 });
          
          if (response.data?.team) {
            const espnTeam = response.data.team;
            if (espnTeam.displayName === team.name || espnTeam.name === team.name) {
              console.log(chalk.green(`🎯 Found ${team.name} = ESPN ID ${id}`));
              
              const { error: updateError } = await supabase
                .from('teams')
                .update({ external_id: String(id) })
                .eq('id', team.id);
                
              if (!updateError) {
                updated++;
              }
              break;
            }
          }
        }
      } catch (e) {
        // Continue searching
      }
    }
  }
  
  console.log(chalk.bold.green(`\n✅ Total updated: ${updated} teams`));
}

updateNCAATeamESPNIds();
#!/usr/bin/env tsx
/**
 * 🏒 NHL TEAMS COLLECTOR - All 32 teams
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.bold.cyan('🏒 NHL TEAMS COLLECTOR\n'));

// All 32 NHL teams with ESPN IDs
const NHL_TEAMS = [
  // Atlantic Division
  { name: 'Boston Bruins', abbreviation: 'BOS', espn_id: 1, conference: 'Eastern', division: 'Atlantic' },
  { name: 'Buffalo Sabres', abbreviation: 'BUF', espn_id: 2, conference: 'Eastern', division: 'Atlantic' },
  { name: 'Detroit Red Wings', abbreviation: 'DET', espn_id: 3, conference: 'Eastern', division: 'Atlantic' },
  { name: 'Florida Panthers', abbreviation: 'FLA', espn_id: 4, conference: 'Eastern', division: 'Atlantic' },
  { name: 'Montreal Canadiens', abbreviation: 'MTL', espn_id: 5, conference: 'Eastern', division: 'Atlantic' },
  { name: 'Ottawa Senators', abbreviation: 'OTT', espn_id: 6, conference: 'Eastern', division: 'Atlantic' },
  { name: 'Tampa Bay Lightning', abbreviation: 'TB', espn_id: 7, conference: 'Eastern', division: 'Atlantic' },
  { name: 'Toronto Maple Leafs', abbreviation: 'TOR', espn_id: 8, conference: 'Eastern', division: 'Atlantic' },
  
  // Metropolitan Division
  { name: 'Carolina Hurricanes', abbreviation: 'CAR', espn_id: 9, conference: 'Eastern', division: 'Metropolitan' },
  { name: 'Columbus Blue Jackets', abbreviation: 'CBJ', espn_id: 10, conference: 'Eastern', division: 'Metropolitan' },
  { name: 'New Jersey Devils', abbreviation: 'NJ', espn_id: 11, conference: 'Eastern', division: 'Metropolitan' },
  { name: 'New York Islanders', abbreviation: 'NYI', espn_id: 12, conference: 'Eastern', division: 'Metropolitan' },
  { name: 'New York Rangers', abbreviation: 'NYR', espn_id: 13, conference: 'Eastern', division: 'Metropolitan' },
  { name: 'Philadelphia Flyers', abbreviation: 'PHI', espn_id: 14, conference: 'Eastern', division: 'Metropolitan' },
  { name: 'Pittsburgh Penguins', abbreviation: 'PIT', espn_id: 15, conference: 'Eastern', division: 'Metropolitan' },
  { name: 'Washington Capitals', abbreviation: 'WSH', espn_id: 16, conference: 'Eastern', division: 'Metropolitan' },
  
  // Central Division
  { name: 'Arizona Coyotes', abbreviation: 'ARI', espn_id: 17, conference: 'Western', division: 'Central' },
  { name: 'Chicago Blackhawks', abbreviation: 'CHI', espn_id: 18, conference: 'Western', division: 'Central' },
  { name: 'Colorado Avalanche', abbreviation: 'COL', espn_id: 19, conference: 'Western', division: 'Central' },
  { name: 'Dallas Stars', abbreviation: 'DAL', espn_id: 20, conference: 'Western', division: 'Central' },
  { name: 'Minnesota Wild', abbreviation: 'MIN', espn_id: 21, conference: 'Western', division: 'Central' },
  { name: 'Nashville Predators', abbreviation: 'NSH', espn_id: 22, conference: 'Western', division: 'Central' },
  { name: 'St. Louis Blues', abbreviation: 'STL', espn_id: 23, conference: 'Western', division: 'Central' },
  { name: 'Winnipeg Jets', abbreviation: 'WPG', espn_id: 24, conference: 'Western', division: 'Central' },
  
  // Pacific Division
  { name: 'Anaheim Ducks', abbreviation: 'ANA', espn_id: 25, conference: 'Western', division: 'Pacific' },
  { name: 'Calgary Flames', abbreviation: 'CGY', espn_id: 26, conference: 'Western', division: 'Pacific' },
  { name: 'Edmonton Oilers', abbreviation: 'EDM', espn_id: 27, conference: 'Western', division: 'Pacific' },
  { name: 'Los Angeles Kings', abbreviation: 'LA', espn_id: 28, conference: 'Western', division: 'Pacific' },
  { name: 'San Jose Sharks', abbreviation: 'SJ', espn_id: 29, conference: 'Western', division: 'Pacific' },
  { name: 'Seattle Kraken', abbreviation: 'SEA', espn_id: 30, conference: 'Western', division: 'Pacific' },
  { name: 'Vancouver Canucks', abbreviation: 'VAN', espn_id: 31, conference: 'Western', division: 'Pacific' },
  { name: 'Vegas Golden Knights', abbreviation: 'VGK', espn_id: 32, conference: 'Western', division: 'Pacific' }
];

async function collectNHLTeams() {
  console.log('📊 Preparing to insert all 32 NHL teams...\n');
  
  // Check existing teams
  const { data: existingTeams } = await supabase
    .from('teams')
    .select('name, external_id')
    .or('sport_id.eq.nhl,sport_id.eq.NHL');
  
  console.log(`Found ${existingTeams?.length || 0} existing NHL teams`);
  
  // Create teams to insert
  const teamsToInsert = NHL_TEAMS.map(team => ({
    name: team.name,
    abbreviation: team.abbreviation,
    sport_id: 'nhl',
    external_id: `espn_nhl_${team.espn_id}`,
    metadata: {
      conference: team.conference,
      division: team.division,
      espn_id: team.espn_id
    }
  }));
  
  // Insert teams
  const { data, error } = await supabase
    .from('teams')
    .upsert(teamsToInsert, { 
      onConflict: 'name,sport_id',
      ignoreDuplicates: false 
    })
    .select();
  
  if (error) {
    console.error('❌ Error inserting teams:', error.message);
  } else {
    console.log(`✅ Successfully upserted ${data.length} NHL teams`);
  }
  
  // Verify final count
  const { count } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .or('sport_id.eq.nhl,sport_id.eq.NHL');
  
  console.log(`\n📈 Total NHL teams in database: ${count}/32`);
  
  if (count === 32) {
    console.log('\n✅ All 32 NHL teams are now in the database!');
    console.log('🎯 Ready to collect NHL games!');
  }
}

collectNHLTeams().catch(console.error);
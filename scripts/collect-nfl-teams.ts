#!/usr/bin/env tsx
/**
 * 🏈 NFL TEAMS COLLECTOR - All 32 teams
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.bold.green('🏈 NFL TEAMS COLLECTOR\n'));

// All 32 NFL teams with ESPN IDs
const NFL_TEAMS = [
  // AFC East
  { name: 'Buffalo Bills', abbreviation: 'BUF', espn_id: 2, conference: 'AFC', division: 'East' },
  { name: 'Miami Dolphins', abbreviation: 'MIA', espn_id: 15, conference: 'AFC', division: 'East' },
  { name: 'New England Patriots', abbreviation: 'NE', espn_id: 17, conference: 'AFC', division: 'East' },
  { name: 'New York Jets', abbreviation: 'NYJ', espn_id: 20, conference: 'AFC', division: 'East' },
  
  // AFC North
  { name: 'Baltimore Ravens', abbreviation: 'BAL', espn_id: 33, conference: 'AFC', division: 'North' },
  { name: 'Cincinnati Bengals', abbreviation: 'CIN', espn_id: 4, conference: 'AFC', division: 'North' },
  { name: 'Cleveland Browns', abbreviation: 'CLE', espn_id: 5, conference: 'AFC', division: 'North' },
  { name: 'Pittsburgh Steelers', abbreviation: 'PIT', espn_id: 23, conference: 'AFC', division: 'North' },
  
  // AFC South
  { name: 'Houston Texans', abbreviation: 'HOU', espn_id: 34, conference: 'AFC', division: 'South' },
  { name: 'Indianapolis Colts', abbreviation: 'IND', espn_id: 11, conference: 'AFC', division: 'South' },
  { name: 'Jacksonville Jaguars', abbreviation: 'JAX', espn_id: 30, conference: 'AFC', division: 'South' },
  { name: 'Tennessee Titans', abbreviation: 'TEN', espn_id: 10, conference: 'AFC', division: 'South' },
  
  // AFC West
  { name: 'Denver Broncos', abbreviation: 'DEN', espn_id: 7, conference: 'AFC', division: 'West' },
  { name: 'Kansas City Chiefs', abbreviation: 'KC', espn_id: 12, conference: 'AFC', division: 'West' },
  { name: 'Las Vegas Raiders', abbreviation: 'LV', espn_id: 13, conference: 'AFC', division: 'West' },
  { name: 'Los Angeles Chargers', abbreviation: 'LAC', espn_id: 24, conference: 'AFC', division: 'West' },
  
  // NFC East
  { name: 'Dallas Cowboys', abbreviation: 'DAL', espn_id: 6, conference: 'NFC', division: 'East' },
  { name: 'New York Giants', abbreviation: 'NYG', espn_id: 19, conference: 'NFC', division: 'East' },
  { name: 'Philadelphia Eagles', abbreviation: 'PHI', espn_id: 21, conference: 'NFC', division: 'East' },
  { name: 'Washington Commanders', abbreviation: 'WAS', espn_id: 28, conference: 'NFC', division: 'East' },
  
  // NFC North
  { name: 'Chicago Bears', abbreviation: 'CHI', espn_id: 3, conference: 'NFC', division: 'North' },
  { name: 'Detroit Lions', abbreviation: 'DET', espn_id: 8, conference: 'NFC', division: 'North' },
  { name: 'Green Bay Packers', abbreviation: 'GB', espn_id: 9, conference: 'NFC', division: 'North' },
  { name: 'Minnesota Vikings', abbreviation: 'MIN', espn_id: 16, conference: 'NFC', division: 'North' },
  
  // NFC South
  { name: 'Atlanta Falcons', abbreviation: 'ATL', espn_id: 1, conference: 'NFC', division: 'South' },
  { name: 'Carolina Panthers', abbreviation: 'CAR', espn_id: 29, conference: 'NFC', division: 'South' },
  { name: 'New Orleans Saints', abbreviation: 'NO', espn_id: 18, conference: 'NFC', division: 'South' },
  { name: 'Tampa Bay Buccaneers', abbreviation: 'TB', espn_id: 27, conference: 'NFC', division: 'South' },
  
  // NFC West
  { name: 'Arizona Cardinals', abbreviation: 'ARI', espn_id: 22, conference: 'NFC', division: 'West' },
  { name: 'Los Angeles Rams', abbreviation: 'LAR', espn_id: 14, conference: 'NFC', division: 'West' },
  { name: 'San Francisco 49ers', abbreviation: 'SF', espn_id: 25, conference: 'NFC', division: 'West' },
  { name: 'Seattle Seahawks', abbreviation: 'SEA', espn_id: 26, conference: 'NFC', division: 'West' }
];

async function collectNFLTeams() {
  console.log('📊 Preparing to insert all 32 NFL teams...\n');
  
  // Check existing teams
  const { data: existingTeams } = await supabase
    .from('teams')
    .select('name, external_id')
    .or('sport_id.eq.nfl,sport_id.eq.NFL');
  
  console.log(`Found ${existingTeams?.length || 0} existing NFL teams`);
  
  // Create teams to insert
  const teamsToInsert = NFL_TEAMS.map(team => ({
    name: team.name,
    abbreviation: team.abbreviation,
    sport_id: 'nfl',
    external_id: `espn_nfl_${team.espn_id}`,
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
    console.log(`✅ Successfully upserted ${data.length} NFL teams`);
  }
  
  // Verify final count
  const { count } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .or('sport_id.eq.nfl,sport_id.eq.NFL');
  
  console.log(`\n📈 Total NFL teams in database: ${count}/32`);
  
  if (count === 32) {
    console.log('\n✅ All 32 NFL teams are now in the database!');
    console.log('🎯 Re-run the NFL games collector to get all 572 games!');
  }
}

collectNFLTeams().catch(console.error);
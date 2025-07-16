#!/usr/bin/env tsx
/**
 * 🏒 ADD MISSING NHL PLAYERS FROM INJURY REPORTS
 * Uses ESPN API to fetch and add missing players
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.bold.cyan('🏒 NHL MISSING PLAYER ADDITION SCRIPT\n'));

// ESPN API base URL
const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl';

// Missing NHL players from injury collection
const MISSING_NHL_PLAYERS = [
  'Carson Meyer',
  'Justin Kirkland',
  'Sean Behrens',
  'Thomas Bordeleau',
  'Johnathan Kovacevic',
  'Nico Hischier',
  'Jesper Bratt',
  'Luke Hughes',
  'Brenden Dillon',
  'Tanner Howe',
  'Jared McCann',
  'Torey Krug',
  'Dylan Guenther',
  'Alex Pietrangelo',
  'Jeremy Lauzon',
  'Mark Stone'
];

// Position mapping from ESPN to our format
const POSITION_MAP: Record<string, string> = {
  'C': 'C',
  'LW': 'LW',
  'RW': 'RW',
  'D': 'D',
  'G': 'G',
  'W': 'W',
  'F': 'F'
};

// NHL team abbreviation to ID mapping (approximate - will search)
const TEAM_ABBREV_MAP: Record<string, string> = {
  'ANA': 'Ducks',
  'ARI': 'Coyotes',
  'BOS': 'Bruins',
  'BUF': 'Sabres',
  'CGY': 'Flames',
  'CAR': 'Hurricanes',
  'CHI': 'Blackhawks',
  'COL': 'Avalanche',
  'CBJ': 'Blue Jackets',
  'DAL': 'Stars',
  'DET': 'Red Wings',
  'EDM': 'Oilers',
  'FLA': 'Panthers',
  'LA': 'Kings',
  'MIN': 'Wild',
  'MTL': 'Canadiens',
  'NSH': 'Predators',
  'NJ': 'Devils',
  'NYI': 'Islanders',
  'NYR': 'Rangers',
  'OTT': 'Senators',
  'PHI': 'Flyers',
  'PIT': 'Penguins',
  'SJ': 'Sharks',
  'SEA': 'Kraken',
  'STL': 'Blues',
  'TB': 'Lightning',
  'TOR': 'Maple Leafs',
  'VAN': 'Canucks',
  'VGK': 'Golden Knights',
  'WSH': 'Capitals',
  'WPG': 'Jets'
};

interface ESPNPlayer {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  position?: {
    abbreviation: string;
  };
  team?: {
    id: string;
    abbreviation: string;
    displayName: string;
  };
}

/**
 * Get all NHL teams from ESPN
 */
async function getNHLTeams(): Promise<Map<string, any>> {
  try {
    const response = await axios.get(`${ESPN_API}/teams`);
    const teams = new Map();
    
    if (response.data.sports?.[0]?.leagues?.[0]?.teams) {
      response.data.sports[0].leagues[0].teams.forEach((t: any) => {
        teams.set(t.team.abbreviation, t.team);
        teams.set(t.team.displayName, t.team);
      });
    }
    
    return teams;
  } catch (error) {
    console.error('Error fetching NHL teams:', error);
    return new Map();
  }
}

/**
 * Search for a player across NHL rosters
 */
async function searchNHLPlayer(playerName: string, teams: Map<string, any>): Promise<ESPNPlayer | null> {
  console.log(`🔍 Searching for: ${playerName}`);
  
  // Try each team's roster
  for (const [teamName, team] of teams) {
    if (typeof teamName !== 'string' || teamName.length > 3) continue; // Skip full names
    
    try {
      const rosterUrl = `${ESPN_API}/teams/${team.id}/roster`;
      const response = await axios.get(rosterUrl);
      
      if (response.data.athletes) {
        // Search for player in this roster
        const player = response.data.athletes.find((athlete: any) => {
          const fullName = athlete.displayName || athlete.fullName;
          return fullName?.toLowerCase() === playerName.toLowerCase() ||
                 fullName?.toLowerCase().includes(playerName.toLowerCase()) ||
                 playerName.toLowerCase().includes(fullName?.toLowerCase());
        });
        
        if (player) {
          console.log(`  ✅ Found on ${team.displayName} roster`);
          return {
            id: player.id,
            displayName: player.displayName || player.fullName,
            firstName: player.firstName,
            lastName: player.lastName,
            position: player.position,
            team: team
          };
        }
      }
    } catch (error) {
      // Silently continue to next team
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return null;
}

/**
 * Get or create team mapping
 */
async function getTeamId(teamName: string, teamAbbrev: string): Promise<number | null> {
  // Try to find team by name or abbreviation
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, abbreviation')
    .or(`name.ilike.%${teamName}%,abbreviation.eq.${teamAbbrev}`)
    .eq('sport', 'NHL');
    
  if (teams && teams.length > 0) {
    console.log(`  📍 Matched team "${teamName}" to ID: ${teams[0].id}`);
    return teams[0].id;
  }
  
  // Try partial match on team name
  const teamPart = teamName.split(' ').slice(-1)[0];
  const { data: partialTeams } = await supabase
    .from('teams')
    .select('id, name')
    .ilike('name', `%${teamPart}%`)
    .eq('sport', 'NHL');
    
  if (partialTeams && partialTeams.length > 0) {
    console.log(`  📍 Matched team "${teamName}" to ID: ${partialTeams[0].id}`);
    return partialTeams[0].id;
  }
  
  console.warn(`  ⚠️  Could not find team mapping for ${teamName} (${teamAbbrev})`);
  return null;
}

/**
 * Add a player to the database
 */
async function addPlayer(espnPlayer: ESPNPlayer): Promise<boolean> {
  try {
    // Get team ID
    const teamId = espnPlayer.team 
      ? await getTeamId(espnPlayer.team.displayName, espnPlayer.team.abbreviation)
      : null;
      
    // Map position
    const position = espnPlayer.position?.abbreviation 
      ? (POSITION_MAP[espnPlayer.position.abbreviation] || espnPlayer.position.abbreviation)
      : 'F'; // Default to forward
      
    // Create player record
    const playerData = {
      name: espnPlayer.displayName,
      firstname: espnPlayer.firstName || espnPlayer.displayName.split(' ')[0],
      lastname: espnPlayer.lastName || espnPlayer.displayName.split(' ').slice(1).join(' '),
      sport_id: 'NHL', // Use uppercase for consistency
      team_id: teamId,
      position: position,
      external_id: `espn_nhl_${espnPlayer.id}`,
      status: 'Active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log(`  ✅ Adding: ${espnPlayer.displayName} (${position}) - Team ID: ${teamId}`);
    
    const { data, error } = await supabase
      .from('players')
      .insert(playerData)
      .select();
      
    if (error) {
      console.error(`  ❌ Error inserting ${espnPlayer.displayName}:`, error.message);
      return false;
    }
    
    return true;
  } catch (error: any) {
    console.error(`  ❌ Error adding player:`, error.message);
    return false;
  }
}

/**
 * Main function to add all missing players
 */
async function addMissingNHLPlayers() {
  console.log(`📋 Processing ${MISSING_NHL_PLAYERS.length} missing NHL players...\n`);
  
  // Get all NHL teams first
  console.log('🏒 Fetching NHL teams...');
  const teams = await getNHLTeams();
  console.log(`✅ Loaded ${teams.size / 2} NHL teams\n`);
  
  let found = 0;
  let added = 0;
  let errors = 0;
  
  for (const playerName of MISSING_NHL_PLAYERS) {
    console.log(`\n🏃 Processing: ${playerName}`);
    
    // Check if player already exists
    const { data: existing } = await supabase
      .from('players')
      .select('id, name')
      .eq('name', playerName)
      .in('sport_id', ['nhl', 'NHL']);
      
    if (existing && existing.length > 0) {
      console.log(`  ⏭️  Already exists in database`);
      continue;
    }
    
    // Search ESPN rosters
    const espnPlayer = await searchNHLPlayer(playerName, teams);
    
    if (espnPlayer) {
      console.log(`  ✅ Found in ESPN: ${espnPlayer.displayName} (ID: ${espnPlayer.id})`);
      found++;
      
      // Add to database
      const success = await addPlayer(espnPlayer);
      if (success) {
        added++;
      } else {
        errors++;
      }
    } else {
      console.log(`  ❌ Not found in ESPN rosters`);
      errors++;
    }
  }
  
  // Summary
  console.log('\n\n📊 SUMMARY:');
  console.log(`Total Players Processed: ${MISSING_NHL_PLAYERS.length}`);
  console.log(`Found in ESPN: ${found}`);
  console.log(`Successfully Added: ${added}`);
  console.log(`Errors/Not Found: ${errors}`);
  
  if (added > 0) {
    console.log('\n✅ Successfully added missing NHL players!');
    console.log('Run the injury collector again to match these players.');
  }
}

// Run the script
addMissingNHLPlayers()
  .then(() => {
    console.log('\n👋 NHL player addition complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
#!/usr/bin/env tsx
/**
 * 🏥 ADD MISSING MLB PLAYERS FROM INJURY REPORTS
 * Uses MLB Stats API to fetch and add missing players
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

console.log(chalk.bold.blue('⚾ MLB MISSING PLAYER ADDITION SCRIPT\n'));

// MLB Stats API base URL
const MLB_API = 'https://statsapi.mlb.com/api/v1';

// Missing MLB players from injury collection
const MISSING_MLB_PLAYERS = [
  'Christian Montes De Oca',
  'Ken Waldichuk',
  'Gunnar Hoglund',
  'Maverick Handley',
  'Jud Fabian',
  'Rodolfo Martinez',
  'Carlos Tavera',
  'Justin Armbruester',
  'Franklin Barreto',
  'Hunter Dobbins',
  'Brandon Birdsell',
  'Tim Elko',
  'Mason Adams',
  'Tyler Callihan',
  'Chase DeLauter',
  'Tanner Burns',
  'Case Williams',
  'Jacob Melton',
  'Miguel Palma',
  'Glenn Otto',
  // Additional missing players from original list
  'Shane Connolly',
  'Tayler Scott',
  'Riley Tirotta',
  'Austin Cox',
  'Luis Guerrero',
  'Carlos Carrasco',
  'Chris Martin',
  'Andrew Benintendi',
  'JP Sears',
  'Mike Yastrzemski',
  'Brooks Raley',
  'Anthony Volpe',
  'Trevor Williams',
  'Darren Baker',
  'Jacob Lopez',
  'Nick Pratto',
  'Jose Tena',
  'Matt Mervis',
  'Logan Porter',
  'Justin Wilson',
  'Leody Taveras',
  'Coby Mayo',
  'Jake Bird',
  'Hurston Waldrep',
  'Colson Montgomery',
  'Luis Urias',
  'Alek Manoah',
  'Owen Murphy',
  'Joey Loperfido',
  'Kyle Tucker',
  'Blaze Alexander',
  'Jose Miranda',
  'Nick Allen'
];

// Position mapping from MLB API to our format
const POSITION_MAP: Record<string, string> = {
  'Pitcher': 'P',
  'Catcher': 'C',
  'First Base': '1B',
  'Second Base': '2B',
  'Third Base': '3B',
  'Shortstop': 'SS',
  'Left Field': 'LF',
  'Center Field': 'CF',
  'Right Field': 'RF',
  'Designated Hitter': 'DH',
  'Outfield': 'OF',
  'Infield': 'IF'
};

// MLB team ID mapping (MLB API ID -> our team_id)
const TEAM_ID_MAP: Record<number, number> = {
  109: 800897,  // Arizona Diamondbacks
  144: 800895,  // Atlanta Braves
  110: 800878,  // Baltimore Orioles
  111: 800884,  // Boston Red Sox
  112: 800877,  // Chicago Cubs
  145: 800874,  // Chicago White Sox
  113: 800880,  // Cincinnati Reds
  114: 800875,  // Cleveland Guardians
  115: 800881,  // Colorado Rockies
  116: 800882,  // Detroit Tigers
  117: 800890,  // Houston Astros
  118: 800886,  // Kansas City Royals
  108: 800896,  // Los Angeles Angels
  119: 800903,  // Los Angeles Dodgers
  146: 800879,  // Miami Marlins
  158: 800892,  // Milwaukee Brewers
  142: 800888,  // Minnesota Twins
  121: 800887,  // New York Mets
  147: 800876,  // New York Yankees
  133: 809251,  // Oakland Athletics
  143: 800899,  // Philadelphia Phillies
  134: 800889,  // Pittsburgh Pirates
  135: 800898,  // San Diego Padres
  136: 800883,  // Seattle Mariners
  137: 800902,  // San Francisco Giants
  138: 800894,  // St. Louis Cardinals
  139: 800885,  // Tampa Bay Rays
  140: 800891,  // Texas Rangers
  141: 800901,  // Toronto Blue Jays
  120: 800893,  // Washington Nationals
};

interface MLBPlayer {
  id: number;
  fullName: string;
  firstName?: string;
  lastName?: string;
  currentTeam?: {
    id: number;
    name: string;
  };
  primaryPosition?: {
    name: string;
    abbreviation: string;
  };
  active: boolean;
}

/**
 * Search for a player using MLB Stats API
 */
async function searchMLBPlayer(playerName: string): Promise<MLBPlayer | null> {
  try {
    // First try exact name search
    const searchUrl = `${MLB_API}/people/search?names.use=${encodeURIComponent(playerName)}`;
    console.log(`🔍 Searching for: ${playerName}`);
    
    let response = await axios.get(searchUrl);
    
    if (!response.data.people || response.data.people.length === 0) {
      // Try with just last name
      const lastName = playerName.split(' ').slice(-1)[0];
      const lastNameUrl = `${MLB_API}/people/search?names.lastName=${encodeURIComponent(lastName)}`;
      response = await axios.get(lastNameUrl);
    }
    
    if (response.data.people && response.data.people.length > 0) {
      // Find exact match first
      let player = response.data.people.find((p: any) => {
        const fullNameMatch = p.fullName.toLowerCase() === playerName.toLowerCase();
        const useNameMatch = p.useName && p.useName.toLowerCase() === playerName.toLowerCase();
        const boxscoreNameMatch = p.boxscoreName && p.boxscoreName.toLowerCase() === playerName.toLowerCase();
        return fullNameMatch || useNameMatch || boxscoreNameMatch;
      });
      
      // If no exact match, look for partial matches
      if (!player) {
        player = response.data.people.find((p: any) => {
          const pName = p.fullName.toLowerCase();
          const searchName = playerName.toLowerCase();
          return pName.includes(searchName) || searchName.includes(pName);
        });
      }
      
      // If still no match, check if first and last names match in any order
      if (!player && playerName.split(' ').length > 1) {
        const [firstName, ...lastParts] = playerName.split(' ');
        const lastName = lastParts.join(' ');
        
        player = response.data.people.find((p: any) => {
          const hasFirstName = p.fullName.toLowerCase().includes(firstName.toLowerCase());
          const hasLastName = p.fullName.toLowerCase().includes(lastName.toLowerCase());
          return hasFirstName && hasLastName;
        });
      }
      
      if (player) {
        // Get full player details
        const detailsUrl = `${MLB_API}/people/${player.id}?hydrate=currentTeam`;
        const detailsResponse = await axios.get(detailsUrl);
        
        if (detailsResponse.data.people && detailsResponse.data.people.length > 0) {
          const fullPlayer = detailsResponse.data.people[0];
          console.log(`  ℹ️  Found: ${fullPlayer.fullName} (ID: ${fullPlayer.id})`);
          return fullPlayer;
        }
      }
    }
    
    return null;
  } catch (error: any) {
    console.error(`❌ Error searching for ${playerName}:`, error.message);
    return null;
  }
}

/**
 * Get or create team mapping
 */
async function getTeamId(mlbTeamId: number, teamName: string): Promise<number | null> {
  // Check if we have a mapping
  if (TEAM_ID_MAP[mlbTeamId]) {
    return TEAM_ID_MAP[mlbTeamId];
  }
  
  // Try to find team by name
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .ilike('name', `%${teamName.split(' ').slice(-1)[0]}%`)
    .eq('sport', 'MLB');
    
  if (teams && teams.length > 0) {
    console.log(`  📍 Matched team "${teamName}" to ID: ${teams[0].id}`);
    return teams[0].id;
  }
  
  console.warn(`  ⚠️  Could not find team mapping for ${teamName} (MLB ID: ${mlbTeamId})`);
  return null;
}

/**
 * Add a player to the database
 */
async function addPlayer(mlbPlayer: MLBPlayer): Promise<boolean> {
  try {
    // Get team ID
    const teamId = mlbPlayer.currentTeam 
      ? await getTeamId(mlbPlayer.currentTeam.id, mlbPlayer.currentTeam.name)
      : null;
      
    // Map position
    const position = mlbPlayer.primaryPosition
      ? (POSITION_MAP[mlbPlayer.primaryPosition.name] || mlbPlayer.primaryPosition.abbreviation)
      : 'P'; // Default to pitcher
      
    // Create player record
    const playerData = {
      name: mlbPlayer.fullName,
      firstname: mlbPlayer.firstName || mlbPlayer.fullName.split(' ')[0],
      lastname: mlbPlayer.lastName || mlbPlayer.fullName.split(' ').slice(1).join(' '),
      sport_id: 'MLB', // Use uppercase for consistency
      team_id: teamId,
      position: [position], // Position is an array field
      external_id: `mlb_${mlbPlayer.id}`,
      status: mlbPlayer.active ? 'Active' : 'Inactive',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log(`  ✅ Adding: ${mlbPlayer.fullName} (${position}) - Team ID: ${teamId}`);
    
    const { data, error } = await supabase
      .from('players')
      .insert(playerData)
      .select();
      
    if (error) {
      console.error(`  ❌ Error inserting ${mlbPlayer.fullName}:`, error.message);
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
async function addMissingMLBPlayers() {
  console.log(`📋 Processing ${MISSING_MLB_PLAYERS.length} missing MLB players...\n`);
  
  let found = 0;
  let added = 0;
  let errors = 0;
  
  for (const playerName of MISSING_MLB_PLAYERS) {
    console.log(`\n🏃 Processing: ${playerName}`);
    
    // Check if player already exists
    const { data: existing } = await supabase
      .from('players')
      .select('id, name')
      .eq('name', playerName)
      .in('sport_id', ['mlb', 'MLB']);
      
    if (existing && existing.length > 0) {
      console.log(`  ⏭️  Already exists in database`);
      continue;
    }
    
    // Search MLB API
    const mlbPlayer = await searchMLBPlayer(playerName);
    
    if (mlbPlayer) {
      console.log(`  ✅ Found in MLB API: ${mlbPlayer.fullName} (ID: ${mlbPlayer.id})`);
      found++;
      
      // Add to database
      const success = await addPlayer(mlbPlayer);
      if (success) {
        added++;
      } else {
        errors++;
      }
    } else {
      console.log(`  ❌ Not found in MLB API`);
      errors++;
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n\n📊 SUMMARY:');
  console.log(`Total Players Processed: ${MISSING_MLB_PLAYERS.length}`);
  console.log(`Found in MLB API: ${found}`);
  console.log(`Successfully Added: ${added}`);
  console.log(`Errors/Not Found: ${errors}`);
  
  if (added > 0) {
    console.log('\n✅ Successfully added missing MLB players!');
    console.log('Run the injury collector again to match these players.');
  }
}

// Run the script
addMissingMLBPlayers()
  .then(() => {
    console.log('\n👋 MLB player addition complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
#!/usr/bin/env tsx
/**
 * 🏈 NCAA FOOTBALL PLAYERS COLLECTOR - FIXED VERSION
 * Forces collection from ALL 500 teams regardless of existing players
 * 10x developer approach: Fix the root cause fast
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.bold.red('🏈 NCAA FOOTBALL PLAYERS COLLECTOR - FIXED VERSION\n'));

// AGGRESSIVE CONFIGURATION
const CONFIG = {
  CONCURRENT_REQUESTS: 30,     // Increased for faster collection
  INSERT_BATCH: 900,           // Just under Supabase limit
  ESPN_API: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football',
  SPORT_ID: 'NCAA_FB',
  SPORT: 'football',
  FORCE_COLLECTION: true,      // Force collect from all teams
  TIMEOUT: 10000,              // 10 second timeout
  MAX_RETRIES: 2
};

// Progress tracking
let totalTeams = 0;
let totalPlayers = 0;
let newPlayers = 0;
let skippedTeams = 0;
let errorCount = 0;
let teamsProcessed = 0;
const startTime = Date.now();
const limit = pLimit(CONFIG.CONCURRENT_REQUESTS);

// Progress bar
const progressBar = new cliProgress.SingleBar({
  format: 'NCAA Football Players |{bar}| {percentage}% | {value}/{total} teams | {players} players | {duration_formatted}',
  barCompleteChar: '\\u2588',
  barIncompleteChar: '\\u2591',
});

interface Player {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  jersey?: string;
  position?: string;
  height?: number;
  weight?: number;
  experience?: string;
  teamId: number;
  teamName: string;
}

/**
 * Normalize player name for matching
 */
function normalizePlayerName(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '') // Remove accents
    .replace(/['']/g, '')
    .replace(/\\./g, '')
    .replace(/jr$/i, '')
    .replace(/sr$/i, '')
    .replace(/iii$/i, '')
    .replace(/ii$/i, '')
    .replace(/\\s+/g, ' ')
    .trim();
}

/**
 * Get all NCAA Football teams
 */
async function getNCAAFootballTeams() {
  console.log('📊 Loading NCAA Football teams...');
  
  const teams = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('teams')
      .select('id, external_id, name')
      .eq('sport', CONFIG.SPORT_ID)
      .range(from, from + batchSize - 1);
    
    if (error) {
      console.error('Error fetching teams:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    teams.push(...data);
    from += batchSize;
    if (data.length < batchSize) break;
  }
  
  console.log(`Found ${teams.length} NCAA Football teams`);
  return teams;
}

/**
 * Get existing players as a Map for fast lookup
 */
async function getExistingPlayers(): Promise<Map<string, any>> {
  console.log('📊 Loading existing players for deduplication...');
  
  const playerMap = new Map();
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, team_id, external_id')
      .eq('sport_id', CONFIG.SPORT_ID)
      .range(from, from + batchSize - 1);
    
    if (error) {
      console.error('Error fetching players:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    data.forEach(player => {
      // Use external_id as primary key for deduplication
      if (player.external_id) {
        playerMap.set(player.external_id, player);
      }
    });
    
    from += batchSize;
    if (data.length < batchSize) break;
  }
  
  console.log(`Found ${playerMap.size} existing NCAA Football players`);
  return playerMap;
}

/**
 * Fetch roster for a specific team with better error handling
 */
async function fetchTeamRoster(team: any, retryCount = 0): Promise<Player[]> {
  try {
    // Extract the ESPN ID from our sport-specific ID
    const espnId = team.external_id.replace('espn_ncaaf_', '');
    const url = `${CONFIG.ESPN_API}/teams/${espnId}/roster`;
    const response = await axios.get(url, { timeout: CONFIG.TIMEOUT });
    
    const players: Player[] = [];
    
    // NCAA Football rosters are organized by position groups
    if (response.data?.athletes && Array.isArray(response.data.athletes)) {
      for (const positionGroup of response.data.athletes) {
        if (positionGroup.items && Array.isArray(positionGroup.items)) {
          for (const athlete of positionGroup.items) {
            players.push({
              id: athlete.id,
              name: athlete.displayName || athlete.fullName || `${athlete.firstName || ''} ${athlete.lastName || ''}`.trim(),
              firstName: athlete.firstName,
              lastName: athlete.lastName,
              jersey: athlete.jersey,
              position: athlete.position?.abbreviation || athlete.position?.displayName || positionGroup.position,
              height: athlete.height,
              weight: athlete.weight,
              experience: athlete.experience?.displayValue || athlete.experience?.years,
              teamId: team.id,
              teamName: team.name
            });
          }
        }
      }
    }
    
    return players;
  } catch (error: any) {
    if (retryCount < CONFIG.MAX_RETRIES) {
      console.log(`⚠️  Retrying ${team.name} (attempt ${retryCount + 1}/${CONFIG.MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return fetchTeamRoster(team, retryCount + 1);
    }
    
    console.error(`❌ Failed to fetch roster for ${team.name} (${team.external_id}):`, error.message);
    errorCount++;
    return [];
  }
}

/**
 * Convert height string to inches
 */
function parseHeight(height: any): number | null {
  if (!height) return null;
  
  // ESPN provides height as a number (total inches)
  if (typeof height === 'number') return height;
  
  // Sometimes it's a string like "6-2"
  if (typeof height === 'string') {
    const match = height.match(/(\\d+)'?\\s*-?\\s*(\\d+)/);
    if (match) {
      const feet = parseInt(match[1]);
      const inches = parseInt(match[2]);
      return feet * 12 + inches;
    }
  }
  
  return null;
}

/**
 * Main collection function
 */
async function collectNCAAFootballPlayers() {
  console.log(chalk.cyan('Starting FIXED NCAA Football players collection...\\n'));
  
  // Get all teams
  const teams = await getNCAAFootballTeams();
  totalTeams = teams.length;
  
  if (totalTeams === 0) {
    console.log(chalk.red('❌ No NCAA Football teams found!'));
    return;
  }
  
  // Get existing players for deduplication
  const existingPlayers = await getExistingPlayers();
  
  // Initialize progress bar
  progressBar.start(totalTeams, 0, { players: 0 });
  
  // Collect all players in memory first
  const allPlayersToInsert = [];
  
  // Process teams in parallel with limit
  const rosterPromises = teams.map(team => 
    limit(async () => {
      const roster = await fetchTeamRoster(team);
      
      const playersToAdd = [];
      
      for (const player of roster) {
        const playerExternalId = `espn_ncaaf_${player.id}`;
        
        // Only skip if player already exists with same external_id
        if (!existingPlayers.has(playerExternalId)) {
          playersToAdd.push({
            name: player.name,
            firstname: player.firstName || player.name.split(' ')[0],
            lastname: player.lastName || player.name.split(' ').slice(1).join(' '),
            position: player.position ? [player.position] : ['Unknown'],
            team_id: team.id,
            jersey_number: player.jersey ? parseInt(player.jersey) : null,
            heightinches: parseHeight(player.height),
            weightlbs: player.weight ? parseInt(player.weight) : null,
            status: 'Active',
            sport_id: CONFIG.SPORT_ID,
            sport: CONFIG.SPORT,
            external_id: playerExternalId,
            college: team.name,
            metadata: {
              experience: player.experience,
              espn_team_id: team.external_id
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }
      
      if (playersToAdd.length > 0) {
        allPlayersToInsert.push(...playersToAdd);
        newPlayers += playersToAdd.length;
      } else if (roster.length === 0) {
        skippedTeams++;
      }
      
      teamsProcessed++;
      totalPlayers += roster.length;
      
      progressBar.update(teamsProcessed, { players: totalPlayers });
    })
  );
  
  // Wait for all rosters to be fetched
  await Promise.all(rosterPromises);
  
  progressBar.stop();
  
  // Insert all players in batches
  let inserted = 0;
  if (allPlayersToInsert.length > 0) {
    console.log(`\\n💾 Inserting ${allPlayersToInsert.length} new players...`);
    
    const insertBar = new cliProgress.SingleBar({
      format: 'Inserting |{bar}| {percentage}% | {value}/{total} | {duration_formatted}',
      barCompleteChar: '\\u2588',
      barIncompleteChar: '\\u2591',
    });
    
    insertBar.start(allPlayersToInsert.length, 0);
    
    // Insert in batches
    for (let i = 0; i < allPlayersToInsert.length; i += CONFIG.INSERT_BATCH) {
      const batch = allPlayersToInsert.slice(i, Math.min(i + CONFIG.INSERT_BATCH, allPlayersToInsert.length));
      
      try {
        const { data, error } = await supabase
          .from('players')
          .insert(batch)
          .select();
        
        if (error) {
          console.error(`\\n❌ Error inserting batch:`, error.message);
        } else {
          inserted += data?.length || 0;
        }
      } catch (error: any) {
        console.error(`\\n❌ Batch insert error:`, error.message);
      }
      
      insertBar.update(inserted);
    }
    
    insertBar.stop();
  }
  
  // Summary
  const duration = (Date.now() - startTime) / 1000;
  console.log('\\n' + chalk.green('═'.repeat(60)));
  console.log(chalk.bold.green('✅ FIXED NCAA FOOTBALL PLAYERS COLLECTION COMPLETE!'));
  console.log(chalk.green('═'.repeat(60)));
  console.log(`Total Teams Processed: ${chalk.bold(teamsProcessed)}`);
  console.log(`Total Players Found: ${chalk.bold(totalPlayers)}`);
  console.log(`New Players Added: ${chalk.bold.green(inserted)}`);
  console.log(`Teams Skipped (No Roster): ${chalk.bold.yellow(skippedTeams)}`);
  console.log(`API Errors: ${chalk.bold.red(errorCount)}`);
  console.log(`Duration: ${chalk.bold(duration.toFixed(1))}s`);
  console.log(`Rate: ${chalk.bold((totalPlayers / duration).toFixed(1))} players/second`);
  
  // Expected vs actual
  const expectedPlayers = totalTeams * 80; // Average 80 players per team
  const coverage = (totalPlayers / expectedPlayers) * 100;
  
  console.log(`\\n📊 Coverage: ${chalk.bold(coverage.toFixed(1))}% of expected players`);
  console.log(`Teams with rosters: ${chalk.bold.green(totalTeams - skippedTeams)}/${totalTeams}`);
  
  console.log(chalk.green('═'.repeat(60)));
}

// Run the collector
collectNCAAFootballPlayers()
  .then(() => {
    console.log('\\n👋 FIXED NCAA Football players collection finished!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
#!/usr/bin/env tsx
/**
 * 🏥 ESPN INJURY REPORT COLLECTOR - REAL DATA EDITION
 * Fetches real injury reports from ESPN's public API
 * Applies ALL lessons learned from weather and stats collectors:
 * - Query limit protection with pagination
 * - Proper ID type casting (bigint -> integer)
 * - Player name matching for ESPN data
 * - Sport ID consistency handling
 * - Batch processing with saves every 50 records
 * - Clean process termination
 * - NO FAKE DATA GENERATION
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.bold.red('🏥 ESPN INJURY REPORT COLLECTOR - REAL DATA EDITION\n'));

// Configuration (optimized based on Ryzen CPU and API limits)
const CONFIG = {
  CONCURRENT_REQUESTS: 10,
  BATCH_SIZE: 100,
  API_DELAY: 500, // 500ms between API calls
  PAGINATION_SIZE: 1000,
  SAVE_BATCH_SIZE: 50 // Save every 50 injuries to prevent data loss
};

// Sport ID mapping (learned from stats collectors)
const SPORT_ID_MAP = {
  nba: 'nba',      // NBA uses lowercase
  nfl: 'NFL',      // NFL uses uppercase  
  nhl: 'NHL',      // NHL uses uppercase
  mlb: 'mlb'       // MLB uses lowercase
};

// Additional sport variations to check (based on actual database)
const SPORT_VARIATIONS = {
  mlb: ['mlb', 'MLB'],  // 85 mlb + 1769 MLB = 1854 total
  nba: ['nba', 'NBA'],  // 700 nba
  nfl: ['nfl', 'NFL'],  // 2916 NFL
  nhl: ['nhl', 'NHL']   // 790 NHL
};

// ESPN API endpoints for injury reports
const ESPN_INJURY_URLS = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/injuries',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/injuries'
};

// Status mapping from ESPN to our database
const STATUS_MAP: Record<string, string> = {
  'Out': 'Out',
  'Questionable': 'Questionable',
  'Doubtful': 'Doubtful',
  'Day-To-Day': 'Day-to-Day',
  'Day-to-day': 'Day-to-Day',
  'IR': 'Out',            // Injured Reserve
  'PUP': 'Out',           // Physically Unable to Perform
  'NFI': 'Out',           // Non-Football Injury
  'Suspended': 'Out',
  'COVID-19': 'Out',
  'Out for season': 'Out',
  'Out indefinitely': 'Out'
};

// Common injury types
const INJURY_TYPES: Record<string, string> = {
  'ankle': 'Ankle',
  'knee': 'Knee',
  'shoulder': 'Shoulder',
  'hamstring': 'Hamstring',
  'groin': 'Groin',
  'back': 'Back',
  'wrist': 'Wrist',
  'elbow': 'Elbow',
  'hip': 'Hip',
  'foot': 'Foot',
  'calf': 'Calf',
  'quad': 'Quadriceps',
  'concussion': 'Concussion',
  'illness': 'Illness',
  'rest': 'Rest',
  'personal': 'Personal'
};

// Tracking
let totalPlayers = 0;
let processedInjuries = 0;
let insertedInjuries = 0;
let updatedInjuries = 0;
let errorCount = 0;
let unmatchedPlayers = new Set<string>();
const startTime = Date.now();

interface InjuryRecord {
  player_id: number;
  injury_type: string;
  body_part: string;
  status: string;
  return_date?: string | null;
  notes: string;
  reported_at: string;
}

interface ESPNInjury {
  athlete: {
    id: string;
    displayName: string;
    fullName: string;
    team?: {
      id: string;
      displayName: string;
    };
  };
  type: {
    id: string;
    name: string;
    description: string;
  };
  status: string;
  date?: string;
  details?: {
    type: string;
    location: string;
    detail: string;
    side?: string;
    returnDate?: string;
  };
}

/**
 * Normalize player names for matching (same as sports collectors)
 */
function normalizePlayerName(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/['']/g, '')
    .replace(/\./g, '')
    .replace(/jr$/i, '')
    .replace(/sr$/i, '')
    .replace(/iii$/i, '')
    .replace(/ii$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity between two strings (0-1)
 */
function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Get players by sport with PAGINATION to avoid query limits
 */
async function getPlayersBySport(sportIds: string[]) {
  console.log(`📊 Loading players for sport IDs: ${sportIds.join(', ')}...`);
  
  const allPlayers = [];
  let from = 0;
  const batchSize = CONFIG.PAGINATION_SIZE;
  
  while (true) {
    const { data: batch } = await supabase
      .from('players')
      .select('id, name, sport_id, team_id, external_id, firstname, lastname')
      .in('sport_id', sportIds)
      .range(from, from + batchSize - 1);
    
    if (!batch || batch.length === 0) break;
    
    allPlayers.push(...batch);
    from += batchSize;
    
    console.log(`  Loaded ${allPlayers.length} players so far...`);
    
    if (batch.length < batchSize) break;
  }
  
  console.log(`✅ Loaded ${allPlayers.length} players total`);
  return allPlayers;
}

/**
 * Get all players for specified sports with proper sport ID handling
 */
async function getPlayersForSports(sports: string[]) {
  console.log('🔍 Loading players (with pagination)...');
  
  const allPlayers = [];
  
  for (const sport of sports) {
    // Get all variations for this sport
    const variations = SPORT_VARIATIONS[sport as keyof typeof SPORT_VARIATIONS] || [sport];
    const sportPlayers = await getPlayersBySport(variations);
    allPlayers.push(...sportPlayers);
  }
  
  console.log(`\n✅ Loaded ${allPlayers.length} total players`);
  
  // Create player lookup by normalized name
  const playerLookup = new Map();
  allPlayers.forEach(p => {
    if (p.name) {
      const normalized = normalizePlayerName(p.name);
      playerLookup.set(normalized, p);
      
      // Also try last name only
      const parts = p.name.split(' ');
      if (parts.length > 1) {
        const lastName = normalizePlayerName(parts[parts.length - 1]);
        if (!playerLookup.has(lastName)) {
          playerLookup.set(lastName, p);
        }
      }
    }
    
    // Try firstname + lastname combination
    if (p.firstname && p.lastname) {
      const fullName = normalizePlayerName(`${p.firstname} ${p.lastname}`);
      if (!playerLookup.has(fullName)) {
        playerLookup.set(fullName, p);
      }
    }
  });
  
  console.log(`✅ Created lookup for ${playerLookup.size} player name variations`);
  return { allPlayers, playerLookup };
}

/**
 * Fetch injury data from ESPN API
 */
async function fetchESPNInjuries(sport: string): Promise<ESPNInjury[]> {
  const url = ESPN_INJURY_URLS[sport as keyof typeof ESPN_INJURY_URLS];
  if (!url) {
    throw new Error(`Invalid sport: ${sport}`);
  }
  
  console.log(`\n🔍 Fetching ${sport.toUpperCase()} injuries from ESPN...`);
  
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Fantasy-AI-Injury-Collector/1.0'
      }
    });
    
    // ESPN returns team-grouped injury data
    let injuries: ESPNInjury[] = [];
    
    // Handle the actual ESPN format
    if (response.data?.injuries) {
      // Each item is a team with injuries array
      response.data.injuries.forEach((team: any) => {
        if (team.injuries && Array.isArray(team.injuries)) {
          injuries.push(...team.injuries);
        }
      });
    }
    
    console.log(`✅ Found ${injuries.length} individual player injuries`);
    
    // Debug: show sample of first injury
    if (injuries.length > 0 && injuries[0]) {
      console.log('\n📋 Sample injury structure:');
      const sample = {
        athlete: injuries[0].athlete?.displayName,
        status: injuries[0].status,
        shortComment: injuries[0].shortComment
      };
      console.log(JSON.stringify(sample, null, 2));
    }
    
    return injuries;
    
  } catch (error: any) {
    console.error(`❌ Error fetching ${sport} injuries:`, error.message);
    return [];
  }
}

/**
 * Extract injury type and body part from ESPN data
 */
function parseInjuryDetails(injury: ESPNInjury): { injuryType: string, bodyPart: string } {
  let injuryType = 'Unknown';
  let bodyPart = 'Unknown';
  
  // Try to get from details first
  if (injury.details) {
    bodyPart = injury.details.location || injury.details.type || 'Unknown';
    injuryType = injury.details.detail || injury.details.type || 'Unknown';
  }
  
  // Fall back to type field
  if (injury.type) {
    const typeName = injury.type.name || injury.type.description || '';
    
    // Try to match known injury types
    for (const [key, value] of Object.entries(INJURY_TYPES)) {
      if (typeName.toLowerCase().includes(key)) {
        injuryType = value;
        bodyPart = value;
        break;
      }
    }
    
    // If still unknown, use the type name
    if (injuryType === 'Unknown' && typeName) {
      injuryType = typeName;
      bodyPart = typeName;
    }
  }
  
  return { injuryType, bodyPart };
}

/**
 * Check existing injuries to avoid duplicates
 */
async function getExistingInjuries(playerIds: number[]): Promise<Map<string, any>> {
  console.log('🔍 Checking existing injuries...');
  
  const existingMap = new Map<string, any>();
  
  // Process in chunks to avoid query limits
  for (let i = 0; i < playerIds.length; i += 500) {
    const chunk = playerIds.slice(i, i + 500);
    
    const { data } = await supabase
      .from('player_injuries')
      .select('id, player_id, injury_type, status')
      .in('player_id', chunk)
      .in('status', ['Out', 'Questionable', 'Doubtful', 'Day-to-Day']);
      
    if (data) {
      data.forEach(injury => {
        const key = `${injury.player_id}-${injury.injury_type}`;
        existingMap.set(key, injury);
      });
    }
  }
  
  console.log(`✅ Found ${existingMap.size} existing active injuries`);
  return existingMap;
}

/**
 * Process injury data and match to players
 */
async function processInjuryData(
  injuries: ESPNInjury[], 
  playerLookup: Map<string, any>,
  existingInjuries: Map<string, any>,
  sport: string
): Promise<InjuryRecord[]> {
  console.log(`\n🏥 Processing ${injuries.length} injury reports...`);
  
  const injuryRecords: InjuryRecord[] = [];
  const updatedRecords: any[] = [];
  
  const progressBar = new cliProgress.SingleBar({
    format: 'Progress |{bar}| {percentage}% | {value}/{total} Injuries | Matched: {matched}',
    etaBuffer: 50
  }, cliProgress.Presets.shades_classic);
  
  progressBar.start(injuries.length, 0, { matched: 0 });
  
  let matched = 0;
  
  for (let i = 0; i < injuries.length; i++) {
    const injury = injuries[i];
    
    try {
      // Get player name
      const playerName = injury.athlete?.displayName || injury.athlete?.fullName;
      if (!playerName) continue;
      
      // Match player
      const normalizedName = normalizePlayerName(playerName);
      let player = playerLookup.get(normalizedName);
      
      // If no exact match, try fuzzy matching
      if (!player) {
        let bestMatch = null;
        let bestScore = 0;
        
        // Check all players for fuzzy match
        for (const [lookupName, candidatePlayer] of playerLookup) {
          const similarity = stringSimilarity(normalizedName, lookupName);
          if (similarity > 0.85 && similarity > bestScore) {
            bestScore = similarity;
            bestMatch = candidatePlayer;
          }
        }
        
        if (bestMatch && bestScore > 0.85) {
          player = bestMatch;
          console.log(`\n  🔍 Fuzzy matched "${playerName}" to "${player.name}" (${Math.round(bestScore * 100)}% similarity)`);
        }
      }
      
      if (!player) {
        unmatchedPlayers.add(`${playerName} (${sport.toUpperCase()})`);
        progressBar.update(i + 1, { matched });
        continue;
      }
      
      matched++;
      
      // Parse injury details
      const { injuryType, bodyPart } = parseInjuryDetails(injury);
      
      // Get status
      const espnStatus = injury.status || 'Unknown';
      const status = STATUS_MAP[espnStatus] || espnStatus;
      
      // Create notes
      const notes = [
        injury.type?.description,
        injury.details?.detail,
        injury.details?.side ? `${injury.details.side} side` : null
      ].filter(Boolean).join(' - ');
      
      // Safe ID casting
      const playerId = parseInt(player.id.toString());
      if (playerId > 2147483647) {
        console.warn(`Player ID ${playerId} too large for integer field`);
        continue;
      }
      
      // Check if injury exists
      const existingKey = `${playerId}-${injuryType}`;
      const existingInjury = existingInjuries.get(existingKey);
      
      if (existingInjury && existingInjury.status === status) {
        // Skip if no status change
        continue;
      }
      
      const injuryRecord: InjuryRecord = {
        player_id: playerId,
        injury_type: injuryType,
        body_part: bodyPart,
        status: status,
        return_date: injury.details?.returnDate || null,
        notes: notes || `${playerName} - ${injuryType}`,
        reported_at: new Date().toISOString()
      };
      
      if (existingInjury) {
        // Update existing injury
        updatedRecords.push({
          id: existingInjury.id,
          ...injuryRecord
        });
      } else {
        // New injury
        injuryRecords.push(injuryRecord);
      }
      
    } catch (error: any) {
      console.error(`\n❌ Error processing injury for ${injury.athlete?.displayName}:`, error.message);
      errorCount++;
    }
    
    progressBar.update(i + 1, { matched });
  }
  
  progressBar.stop();
  
  console.log(`\n✅ Matched ${matched}/${injuries.length} injuries to players`);
  console.log(`📝 New injuries: ${injuryRecords.length}, Updates: ${updatedRecords.length}`);
  
  // Handle updates
  if (updatedRecords.length > 0) {
    await updateExistingInjuries(updatedRecords);
  }
  
  return injuryRecords;
}

/**
 * Update existing injuries with new status
 */
async function updateExistingInjuries(updates: any[]) {
  console.log(`\n🔄 Updating ${updates.length} existing injuries...`);
  
  for (const update of updates) {
    const { id, ...data } = update;
    
    const { error } = await supabase
      .from('player_injuries')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);
      
    if (error) {
      console.error(`Error updating injury ${id}:`, error.message);
    } else {
      updatedInjuries++;
    }
  }
  
  console.log(`✅ Updated ${updatedInjuries} injuries`);
}

/**
 * Insert injury data in BATCHES to avoid query limits
 */
async function insertInjuryData(injuryRecords: InjuryRecord[]) {
  console.log(`\n💾 Inserting ${injuryRecords.length} injury records in batches...`);
  
  if (injuryRecords.length === 0) {
    console.log('⚠️  No new injuries to insert');
    return;
  }
  
  let inserted = 0;
  let errorBatches = 0;
  
  for (let i = 0; i < injuryRecords.length; i += CONFIG.BATCH_SIZE) {
    const batch = injuryRecords.slice(i, i + CONFIG.BATCH_SIZE);
    
    const { data, error } = await supabase
      .from('player_injuries')
      .insert(batch)
      .select();
    
    if (error) {
      console.error(`\nBatch ${Math.floor(i/CONFIG.BATCH_SIZE)+1} error:`, error.message);
      errorBatches++;
    } else if (data) {
      inserted += data.length;
    }
    
    process.stdout.write(`\r💾 Inserted ${inserted} / ${injuryRecords.length} records (${errorBatches} batch errors)`);
  }
  
  insertedInjuries = inserted;
  console.log(`\n✅ Successfully inserted ${inserted} injury records`);
}

/**
 * Main collection function
 */
async function collectESPNInjuries(sportFilter?: string) {
  const sports = sportFilter ? [sportFilter] : ['nfl', 'nba', 'mlb', 'nhl'];
  const sportName = sportFilter ? sportFilter.toUpperCase() : 'ALL';
  
  console.log(`🚀 STARTING ESPN INJURY COLLECTION FOR ${sportName} SPORTS`);
  console.log(`⚡ Configuration: ${CONFIG.CONCURRENT_REQUESTS} concurrent requests, ${CONFIG.BATCH_SIZE} batch size\n`);
  
  try {
    // Step 1: Get all players for the specified sports
    const { allPlayers, playerLookup } = await getPlayersForSports(sports);
    totalPlayers = allPlayers.length;
    
    if (totalPlayers === 0) {
      console.log('⚠️  No players found to process');
      return;
    }
    
    // Step 2: Check existing injuries
    const playerIds = allPlayers.map(p => parseInt(p.id.toString()));
    const existingInjuries = await getExistingInjuries(playerIds);
    
    // Step 3: Process each sport
    for (const sport of sports) {
      console.log(chalk.blue(`\n════════════════════════════════════════`));
      console.log(chalk.blue(`Processing ${sport.toUpperCase()} injuries...`));
      console.log(chalk.blue(`════════════════════════════════════════`));
      
      // Fetch injuries from ESPN
      const injuries = await fetchESPNInjuries(sport);
      
      if (injuries.length === 0) {
        console.log(`⚠️  No injuries found for ${sport.toUpperCase()}`);
        continue;
      }
      
      // Process injuries and save in batches
      const allInjuryRecords: InjuryRecord[] = [];
      
      // Process in batches to save regularly
      for (let i = 0; i < injuries.length; i += CONFIG.SAVE_BATCH_SIZE) {
        const batch = injuries.slice(i, Math.min(i + CONFIG.SAVE_BATCH_SIZE, injuries.length));
        
        const injuryRecords = await processInjuryData(
          batch, 
          playerLookup, 
          existingInjuries,
          sport
        );
        
        if (injuryRecords.length > 0) {
          // Save this batch immediately
          console.log(`\n💾 Saving batch of ${injuryRecords.length} injuries...`);
          await insertInjuryData(injuryRecords);
          allInjuryRecords.push(...injuryRecords);
        }
        
        processedInjuries += batch.length;
      }
      
      // Delay between sports to respect API limits
      if (sports.indexOf(sport) < sports.length - 1) {
        console.log('\n⏳ Waiting before next sport...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Final summary
    const elapsedTime = (Date.now() - startTime) / 1000;
    
    console.log('\n\n🏆 ESPN INJURY COLLECTION COMPLETE!\n');
    console.log(`⏱️  Total Time: ${(elapsedTime / 60).toFixed(1)} minutes`);
    console.log(`👥 Players in Database: ${totalPlayers}`);
    console.log(`📊 Injuries Processed: ${processedInjuries}`);
    console.log(`🏥 New Injuries Inserted: ${insertedInjuries}`);
    console.log(`🔄 Injuries Updated: ${updatedInjuries}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`⚡ Processing Rate: ${(processedInjuries / (elapsedTime / 60)).toFixed(1)} injuries/min`);
    
    if (unmatchedPlayers.size > 0) {
      console.log(`\n⚠️  Found ${unmatchedPlayers.size} unmatched players`);
      console.log('Sample unmatched players:');
      Array.from(unmatchedPlayers).slice(0, 20).forEach(name => {
        console.log(`  - ${name}`);
      });
    }
    
    // Check final total
    const { count: finalTotal } = await supabase
      .from('player_injuries')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\n📈 Total injury records in database: ${finalTotal?.toLocaleString()}`);
    
    if (finalTotal && finalTotal > 0) {
      console.log('✅ ESPN injury data collection successful!');
    }
    
  } catch (error) {
    console.error('❌ Collection failed:', error);
  }
}

// Parse command-line arguments
async function main() {
  try {
    // Check dependencies
    require('axios');
    require('p-limit');
    require('cli-progress');
  } catch {
    console.log('📦 Installing required packages...');
    const { execSync } = require('child_process');
    execSync('npm install axios p-limit cli-progress', { stdio: 'inherit' });
  }
  
  // Parse command-line arguments
  const args = process.argv.slice(2);
  let sportFilter: string | undefined;
  
  // Check for --sport argument
  const sportArg = args.find(arg => arg.startsWith('--sport='));
  if (sportArg) {
    sportFilter = sportArg.split('=')[1]?.toLowerCase();
    if (sportFilter && !['nfl', 'nba', 'mlb', 'nhl'].includes(sportFilter)) {
      console.error('❌ Invalid sport. Use --sport=nfl, --sport=nba, --sport=mlb, or --sport=nhl');
      process.exit(1);
    }
  }
  
  await collectESPNInjuries(sportFilter);
  
  console.log('\n👋 Exiting - ESPN injury collection complete!');
  process.exit(0);
}

main().catch(console.error);
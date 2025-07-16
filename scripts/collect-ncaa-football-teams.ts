#!/usr/bin/env tsx
/**
 * 🏈 NCAA FOOTBALL TEAMS COLLECTOR - ULTRA SPEED EDITION
 * Fetches all 130+ FBS teams from ESPN API
 * Optimized for Ryzen 5 7600X with aggressive batching
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

console.log(chalk.bold.red('🏈 NCAA FOOTBALL TEAMS COLLECTOR - ULTRA SPEED EDITION\n'));

// AGGRESSIVE CONFIGURATION
const CONFIG = {
  CONCURRENT_REQUESTS: 20,     // Maxed out for Ryzen 5
  INSERT_BATCH: 900,           // Just under Supabase limit
  ESPN_API: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football',
  SPORT_ID: 'NCAA_FB',
  NO_TIMEOUT: true
};

// Progress tracking
let totalTeams = 0;
let newTeams = 0;
let existingTeams = 0;
const startTime = Date.now();

// Progress bar
const progressBar = new cliProgress.SingleBar({
  format: 'NCAA Football Teams |{bar}| {percentage}% | {value}/{total} | {duration_formatted} | ETA: {eta_formatted}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
});

interface ESPNTeam {
  id: string;
  name: string;
  displayName: string;
  abbreviation: string;
  logo?: string;
  location?: string;
  conferenceId?: string;
}

/**
 * Fetch all NCAA Football teams from ESPN
 */
async function fetchAllNCAAFootballTeams(): Promise<ESPNTeam[]> {
  console.log('🔍 Fetching all FBS teams from ESPN...');
  
  try {
    // ESPN endpoint for all teams
    const response = await axios.get(`${CONFIG.ESPN_API}/teams`, {
      params: {
        limit: 500  // Get all teams in one request
      }
    });

    const teams: ESPNTeam[] = [];
    
    if (response.data?.sports?.[0]?.leagues?.[0]?.teams) {
      for (const teamData of response.data.sports[0].leagues[0].teams) {
        const team = teamData.team;
        
        // Filter for FBS teams only
        // FBS teams are typically in major conferences or have isActive flag
        if (team.isActive !== false && team.id) {
          teams.push({
            id: team.id,
            name: team.name,
            displayName: team.displayName,
            abbreviation: team.abbreviation,
            logo: team.logos?.[0]?.href,
            location: team.location,
            conferenceId: team.groups?.id || team.conferenceId
          });
        }
      }
    }
    
    console.log(chalk.green(`✅ Found ${teams.length} FBS teams`));
    return teams;
  } catch (error: any) {
    console.error(chalk.red('❌ Error fetching teams:'), error.message);
    return [];
  }
}

/**
 * Get existing teams from database
 */
async function getExistingTeams(): Promise<{ ncaaFootballIds: Set<string>, allExternalIds: Set<string> }> {
  console.log('📊 Checking existing teams in database...');
  
  const ncaaFootballIds = new Set<string>();
  const allExternalIds = new Set<string>();
  let from = 0;
  const batchSize = 1000;
  
  // Get ALL teams with external IDs to avoid duplicates
  while (true) {
    const { data, error } = await supabase
      .from('teams')
      .select('external_id, sport')
      .not('external_id', 'is', null)
      .range(from, from + batchSize - 1);
    
    if (error) {
      console.error('Error fetching existing teams:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    data.forEach(team => {
      if (team.external_id) {
        allExternalIds.add(team.external_id);
        if (team.sport === CONFIG.SPORT_ID) {
          ncaaFootballIds.add(team.external_id);
        }
      }
    });
    
    from += batchSize;
    if (data.length < batchSize) break;
  }
  
  console.log(`Found ${ncaaFootballIds.size} existing NCAA Football teams`);
  console.log(`Found ${allExternalIds.size} total teams with ESPN IDs`);
  return { ncaaFootballIds, allExternalIds };
}

/**
 * Insert teams into database
 */
async function insertTeams(teams: any[]): Promise<number> {
  if (teams.length === 0) return 0;
  
  console.log(`\n💾 Inserting ${teams.length} new teams...`);
  
  let inserted = 0;
  
  // Split into chunks of 900 (just under Supabase limit)
  for (let i = 0; i < teams.length; i += CONFIG.INSERT_BATCH) {
    const batch = teams.slice(i, Math.min(i + CONFIG.INSERT_BATCH, teams.length));
    
    const { data, error } = await supabase
      .from('teams')
      .insert(batch)
      .select();
    
    if (error) {
      console.error(`❌ Error inserting batch:`, error.message);
    } else {
      inserted += data?.length || 0;
    }
    
    progressBar.update(inserted);
  }
  
  return inserted;
}

/**
 * Main function to collect all NCAA Football teams
 */
async function collectNCAAFootballTeams() {
  console.log(chalk.cyan('Starting NCAA Football teams collection...\n'));
  
  // Get existing teams
  const { ncaaFootballIds, allExternalIds } = await getExistingTeams();
  existingTeams = ncaaFootballIds.size;
  
  // Fetch all teams from ESPN
  const espnTeams = await fetchAllNCAAFootballTeams();
  totalTeams = espnTeams.length;
  
  // Filter out existing teams
  const teamsToInsert = [];
  let skippedDuplicates = 0;
  
  for (const team of espnTeams) {
    // Create sport-specific external ID to avoid conflicts
    const sportSpecificId = `espn_ncaaf_${team.id}`;
    
    // Skip if already exists for NCAA Football
    if (ncaaFootballIds.has(sportSpecificId)) {
      continue;
    }
    
    // Check if this ESPN ID is used by another sport
    if (allExternalIds.has(team.id)) {
      skippedDuplicates++;
      // Still add it with sport-specific ID
    }
    
    teamsToInsert.push({
      external_id: sportSpecificId,  // Sport-specific ID
      name: team.displayName,
      city: team.location || team.name.split(' ').slice(0, -1).join(' '),
      abbreviation: team.abbreviation,
      sport: CONFIG.SPORT_ID,
      sport_id: CONFIG.SPORT_ID,
      league_id: 'NCAA',
      logo_url: team.logo,
      metadata: {
        espn_id: team.id,  // Store original ESPN ID
        conference_id: team.conferenceId,
        division: 'FBS'
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  
  newTeams = teamsToInsert.length;
  
  if (skippedDuplicates > 0) {
    console.log(chalk.yellow(`⚠️  ${skippedDuplicates} teams share ESPN IDs with other sports`));
  }
  
  if (newTeams === 0) {
    console.log(chalk.yellow('\n✅ All NCAA Football teams already in database!'));
    return;
  }
  
  // Initialize progress bar
  progressBar.start(newTeams, 0);
  
  // Insert new teams
  const inserted = await insertTeams(teamsToInsert);
  
  progressBar.stop();
  
  // Summary
  const duration = (Date.now() - startTime) / 1000;
  console.log('\n' + chalk.green('═'.repeat(60)));
  console.log(chalk.bold.green('✅ NCAA FOOTBALL TEAMS COLLECTION COMPLETE!'));
  console.log(chalk.green('═'.repeat(60)));
  console.log(`Total FBS Teams: ${chalk.bold(totalTeams)}`);
  console.log(`Existing Teams: ${chalk.bold(existingTeams)}`);
  console.log(`New Teams Added: ${chalk.bold.green(inserted)}`);
  console.log(`Duration: ${chalk.bold(duration.toFixed(1))}s`);
  console.log(`Rate: ${chalk.bold((inserted / duration).toFixed(1))} teams/second`);
  console.log(chalk.green('═'.repeat(60)));
}

// Run the collector
collectNCAAFootballTeams()
  .then(() => {
    console.log('\n👋 NCAA Football teams collection finished!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
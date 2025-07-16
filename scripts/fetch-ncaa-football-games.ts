#!/usr/bin/env tsx
/**
 * 🏈 NCAA FOOTBALL GAMES FETCHER - ULTRA SPEED EDITION
 * Fetches all games from 2024 season (Aug 2024 - Jan 2025)
 * Optimized with all lessons learned from pro sports collection
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

console.log(chalk.bold.red('🏈 NCAA FOOTBALL GAMES FETCHER - ULTRA SPEED EDITION\n'));

// AGGRESSIVE CONFIGURATION
const CONFIG = {
  CONCURRENT_REQUESTS: 20,     // Maxed out for Ryzen 5
  DB_QUERY_BATCH: 1000,        // Database query limit
  INSERT_BATCH: 900,           // Just under Supabase limit
  ESPN_API: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  SPORT: 'NCAA_FB',
  SEASON_START: new Date('2024-08-24'),
  SEASON_END: new Date('2025-01-20'),    // National Championship
  GROUP_ID: 80                            // FBS games
};

// Progress tracking
let totalGames = 0;
let newGames = 0;
let existingGames = 0;
let weeksProcessed = 0;
const startTime = Date.now();

// Progress bar
const progressBar = new cliProgress.SingleBar({
  format: 'NCAA Football Games |{bar}| {percentage}% | Week {week}/{totalWeeks} | {value} games found | {duration_formatted}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
});

interface Game {
  id: string;
  date: string;
  homeTeam: {
    id: string;
    name: string;
    score: number;
  };
  awayTeam: {
    id: string;
    name: string;
    score: number;
  };
  status: string;
  venue: string;
  attendance?: number;
  conference?: boolean;
  week?: number;
}

/**
 * Get existing games to avoid duplicates
 */
async function getExistingGames(): Promise<Set<string>> {
  console.log('📊 Loading existing NCAA Football games...');
  
  const existingIds = new Set<string>();
  let from = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('games')
      .select('external_id')
      .eq('sport', CONFIG.SPORT)
      .range(from, from + CONFIG.DB_QUERY_BATCH - 1);
    
    if (error) {
      console.error('Error fetching existing games:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    data.forEach(game => {
      if (game.external_id) {
        existingIds.add(game.external_id);
      }
    });
    
    from += CONFIG.DB_QUERY_BATCH;
    if (data.length < CONFIG.DB_QUERY_BATCH) break;
  }
  
  console.log(`Found ${existingIds.size} existing NCAA Football games`);
  return existingIds;
}

/**
 * Fetch games for a date range
 */
async function fetchGamesForDateRange(startDate: Date, endDate: Date): Promise<Game[]> {
  const games: Game[] = [];
  
  try {
    const startStr = startDate.toISOString().split('T')[0].replace(/-/g, '');
    const endStr = endDate.toISOString().split('T')[0].replace(/-/g, '');
    
    const url = `${CONFIG.ESPN_API}?dates=${startStr}-${endStr}&groups=${CONFIG.GROUP_ID}&limit=500`;
    const response = await axios.get(url);
    
    if (response.data?.events) {
      for (const event of response.data.events) {
        const competition = event.competitions[0];
        const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home');
        const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away');
        
        games.push({
          id: event.id,
          date: event.date,
          homeTeam: {
            id: homeTeam.team.id,
            name: homeTeam.team.displayName,
            score: parseInt(homeTeam.score) || 0
          },
          awayTeam: {
            id: awayTeam.team.id,
            name: awayTeam.team.displayName,
            score: parseInt(awayTeam.score) || 0
          },
          status: event.status.type.name,
          venue: competition.venue?.fullName || 'Unknown',
          attendance: competition.attendance,
          conference: competition.conferenceCompetition,
          week: event.week?.number
        });
      }
    }
  } catch (error: any) {
    console.error(`Error fetching games for ${startDate.toDateString()}:`, error.message);
  }
  
  return games;
}

/**
 * Get team IDs from database
 */
async function getTeamMappings(): Promise<Map<string, number>> {
  console.log('📊 Loading team mappings...');
  
  const teamMap = new Map<string, number>();
  let from = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('teams')
      .select('id, external_id, metadata')
      .eq('sport', CONFIG.SPORT)
      .range(from, from + CONFIG.DB_QUERY_BATCH - 1);
    
    if (error) {
      console.error('Error fetching teams:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    data.forEach(team => {
      // Map ESPN ID to our internal ID
      const espnId = (team.metadata as any)?.espn_id;
      if (espnId) {
        teamMap.set(espnId, team.id);
      }
    });
    
    from += CONFIG.DB_QUERY_BATCH;
    if (data.length < CONFIG.DB_QUERY_BATCH) break;
  }
  
  console.log(`Loaded ${teamMap.size} team mappings`);
  return teamMap;
}

/**
 * Main function to fetch all games
 */
async function fetchNCAAFootballGames() {
  console.log(chalk.cyan('Starting NCAA Football 2024 season games collection...\n'));
  
  // Get existing games
  const existingGamesSet = await getExistingGames();
  existingGames = existingGamesSet.size;
  
  // Get team mappings
  const teamMappings = await getTeamMappings();
  
  // Calculate total weeks
  const totalWeeks = Math.ceil((CONFIG.SEASON_END.getTime() - CONFIG.SEASON_START.getTime()) / (7 * 24 * 60 * 60 * 1000));
  
  // Initialize progress bar
  progressBar.start(0, 0, { week: 0, totalWeeks });
  
  // Collect all games
  const allGamesToInsert = [];
  const limit = pLimit(CONFIG.CONCURRENT_REQUESTS);
  
  // Process weeks in parallel
  const weekPromises = [];
  for (let date = new Date(CONFIG.SEASON_START); date <= CONFIG.SEASON_END; date.setDate(date.getDate() + 7)) {
    const weekStart = new Date(date);
    const weekEnd = new Date(date);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    weekPromises.push(
      limit(async () => {
        const games = await fetchGamesForDateRange(weekStart, weekEnd);
        
        for (const game of games) {
          if (!existingGamesSet.has(game.id)) {
            const homeTeamId = teamMappings.get(game.homeTeam.id);
            const awayTeamId = teamMappings.get(game.awayTeam.id);
            
            allGamesToInsert.push({
              external_id: game.id,
              sport: CONFIG.SPORT,
              sport_id: CONFIG.SPORT,
              home_team_id: homeTeamId || null,
              away_team_id: awayTeamId || null,
              start_time: game.date,
              status: game.status,
              home_score: game.status === 'STATUS_FINAL' ? game.homeTeam.score : null,
              away_score: game.status === 'STATUS_FINAL' ? game.awayTeam.score : null,
              venue: game.venue,
              metadata: {
                home_team: game.homeTeam.name,
                away_team: game.awayTeam.name,
                home_team_espn_id: game.homeTeam.id,
                away_team_espn_id: game.awayTeam.id,
                conference: game.conference,
                attendance: game.attendance,
                week: game.week
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        }
        
        totalGames += games.length;
        weeksProcessed++;
        progressBar.update(totalGames, { week: weeksProcessed });
      })
    );
  }
  
  // Wait for all weeks to be processed
  await Promise.all(weekPromises);
  
  progressBar.stop();
  
  // Insert games in batches
  if (allGamesToInsert.length > 0) {
    console.log(`\n💾 Inserting ${allGamesToInsert.length} new games...`);
    
    let inserted = 0;
    const insertBar = new cliProgress.SingleBar({
      format: 'Inserting |{bar}| {percentage}% | {value}/{total} | {duration_formatted}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });
    
    insertBar.start(allGamesToInsert.length, 0);
    
    for (let i = 0; i < allGamesToInsert.length; i += CONFIG.INSERT_BATCH) {
      const batch = allGamesToInsert.slice(i, Math.min(i + CONFIG.INSERT_BATCH, allGamesToInsert.length));
      
      const { data, error } = await supabase
        .from('games')
        .insert(batch)
        .select();
      
      if (error) {
        console.error(`\n❌ Error inserting batch:`, error.message);
      } else {
        inserted += data?.length || 0;
      }
      
      insertBar.update(inserted);
    }
    
    insertBar.stop();
    newGames = inserted;
  }
  
  // Summary
  const duration = (Date.now() - startTime) / 1000;
  console.log('\n' + chalk.green('═'.repeat(60)));
  console.log(chalk.bold.green('✅ NCAA FOOTBALL GAMES COLLECTION COMPLETE!'));
  console.log(chalk.green('═'.repeat(60)));
  console.log(`Season: ${chalk.bold('2024-2025')}`);
  console.log(`Total Games Found: ${chalk.bold(totalGames)}`);
  console.log(`Existing Games: ${chalk.bold(existingGames)}`);
  console.log(`New Games Added: ${chalk.bold.green(newGames)}`);
  console.log(`Duration: ${chalk.bold(duration.toFixed(1))}s`);
  console.log(`Rate: ${chalk.bold((totalGames / duration).toFixed(1))} games/second`);
  console.log(chalk.green('═'.repeat(60)));
}

// Run the fetcher
fetchNCAAFootballGames()
  .then(() => {
    console.log('\n👋 NCAA Football games collection finished!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
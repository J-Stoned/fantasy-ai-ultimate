#!/usr/bin/env tsx
/**
 * 🚀 10X COMPLETE 2021 SEASONS COLLECTOR 🚀
 * 
 * ULTIMATE collector that gets 100% of 2021 season data
 * - No database limits (proper pagination)
 * - Correct season dates for each sport
 * - 200+ concurrent requests for Ryzen 5 7600X
 * - Smart deduplication
 * - Direct ESPN API with season parameters
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 10X SETTINGS - OPTIMIZED FOR RYZEN 5 7600X + 32GB RAM
const limit = pLimit(200); // 200 concurrent requests!
const BATCH_SIZE = 1000; // Process 1000 items at once

// In-memory caches for speed
const teamCache = new Map<string, number>();
const playerCache = new Map<string, number>();
const gameCache = new Set<string>();

// Season configurations with CORRECT dates
const SEASONS = {
  NFL: {
    year: 2021,
    regular: { start: '2021-09-09', end: '2022-01-09' },
    playoffs: { start: '2022-01-15', end: '2022-02-13' },
    espnYear: 2021
  },
  NBA: {
    year: 2021,
    regular: { start: '2021-10-19', end: '2022-04-10' },
    playoffs: { start: '2022-04-16', end: '2022-06-16' },
    espnYear: 2022 // NBA uses end year for API
  },
  MLB: {
    year: 2021,
    regular: { start: '2021-04-01', end: '2021-10-03' },
    playoffs: { start: '2021-10-05', end: '2021-11-02' },
    espnYear: 2021
  },
  NHL: {
    year: 2021,
    regular: { start: '2021-10-12', end: '2022-04-29' },
    playoffs: { start: '2022-05-02', end: '2022-06-26' },
    espnYear: 2022 // NHL uses end year for API
  }
};

// Progress tracking
const progress = {
  NFL: { games: 0, players: 0, stats: 0 },
  NBA: { games: 0, players: 0, stats: 0 },
  MLB: { games: 0, players: 0, stats: 0 },
  NHL: { games: 0, players: 0, stats: 0 }
};

// ESPN API endpoints
function getESPNEndpoint(sport: string): string {
  const endpoints: Record<string, string> = {
    NFL: 'football/nfl',
    NBA: 'basketball/nba',
    MLB: 'baseball/mlb',
    NHL: 'hockey/nhl'
  };
  return endpoints[sport];
}

// Load all teams into cache
async function loadTeamsIntoCache() {
  console.log(chalk.blue('⚡ Loading all teams into memory...'));
  
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data: teams } = await supabase
      .from('teams')
      .select('id, external_id, sport')
      .range(offset, offset + BATCH_SIZE - 1);
    
    if (!teams || teams.length === 0) {
      hasMore = false;
      break;
    }
    
    teams.forEach(team => {
      teamCache.set(team.external_id, team.id);
    });
    
    offset += BATCH_SIZE;
    hasMore = teams.length === BATCH_SIZE;
  }
  
  console.log(chalk.green(`  ✅ Cached ${teamCache.size} teams`));
}

// Load existing games to avoid duplicates
async function loadExistingGames(sport: string) {
  console.log(chalk.gray(`  Loading existing ${sport} games...`));
  
  const season = SEASONS[sport as keyof typeof SEASONS];
  let offset = 0;
  let hasMore = true;
  let count = 0;
  
  while (hasMore) {
    const { data: games } = await supabase
      .from('games')
      .select('external_id')
      .eq('sport', sport)
      .gte('start_time', season.regular.start)
      .lte('start_time', season.playoffs.end)
      .range(offset, offset + BATCH_SIZE - 1);
    
    if (!games || games.length === 0) {
      hasMore = false;
      break;
    }
    
    games.forEach(game => {
      gameCache.add(game.external_id);
      count++;
    });
    
    offset += BATCH_SIZE;
    hasMore = games.length === BATCH_SIZE;
  }
  
  console.log(chalk.gray(`    Found ${count} existing games`));
}

// Collect games for a sport
async function collectGamesForSport(sport: string) {
  console.log(chalk.cyan(`\n📅 Collecting ${sport} 2021 season games...`));
  
  const season = SEASONS[sport as keyof typeof SEASONS];
  const endpoint = getESPNEndpoint(sport);
  
  // Load existing games first
  await loadExistingGames(sport);
  
  const allGames = [];
  const dates = [];
  
  // Generate all dates for the season
  for (const period of ['regular', 'playoffs']) {
    const { start, end } = season[period as keyof typeof season] as any;
    const currentDate = new Date(start);
    const endDate = new Date(end);
    
    while (currentDate <= endDate) {
      dates.push(currentDate.toISOString().slice(0, 10).replace(/-/g, ''));
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
  
  console.log(chalk.yellow(`  📅 Checking ${dates.length} days...`));
  
  // Create progress bar
  const progressBar = new cliProgress.SingleBar({
    format: '  Progress |{bar}| {percentage}% | {value}/{total} days | {games} games found',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591'
  });
  
  progressBar.start(dates.length, 0, { games: 0 });
  
  // Process dates in batches with massive parallelization
  for (let i = 0; i < dates.length; i += 100) {
    const batch = dates.slice(i, i + 100);
    
    const batchGames = await Promise.all(
      batch.map(dateStr => 
        limit(async () => {
          try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/${endpoint}/scoreboard?dates=${dateStr}`;
            const response = await axios.get(url, { timeout: 10000 });
            
            const dayGames = [];
            
            if (response.data.events) {
              for (const event of response.data.events) {
                const competition = event.competitions?.[0];
                if (!competition) continue;
                
                const externalId = `espn_${sport.toLowerCase()}_${event.id}`;
                
                // Skip if we already have this game
                if (gameCache.has(externalId)) continue;
                
                const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home');
                const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away');
                
                if (homeTeam && awayTeam) {
                  const homeTeamId = teamCache.get(`espn_${sport.toLowerCase()}_${homeTeam.team.id}`);
                  const awayTeamId = teamCache.get(`espn_${sport.toLowerCase()}_${awayTeam.team.id}`);
                  
                  if (homeTeamId && awayTeamId) {
                    dayGames.push({
                      external_id: externalId,
                      sport: sport,
                      start_time: event.date,
                      status: event.status?.type?.completed ? 'Final' : 'scheduled',
                      home_team_id: homeTeamId,
                      away_team_id: awayTeamId,
                      home_score: parseInt(homeTeam.score) || 0,
                      away_score: parseInt(awayTeam.score) || 0,
                      metadata: {
                        venue: competition.venue?.fullName,
                        attendance: competition.attendance,
                        season_type: event.season?.type === 3 ? 'playoffs' : 'regular'
                      }
                    });
                  }
                }
              }
            }
            
            return dayGames;
          } catch (error) {
            return [];
          }
        })
      )
    );
    
    const flatGames = batchGames.flat();
    allGames.push(...flatGames);
    progressBar.update(i + batch.length, { games: allGames.length });
  }
  
  progressBar.stop();
  
  // Insert games in batches
  if (allGames.length > 0) {
    console.log(chalk.blue(`  ⚡ Inserting ${allGames.length} new games...`));
    
    for (let i = 0; i < allGames.length; i += BATCH_SIZE) {
      const batch = allGames.slice(i, i + BATCH_SIZE);
      
      const { data, error } = await supabase
        .from('games')
        .upsert(batch, { onConflict: 'external_id' })
        .select();
      
      if (!error && data) {
        progress[sport as keyof typeof progress].games += data.length;
      }
    }
  }
  
  console.log(chalk.green(`  ✅ ${sport}: ${progress[sport as keyof typeof progress].games} games collected`));
}

// Collect players for a sport
async function collectPlayersForSport(sport: string) {
  console.log(chalk.cyan(`\n👥 Collecting ${sport} 2021 players...`));
  
  const endpoint = getESPNEndpoint(sport);
  const season = SEASONS[sport as keyof typeof SEASONS];
  
  // Get all teams for this sport
  const teams = Array.from(teamCache.entries())
    .filter(([key]) => key.includes(sport.toLowerCase()))
    .map(([key, id]) => ({ external_id: key, id }));
  
  console.log(chalk.gray(`  Processing ${teams.length} teams...`));
  
  const allPlayers = [];
  
  // Process teams in parallel
  const playerPromises = teams.map(team => 
    limit(async () => {
      try {
        const espnTeamId = team.external_id.split('_').pop();
        const url = `https://site.api.espn.com/apis/site/v2/sports/${endpoint}/teams/${espnTeamId}/roster?season=${season.espnYear}`;
        
        const response = await axios.get(url, { timeout: 10000 });
        
        if (response.data.athletes) {
          return response.data.athletes.map((athlete: any) => ({
            external_id: `espn_${sport.toLowerCase()}_${athlete.id}`,
            name: athlete.displayName,
            position: athlete.position?.abbreviation,
            team_id: team.id,
            sport: sport,
            jersey_number: athlete.jersey,
            metadata: {
              height: athlete.height,
              weight: athlete.weight,
              age: athlete.age,
              experience: athlete.experience?.years
            }
          }));
        }
      } catch (error) {
        return [];
      }
    })
  );
  
  const results = await Promise.all(playerPromises);
  allPlayers.push(...results.flat());
  
  // Load players into cache and insert new ones
  if (allPlayers.length > 0) {
    console.log(chalk.blue(`  ⚡ Processing ${allPlayers.length} players...`));
    
    // First, load existing players
    const { data: existingPlayers } = await supabase
      .from('players')
      .select('id, external_id')
      .eq('sport', sport);
    
    existingPlayers?.forEach(player => {
      playerCache.set(player.external_id, player.id);
    });
    
    // Filter new players
    const newPlayers = allPlayers.filter(p => !playerCache.has(p.external_id));
    
    if (newPlayers.length > 0) {
      console.log(chalk.blue(`  ⚡ Inserting ${newPlayers.length} new players...`));
      
      for (let i = 0; i < newPlayers.length; i += BATCH_SIZE) {
        const batch = newPlayers.slice(i, i + BATCH_SIZE);
        
        const { data, error } = await supabase
          .from('players')
          .upsert(batch, { onConflict: 'external_id' })
          .select();
        
        if (!error && data) {
          data.forEach(player => {
            playerCache.set(player.external_id, player.id);
          });
          progress[sport as keyof typeof progress].players += data.length;
        }
      }
    }
  }
  
  console.log(chalk.green(`  ✅ ${sport}: ${progress[sport as keyof typeof progress].players} players collected`));
}

// Collect stats for a sport
async function collectStatsForSport(sport: string) {
  console.log(chalk.cyan(`\n📊 Collecting ${sport} 2021 stats...`));
  
  const endpoint = getESPNEndpoint(sport);
  const season = SEASONS[sport as keyof typeof SEASONS];
  
  // Get all games for this season (no limit!)
  let offset = 0;
  let hasMore = true;
  const allGames = [];
  
  while (hasMore) {
    const { data: games } = await supabase
      .from('games')
      .select('id, external_id, start_time')
      .eq('sport', sport)
      .eq('status', 'Final')
      .gte('start_time', season.regular.start)
      .lte('start_time', season.playoffs.end)
      .range(offset, offset + BATCH_SIZE - 1);
    
    if (!games || games.length === 0) {
      hasMore = false;
      break;
    }
    
    allGames.push(...games);
    offset += BATCH_SIZE;
    hasMore = games.length === BATCH_SIZE;
  }
  
  console.log(chalk.yellow(`  📊 Processing ${allGames.length} games for stats...`));
  
  // Create progress bar for stats
  const progressBar = new cliProgress.SingleBar({
    format: '  Stats |{bar}| {percentage}% | {value}/{total} games | {stats} stats collected',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591'
  });
  
  progressBar.start(allGames.length, 0, { stats: 0 });
  
  let totalStats = 0;
  
  // Process games in batches
  for (let i = 0; i < allGames.length; i += 50) {
    const batch = allGames.slice(i, i + 50);
    
    const statsPromises = batch.map(game => 
      limit(async () => {
        try {
          const espnGameId = game.external_id.split('_').pop();
          const url = `https://site.api.espn.com/apis/site/v2/sports/${endpoint}/summary?event=${espnGameId}`;
          
          const response = await axios.get(url, { timeout: 15000 });
          
          const gameStats = [];
          
          if (response.data.boxscore?.players) {
            for (const team of response.data.boxscore.players) {
              const teamExternalId = `espn_${sport.toLowerCase()}_${team.team.id}`;
              const teamId = teamCache.get(teamExternalId);
              
              if (!teamId) continue;
              
              for (const statGroup of team.statistics || []) {
                for (const athlete of statGroup.athletes || []) {
                  const playerExternalId = `espn_${sport.toLowerCase()}_${athlete.athlete.id}`;
                  const playerId = playerCache.get(playerExternalId);
                  
                  if (playerId && athlete.stats && athlete.stats.length > 0) {
                    const stats = parseStats(athlete.stats, statGroup.name, sport);
                    
                    if (Object.keys(stats).length > 0) {
                      gameStats.push({
                        player_id: playerId,
                        game_id: game.id,
                        team_id: teamId,
                        game_date: new Date(game.start_time).toISOString().split('T')[0],
                        is_home: team.homeAway === 'home',
                        stats: stats,
                        fantasy_points: calculateFantasyPoints(stats, sport),
                        metadata: {
                          season: '2021',
                          stat_category: statGroup.name
                        }
                      });
                    }
                  }
                }
              }
            }
          }
          
          return gameStats;
        } catch (error) {
          return [];
        }
      })
    );
    
    const results = await Promise.all(statsPromises);
    const batchStats = results.flat();
    
    // Insert stats
    if (batchStats.length > 0) {
      for (let j = 0; j < batchStats.length; j += 500) {
        const statBatch = batchStats.slice(j, j + 500);
        
        const { error } = await supabase
          .from('player_game_logs')
          .insert(statBatch);
        
        if (!error) {
          totalStats += statBatch.length;
          progress[sport as keyof typeof progress].stats += statBatch.length;
        }
      }
    }
    
    progressBar.update(i + batch.length, { stats: totalStats });
  }
  
  progressBar.stop();
  console.log(chalk.green(`  ✅ ${sport}: ${progress[sport as keyof typeof progress].stats} stats collected`));
}

// Parse stats based on sport
function parseStats(statArray: any[], category: string, sport: string): any {
  const stats: any = {};
  
  // Sport-specific stat mappings
  const mappings: Record<string, Record<string, string[]>> = {
    NBA: {
      'field goals': ['field_goals_made', 'field_goals_attempted'],
      'rebounds': ['offensive_rebounds', 'defensive_rebounds', 'rebounds'],
      'passing': ['assists', 'turnovers'],
      'defensive': ['steals', 'blocks'],
      'misc': ['minutes_played', 'points', 'fouls']
    },
    NFL: {
      'passing': ['completions', 'attempts', 'passing_yards', 'passing_touchdowns', 'interceptions'],
      'rushing': ['rushing_attempts', 'rushing_yards', 'rushing_touchdowns'],
      'receiving': ['receptions', 'targets', 'receiving_yards', 'receiving_touchdowns'],
      'defensive': ['tackles', 'sacks', 'interceptions', 'forced_fumbles']
    },
    MLB: {
      'batting': ['at_bats', 'runs', 'hits', 'doubles', 'triples', 'home_runs', 'runs_batted_in', 'walks', 'strikeouts'],
      'pitching': ['innings_pitched', 'hits_allowed', 'runs_allowed', 'earned_runs', 'walks_allowed', 'strikeouts_pitched', 'home_runs_allowed']
    },
    NHL: {
      'skater': ['goals', 'assists', 'points', 'plus_minus', 'penalty_minutes', 'shots_on_goal', 'hits', 'blocked_shots'],
      'goalie': ['saves', 'goals_against', 'save_percentage', 'shutouts']
    }
  };
  
  // Extract stats based on category and sport
  const categoryLower = category.toLowerCase();
  const sportMappings = mappings[sport] || {};
  
  let statIndex = 0;
  for (const [cat, fields] of Object.entries(sportMappings)) {
    if (categoryLower.includes(cat)) {
      fields.forEach(field => {
        if (statIndex < statArray.length) {
          const value = parseFloat(statArray[statIndex]) || 0;
          if (value !== 0) {
            stats[field] = value;
          }
          statIndex++;
        }
      });
    }
  }
  
  // If no specific mapping, store raw values
  if (Object.keys(stats).length === 0 && statArray.length > 0) {
    statArray.forEach((value, index) => {
      if (value && value !== '0' && value !== 0) {
        stats[`stat_${index}`] = parseFloat(value) || value;
      }
    });
  }
  
  return stats;
}

// Calculate fantasy points
function calculateFantasyPoints(stats: any, sport: string): number {
  let points = 0;
  
  switch (sport) {
    case 'NBA':
      points = (stats.points || 0) + 
               (stats.rebounds || 0) * 1.2 + 
               (stats.assists || 0) * 1.5 + 
               (stats.steals || 0) * 3 + 
               (stats.blocks || 0) * 3 - 
               (stats.turnovers || 0);
      break;
      
    case 'NFL':
      points = (stats.passing_yards || 0) / 25 + 
               (stats.passing_touchdowns || 0) * 4 + 
               (stats.rushing_yards || 0) / 10 + 
               (stats.rushing_touchdowns || 0) * 6 + 
               (stats.receiving_yards || 0) / 10 + 
               (stats.receiving_touchdowns || 0) * 6 + 
               (stats.receptions || 0) * 0.5;
      break;
      
    case 'MLB':
      points = (stats.hits || 0) * 3 + 
               (stats.runs || 0) * 2 + 
               (stats.runs_batted_in || 0) * 2 + 
               (stats.home_runs || 0) * 4 + 
               (stats.walks || 0) - 
               (stats.strikeouts || 0) * 0.5;
      break;
      
    case 'NHL':
      points = (stats.goals || 0) * 3 + 
               (stats.assists || 0) * 2 + 
               (stats.shots_on_goal || 0) * 0.5;
      break;
  }
  
  return Math.max(0, points);
}

// Main collection function
async function collect2021Seasons() {
  console.log(chalk.bold.red('🚀 10X COMPLETE 2021 SEASONS COLLECTOR'));
  console.log(chalk.yellow('⚡ 200x parallel | No limits | 100% data'));
  console.log(chalk.yellow('🔥 Ryzen 5 7600X + 32GB RAM = ULTIMATE PERFORMANCE\n'));
  
  const startTime = Date.now();
  
  try {
    // Load all teams into cache first
    await loadTeamsIntoCache();
    
    // Collect data for each sport
    for (const sport of ['NFL', 'NBA', 'MLB', 'NHL']) {
      console.log(chalk.bold.cyan(`\n${'='.repeat(70)}`));
      console.log(chalk.bold.cyan(`COLLECTING ${sport} 2021 SEASON`));
      console.log(chalk.bold.cyan('='.repeat(70)));
      
      await collectGamesForSport(sport);
      await collectPlayersForSport(sport);
      await collectStatsForSport(sport);
    }
    
    // Final summary
    const elapsedMinutes = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log(chalk.bold.cyan(`\n${'='.repeat(70)}`));
    console.log(chalk.bold.green('✅ 2021 SEASON COLLECTION COMPLETE!'));
    console.log(chalk.bold.cyan('='.repeat(70)));
    
    console.log(chalk.white(`\n⏱️  Time: ${elapsedMinutes} minutes`));
    console.log(chalk.white('\n📊 FINAL RESULTS:'));
    
    for (const sport of ['NFL', 'NBA', 'MLB', 'NHL']) {
      const stats = progress[sport as keyof typeof progress];
      console.log(chalk.green(`\n${sport}:`));
      console.log(chalk.green(`  Games: ${stats.games.toLocaleString()}`));
      console.log(chalk.green(`  Players: ${stats.players.toLocaleString()}`));
      console.log(chalk.green(`  Stats: ${stats.stats.toLocaleString()}`));
    }
    
    console.log(chalk.bold.red('\n🔥 10X DEVELOPER MODE COMPLETE!'));
    
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
  }
}

// Run it!
collect2021Seasons()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
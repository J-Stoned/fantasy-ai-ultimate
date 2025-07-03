#!/usr/bin/env tsx
/**
 * 📥 FETCH HISTORICAL GAMES FROM ESPN
 * 
 * Downloads historical games with box scores directly from ESPN API
 * Stores them with proper external IDs for future reference
 */

import chalk from 'chalk';
import { config } from 'dotenv';
import { schemaAdapter } from '../lib/db/schema-adapter';
import axios from 'axios';
import pLimit from 'p-limit';

// Load environment variables
config({ path: '.env.local' });

// Rate limiting
const limit = pLimit(5);

// ESPN API base URL
const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports';

interface SportConfig {
  sport: string;
  league: string;
  seasons: number[]; // Years to fetch
  seasonType: number; // 2 = regular season, 3 = playoffs
}

const SPORTS_TO_FETCH: SportConfig[] = [
  {
    sport: 'football',
    league: 'nfl',
    seasons: [2023, 2024], // Last 2 seasons
    seasonType: 2
  },
  {
    sport: 'basketball',
    league: 'nba',
    seasons: [2023, 2024],
    seasonType: 2
  },
  {
    sport: 'baseball',
    league: 'mlb',
    seasons: [2023, 2024],
    seasonType: 2
  }
];

async function fetchSeasonGames(config: SportConfig, year: number) {
  const games: any[] = [];
  
  try {
    // ESPN API supports date ranges
    const startDate = `${year}0801`; // August 1st
    const endDate = `${year + 1}0731`; // July 31st next year
    
    const url = `${ESPN_BASE_URL}/${config.sport}/${config.league}/scoreboard`;
    const params = {
      dates: `${startDate}-${endDate}`,
      seasontype: config.seasonType,
      limit: 1000
    };
    
    console.log(chalk.cyan(`Fetching ${config.league.toUpperCase()} ${year} season...`));
    
    const response = await axios.get(url, { params });
    
    if (response.data?.events) {
      games.push(...response.data.events);
      console.log(chalk.green(`  ✅ Found ${response.data.events.length} games`));
    }
  } catch (error: any) {
    console.error(chalk.red(`  ❌ Error fetching ${config.league} ${year}:`), error.message);
  }
  
  return games;
}

async function processGame(game: any, sport: string, league: string) {
  try {
    const competition = game.competitions?.[0];
    if (!competition) return null;
    
    const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home');
    const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away');
    
    if (!homeTeam || !awayTeam) return null;
    
    // Store game with external ID
    const gameData = {
      external_id: `espn_${league}_${game.id}`,
      home_team: homeTeam.team.displayName,
      away_team: awayTeam.team.displayName,
      home_score: parseInt(homeTeam.score || '0'),
      away_score: parseInt(awayTeam.score || '0'),
      status: game.status.type.completed ? 'completed' : 'scheduled',
      game_date: game.date,
      sport: sport,
      venue: competition.venue?.fullName,
      attendance: competition.attendance
    };
    
    const gameId = await schemaAdapter.upsertGame(gameData);
    
    // If game is completed, fetch box score
    if (gameId && game.status.type.completed) {
      await fetchAndStoreBoxScore(game.id, gameId, sport, league);
    }
    
    return gameId;
  } catch (error: any) {
    console.error(chalk.red(`Error processing game ${game.id}:`), error.message);
    return null;
  }
}

async function fetchAndStoreBoxScore(espnGameId: string, gameId: number, sport: string, league: string) {
  try {
    const url = `${ESPN_BASE_URL}/${sport}/${league}/summary?event=${espnGameId}`;
    const response = await axios.get(url);
    
    const boxscore = response.data?.boxscore;
    if (!boxscore?.teams) return;
    
    let playerCount = 0;
    
    // Process each team
    for (const team of boxscore.teams) {
      const teamName = team.team.displayName;
      
      // Process statistics by category
      for (const category of team.statistics || []) {
        for (const athlete of category.athletes || []) {
          // Create/update player
          const playerId = await schemaAdapter.upsertPlayer({
            name: athlete.athlete.displayName,
            position: athlete.athlete.position?.abbreviation,
            team: teamName,
            sport: sport,
            external_id: `espn_${league}_player_${athlete.athlete.id}`,
            jersey_number: athlete.athlete.jersey
          }, 'espn');
          
          if (!playerId) continue;
          
          // Parse and store stats
          const stats = parseStatsForSport(league, category.name, athlete.stats);
          
          if (Object.keys(stats).length > 0) {
            const fantasyPoints = calculateFantasyPoints(league, stats);
            
            await schemaAdapter.upsertPlayerStats({
              player_id: playerId,
              game_id: gameId,
              stats: stats,
              fantasy_points: fantasyPoints,
              game_date: new Date().toISOString() // Will be overridden by game date
            });
            
            playerCount++;
          }
        }
      }
    }
    
    if (playerCount > 0) {
      console.log(chalk.green(`    📊 Stored stats for ${playerCount} players`));
    }
  } catch (error: any) {
    if (error.response?.status !== 404) {
      console.error(chalk.red(`  Failed to fetch box score for game ${espnGameId}:`), error.message);
    }
  }
}

function parseStatsForSport(league: string, category: string, statArray: string[]): Record<string, number> {
  const stats: Record<string, number> = {};
  
  switch (league) {
    case 'nfl':
      if (category === 'passing' && statArray.length >= 9) {
        const [comp, att] = (statArray[0] || '0/0').split('/');
        stats.completions = parseInt(comp || '0');
        stats.attempts = parseInt(att || '0');
        stats.passing_yards = parseInt(statArray[1] || '0');
        stats.passing_tds = parseInt(statArray[2] || '0');
        stats.interceptions = parseInt(statArray[3] || '0');
      } else if (category === 'rushing' && statArray.length >= 5) {
        stats.carries = parseInt(statArray[0] || '0');
        stats.rushing_yards = parseInt(statArray[1] || '0');
        stats.rushing_tds = parseInt(statArray[3] || '0');
      } else if (category === 'receiving' && statArray.length >= 5) {
        stats.receptions = parseInt(statArray[0] || '0');
        stats.receiving_yards = parseInt(statArray[1] || '0');
        stats.receiving_tds = parseInt(statArray[3] || '0');
        stats.targets = parseInt(statArray[4] || '0');
      }
      break;
      
    case 'nba':
      if (statArray.length >= 15) {
        stats.minutes = parseFloat(statArray[0] || '0');
        stats.points = parseInt(statArray[13] || '0');
        stats.rebounds = parseInt(statArray[5] || '0');
        stats.assists = parseInt(statArray[6] || '0');
        stats.steals = parseInt(statArray[7] || '0');
        stats.blocks = parseInt(statArray[8] || '0');
        
        const [fgm, fga] = (statArray[1] || '0-0').split('-');
        stats.field_goals_made = parseInt(fgm || '0');
        stats.field_goals_attempted = parseInt(fga || '0');
        
        const [tpm, tpa] = (statArray[2] || '0-0').split('-');
        stats.three_pointers_made = parseInt(tpm || '0');
        stats.three_pointers_attempted = parseInt(tpa || '0');
      }
      break;
      
    case 'mlb':
      if (category === 'batting' && statArray.length >= 8) {
        stats.at_bats = parseInt(statArray[0] || '0');
        stats.runs = parseInt(statArray[1] || '0');
        stats.hits = parseInt(statArray[2] || '0');
        stats.rbi = parseInt(statArray[3] || '0');
        stats.home_runs = parseInt(statArray[4] || '0');
        stats.batting_avg = parseFloat(statArray[7] || '0');
      } else if (category === 'pitching' && statArray.length >= 10) {
        stats.innings_pitched = parseFloat(statArray[0] || '0');
        stats.hits_allowed = parseInt(statArray[1] || '0');
        stats.runs_allowed = parseInt(statArray[2] || '0');
        stats.earned_runs = parseInt(statArray[3] || '0');
        stats.strikeouts = parseInt(statArray[5] || '0');
        stats.walks = parseInt(statArray[4] || '0');
        stats.era = parseFloat(statArray[9] || '0');
      }
      break;
  }
  
  return stats;
}

function calculateFantasyPoints(league: string, stats: Record<string, number>): number {
  let points = 0;
  
  switch (league) {
    case 'nfl':
      points += (stats.passing_yards || 0) * 0.04;
      points += (stats.passing_tds || 0) * 4;
      points -= (stats.interceptions || 0) * 2;
      points += (stats.rushing_yards || 0) * 0.1;
      points += (stats.rushing_tds || 0) * 6;
      points += (stats.receiving_yards || 0) * 0.1;
      points += (stats.receiving_tds || 0) * 6;
      points += (stats.receptions || 0) * 0.5;
      break;
      
    case 'nba':
      points += (stats.points || 0) * 1;
      points += (stats.rebounds || 0) * 1.2;
      points += (stats.assists || 0) * 1.5;
      points += (stats.steals || 0) * 3;
      points += (stats.blocks || 0) * 3;
      break;
      
    case 'mlb':
      points += (stats.runs || 0) * 2;
      points += (stats.rbi || 0) * 2;
      points += (stats.home_runs || 0) * 4;
      points += (stats.hits || 0) * 1;
      points += (stats.innings_pitched || 0) * 2.25;
      points += (stats.strikeouts || 0) * 2;
      points -= (stats.earned_runs || 0) * 2;
      break;
  }
  
  return Math.round(points * 100) / 100;
}

async function fetchHistoricalGames() {
  console.log(chalk.bold.cyan('\n📥 FETCHING HISTORICAL GAMES FROM ESPN'));
  console.log(chalk.gray('='.repeat(50)));
  
  const startTime = Date.now();
  let totalGames = 0;
  let totalPlayers = 0;
  
  for (const sportConfig of SPORTS_TO_FETCH) {
    console.log(chalk.yellow(`\n🏆 Processing ${sportConfig.league.toUpperCase()}...`));
    
    for (const year of sportConfig.seasons) {
      // Fetch games for this season
      const games = await fetchSeasonGames(sportConfig, year);
      
      if (games.length > 0) {
        console.log(chalk.cyan(`  📦 Processing ${games.length} games...`));
        
        // Process games with rate limiting
        const results = await Promise.all(
          games.map(game => 
            limit(() => processGame(game, sportConfig.sport, sportConfig.league))
          )
        );
        
        const successful = results.filter(r => r !== null).length;
        totalGames += successful;
        
        console.log(chalk.green(`  ✅ Stored ${successful} games`));
      }
      
      // Delay between seasons
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  const duration = Math.round((Date.now() - startTime) / 1000);
  
  console.log(chalk.bold.green('\n✨ HISTORICAL DATA FETCH COMPLETE!'));
  console.log(chalk.gray('='.repeat(50)));
  console.log(chalk.cyan('📊 Summary:'));
  console.log(`  Total Games: ${totalGames}`);
  console.log(`  Duration: ${duration}s`);
  console.log(chalk.yellow('\nNext: Run backfill script to populate player stats'));
}

// Run the fetch
fetchHistoricalGames().catch(console.error);
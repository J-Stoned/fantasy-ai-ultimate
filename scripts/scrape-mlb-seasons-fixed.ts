#!/usr/bin/env node
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// Initialize connections (from operational manual)
const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

const mlbApi = axios.create({
  baseURL: 'https://statsapi.mlb.com/api/v1'
});

// Configuration
const SEASONS = [2023, 2024];
const BATCH_SIZE = 50; // Process games in batches
const DELAY_MS = 1000; // Delay between API calls to be respectful

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// First, ensure all MLB teams are in the database
async function ensureTeamsInDatabase() {
  console.log('📋 Ensuring all MLB teams are in database...');
  
  const response = await mlbApi.get('/teams', {
    params: { sportId: 1 }
  });
  
  const teamsToInsert = response.data.teams.map((team: any) => ({
    id: team.id,
    name: team.name,
    abbreviation: team.abbreviation,
    sport: 'MLB',
    league: team.league?.name || 'MLB',
    division: team.division?.name || 'Unknown',
    venue: team.venue?.name || 'Unknown',
    metadata: {
      mlb_team_id: team.id,
      full_name: team.name,
      team_code: team.teamCode,
      file_code: team.fileCode,
      location_name: team.locationName,
      franchise_name: team.franchiseName,
      club_name: team.clubName
    }
  }));
  
  const { data, error } = await supabase
    .from('teams')
    .upsert(teamsToInsert, {
      onConflict: 'id',
      ignoreDuplicates: false
    });
    
  if (error) {
    console.error('Error inserting teams:', error);
  } else {
    console.log(`✅ Ensured ${teamsToInsert.length} MLB teams are in database`);
  }
  
  return new Map(teamsToInsert.map((t: any) => [t.id, t]));
}

// Convert MLB game data to our database format
function convertGameToDbFormat(mlbGame: any) {
  return {
    external_id: `mlb_${mlbGame.gamePk}`,
    sport: 'MLB',
    league: 'MLB',
    sport_id: 1,
    home_team_id: mlbGame.teams.home.team.id,
    away_team_id: mlbGame.teams.away.team.id,
    start_time: mlbGame.gameDate,
    venue: mlbGame.venue?.name || 'Unknown',
    home_score: mlbGame.teams.home.score || 0,
    away_score: mlbGame.teams.away.score || 0,
    status: mlbGame.status.statusCode === 'F' ? 'final' : mlbGame.status.detailedState.toLowerCase(),
    metadata: {
      mlb_game_pk: mlbGame.gamePk,
      home_team_name: mlbGame.teams.home.team.name,
      away_team_name: mlbGame.teams.away.team.name,
      game_type: mlbGame.gameType,
      season: mlbGame.season,
      series_description: mlbGame.seriesDescription,
      game_number: mlbGame.gameNumber,
      double_header: mlbGame.doubleHeader === 'Y',
      day_night: mlbGame.dayNight,
      scheduled_innings: mlbGame.scheduledInnings,
      innings_played: mlbGame.linescore?.innings?.length || 0,
      weather: mlbGame.weather,
      wind: mlbGame.wind,
      attendance: mlbGame.attendance
    }
  };
}

// Fetch games for a date range
async function fetchGamesForDateRange(startDate: string, endDate: string) {
  try {
    const response = await mlbApi.get('/schedule', {
      params: {
        sportId: 1,
        startDate,
        endDate,
        hydrate: 'team,venue,weather,linescore'
      }
    });
    
    const games = [];
    if (response.data.dates) {
      response.data.dates.forEach((date: any) => {
        if (date.games) {
          games.push(...date.games);
        }
      });
    }
    
    return games;
  } catch (error) {
    console.error(`Error fetching games for ${startDate} to ${endDate}:`, error.message);
    return [];
  }
}

// Insert games into database (handle duplicates properly)
async function insertGamesIntoDatabase(games: any[]) {
  if (games.length === 0) return;
  
  // Remove any duplicate external_ids within the batch
  const uniqueGames = new Map();
  games.forEach(game => {
    uniqueGames.set(game.external_id, game);
  });
  const gamesToInsert = Array.from(uniqueGames.values());
  
  const { data, error } = await supabase
    .from('games')
    .upsert(gamesToInsert, {
      onConflict: 'external_id',
      ignoreDuplicates: false
    });
    
  if (error) {
    console.error('Error inserting games:', error);
  } else {
    console.log(`✅ Inserted/updated ${gamesToInsert.length} games`);
  }
  
  return { data, error };
}

// Fetch player stats for a game (simplified without metadata)
async function fetchGameStats(gamePk: number, gameId: string) {
  try {
    const response = await mlbApi.get(`/game/${gamePk}/boxscore`);
    const stats = [];
    
    // Process home team batting stats
    const homeTeam = response.data.teams?.home;
    if (homeTeam?.players) {
      Object.values(homeTeam.players).forEach((player: any) => {
        if (player.stats?.batting && player.stats.batting.atBats > 0) {
          const batting = player.stats.batting;
          stats.push({
            player_id: `mlb_${player.person.id}`,
            game_id: gameId,
            stat_type: 'hits',
            stat_value: batting.hits || 0,
            fantasy_points: calculateFantasyPoints(batting)
          });
          
          // Add more granular stats
          if (batting.homeRuns > 0) {
            stats.push({
              player_id: `mlb_${player.person.id}`,
              game_id: gameId,
              stat_type: 'home_runs',
              stat_value: batting.homeRuns,
              fantasy_points: batting.homeRuns * 10
            });
          }
          
          if (batting.rbi > 0) {
            stats.push({
              player_id: `mlb_${player.person.id}`,
              game_id: gameId,
              stat_type: 'rbi',
              stat_value: batting.rbi,
              fantasy_points: batting.rbi * 2
            });
          }
        }
        
        // Pitching stats
        if (player.stats?.pitching && player.stats.pitching.inningsPitched > 0) {
          const pitching = player.stats.pitching;
          stats.push({
            player_id: `mlb_${player.person.id}`,
            game_id: gameId,
            stat_type: 'innings_pitched',
            stat_value: parseFloat(pitching.inningsPitched || '0'),
            fantasy_points: calculatePitchingFantasyPoints(pitching)
          });
          
          if (pitching.strikeOuts > 0) {
            stats.push({
              player_id: `mlb_${player.person.id}`,
              game_id: gameId,
              stat_type: 'strikeouts',
              stat_value: pitching.strikeOuts,
              fantasy_points: pitching.strikeOuts * 2
            });
          }
        }
      });
    }
    
    // Process away team stats (similar structure)
    const awayTeam = response.data.teams?.away;
    if (awayTeam?.players) {
      Object.values(awayTeam.players).forEach((player: any) => {
        if (player.stats?.batting && player.stats.batting.atBats > 0) {
          const batting = player.stats.batting;
          stats.push({
            player_id: `mlb_${player.person.id}`,
            game_id: gameId,
            stat_type: 'hits',
            stat_value: batting.hits || 0,
            fantasy_points: calculateFantasyPoints(batting)
          });
          
          if (batting.homeRuns > 0) {
            stats.push({
              player_id: `mlb_${player.person.id}`,
              game_id: gameId,
              stat_type: 'home_runs',
              stat_value: batting.homeRuns,
              fantasy_points: batting.homeRuns * 10
            });
          }
          
          if (batting.rbi > 0) {
            stats.push({
              player_id: `mlb_${player.person.id}`,
              game_id: gameId,
              stat_type: 'rbi',
              stat_value: batting.rbi,
              fantasy_points: batting.rbi * 2
            });
          }
        }
        
        if (player.stats?.pitching && player.stats.pitching.inningsPitched > 0) {
          const pitching = player.stats.pitching;
          stats.push({
            player_id: `mlb_${player.person.id}`,
            game_id: gameId,
            stat_type: 'innings_pitched',
            stat_value: parseFloat(pitching.inningsPitched || '0'),
            fantasy_points: calculatePitchingFantasyPoints(pitching)
          });
          
          if (pitching.strikeOuts > 0) {
            stats.push({
              player_id: `mlb_${player.person.id}`,
              game_id: gameId,
              stat_type: 'strikeouts',
              stat_value: pitching.strikeOuts,
              fantasy_points: pitching.strikeOuts * 2
            });
          }
        }
      });
    }
    
    return stats;
  } catch (error) {
    console.error(`Error fetching stats for game ${gamePk}:`, error.message);
    return [];
  }
}

// Calculate fantasy points for batters
function calculateFantasyPoints(batting: any): number {
  let points = 0;
  points += (batting.hits || 0) * 3;
  points += (batting.doubles || 0) * 2;
  points += (batting.triples || 0) * 3;
  points += (batting.homeRuns || 0) * 10;
  points += (batting.rbi || 0) * 2;
  points += (batting.runs || 0) * 2;
  points += (batting.baseOnBalls || 0) * 1;
  points += (batting.stolenBases || 0) * 5;
  points -= (batting.strikeOuts || 0) * 1;
  return points;
}

// Calculate fantasy points for pitchers
function calculatePitchingFantasyPoints(pitching: any): number {
  let points = 0;
  points += (parseFloat(pitching.inningsPitched || '0')) * 3;
  points += (pitching.strikeOuts || 0) * 2;
  points += (pitching.wins || 0) * 10;
  points += (pitching.saves || 0) * 10;
  points -= (pitching.earnedRuns || 0) * 2;
  points -= (pitching.hits || 0) * 0.5;
  points -= (pitching.baseOnBalls || 0) * 1;
  return points;
}

// Main scraping function
async function scrapeMLBSeasons() {
  console.log('🚀 Starting MLB season scraper for 2023-2024 (FIXED VERSION)...\n');
  
  // First ensure all teams are in the database
  await ensureTeamsInDatabase();
  await delay(2000);
  
  // Track total progress
  let totalGamesProcessed = 0;
  let totalStatsProcessed = 0;
  
  for (const season of SEASONS) {
    console.log(`\n📅 Processing ${season} season...`);
    
    // MLB season typically runs from late March to early October
    const startDate = `${season}-03-20`;
    const endDate = `${season}-10-31`;
    
    // Process in weekly chunks
    let currentDate = new Date(startDate);
    const seasonEndDate = new Date(endDate);
    
    while (currentDate <= seasonEndDate) {
      const chunkStart = currentDate.toISOString().split('T')[0];
      currentDate.setDate(currentDate.getDate() + 7); // Process week by week
      const chunkEnd = currentDate > seasonEndDate ? endDate : currentDate.toISOString().split('T')[0];
      
      console.log(`\nFetching games from ${chunkStart} to ${chunkEnd}...`);
      
      // Fetch games
      const mlbGames = await fetchGamesForDateRange(chunkStart, chunkEnd);
      console.log(`Found ${mlbGames.length} games`);
      
      if (mlbGames.length > 0) {
        // Convert to database format
        const dbGames = mlbGames.map(game => convertGameToDbFormat(game));
        
        // Insert games
        await insertGamesIntoDatabase(dbGames);
        totalGamesProcessed += dbGames.length;
        
        // Get the game IDs we just inserted
        const gameIdMap = new Map();
        dbGames.forEach(game => {
          gameIdMap.set(game.metadata.mlb_game_pk, game.external_id);
        });
        
        // Fetch and insert player stats for completed games
        const completedGames = mlbGames.filter(g => g.status.statusCode === 'F');
        console.log(`Fetching stats for ${completedGames.length} completed games...`);
        
        let statsCount = 0;
        for (let i = 0; i < completedGames.length; i++) {
          const game = completedGames[i];
          const gameId = gameIdMap.get(game.gamePk);
          
          if (gameId) {
            const stats = await fetchGameStats(game.gamePk, gameId);
            if (stats.length > 0) {
              const { error } = await supabase
                .from('player_stats')
                .upsert(stats, {
                  onConflict: 'player_id,game_id,stat_type'
                });
                
              if (!error) {
                statsCount += stats.length;
                totalStatsProcessed += stats.length;
              }
            }
          }
          
          // Progress update
          if ((i + 1) % 10 === 0) {
            console.log(`Progress: ${i + 1}/${completedGames.length} games processed (${statsCount} stats)`);
          }
          
          // Be respectful to the API
          await delay(100);
        }
      }
      
      // Delay between chunks
      await delay(DELAY_MS);
    }
    
    console.log(`\n✅ ${season} season complete!`);
  }
  
  // Final summary
  const { count: gameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB');
    
  const { count: statCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    .like('player_id', 'mlb_%');
    
  console.log('\n🎉 MLB Scraping Complete!');
  console.log(`Total games processed: ${totalGamesProcessed}`);
  console.log(`Total stats processed: ${totalStatsProcessed}`);
  console.log(`Total MLB games in database: ${gameCount}`);
  console.log(`Total MLB player stats in database: ${statCount}`);
}

// Run the scraper
scrapeMLBSeasons().catch(console.error);
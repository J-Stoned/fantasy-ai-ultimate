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

// Get MLB team IDs and map them
async function getMLBTeams() {
  console.log('📋 Fetching MLB teams...');
  const response = await mlbApi.get('/teams', {
    params: { sportId: 1 }
  });
  
  const teams = new Map();
  response.data.teams.forEach((team: any) => {
    teams.set(team.id, {
      id: team.id,
      name: team.name,
      abbreviation: team.abbreviation,
      division: team.division?.name,
      league: team.league?.name
    });
  });
  
  return teams;
}

// Convert MLB game data to our database format
function convertGameToDbFormat(mlbGame: any, teams: Map<any, any>) {
  const homeTeam = teams.get(mlbGame.teams.home.team.id);
  const awayTeam = teams.get(mlbGame.teams.away.team.id);
  
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
      home_team_name: homeTeam?.name,
      away_team_name: awayTeam?.name,
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

// Insert games into database
async function insertGamesIntoDatabase(games: any[]) {
  if (games.length === 0) return;
  
  const { data, error } = await supabase
    .from('games')
    .upsert(games, {
      onConflict: 'external_id',
      ignoreDuplicates: false
    });
    
  if (error) {
    console.error('Error inserting games:', error);
  } else {
    console.log(`✅ Inserted/updated ${games.length} games`);
  }
  
  return { data, error };
}

// Fetch player stats for a game
async function fetchGameStats(gamePk: number) {
  try {
    const response = await mlbApi.get(`/game/${gamePk}/boxscore`);
    const stats = [];
    
    // Process home team stats
    const homeTeam = response.data.teams?.home;
    if (homeTeam?.players) {
      Object.values(homeTeam.players).forEach((player: any) => {
        if (player.stats?.batting) {
          const batting = player.stats.batting;
          stats.push({
            player_id: `mlb_${player.person.id}`,
            game_id: `mlb_${gamePk}`,
            stat_type: 'batting_avg',
            stat_value: parseFloat(batting.avg || '0'),
            fantasy_points: calculateFantasyPoints(batting),
            metadata: {
              player_name: player.person.fullName,
              team: 'home',
              position: player.position?.abbreviation,
              batting_order: player.battingOrder,
              stats: batting
            }
          });
        }
        
        if (player.stats?.pitching) {
          const pitching = player.stats.pitching;
          stats.push({
            player_id: `mlb_${player.person.id}`,
            game_id: `mlb_${gamePk}`,
            stat_type: 'era',
            stat_value: parseFloat(pitching.era || '0'),
            fantasy_points: calculatePitchingFantasyPoints(pitching),
            metadata: {
              player_name: player.person.fullName,
              team: 'home',
              position: 'P',
              stats: pitching
            }
          });
        }
      });
    }
    
    // Process away team stats
    const awayTeam = response.data.teams?.away;
    if (awayTeam?.players) {
      Object.values(awayTeam.players).forEach((player: any) => {
        if (player.stats?.batting) {
          const batting = player.stats.batting;
          stats.push({
            player_id: `mlb_${player.person.id}`,
            game_id: `mlb_${gamePk}`,
            stat_type: 'batting_avg',
            stat_value: parseFloat(batting.avg || '0'),
            fantasy_points: calculateFantasyPoints(batting),
            metadata: {
              player_name: player.person.fullName,
              team: 'away',
              position: player.position?.abbreviation,
              batting_order: player.battingOrder,
              stats: batting
            }
          });
        }
        
        if (player.stats?.pitching) {
          const pitching = player.stats.pitching;
          stats.push({
            player_id: `mlb_${player.person.id}`,
            game_id: `mlb_${gamePk}`,
            stat_type: 'era',
            stat_value: parseFloat(pitching.era || '0'),
            fantasy_points: calculatePitchingFantasyPoints(pitching),
            metadata: {
              player_name: player.person.fullName,
              team: 'away',
              position: 'P',
              stats: pitching
            }
          });
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
  points += (pitching.inningsPitched || 0) * 3;
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
  console.log('🚀 Starting MLB season scraper for 2023-2024...\n');
  
  // Get team mappings
  const teams = await getMLBTeams();
  console.log(`Found ${teams.size} MLB teams\n`);
  
  for (const season of SEASONS) {
    console.log(`\n📅 Processing ${season} season...`);
    
    // MLB season typically runs from late March to early October
    const startDate = `${season}-03-20`;
    const endDate = `${season}-10-31`;
    
    // Process in monthly chunks
    let currentDate = new Date(startDate);
    const seasonEndDate = new Date(endDate);
    let totalGames = 0;
    let totalStats = 0;
    
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
        const dbGames = mlbGames.map(game => convertGameToDbFormat(game, teams));
        
        // Insert games
        await insertGamesIntoDatabase(dbGames);
        totalGames += dbGames.length;
        
        // Fetch and insert player stats for completed games
        const completedGames = mlbGames.filter(g => g.status.statusCode === 'F');
        console.log(`Fetching stats for ${completedGames.length} completed games...`);
        
        for (let i = 0; i < completedGames.length; i += BATCH_SIZE) {
          const batch = completedGames.slice(i, i + BATCH_SIZE);
          
          for (const game of batch) {
            const stats = await fetchGameStats(game.gamePk);
            if (stats.length > 0) {
              const { error } = await supabase
                .from('player_stats')
                .upsert(stats, {
                  onConflict: 'player_id,game_id,stat_type'
                });
                
              if (error) {
                console.error('Error inserting stats:', error);
              } else {
                totalStats += stats.length;
              }
            }
            
            // Be respectful to the API
            await delay(100);
          }
          
          console.log(`Progress: ${Math.min(i + BATCH_SIZE, completedGames.length)}/${completedGames.length} games processed`);
        }
      }
      
      // Delay between chunks
      await delay(DELAY_MS);
    }
    
    console.log(`\n✅ ${season} season complete: ${totalGames} games, ${totalStats} player stats`);
  }
  
  // Final summary
  const { count: gameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB');
    
  const { count: statCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    .like('game_id', 'mlb_%');
    
  console.log('\n🎉 MLB Scraping Complete!');
  console.log(`Total MLB games in database: ${gameCount}`);
  console.log(`Total MLB player stats in database: ${statCount}`);
}

// Run the scraper
scrapeMLBSeasons().catch(console.error);
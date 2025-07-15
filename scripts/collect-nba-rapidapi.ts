#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// Using API-NBA from RapidAPI (free tier available)
const nbaApi = axios.create({
  baseURL: 'https://api-nba-v1.p.rapidapi.com',
  timeout: 15000,
  headers: {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '', // Sign up free at rapidapi.com
    'X-RapidAPI-Host': 'api-nba-v1.p.rapidapi.com'
  }
});

console.log('🏀 NBA DATA COLLECTOR - RapidAPI');
console.log('📊 Using API-NBA v1 (free tier: 100 requests/day)\n');

const CONFIG = {
  SEASON: 2024, // 2024-25 season
  CONCURRENT_CALLS: 3, // Be conservative with free tier
  BATCH_SIZE: 100,
  DELAY_MS: 1500, // 1.5 seconds between requests
  MAX_GAMES: 50 // Limit for free tier
};

// Tracking
let gamesCollected = 0;
let statsCollected = 0;
let playersFound = 0;

// NBA team mappings for API-NBA
const NBA_TEAMS: Record<number, { name: string, code: string, logo: string }> = {
  1: { name: 'Atlanta Hawks', code: 'ATL', logo: '' },
  2: { name: 'Boston Celtics', code: 'BOS', logo: '' },
  4: { name: 'Brooklyn Nets', code: 'BKN', logo: '' },
  5: { name: 'Charlotte Hornets', code: 'CHA', logo: '' },
  6: { name: 'Chicago Bulls', code: 'CHI', logo: '' },
  7: { name: 'Cleveland Cavaliers', code: 'CLE', logo: '' },
  8: { name: 'Dallas Mavericks', code: 'DAL', logo: '' },
  9: { name: 'Denver Nuggets', code: 'DEN', logo: '' },
  10: { name: 'Detroit Pistons', code: 'DET', logo: '' },
  11: { name: 'Golden State Warriors', code: 'GSW', logo: '' },
  14: { name: 'Houston Rockets', code: 'HOU', logo: '' },
  15: { name: 'Indiana Pacers', code: 'IND', logo: '' },
  16: { name: 'LA Clippers', code: 'LAC', logo: '' },
  17: { name: 'Los Angeles Lakers', code: 'LAL', logo: '' },
  19: { name: 'Memphis Grizzlies', code: 'MEM', logo: '' },
  20: { name: 'Miami Heat', code: 'MIA', logo: '' },
  21: { name: 'Milwaukee Bucks', code: 'MIL', logo: '' },
  22: { name: 'Minnesota Timberwolves', code: 'MIN', logo: '' },
  23: { name: 'New Orleans Pelicans', code: 'NOP', logo: '' },
  24: { name: 'New York Knicks', code: 'NYK', logo: '' },
  25: { name: 'Oklahoma City Thunder', code: 'OKC', logo: '' },
  26: { name: 'Orlando Magic', code: 'ORL', logo: '' },
  27: { name: 'Philadelphia 76ers', code: 'PHI', logo: '' },
  28: { name: 'Phoenix Suns', code: 'PHX', logo: '' },
  29: { name: 'Portland Trail Blazers', code: 'POR', logo: '' },
  30: { name: 'Sacramento Kings', code: 'SAC', logo: '' },
  31: { name: 'San Antonio Spurs', code: 'SAS', logo: '' },
  38: { name: 'Toronto Raptors', code: 'TOR', logo: '' },
  40: { name: 'Utah Jazz', code: 'UTA', logo: '' },
  41: { name: 'Washington Wizards', code: 'WAS', logo: '' }
};

// Progress bar
const progressBar = new cliProgress.SingleBar({
  format: '🏀 Progress |{bar}| {percentage}% | {value}/{total} | {task}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true
});

async function ensureNBATeams() {
  console.log('🏟️  Ensuring NBA teams exist...');
  
  const teamsToInsert = Object.entries(NBA_TEAMS).map(([id, team]) => ({
    id: 11000 + parseInt(id), // New offset to avoid conflicts
    name: team.name,
    abbreviation: team.code,
    sport: 'NBA',
    external_id: `api_nba_${id}`
  }));
  
  const { error } = await supabase
    .from('teams')
    .upsert(teamsToInsert, { onConflict: 'id' });
    
  if (!error) {
    console.log(`✅ ${teamsToInsert.length} NBA teams ready\n`);
  }
}

async function testAPIConnection() {
  console.log('🔌 Testing API connection...');
  try {
    const response = await nbaApi.get('/status');
    if (response.data.response) {
      console.log('✅ API connection successful!\n');
      return true;
    }
  } catch (error: any) {
    console.error('❌ API connection failed!');
    console.error('Please sign up for a free RapidAPI key at:');
    console.error('https://rapidapi.com/api-sports/api/api-nba\n');
    console.error('Then update the X-RapidAPI-Key in this script.\n');
    return false;
  }
}

async function fetchNBAGames() {
  try {
    // Get games from current season
    const response = await nbaApi.get('/games', {
      params: {
        season: CONFIG.SEASON
      }
    });
    
    if (!response.data.response || response.data.response.length === 0) {
      console.log('No games found for season', CONFIG.SEASON);
      return [];
    }
    
    const games = response.data.response
      .filter((game: any) => game.status.long === 'Finished')
      .slice(0, CONFIG.MAX_GAMES) // Limit for free tier
      .map((game: any) => ({
        external_id: `api_nba_${game.id}`,
        sport: 'NBA',
        start_time: game.date.start,
        status: 'final',
        home_team_id: 11000 + game.teams.home.id,
        away_team_id: 11000 + game.teams.visitors.id,
        home_score: game.scores.home.points || 0,
        away_score: game.scores.visitors.points || 0,
        venue: game.arena.name || 'Unknown',
        metadata: {
          season: CONFIG.SEASON,
          stage: game.stage,
          week: game.week,
          periods: game.periods,
          arena_city: game.arena.city,
          arena_state: game.arena.state,
          game_duration: game.status.duration
        }
      }));
    
    return games;
  } catch (error: any) {
    console.error('Error fetching games:', error.message);
    return [];
  }
}

async function fetchGameStats(gameId: number) {
  try {
    const response = await nbaApi.get('/players/statistics', {
      params: {
        game: gameId
      }
    });
    
    if (!response.data.response || response.data.response.length === 0) {
      return { stats: [], players: [] };
    }
    
    const stats: any[] = [];
    const players = new Map<number, any>();
    
    response.data.response.forEach((playerStat: any) => {
      const playerId = 12000 + playerStat.player.id; // Offset for players
      
      // Add player if new
      if (!players.has(playerId)) {
        players.set(playerId, {
          id: playerId,
          name: `${playerStat.player.firstname} ${playerStat.player.lastname}`,
          sport: 'NBA',
          position: playerStat.pos || 'N/A',
          external_id: `api_nba_${playerStat.player.id}`,
          metadata: {
            team_id: playerStat.team.id,
            jersey: playerStat.player.jersey
          }
        });
      }
      
      // Parse stats if player played
      const minutes = parseInt(playerStat.min || '0');
      if (minutes > 0) {
        const statTypes = [
          { type: 'minutes', value: minutes, fantasy: 0 },
          { type: 'points', value: playerStat.points || 0, fantasy: playerStat.points || 0 },
          { type: 'rebounds', value: playerStat.totReb || 0, fantasy: (playerStat.totReb || 0) * 1.2 },
          { type: 'assists', value: playerStat.assists || 0, fantasy: (playerStat.assists || 0) * 1.5 },
          { type: 'steals', value: playerStat.steals || 0, fantasy: (playerStat.steals || 0) * 3 },
          { type: 'blocks', value: playerStat.blocks || 0, fantasy: (playerStat.blocks || 0) * 3 },
          { type: 'turnovers', value: playerStat.turnovers || 0, fantasy: -(playerStat.turnovers || 0) },
          { type: 'fg_made', value: playerStat.fgm || 0, fantasy: 0 },
          { type: 'fg_attempted', value: playerStat.fga || 0, fantasy: 0 },
          { type: '3pt_made', value: playerStat.tpm || 0, fantasy: (playerStat.tpm || 0) * 0.5 },
          { type: '3pt_attempted', value: playerStat.tpa || 0, fantasy: 0 },
          { type: 'ft_made', value: playerStat.ftm || 0, fantasy: 0 },
          { type: 'ft_attempted', value: playerStat.fta || 0, fantasy: 0 },
          { type: 'offensive_rebounds', value: playerStat.offReb || 0, fantasy: (playerStat.offReb || 0) * 0.5 },
          { type: 'defensive_rebounds', value: playerStat.defReb || 0, fantasy: (playerStat.defReb || 0) * 0.5 },
          { type: 'personal_fouls', value: playerStat.pFouls || 0, fantasy: 0 }
        ];
        
        statTypes.forEach(s => {
          if (s.value > 0 || s.type === 'turnovers') {
            stats.push({
              player_id: playerId,
              game_id: gameId, // Will be mapped later
              stat_type: s.type,
              stat_value: s.value,
              fantasy_points: s.fantasy,
              sport: 'NBA'
            });
          }
        });
      }
    });
    
    return {
      stats,
      players: Array.from(players.values())
    };
  } catch (error: any) {
    console.error('Error fetching stats:', error.message);
    return { stats: [], players: [] };
  }
}

async function collectNBAData() {
  const startTime = Date.now();
  
  // Test API connection first
  const apiConnected = await testAPIConnection();
  if (!apiConnected) {
    console.log('\n⚠️  Please get a free API key and update this script!');
    console.log('Instructions:');
    console.log('1. Go to https://rapidapi.com/api-sports/api/api-nba');
    console.log('2. Click "Subscribe to Test" (free tier available)');
    console.log('3. Copy your API key');
    console.log('4. Update line 17 of this script with your key\n');
    return;
  }
  
  await ensureNBATeams();
  
  // Fetch games
  console.log(`📅 Fetching ${CONFIG.SEASON} season games...\n`);
  const games = await fetchNBAGames();
  
  if (games.length === 0) {
    console.log('No games found to process.');
    return;
  }
  
  console.log(`📊 Found ${games.length} finished games`);
  
  // Insert games
  console.log('\n💾 Inserting games...');
  const { data: insertedGames, error } = await supabase
    .from('games')
    .upsert(games, { onConflict: 'external_id' })
    .select();
    
  if (insertedGames) {
    gamesCollected = insertedGames.length;
    console.log(`✅ Inserted ${gamesCollected} games`);
    
    // Collect stats for games
    console.log('\n📊 Collecting player stats...\n');
    progressBar.start(insertedGames.length, 0, { task: 'Fetching stats' });
    
    const limit = pLimit(CONFIG.CONCURRENT_CALLS);
    let processedCount = 0;
    
    const statPromises = insertedGames.map(game => 
      limit(async () => {
        const apiGameId = parseInt(game.external_id.replace('api_nba_', ''));
        const result = await fetchGameStats(apiGameId);
        
        // Insert players
        if (result.players.length > 0) {
          await supabase
            .from('players')
            .upsert(result.players, { onConflict: 'id' });
          playersFound += result.players.length;
        }
        
        // Map game ID and insert stats
        if (result.stats.length > 0) {
          const mappedStats = result.stats.map(s => ({
            ...s,
            game_id: game.id
          }));
          
          const { data: statsData } = await supabase
            .from('player_stats')
            .insert(mappedStats)
            .select();
            
          if (statsData) statsCollected += statsData.length;
        }
        
        processedCount++;
        progressBar.update(processedCount);
        
        // Rate limit
        await new Promise(r => setTimeout(r, CONFIG.DELAY_MS));
      })
    );
    
    await Promise.all(statPromises);
    progressBar.stop();
  }
  
  // Summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\n\n✅ NBA DATA COLLECTION COMPLETE!\n');
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`🎮 Games collected: ${gamesCollected}`);
  console.log(`📊 Stats collected: ${statsCollected}`);
  console.log(`👥 Players found: ${playersFound}`);
  
  // Check totals
  const { count: nbaGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA');
    
  const { count: nbaStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA');
    
  console.log('\n📈 NBA Database Totals:');
  console.log(`🏀 Total NBA games: ${nbaGames}`);
  console.log(`📊 Total NBA stats: ${nbaStats}`);
  
  if (statsCollected === 0) {
    console.log('\n⚠️  No stats collected. This could mean:');
    console.log('1. You need to update the API key on line 17');
    console.log('2. The free tier limit has been reached');
    console.log('3. Try again tomorrow (limits reset daily)');
  }
}

// Main
async function main() {
  try {
    require('p-limit');
    require('cli-progress');
  } catch {
    console.log('📦 Installing packages...');
    const { execSync } = require('child_process');
    execSync('npm install p-limit cli-progress', { stdio: 'inherit' });
  }
  
  await collectNBAData();
}

main().catch(console.error);
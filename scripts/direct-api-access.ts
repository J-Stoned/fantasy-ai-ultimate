#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// 1. SUPABASE DIRECT ACCESS
const supabaseUrl = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// Example: Query your games table
async function queryGames() {
  console.log('\n📊 Querying Supabase Games...');
  
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('status', 'final')
    .order('start_time', { ascending: false })
    .limit(5);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Found ${data?.length} games:`);
  data?.forEach(game => {
    console.log(`- Team ${game.home_team_id} vs Team ${game.away_team_id} (${game.start_time})`);
  });
}

// Example: Get player stats
async function getPlayerStats(playerId: string) {
  const { data, error } = await supabase
    .from('player_stats')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(10);
    
  return data;
}

// 2. BALLDONTLIE NBA API
const ballDontLieApiKey = '59de4292-dfc4-4a8a-b337-1e804f4109c6';
const ballDontLieApi = axios.create({
  baseURL: 'https://api.balldontlie.io/v1',
  headers: {
    'Authorization': ballDontLieApiKey
  }
});

async function getNBAGames() {
  console.log('\n🏀 Fetching NBA Games from BallDontLie...');
  
  try {
    const response = await ballDontLieApi.get('/games', {
      params: {
        start_date: '2025-01-10',
        end_date: '2025-01-14',
        per_page: 10
      }
    });
    
    console.log(`Found ${response.data.data.length} NBA games`);
    response.data.data.forEach((game: any) => {
      console.log(`- ${game.home_team.full_name} vs ${game.visitor_team.full_name}`);
    });
  } catch (error) {
    console.error('BallDontLie API error:', error);
  }
}

async function getNBAPlayerStats(playerId: number) {
  try {
    const response = await ballDontLieApi.get('/stats', {
      params: {
        player_ids: [playerId],
        per_page: 10
      }
    });
    
    return response.data.data;
  } catch (error) {
    console.error('BallDontLie API error:', error);
    return [];
  }
}

// 3. MLB API (MLB-Stats-API)
const mlbApi = axios.create({
  baseURL: 'https://statsapi.mlb.com/api/v1'
});

async function getMLBGames() {
  console.log('\n⚾ Fetching MLB Games...');
  
  try {
    const response = await mlbApi.get('/schedule', {
      params: {
        sportId: 1,
        startDate: '2024-10-01',
        endDate: '2024-10-07'
      }
    });
    
    const games = response.data.dates.flatMap((date: any) => date.games);
    console.log(`Found ${games.length} MLB games`);
    games.slice(0, 5).forEach((game: any) => {
      console.log(`- ${game.teams.home.team.name} vs ${game.teams.away.team.name}`);
    });
  } catch (error) {
    console.error('MLB API error:', error);
  }
}

async function getMLBPlayerStats(playerId: number) {
  try {
    const response = await mlbApi.get(`/people/${playerId}/stats`, {
      params: {
        stats: 'season',
        season: 2024
      }
    });
    
    return response.data.stats;
  } catch (error) {
    console.error('MLB API error:', error);
    return [];
  }
}

// 4. REDIS CONNECTION (if needed)
// import Redis from 'ioredis';
// const redis = new Redis('redis://localhost:6379');

// 5. DIRECT POSTGRES QUERIES
import { Pool } from 'pg';

const pgPool = new Pool({
  connectionString: 'postgresql://postgres:process.env.DB_PASSWORD || ''@db.pvekvqiqrrpugfmpgaup.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function directPostgresQuery() {
  console.log('\n🐘 Direct PostgreSQL Query...');
  
  try {
    const result = await pgPool.query(`
      SELECT 
        COUNT(*) as total_games,
        COUNT(CASE WHEN status = 'final' THEN 1 END) as completed_games
      FROM games
    `);
    
    console.log('Database stats:', result.rows[0]);
  } catch (error) {
    console.error('Postgres error:', error.message);
  }
}

// Run examples
async function runExamples() {
  console.log('🚀 Direct API Access Examples\n');
  
  // Supabase
  await queryGames();
  
  // NBA API
  await getNBAGames();
  
  // MLB API
  await getMLBGames();
  
  // Direct Postgres
  await directPostgresQuery();
  
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  runExamples();
}

// Export for use in other files
export {
  supabase,
  ballDontLieApi,
  mlbApi,
  pgPool,
  getNBAGames,
  getNBAPlayerStats,
  getMLBGames,
  getMLBPlayerStats,
  getPlayerStats
};
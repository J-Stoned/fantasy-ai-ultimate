#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

// Direct connection (from direct-api-access.ts)
const supabaseUrl = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

const pgPool = new Pool({
  connectionString: 'postgresql://postgres:process.env.DB_PASSWORD || ''@db.pvekvqiqrrpugfmpgaup.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkNBASchema() {
  console.log('🏀 Checking NBA database schema...\n');

  // Check for NBA-related data in player_stats
  const { data: nbaStats, count } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact' })
    .like('player_id', 'espn_nba_%')
    .limit(5);

  console.log(`NBA stats in player_stats table: ${count || 0}`);
  if (nbaStats && nbaStats.length > 0) {
    console.log('Sample NBA stat structure:', Object.keys(nbaStats[0]));
    console.log('Sample data:', nbaStats[0]);
  }

  // Check for NBA games
  const { data: nbaGames, count: gameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact' })
    .eq('sport', 'NBA')
    .limit(5);

  console.log(`\nNBA games in database: ${gameCount || 0}`);
  if (nbaGames && nbaGames.length > 0) {
    console.log('Sample NBA game:', nbaGames[0]);
  }

  // Check for NBA players
  const { data: nbaPlayers, count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact' })
    .like('id', 'espn_nba_%')
    .limit(5);

  console.log(`\nNBA players in database: ${playerCount || 0}`);
  if (nbaPlayers && nbaPlayers.length > 0) {
    console.log('Sample NBA player:', nbaPlayers[0]);
  }
}

checkNBASchema().catch(console.error).finally(() => {
  pgPool.end();
  process.exit(0);
});
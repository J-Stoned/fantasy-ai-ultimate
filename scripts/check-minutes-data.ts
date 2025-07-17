#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMinutesData() {
  // Check if we have any minutes data
  const { count: logsWithMinutes } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .gt('minutes', 0);
    
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
    
  console.log('Player game logs with minutes > 0:', logsWithMinutes);
  console.log('Total player game logs:', totalLogs);
  
  // Check a sample to see what the minutes column looks like
  const { data: sample } = await supabase
    .from('player_game_logs')
    .select('id, game_id, player_id, minutes, fantasy_points, sport')
    .limit(10);
    
  console.log('\nSample of player_game_logs:');
  console.log(sample);
  
  // Check if minutes column is NULL
  const { count: nullMinutes } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .is('minutes', null);
    
  console.log('\nLogs with NULL minutes:', nullMinutes);
  
  // Check by sport
  const { data: sportCounts } = await supabase
    .from('player_game_logs')
    .select('sport')
    .not('minutes', 'is', null)
    .gt('minutes', 0);
    
  const sportMap = new Map();
  sportCounts?.forEach(row => {
    sportMap.set(row.sport, (sportMap.get(row.sport) || 0) + 1);
  });
  
  console.log('\nLogs with minutes > 0 by sport:');
  for (const [sport, count] of sportMap) {
    console.log(`- ${sport}: ${count}`);
  }
  
  // Check if we need to look at a different column
  const { data: columns } = await supabase
    .from('player_game_logs')
    .select('*')
    .limit(1);
    
  if (columns && columns.length > 0) {
    console.log('\nAvailable columns in player_game_logs:');
    console.log(Object.keys(columns[0]));
  }
  
  // Let's check games with lots of player logs
  const { data: gamesWithLogs } = await supabase
    .rpc('get_games_with_player_counts', { min_players: 10 })
    .limit(5);
    
  if (gamesWithLogs) {
    console.log('\nGames with 10+ player logs:');
    console.log(gamesWithLogs);
  }
}

// First create the RPC function if it doesn't exist
async function createRPCFunction() {
  const sql = `
    CREATE OR REPLACE FUNCTION get_games_with_player_counts(min_players INT DEFAULT 10)
    RETURNS TABLE(game_id TEXT, player_count BIGINT)
    LANGUAGE sql
    AS $$
      SELECT game_id, COUNT(*) as player_count
      FROM player_game_logs
      GROUP BY game_id
      HAVING COUNT(*) >= min_players
      ORDER BY player_count DESC
    $$;
  `;
  
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error && !error.message.includes('already exists')) {
    console.error('Error creating function:', error);
  }
}

async function analyzeGameStructure() {
  // Let's look at a specific game to understand the data
  const { data: nbaGame } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NBA')
    .not('home_score', 'is', null)
    .limit(1)
    .single();
    
  if (nbaGame) {
    console.log('\n--- Analyzing NBA Game ---');
    console.log('Game ID:', nbaGame.id);
    
    const { data: gameLogs, count } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact' })
      .eq('game_id', nbaGame.id);
      
    console.log('Player logs for this game:', count);
    
    if (gameLogs && gameLogs.length > 0) {
      console.log('\nFirst player log:');
      console.log(gameLogs[0]);
      
      // Check which fields might contain playing time
      const timeFields = ['minutes', 'min', 'mins', 'playing_time', 'time_played'];
      for (const field of timeFields) {
        if (field in gameLogs[0]) {
          console.log(`Found time field "${field}":`, gameLogs[0][field]);
        }
      }
    }
  }
}

async function main() {
  try {
    await createRPCFunction();
  } catch (e) {
    // Ignore if function already exists
  }
  
  await checkMinutesData();
  await analyzeGameStructure();
}

main().catch(console.error);
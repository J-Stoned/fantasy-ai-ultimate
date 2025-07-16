#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMLBCoverage() {
  // Count MLB games
  const { count: mlbGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .or('sport_id.eq.mlb,sport_id.eq.MLB')
    .eq('status', 'completed')
    .not('home_score', 'is', null);
    
  // Get all MLB game IDs
  const { data: allMLBGames } = await supabase
    .from('games')
    .select('id')
    .or('sport_id.eq.mlb,sport_id.eq.MLB')
    .eq('status', 'completed')
    .not('home_score', 'is', null);
    
  const mlbGameIds = allMLBGames?.map(g => g.id) || [];
  
  // Count MLB games with stats
  const { data: mlbGamesWithStats } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .in('game_id', mlbGameIds);
      
  const uniqueGamesWithStats = new Set(mlbGamesWithStats?.map(g => g.game_id) || []);
  
  // Count MLB stats
  const { count: mlbStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('game_id', mlbGameIds);
    
  console.log('MLB Coverage Check:');
  console.log('==================');
  console.log(`Total MLB games: ${mlbGames}`);
  console.log(`MLB games with stats: ${uniqueGamesWithStats.size}`);
  console.log(`Coverage: ${((uniqueGamesWithStats.size / (mlbGames || 1)) * 100).toFixed(1)}%`);
  console.log(`Total MLB stats: ${mlbStats}`);
  console.log(`Avg stats per game: ${(mlbStats! / uniqueGamesWithStats.size).toFixed(1)}`);
  
  // Check games without stats
  const gamesWithoutStats = mlbGameIds.filter(id => !uniqueGamesWithStats.has(id));
  console.log(`\nGames missing stats: ${gamesWithoutStats.length}`);
  
  if (gamesWithoutStats.length > 0) {
    // Sample a few games without stats
    const { data: sampleGames } = await supabase
      .from('games')
      .select('id, external_id, start_time, home_team_id, away_team_id')
      .in('id', gamesWithoutStats.slice(0, 5));
      
    console.log('\nSample games without stats:');
    sampleGames?.forEach(g => {
      console.log(`- Game ${g.id}: ${g.external_id} (${g.start_time})`);
    });
  }
}

checkMLBCoverage().catch(console.error);
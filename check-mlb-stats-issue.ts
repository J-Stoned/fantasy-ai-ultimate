import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkMLBStatsIssue() {
  console.log('🔍 Investigating MLB Stats Issue...\n');

  // 1. Count MLB games
  const { count: mlbGamesCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB');
  
  console.log(`Total MLB games: ${mlbGamesCount}`);

  // 2. Count MLB stats
  const { count: mlbStatsCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB');
  
  console.log(`Total MLB stats: ${mlbStatsCount}`);

  // 3. Get sample of MLB games
  const { data: sampleGames } = await supabase
    .from('games')
    .select('id, external_id, home_team_score, away_team_score, status')
    .eq('sport', 'MLB')
    .limit(3);
  
  console.log('\nSample MLB games:');
  console.log(sampleGames);

  // 4. Get sample of MLB stats
  const { data: sampleStats } = await supabase
    .from('player_stats')
    .select('id, game_id, player_id, sport')
    .eq('sport', 'MLB')
    .limit(3);
  
  console.log('\nSample MLB stats:');
  console.log(sampleStats);

  // 5. Check how many unique games have stats
  if (sampleStats && sampleStats.length > 0) {
    // Get unique game IDs from stats
    const { data: uniqueGameIds } = await supabase
      .from('player_stats')
      .select('game_id')
      .eq('sport', 'MLB');
    
    const uniqueGames = new Set(uniqueGameIds?.map(s => s.game_id));
    console.log(`\nUnique games with MLB stats: ${uniqueGames.size}`);
    
    // Check if these game IDs exist in games table
    const sampleGameId = Array.from(uniqueGames)[0];
    const { data: gameCheck } = await supabase
      .from('games')
      .select('id, sport, external_id')
      .eq('id', sampleGameId);
    
    console.log(`\nChecking game ID ${sampleGameId}:`);
    console.log(gameCheck);
  }

  // 6. Check for completed MLB games without stats
  const { data: completedGamesWithoutStats } = await supabase
    .from('games')
    .select('id, external_id')
    .eq('sport', 'MLB')
    .eq('status', 'Final')
    .is('home_team_score', 'not.null')
    .limit(5);

  console.log('\nSample completed MLB games (should have stats):');
  console.log(completedGamesWithoutStats);

  // 7. Cross-check: Do these games have stats?
  if (completedGamesWithoutStats && completedGamesWithoutStats.length > 0) {
    const gameId = completedGamesWithoutStats[0].id;
    const { count: statsForGame } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', gameId);
    
    console.log(`\nStats count for game ${gameId}: ${statsForGame}`);
  }
}

checkMLBStatsIssue().catch(console.error);

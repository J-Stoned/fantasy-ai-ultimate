import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function solveTheNHLMystery() {
  console.log('🔍 THE NHL MYSTERY: 934K STATS FROM 7 GAMES?!\n');
  console.log('='.repeat(80));

  // Get ALL unique game_ids from player_stats
  console.log('📊 Scanning ALL player_stats for unique game_ids...\n');
  
  let allGameIds = new Set<number>();
  let offset = 0;
  const batchSize = 50000;
  
  while (true) {
    const { data: batch, error } = await supabase
      .from('player_stats')
      .select('game_id')
      .range(offset, offset + batchSize - 1);
    
    if (error || !batch || batch.length === 0) break;
    
    batch.forEach(s => allGameIds.add(s.game_id));
    console.log(`Processed ${offset + batch.length} stats... Found ${allGameIds.size} unique game_ids so far`);
    
    offset += batchSize;
    if (batch.length < batchSize) break;
  }
  
  console.log(`\n✅ TOTAL UNIQUE GAME_IDS IN PLAYER_STATS: ${allGameIds.size}`);
  
  // Now check how many exist in games table
  const gameIdArray = Array.from(allGameIds);
  let existingCount = 0;
  let missingCount = 0;
  
  for (let i = 0; i < gameIdArray.length; i += 500) {
    const batch = gameIdArray.slice(i, i + 500);
    const { count, error } = await supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .in('id', batch);
    
    if (!error && count !== null) {
      existingCount += count;
      missingCount += (batch.length - count);
    }
  }
  
  console.log(`\n🎯 GAME EXISTENCE CHECK:`);
  console.log(`  - Games that EXIST in games table: ${existingCount}`);
  console.log(`  - Games that are MISSING: ${missingCount}`);
  console.log(`  - Missing percentage: ${(missingCount/allGameIds.size*100).toFixed(1)}%`);
  
  // Let's check the distribution of stats per game
  console.log('\n\n📊 STATS PER GAME ANALYSIS:');
  
  const gameIdList = Array.from(allGameIds).slice(0, 20);
  for (const gameId of gameIdList) {
    const { count } = await supabase
      .from('player_stats')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', gameId);
    
    // Check if game exists
    const { data: game } = await supabase
      .from('games')
      .select('sport, sport_id, status')
      .eq('id', gameId)
      .single();
    
    const gameInfo = game ? `${game.sport || game.sport_id} - ${game.status}` : 'MISSING GAME';
    console.log(`  Game ${gameId}: ${count} stats (${gameInfo})`);
  }
  
  // Check the actual coverage for games that exist
  console.log('\n\n📊 REAL COVERAGE FOR EXISTING GAMES:');
  
  const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
  for (const sport of sports) {
    const { data: sportGames } = await supabase
      .from('games')
      .select('id')
      .eq('sport', sport);
    
    if (!sportGames || sportGames.length === 0) continue;
    
    const gameIds = sportGames.map(g => g.id);
    
    // Check how many have stats
    const gamesWithStats = new Set<number>();
    for (let i = 0; i < gameIds.length; i += 1000) {
      const batch = gameIds.slice(i, i + 1000);
      const { data: stats } = await supabase
        .from('player_stats')
        .select('game_id')
        .in('game_id', batch);
      
      stats?.forEach(s => gamesWithStats.add(s.game_id));
    }
    
    const coverage = (gamesWithStats.size / gameIds.length * 100).toFixed(1);
    console.log(`\n${sport}:`);
    console.log(`  - Total games: ${gameIds.length}`);
    console.log(`  - Games with stats: ${gamesWithStats.size}`);
    console.log(`  - Coverage: ${coverage}%`);
  }
  
  // Find orphaned stats
  console.log('\n\n🚨 ORPHANED STATS INVESTIGATION:');
  
  const { data: orphanedSample } = await supabase
    .from('player_stats')
    .select('game_id, stat_type, player_id')
    .not('game_id', 'in', gameIdArray.slice(0, 100))
    .limit(20);
  
  if (orphanedSample && orphanedSample.length > 0) {
    console.log('\nSample orphaned stats:');
    orphanedSample.forEach(s => {
      console.log(`  - Game ${s.game_id}, Player ${s.player_id}, Type: ${s.stat_type}`);
    });
  }
  
  console.log('\n\n🎯 MYSTERY SOLVED:');
  console.log('='.repeat(80));
  console.log(`We have ${allGameIds.size} unique games with stats`);
  console.log(`But ${missingCount} of these games DON\'T EXIST in the games table!`);
  console.log('This is why coverage appears so low - the stats reference non-existent games!');
  console.log('='.repeat(80));
}

solveTheNHLMystery().catch(console.error);
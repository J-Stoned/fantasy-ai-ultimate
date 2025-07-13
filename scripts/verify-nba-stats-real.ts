import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyNBAStatsReal() {
  console.log('🔍 VERIFYING NBA STATS ARE REAL\n');
  console.log('='.repeat(80));

  // 1. Check total stats
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });

  console.log(`📊 Total player_stats in database: ${totalStats?.toLocaleString()}\n`);

  // 2. Check recent stats
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  
  const { data: recentStats, count: recentCount } = await supabase
    .from('player_stats')
    .select('id, game_id, player_id, stat_type, stat_value, created_at')
    .gte('created_at', tenMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`📅 Stats added in last 10 minutes: ${recentCount || 0}\n`);
  
  if (recentStats && recentStats.length > 0) {
    console.log('Sample of recently added stats:');
    recentStats.forEach(stat => {
      console.log(`  - ID: ${stat.id}, Game: ${stat.game_id}, Type: ${stat.stat_type}, Value: ${stat.stat_value}`);
    });
  }

  // 3. Check specific games we know we scraped
  console.log('\n🎯 Checking specific games from our collection:');
  
  const gamesWeScraped = [3184279, 3184278, 3184277, 3184276, 3184275]; // Recent game IDs
  
  for (const gameId of gamesWeScraped) {
    const { count: gameStats, data: sample } = await supabase
      .from('player_stats')
      .select('stat_type, stat_value')
      .eq('game_id', gameId)
      .limit(5);
    
    if (gameStats && gameStats > 0) {
      console.log(`  ✅ Game ${gameId}: ${gameStats} stats found`);
      if (sample && sample.length > 0) {
        console.log(`     Sample: ${sample.map(s => `${s.stat_type}=${s.stat_value}`).join(', ')}`);
      }
    } else {
      console.log(`  ❌ Game ${gameId}: No stats found`);
    }
  }

  // 4. Check NBA games with stats
  console.log('\n📊 Checking NBA games coverage:');
  
  // Get a batch of NBA games
  const { data: nbaGames } = await supabase
    .from('games')
    .select('id')
    .or('sport.eq.NBA,sport_id.eq.nba')
    .order('id', { ascending: false })
    .limit(100);

  if (nbaGames) {
    let gamesWithStats = 0;
    let totalStatsFound = 0;
    
    for (const game of nbaGames) {
      const { count } = await supabase
        .from('player_stats')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (count && count > 0) {
        gamesWithStats++;
        totalStatsFound += count;
      }
    }
    
    console.log(`  Checked ${nbaGames.length} recent NBA games`);
    console.log(`  Games with stats: ${gamesWithStats}`);
    console.log(`  Total stats in these games: ${totalStatsFound.toLocaleString()}`);
    console.log(`  Coverage in sample: ${(gamesWithStats/nbaGames.length*100).toFixed(1)}%`);
  }

  // 5. Verify data integrity
  console.log('\n🔍 Data integrity check:');
  
  // Check if stats reference valid games
  const { data: randomStats } = await supabase
    .from('player_stats')
    .select('game_id, player_id')
    .order('created_at', { ascending: false })
    .limit(20);

  if (randomStats) {
    const gameIds = [...new Set(randomStats.map(s => s.game_id))];
    const playerIds = [...new Set(randomStats.map(s => s.player_id))];
    
    // Check games exist
    const { count: validGames } = await supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .in('id', gameIds);
    
    // Check players exist
    const { count: validPlayers } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .in('id', playerIds);
    
    console.log(`  ✅ ${validGames}/${gameIds.length} game references are valid`);
    console.log(`  ✅ ${validPlayers}/${playerIds.length} player references are valid`);
  }

  console.log('\n✅ VERIFICATION COMPLETE!');
}

verifyNBAStatsReal().catch(console.error);
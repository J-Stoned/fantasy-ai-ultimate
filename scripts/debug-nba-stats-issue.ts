import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugNBAStatsIssue() {
  console.log('🔍 DEBUGGING NBA STATS ISSUE\n');
  console.log('='.repeat(80));

  // Get recent player_stats
  console.log('📊 Checking recently added stats...\n');
  
  const { data: recentStats, error: recentError } = await supabase
    .from('player_stats')
    .select('id, game_id, player_id, stat_type, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (recentError) {
    console.error('Error:', recentError);
    return;
  }

  console.log('Recent stats:');
  recentStats?.forEach(stat => {
    console.log(`  - ID: ${stat.id}, Game: ${stat.game_id}, Created: ${stat.created_at}`);
  });

  // Check if those game_ids exist in games table
  const gameIds = [...new Set(recentStats?.map(s => s.game_id) || [])];
  
  console.log('\n🔍 Checking if these game_ids exist in games table...');
  
  for (const gameId of gameIds) {
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, sport, sport_id, status')
      .eq('id', gameId)
      .single();
    
    if (game) {
      console.log(`  ✅ Game ${gameId} exists: ${game.sport || game.sport_id}`);
    } else {
      console.log(`  ❌ Game ${gameId} NOT FOUND!`);
    }
  }

  // Check specific NBA game IDs we tried to insert
  console.log('\n🔍 Checking specific NBA games we scraped...');
  
  const nbaGameIds = [3563976, 3563986, 3564584, 3564585, 3564586];
  
  for (const gameId of nbaGameIds) {
    const { count: statsCount } = await supabase
      .from('player_stats')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', gameId);
    
    console.log(`  Game ${gameId}: ${statsCount || 0} stats`);
  }

  // Check if there's a foreign key issue
  console.log('\n🔍 Checking for orphaned player_ids...');
  
  const { data: sampleStats } = await supabase
    .from('player_stats')
    .select('player_id')
    .limit(100);
  
  if (sampleStats) {
    const playerIds = [...new Set(sampleStats.map(s => s.player_id))];
    
    const { count: existingPlayers } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .in('id', playerIds);
    
    console.log(`  Checked ${playerIds.length} unique player_ids`);
    console.log(`  Found ${existingPlayers || 0} in players table`);
    
    if (existingPlayers !== playerIds.length) {
      console.log(`  ⚠️  ${playerIds.length - (existingPlayers || 0)} player_ids don't exist!`);
    }
  }

  // Get the actual new stats count
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { count: newStatsCount } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo);
  
  console.log(`\n📊 Stats added in last hour: ${newStatsCount || 0}`);
}

debugNBAStatsIssue().catch(console.error);
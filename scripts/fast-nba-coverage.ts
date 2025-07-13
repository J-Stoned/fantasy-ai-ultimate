import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fastNBACoverage() {
  console.log('🏀 FAST NBA COVERAGE CHECK\n');
  console.log('='.repeat(80));

  // Get completed NBA games
  const { count: totalGames } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .or('sport.eq.NBA,sport_id.eq.nba')
    .or('status.eq.completed,status.eq.STATUS_FINAL,status.eq.Final')
    .not('home_score', 'is', null);

  console.log(`Total completed NBA games: ${totalGames}`);

  // Get all game IDs in chunks and check stats
  const { data: allGames } = await supabase
    .from('games')
    .select('id')
    .or('sport.eq.NBA,sport_id.eq.nba')
    .or('status.eq.completed,status.eq.STATUS_FINAL,status.eq.Final')
    .not('home_score', 'is', null);

  if (!allGames) return;

  // Get all player stats game_ids in one query
  console.log('\n🔍 Fetching all NBA game stats...');
  
  const gameIds = allGames.map(g => g.id);
  const { data: statsData } = await supabase
    .from('player_stats')
    .select('game_id')
    .in('game_id', gameIds);

  // Count unique games with stats
  const gamesWithStats = new Set(statsData?.map(s => s.game_id) || []);
  const coverage = totalGames ? (gamesWithStats.size / totalGames * 100).toFixed(1) : 0;
  
  console.log('\n🏀 NBA COVERAGE RESULTS:');
  console.log('='.repeat(50));
  console.log(`Games with stats: ${gamesWithStats.size}/${totalGames}`);
  console.log(`Coverage: ${coverage}%`);
  console.log(`Total stats found: ${statsData?.length.toLocaleString() || 0}`);
  
  const targetGames = Math.ceil(totalGames! * 0.95);
  const gamesNeeded = Math.max(0, targetGames - gamesWithStats.size);
  
  console.log('\n🎯 95% COVERAGE TARGET:');
  console.log(`Need ${gamesNeeded} more games`);
  
  if (parseFloat(coverage) >= 95) {
    console.log('\n🎉 NBA HAS REACHED 95% COVERAGE! 🎉');
  }

  // Check recent additions
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', tenMinutesAgo);
  
  console.log(`\n⚡ Stats added in last 10 min: ${recentCount?.toLocaleString() || 0}`);
}

fastNBACoverage().catch(console.error);
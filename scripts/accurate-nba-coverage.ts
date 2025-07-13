import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function accurateNBACoverage() {
  console.log('🏀 ACCURATE NBA COVERAGE CHECK\n');
  console.log('='.repeat(80));

  // Get all NBA games that are completed
  console.log('📊 Fetching all completed NBA games...');
  
  const { data: nbaGames, error: gamesError } = await supabase
    .from('games')
    .select('id')
    .or('sport.eq.NBA,sport_id.eq.nba')
    .or('status.eq.completed,status.eq.STATUS_FINAL,status.eq.Final')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);

  if (gamesError || !nbaGames) {
    console.error('Error:', gamesError);
    return;
  }

  const totalGames = nbaGames.length;
  console.log(`Found ${totalGames} completed NBA games`);

  // Check how many have stats
  console.log('\n🔍 Checking which games have stats...');
  
  let gamesWithStats = 0;
  let totalStats = 0;
  const batchSize = 100;
  
  for (let i = 0; i < nbaGames.length; i += batchSize) {
    const batch = nbaGames.slice(i, i + batchSize);
    const gameIds = batch.map(g => g.id);
    
    // Count games with at least one stat
    for (const gameId of gameIds) {
      const { count } = await supabase
        .from('player_stats')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', gameId);
      
      if (count && count > 0) {
        gamesWithStats++;
        totalStats += count;
      }
    }
    
    if (i % 500 === 0 && i > 0) {
      const currentCoverage = (gamesWithStats / (i + batchSize) * 100).toFixed(1);
      console.log(`  Progress: ${i}/${totalGames} games checked. Current coverage: ${currentCoverage}%`);
    }
  }

  const coverage = (gamesWithStats / totalGames * 100).toFixed(1);
  const targetGames = Math.ceil(totalGames * 0.95);
  const gamesNeeded = Math.max(0, targetGames - gamesWithStats);

  console.log('\n\n🏀 NBA COVERAGE RESULTS:');
  console.log('='.repeat(80));
  console.log(`Total completed NBA games: ${totalGames}`);
  console.log(`Games with stats: ${gamesWithStats}`);
  console.log(`Coverage: ${coverage}%`);
  console.log(`Total player stats: ${totalStats.toLocaleString()}`);
  console.log(`Average stats per game: ${gamesWithStats > 0 ? Math.round(totalStats / gamesWithStats) : 0}`);
  
  console.log('\n🎯 95% COVERAGE TARGET:');
  console.log(`Target: ${targetGames} games`);
  console.log(`Current: ${gamesWithStats} games`);
  console.log(`Needed: ${gamesNeeded} games`);
  
  if (parseFloat(coverage) >= 95) {
    console.log('\n🎉 NBA HAS REACHED 95% COVERAGE! 🎉');
  } else {
    console.log(`\n📈 Progress: ${(gamesWithStats / targetGames * 100).toFixed(1)}% of the way to 95% coverage`);
  }
  
  // Show recent progress
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count: recentStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', fiveMinutesAgo);
  
  if (recentStats && recentStats > 0) {
    console.log(`\n⚡ Recent activity: ${recentStats.toLocaleString()} stats added in last 5 minutes`);
  }
}

accurateNBACoverage().catch(console.error);
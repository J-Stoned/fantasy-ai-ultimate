import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyMLBNumbers() {
  console.log('🔍 VERIFYING MLB NUMBERS\n');
  console.log('='.repeat(80));
  
  // 1. Total MLB games
  const { count: totalMLBGames } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .or('sport.eq.MLB,sport_id.eq.mlb');
  
  const { count: completedMLBGames } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .or('sport.eq.MLB,sport_id.eq.mlb')
    .not('home_score', 'is', null);
  
  console.log('📊 MLB GAMES:');
  console.log(`   Total MLB games: ${totalMLBGames?.toLocaleString()}`);
  console.log(`   Completed (with scores): ${completedMLBGames?.toLocaleString()}`);
  
  // 2. Check recent games we processed
  console.log('\n📊 GAMES WE JUST PROCESSED:');
  
  const { data: recentGames } = await supabase
    .from('games')
    .select('id')
    .or('sport.eq.MLB,sport_id.eq.mlb')
    .gte('start_time', '2024-01-01')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(1000);
  
  console.log(`   2024 MLB games checked: ${recentGames?.length}`);
  
  // Check how many have stats
  if (recentGames) {
    let gamesWithStats = 0;
    let totalStatsInSample = 0;
    
    // Check in batches
    for (let i = 0; i < recentGames.length; i += 100) {
      const batch = recentGames.slice(i, i + 100);
      const gameIds = batch.map(g => g.id);
      
      const { data: stats } = await supabase
        .from('player_stats')
        .select('game_id')
        .in('game_id', gameIds);
      
      const uniqueGames = new Set(stats?.map(s => s.game_id) || []);
      gamesWithStats += uniqueGames.size;
      totalStatsInSample += (stats?.length || 0);
    }
    
    console.log(`   Games with stats: ${gamesWithStats}/${recentGames.length}`);
    console.log(`   Total stats in these games: ${totalStatsInSample.toLocaleString()}`);
    console.log(`   Average stats per game: ${Math.round(totalStatsInSample / gamesWithStats)}`);
  }
  
  // 3. Stats added in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo);
  
  console.log(`\n📊 RECENT ACTIVITY:`);
  console.log(`   Stats added in last hour: ${recentStats?.toLocaleString()}`);
  
  // 4. Overall coverage calculation
  console.log('\n📊 COVERAGE CALCULATION:');
  
  // Take a proper sample across all MLB games
  const { data: coverageSample } = await supabase
    .from('games')
    .select('id')
    .or('sport.eq.MLB,sport_id.eq.mlb')
    .not('home_score', 'is', null)
    .order('random()')  // Random sample
    .limit(500);
  
  if (coverageSample) {
    const { data: sampleStats } = await supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', coverageSample.map(g => g.id));
    
    const gamesWithStats = new Set(sampleStats?.map(s => s.game_id) || []).size;
    const coverage = (gamesWithStats / coverageSample.length * 100).toFixed(1);
    
    console.log(`   Random sample: ${gamesWithStats}/${coverageSample.length} games have stats`);
    console.log(`   Coverage estimate: ${coverage}%`);
    
    const estimatedTotal = Math.round((completedMLBGames || 0) * (gamesWithStats / coverageSample.length));
    console.log(`   Estimated games with stats: ${estimatedTotal} of ${completedMLBGames}`);
  }
  
  // 5. Database totals
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  console.log('\n📊 DATABASE TOTALS:');
  console.log(`   Total player_stats: ${totalStats?.toLocaleString()}`);
  console.log(`   Growth from 934,833: +${((totalStats || 0) - 934833).toLocaleString()}`);
}

verifyMLBNumbers().catch(console.error);
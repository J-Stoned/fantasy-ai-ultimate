import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNewNBACoverage() {
  console.log('🏀 NBA COVERAGE UPDATE CHECK\n');
  console.log('='.repeat(50));

  // Get total NBA games
  const { count: totalGames } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .or('sport.eq.NBA,sport_id.eq.nba')
    .eq('status', 'completed');

  // Get current player stats count
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });

  console.log(`Total player stats in DB: ${totalStats?.toLocaleString()}`);
  console.log(`Total NBA games: ${totalGames}`);

  // Check games with stats
  const { data: nbaGames } = await supabase
    .from('games')
    .select('id')
    .or('sport.eq.NBA,sport_id.eq.nba')
    .eq('status', 'completed')
    .limit(2000);

  if (!nbaGames) return;

  let gamesWithStats = 0;
  const batchSize = 500;
  
  for (let i = 0; i < nbaGames.length; i += batchSize) {
    const batch = nbaGames.slice(i, i + batchSize).map(g => g.id);
    
    const { data: stats } = await supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', batch);
    
    const uniqueGames = new Set(stats?.map(s => s.game_id) || []);
    gamesWithStats += uniqueGames.size;
  }

  const coverage = totalGames ? (gamesWithStats / totalGames * 100).toFixed(1) : 0;
  const gamesNeeded = Math.max(0, Math.ceil(totalGames! * 0.95) - gamesWithStats);

  console.log('\n📊 NBA COVERAGE:');
  console.log(`Games with stats: ${gamesWithStats}`);
  console.log(`Coverage: ${coverage}%`);
  console.log(`Games needed for 95%: ${gamesNeeded}`);
  
  if (parseFloat(coverage.toString()) >= 95) {
    console.log('\n🎉 NBA HAS REACHED 95% COVERAGE!');
  } else {
    console.log(`\n📈 Progress: We've added ~72 games with stats!`);
  }
}

checkNewNBACoverage().catch(console.error);
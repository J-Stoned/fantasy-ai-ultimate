import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTrueCoverage() {
  console.log('📊 CHECKING TRUE COVERAGE FOR ALL SPORTS\n');
  
  const sports = ['MLB', 'NBA', 'NFL', 'NHL'];
  
  for (const sport of sports) {
    console.log(`\n${sport} COVERAGE:`);
    console.log('='.repeat(40));
    
    // Get ALL games for this sport
    const allGameIds: number[] = [];
    let offset = 0;
    const chunkSize = 1000;
    
    while (true) {
      const { data: games } = await supabase
        .from('games')
        .select('id')
        .or(`sport.eq.${sport},sport_id.eq.${sport.toLowerCase()}`)
        .not('home_score', 'is', null)
        .range(offset, offset + chunkSize - 1);
      
      if (!games || games.length === 0) break;
      allGameIds.push(...games.map(g => g.id));
      
      if (games.length < chunkSize) break;
      offset += chunkSize;
    }
    
    console.log(`Total completed games: ${allGameIds.length}`);
    
    // Check how many have stats
    let gamesWithStats = 0;
    let totalStatsCount = 0;
    
    for (let i = 0; i < allGameIds.length; i += 100) {
      const batch = allGameIds.slice(i, i + 100);
      
      const { data: stats, count } = await supabase
        .from('player_stats')
        .select('game_id', { count: 'exact' })
        .in('game_id', batch);
      
      const uniqueGames = new Set(stats?.map(s => s.game_id) || []);
      gamesWithStats += uniqueGames.size;
      totalStatsCount += (count || 0);
    }
    
    const coverage = (gamesWithStats / allGameIds.length * 100);
    const gamesNeededFor95 = Math.ceil(allGameIds.length * 0.95) - gamesWithStats;
    
    console.log(`Games with stats: ${gamesWithStats}/${allGameIds.length}`);
    console.log(`Coverage: ${coverage.toFixed(1)}%`);
    console.log(`Average stats per game: ${Math.round(totalStatsCount / gamesWithStats)}`);
    
    if (coverage < 95) {
      console.log(`Games needed for 95%: ${gamesNeededFor95}`);
    } else {
      console.log(`✅ ACHIEVED 95%+ COVERAGE!`);
    }
    
    // Progress bar
    const barLength = 40;
    const filled = Math.round(barLength * coverage / 100);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    console.log(`[${bar}] ${coverage.toFixed(1)}%`);
  }
  
  // Total stats
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  console.log(`\n📊 TOTAL DATABASE STATS: ${totalStats?.toLocaleString()}`);
}

checkTrueCoverage().catch(console.error);
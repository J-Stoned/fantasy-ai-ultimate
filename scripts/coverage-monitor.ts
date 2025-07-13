import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function coverageMonitor() {
  console.clear();
  console.log('📊 LIVE COVERAGE MONITOR');
  console.log('='.repeat(80));
  
  while (true) {
    const { count: totalStats } = await supabase
      .from('player_stats')
      .select('id', { count: 'exact', head: true });
    
    console.log(`\n⏰ ${new Date().toLocaleTimeString()}`);
    console.log(`📈 Total Stats: ${totalStats?.toLocaleString()}`);
    console.log('\n🏆 COVERAGE BY SPORT:');
    console.log('-'.repeat(50));
    
    const sports = [
      { name: 'NBA', queries: ['sport.eq.NBA', 'sport_id.eq.nba'] },
      { name: 'NFL', queries: ['sport.eq.NFL', 'sport_id.eq.nfl'] },
      { name: 'NHL', queries: ['sport.eq.NHL', 'sport_id.eq.nhl'] },
      { name: 'MLB', queries: ['sport.eq.MLB', 'sport_id.eq.mlb'] }
    ];
    
    for (const sport of sports) {
      // Get total completed games
      const { count: totalGames } = await supabase
        .from('games')
        .select('id', { count: 'exact', head: true })
        .or(sport.queries.join(','))
        .not('home_score', 'is', null);
      
      // Sample for coverage
      const { data: sample } = await supabase
        .from('games')
        .select('id')
        .or(sport.queries.join(','))
        .not('home_score', 'is', null)
        .limit(100);
      
      if (sample) {
        const { data: withStats } = await supabase
          .from('player_stats')
          .select('game_id')
          .in('game_id', sample.map(g => g.id));
        
        const coverage = new Set(withStats?.map(s => s.game_id) || []).size;
        const percent = (coverage / sample.length * 100).toFixed(1);
        const estimatedTotal = Math.round((totalGames || 0) * (coverage / sample.length));
        const needed = Math.max(0, Math.ceil((totalGames || 0) * 0.95) - estimatedTotal);
        
        console.log(`\n${sport.name}:`);
        console.log(`  Coverage: ${percent}% (${estimatedTotal}/${totalGames} games)`);
        console.log(`  To 95%: ${needed} games needed`);
        
        // Progress bar
        const barLength = 30;
        const filled = Math.round(barLength * parseFloat(percent) / 100);
        const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
        console.log(`  [${bar}] ${percent}%`);
      }
    }
    
    // Check recent activity
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: recentStats } = await supabase
      .from('player_stats')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', fiveMinAgo);
    
    console.log(`\n⚡ Last 5 min: +${recentStats?.toLocaleString() || 0} stats`);
    console.log('\n🔄 Refreshing in 30 seconds... (Ctrl+C to exit)');
    
    await new Promise(resolve => setTimeout(resolve, 30000));
    console.clear();
  }
}

coverageMonitor().catch(console.error);
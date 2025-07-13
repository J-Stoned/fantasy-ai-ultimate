import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function quickMLBCoverage() {
  console.log('⚾ MLB COVERAGE CHECK\n');
  
  // Total stats
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  console.log(`📊 Total stats in database: ${totalStats?.toLocaleString()}\n`);
  
  // MLB games
  const { count: totalMLB } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .or('sport.eq.MLB,sport_id.eq.mlb')
    .not('home_score', 'is', null);
  
  // Sample coverage
  const { data: sample } = await supabase
    .from('games')
    .select('id')
    .or('sport.eq.MLB,sport_id.eq.mlb')
    .not('home_score', 'is', null)
    .limit(200);
  
  if (sample) {
    const { data: withStats } = await supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', sample.map(g => g.id));
    
    const coverage = new Set(withStats?.map(s => s.game_id) || []).size;
    const percent = (coverage / sample.length * 100).toFixed(1);
    const estimated = Math.round((totalMLB || 0) * (coverage / sample.length));
    
    console.log(`⚾ MLB:`);
    console.log(`   Total games: ${totalMLB?.toLocaleString()}`);
    console.log(`   Coverage: ${percent}% (${estimated}/${totalMLB} games)`);
    console.log(`   To 95%: ${Math.max(0, Math.ceil((totalMLB || 0) * 0.95) - estimated)} games needed`);
    
    // Progress bar
    const barLength = 40;
    const filled = Math.round(barLength * parseFloat(percent) / 100);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    console.log(`   [${bar}] ${percent}%`);
  }
  
  console.log('\n💪 SCALING METRICS:');
  console.log(`   Started at: 934,833 stats`);
  console.log(`   Current: ${totalStats?.toLocaleString()} stats`);
  console.log(`   ADDED: +${((totalStats || 0) - 934833).toLocaleString()} stats!`);
}

quickMLBCoverage().catch(console.error);
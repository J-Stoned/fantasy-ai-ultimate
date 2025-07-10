import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkPlayerTables() {
  console.log('🔍 Checking Player-Related Tables...\n');

  // Check player_stats
  const { count: statsCount, error: statsError } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
  
  const { data: statsSchema } = await supabase
    .from('player_stats')
    .select('*')
    .limit(1);
  
  console.log('📊 player_stats table:');
  console.log('  - Total records:', statsCount || 0);
  if (statsSchema && statsSchema.length > 0) {
    console.log('  - Schema fields:', Object.keys(statsSchema[0]).join(', '));
  }

  // Check player_injuries
  const { count: injuriesCount, error: injuriesError } = await supabase
    .from('player_injuries')
    .select('*', { count: 'exact', head: true });
  
  const { data: injuriesSchema } = await supabase
    .from('player_injuries')
    .select('*')
    .limit(1);
  
  console.log('\n🏥 player_injuries table:');
  console.log('  - Total records:', injuriesCount || 0);
  if (injuriesSchema && injuriesSchema.length > 0) {
    console.log('  - Schema fields:', Object.keys(injuriesSchema[0]).join(', '));
  }

  // Check player_performance
  const { count: perfCount, error: perfError } = await supabase
    .from('player_performance')
    .select('*', { count: 'exact', head: true });
  
  const { data: perfSchema } = await supabase
    .from('player_performance')
    .select('*')
    .limit(1);
  
  console.log('\n⚡ player_performance table:');
  console.log('  - Total records:', perfCount || 0);
  if (perfSchema && perfSchema.length > 0) {
    console.log('  - Schema fields:', Object.keys(perfSchema[0]).join(', '));
  }

  // Check players table
  const { count: playersCount, error: playersError } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
  
  const { data: playersSchema } = await supabase
    .from('players')
    .select('*')
    .limit(1);
  
  console.log('\n👤 players table:');
  console.log('  - Total records:', playersCount || 0);
  if (playersSchema && playersSchema.length > 0) {
    console.log('  - Schema fields:', Object.keys(playersSchema[0]).join(', '));
  }

  // Sample some actual data
  console.log('\n📋 Sample Data from player_stats:');
  const { data: sampleStats } = await supabase
    .from('player_stats')
    .select('*')
    .limit(3);
  
  if (sampleStats && sampleStats.length > 0) {
    sampleStats.forEach((stat, i) => {
      console.log(`\nRecord ${i + 1}:`, JSON.stringify(stat, null, 2));
    });
  }

  // Check recent player_performance entries
  console.log('\n📋 Sample Data from player_performance:');
  const { data: samplePerf } = await supabase
    .from('player_performance')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);
  
  if (samplePerf && samplePerf.length > 0) {
    samplePerf.forEach((perf, i) => {
      console.log(`\nRecord ${i + 1}:`, JSON.stringify(perf, null, 2));
    });
  }
}

checkPlayerTables().catch(console.error);
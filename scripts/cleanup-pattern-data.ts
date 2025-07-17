import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function cleanPatternData() {
  console.log('🧹 Cleaning pattern data from corrupted database...\n');
  
  // Clean pattern_performance
  console.log('📊 Cleaning pattern_performance table...');
  const { count: perfCount } = await supabase
    .from('pattern_performance')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Found ${perfCount} pattern performance records`);
  
  if (perfCount && perfCount > 0) {
    const { error: perfError } = await supabase
      .from('pattern_performance')
      .delete()
      .gte('id', 0); // Delete all (id >= 0 matches everything)
    
    if (perfError) {
      console.error('Error cleaning pattern_performance:', perfError);
    } else {
      console.log(`✅ Cleaned ${perfCount} pattern_performance records`);
    }
  }
  
  // Clean pattern_multipliers
  console.log('\n📊 Cleaning pattern_multipliers table...');
  const { count: multCount } = await supabase
    .from('pattern_multipliers')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Found ${multCount} pattern multiplier records`);
  
  if (multCount && multCount > 0) {
    const { error: multError } = await supabase
      .from('pattern_multipliers')
      .delete()
      .gte('id', 0); // Delete all (id >= 0 matches everything)
    
    if (multError) {
      console.error('Error cleaning pattern_multipliers:', multError);
    } else {
      console.log(`✅ Cleaned ${multCount} pattern_multipliers records`);
    }
  }
  
  // Clean temporal_pattern_performance if it exists
  console.log('\n📊 Cleaning temporal_pattern_performance table...');
  const { count: tempCount } = await supabase
    .from('temporal_pattern_performance')
    .select('*', { count: 'exact', head: true });
  
  if (tempCount && tempCount > 0) {
    const { error: tempError } = await supabase
      .from('temporal_pattern_performance')
      .delete()
      .gte('id', 0); // Delete all (id >= 0 matches everything)
    
    if (tempError) {
      console.error('Error cleaning temporal_pattern_performance:', tempError);
    } else {
      console.log(`✅ Cleaned ${tempCount} temporal_pattern_performance records`);
    }
  }
  
  console.log('\n🎯 Pattern data cleaned!');
  console.log('📌 Next steps:');
  console.log('1. Run pattern detection scripts with the clean database');
  console.log('2. Pattern data will be rebuilt with correct game/player IDs');
  console.log('3. Accuracy rates will reflect real performance');
  
  // Show what pattern detection scripts to run
  console.log('\n🚀 Run these scripts to rebuild pattern data:');
  console.log('npx tsx scripts/pattern-detection/production-pattern-api-v4.ts');
  console.log('npx tsx scripts/pattern-detection/unified-pattern-api.ts');
  console.log('npx tsx scripts/pattern-detection/realtime-pattern-scanner.ts');
}

cleanPatternData().catch(console.error);
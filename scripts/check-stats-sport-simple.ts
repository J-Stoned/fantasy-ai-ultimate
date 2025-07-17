#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkStatsSport() {
  // Get sample stats
  const { data: stats } = await supabase
    .from('player_game_logs')
    .select('id, sport')
    .limit(100);
    
  console.log('Sample of 100 stats:');
  let nullCount = 0;
  let hasValueCount = 0;
  
  stats?.forEach(s => {
    if (s.sport === null) {
      nullCount++;
    } else {
      hasValueCount++;
    }
  });
  
  console.log(`  NULL sport: ${nullCount}`);
  console.log(`  Has sport: ${hasValueCount}`);
  
  if (hasValueCount > 0) {
    // Show some examples
    const withSport = stats?.filter(s => s.sport !== null).slice(0, 5);
    console.log('\nExamples with sport:');
    withSport?.forEach(s => console.log(`  ID ${s.id}: ${s.sport}`));
  }
  
  // It seems the issue from before was the sport field was already populated!
  // Let's check the actual total
  console.log('\nGetting actual totals (this may take a moment)...');
  
  // Since counts aren't working, let's check differently
  const { data: allStats, error } = await supabase
    .from('player_game_logs')
    .select('sport')
    .is('sport', null)
    .limit(1);
    
  if (error) {
    console.error('Error:', error);
  } else if (allStats && allStats.length === 0) {
    console.log('\n✅ All stats already have sport field populated!');
  } else {
    console.log('\n❌ Some stats still have NULL sport');
  }
}

checkStatsSport().catch(console.error);
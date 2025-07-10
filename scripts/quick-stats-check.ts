#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function quickCheck() {
  const { count } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
  
  console.log('Total player_stats records:', count);
  
  // Get unique players
  const { data: allStats } = await supabase
    .from('player_stats')
    .select('player_id')
    .not('player_id', 'is', null);
  
  const uniquePlayers = new Set(allStats?.map(s => s.player_id) || []);
  console.log('Unique players with stats:', uniquePlayers.size);
  
  // Get breakdown
  const { data: sample } = await supabase
    .from('player_stats')
    .select('*')
    .limit(10);
  
  console.log('\nSample records:');
  sample?.forEach(s => {
    console.log(`- Player ${s.player_id}: ${s.stat_name} = ${s.stat_value}`);
  });
}

quickCheck().catch(console.error);
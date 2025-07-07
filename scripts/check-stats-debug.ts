#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function debug() {
  // Count total stats
  const { count } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
    
  console.log('Total player_stats records:', count);
  
  // Get unique games - need to do this in chunks
  let allGameIds = new Set<number>();
  let offset = 0;
  const chunkSize = 10000;
  
  while (true) {
    const { data } = await supabase
      .from('player_stats')
      .select('game_id')
      .range(offset, offset + chunkSize - 1);
      
    if (!data || data.length === 0) break;
    
    data.forEach(s => allGameIds.add(s.game_id));
    console.log(`Processed ${offset + data.length} records, unique games so far: ${allGameIds.size}`);
    
    if (data.length < chunkSize) break;
    offset += chunkSize;
  }
  
  console.log('\nFinal unique games with stats:', allGameIds.size);
  
  // Get sample of game IDs
  const sampleIds = Array.from(allGameIds).slice(0, 20);
  console.log('Sample game IDs:', sampleIds);
  
  // Check a specific game
  if (sampleIds.length > 0) {
    const { data: sampleStats } = await supabase
      .from('player_stats')
      .select('*')
      .eq('game_id', sampleIds[0])
      .limit(5);
      
    console.log('\nSample stats for game', sampleIds[0], ':');
    console.log(sampleStats);
  }
}

debug().catch(console.error);
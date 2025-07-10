#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  // Get one test player
  const { data: testPlayer } = await supabase
    .from('players')
    .select('id, name')
    .like('name', '%_175133%_%')
    .limit(1)
    .single();
    
  if (testPlayer) {
    console.log('Found test player:', testPlayer.name);
    console.log('ID:', testPlayer.id);
    
    // Count their stats
    const { count: statsCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .eq('player_id', testPlayer.id);
      
    console.log('This player has', statsCount, 'stats records');
    
    // Try deleting in smaller chunks
    console.log('\nDeleting stats in chunks...');
    let deleted = 0;
    
    for (let i = 0; i < 10; i++) {
      const { data: statBatch } = await supabase
        .from('player_stats')
        .select('id')
        .eq('player_id', testPlayer.id)
        .limit(100);
        
      if (!statBatch || statBatch.length === 0) break;
      
      const ids = statBatch.map(s => s.id);
      
      const { error, count } = await supabase
        .from('player_stats')
        .delete()
        .in('id', ids);
        
      if (!error && count) {
        deleted += count;
        console.log(`  Deleted batch ${i + 1}: ${count} records (total: ${deleted})`);
      }
    }
    
    // Now try to delete the player
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', testPlayer.id);
      
    if (error) {
      console.log('\nStill cannot delete player:', error.message);
    } else {
      console.log('\n✅ Successfully deleted test player!');
    }
  }
}

main();
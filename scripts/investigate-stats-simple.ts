#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function investigateStats() {
  console.log('🔍 SIMPLE PLAYER_STATS INVESTIGATION\n');
  console.log('━'.repeat(50));
  
  try {
    // 1. Total count
    const { count: total } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    console.log(`📊 Total records: ${total?.toLocaleString()}`);
    
    // 2. Check NULL game_ids
    const { count: nullCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .is('game_id', null);
    console.log(`❌ NULL game_ids: ${nullCount?.toLocaleString()}`);
    console.log(`✅ Valid game_ids: ${((total || 0) - (nullCount || 0)).toLocaleString()}`);
    
    // 3. Sample some records
    console.log('\n📋 Sample records:');
    const { data: sample } = await supabase
      .from('player_stats')
      .select('game_id, player_id, stat_type, stat_value')
      .not('game_id', 'is', null)
      .limit(10);
    
    sample?.forEach((rec, i) => {
      console.log(`${i + 1}. Game: ${rec.game_id}, Player: ${rec.player_id}, ${rec.stat_type}: ${JSON.stringify(rec.stat_value)}`);
    });
    
    // 4. Get game_id range
    console.log('\n🎮 Game ID range:');
    const { data: minMax } = await supabase
      .from('player_stats')
      .select('game_id')
      .not('game_id', 'is', null)
      .order('game_id', { ascending: true })
      .limit(1);
    
    const { data: maxGame } = await supabase
      .from('player_stats')
      .select('game_id')
      .not('game_id', 'is', null)
      .order('game_id', { ascending: false })
      .limit(1);
    
    if (minMax?.[0] && maxGame?.[0]) {
      console.log(`Min game_id: ${minMax[0].game_id}`);
      console.log(`Max game_id: ${maxGame[0].game_id}`);
    }
    
    // 5. Check if these IDs are way out of range
    const { data: maxGameInTable } = await supabase
      .from('games')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);
    
    console.log(`\n🎯 Games table max ID: ${maxGameInTable?.[0]?.id}`);
    
    // 6. Check stat_value format
    console.log('\n📊 Stat value format:');
    const { data: statValues } = await supabase
      .from('player_stats')
      .select('stat_value')
      .limit(5);
    
    statValues?.forEach((v, i) => {
      const val = v.stat_value;
      console.log(`${i + 1}. Type: ${typeof val}, Value: ${JSON.stringify(val)}`);
    });
    
    console.log('\n💡 CONCLUSION:');
    if (nullCount && nullCount > total! * 0.99) {
      console.log('❗ Almost all records have NULL game_id - this is likely season stats, not game stats!');
    } else if (minMax?.[0]?.game_id > 1000000) {
      console.log('❗ Game IDs are very large numbers - likely external IDs from a different system');
    } else {
      console.log('✅ Data looks valid for transformation');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

investigateStats();
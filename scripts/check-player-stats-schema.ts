#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

async function checkSchema() {
  console.log('🔍 Checking player_stats table schema...\n');
  
  // Get a sample record to see the structure
  const { data: sample, error } = await supabase
    .from('player_stats')
    .select('*')
    .limit(1);
    
  if (sample && sample.length > 0) {
    console.log('Sample record:');
    console.log(JSON.stringify(sample[0], null, 2));
    console.log('\nColumn types:');
    Object.entries(sample[0]).forEach(([key, value]) => {
      console.log(`- ${key}: ${typeof value} (value: ${value})`);
    });
  }
  
  // Check existing player IDs to understand the format
  const { data: playerIds } = await supabase
    .from('player_stats')
    .select('player_id')
    .limit(10);
    
  console.log('\n\nExisting player_id examples:');
  const uniqueIds = [...new Set(playerIds?.map(p => p.player_id) || [])];
  uniqueIds.forEach(id => {
    console.log(`- ${id} (type: ${typeof id})`);
  });
  
  // Check if there are any MLB stats already
  const { data: mlbCheck } = await supabase
    .from('player_stats')
    .select('player_id')
    .like('player_id', '%mlb%')
    .limit(5);
    
  if (mlbCheck && mlbCheck.length > 0) {
    console.log('\n\nFound existing MLB player stats:');
    mlbCheck.forEach(p => console.log(`- ${p.player_id}`));
  } else {
    console.log('\n\nNo MLB player stats found (player_id with "mlb" pattern)');
  }
  
  // Test inserting a record with string player_id
  console.log('\n\n🧪 Testing string player_id insertion...');
  const testRecord = {
    player_id: 'test_mlb_999999',
    game_id: 3784317, // Use a real game ID
    stat_type: 'test',
    stat_value: 1.0,
    fantasy_points: 0
  };
  
  const { data: insertTest, error: insertError } = await supabase
    .from('player_stats')
    .insert(testRecord)
    .select();
    
  if (insertError) {
    console.log('❌ String player_id failed:', insertError.message);
    console.log('   This confirms player_id must be numeric');
  } else {
    console.log('✅ String player_id accepted!');
    // Clean up test record
    await supabase
      .from('player_stats')
      .delete()
      .match(testRecord);
  }
}

checkSchema().catch(console.error);
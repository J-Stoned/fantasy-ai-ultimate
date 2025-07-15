#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

async function analyzeForeignKeyIssue() {
  console.log('🔍 ANALYZING FOREIGN KEY CONSTRAINT ISSUES\n');
  
  // 1. Check what player IDs we're trying to insert
  console.log('1️⃣ Checking player IDs we want to use (3000000 range)...');
  
  const testIds = [3518617, 3670764, 3542888, 3642350, 3670623];
  
  for (const id of testIds) {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, external_id')
      .eq('id', id)
      .single();
      
    if (data) {
      console.log(`✅ Player ${id} exists: ${data.name} (${data.external_id})`);
    } else {
      console.log(`❌ Player ${id} does NOT exist in players table`);
    }
  }
  
  // 2. Check the actual constraint
  console.log('\n2️⃣ Understanding the constraint...');
  console.log('The player_stats table has: FOREIGN KEY (player_id) REFERENCES players(id)');
  console.log('This means: Every player_id in player_stats MUST exist in players table first');
  
  // 3. Solutions
  console.log('\n3️⃣ SOLUTIONS AVAILABLE:\n');
  
  console.log('SOLUTION 1: Ensure players exist before inserting stats');
  console.log('SOLUTION 2: Create a separate MLB stats table without constraints');
  console.log('SOLUTION 3: Use RPC functions to handle the insertion');
  console.log('SOLUTION 4: Temporarily disable the constraint (requires admin)');
  
  return testIds;
}

async function solution1_ensurePlayersExist() {
  console.log('\n\n✅ IMPLEMENTING SOLUTION 1: Ensure Players Exist\n');
  
  // Load the mappings
  const fs = await import('fs/promises');
  const mappingsPath = './mlb-player-mappings.json';
  
  try {
    const mappingsData = await fs.readFile(mappingsPath, 'utf-8');
    const mappings = JSON.parse(mappingsData);
    
    console.log(`Found ${Object.keys(mappings).length} player mappings`);
    
    // Create all players first
    const playersToCreate = Object.entries(mappings).map(([mlbId, numericId]) => ({
      id: numericId,
      name: `MLB Player ${mlbId}`,
      sport: 'MLB',
      external_id: mlbId
    }));
    
    console.log('Creating players in batches...');
    const batchSize = 10;
    let created = 0;
    
    for (let i = 0; i < playersToCreate.length; i += batchSize) {
      const batch = playersToCreate.slice(i, i + batchSize);
      
      // Use insert with on conflict do nothing
      const { error } = await supabase
        .from('players')
        .insert(batch)
        .select();
        
      if (!error) {
        created += batch.length;
      } else if (!error.message.includes('duplicate')) {
        console.error('Error:', error.message);
      }
    }
    
    console.log(`✅ Created/verified ${created} player records`);
    
    // Now verify a few
    const sampleIds = Object.values(mappings).slice(0, 3) as number[];
    for (const id of sampleIds) {
      const { data } = await supabase
        .from('players')
        .select('id')
        .eq('id', id)
        .single();
        
      console.log(`Player ${id}: ${data ? 'EXISTS' : 'MISSING'}`);
    }
    
  } catch (error) {
    console.log('No mappings file found');
  }
}

async function solution2_createMLBStatsTable() {
  console.log('\n\n✅ IMPLEMENTING SOLUTION 2: Create Dedicated MLB Stats Table\n');
  
  // This would create a new table specifically for MLB stats
  console.log('Creating mlb_player_stats table (conceptual)...');
  console.log(`
  CREATE TABLE mlb_player_stats (
    id SERIAL PRIMARY KEY,
    mlb_player_id VARCHAR(50),
    game_id INTEGER REFERENCES games(id),
    stat_type VARCHAR(50),
    stat_value NUMERIC,
    fantasy_points NUMERIC,
    created_at TIMESTAMP DEFAULT NOW()
  );
  `);
  
  console.log('\nThis table would:');
  console.log('- Store MLB player IDs as strings directly');
  console.log('- Still reference games table');
  console.log('- Avoid player_id foreign key issues');
  console.log('- Allow full MLB stats storage');
}

async function solution3_useSupabaseRPC() {
  console.log('\n\n✅ IMPLEMENTING SOLUTION 3: Use Supabase RPC\n');
  
  console.log('We could create a Supabase function that:');
  console.log('1. Takes MLB player ID and stats');
  console.log('2. Creates player if needed');
  console.log('3. Inserts stats');
  console.log('4. Handles all in one transaction');
  
  // Example of how to call it (if it existed)
  console.log('\nExample usage:');
  console.log(`
  const { data, error } = await supabase
    .rpc('insert_mlb_player_stat', {
      mlb_player_id: 'mlb_624424',
      player_name: 'Player Name',
      game_id: 123456,
      stat_type: 'hits',
      stat_value: 3,
      fantasy_points: 9
    });
  `);
}

async function testStatsInsertion() {
  console.log('\n\n🧪 TESTING STATS INSERTION\n');
  
  // First create a test player
  const testPlayer = {
    id: 3999999,
    name: 'Test MLB Player',
    sport: 'MLB',
    external_id: 'mlb_test_999999'
  };
  
  console.log('Creating test player...');
  const { error: playerError } = await supabase
    .from('players')
    .insert(testPlayer);
    
  if (playerError && !playerError.message.includes('duplicate')) {
    console.error('Player creation error:', playerError.message);
    return;
  }
  
  // Now try to insert a stat
  console.log('Inserting test stat...');
  const testStat = {
    player_id: 3999999,
    game_id: 3785094, // A real MLB game
    stat_type: 'test_hits',
    stat_value: '3',
    fantasy_points: 9
  };
  
  const { data, error: statError } = await supabase
    .from('player_stats')
    .insert(testStat)
    .select();
    
  if (statError) {
    console.error('❌ Stat insertion failed:', statError.message);
  } else {
    console.log('✅ Stat inserted successfully!');
    console.log('Data:', data);
    
    // Clean up
    await supabase
      .from('player_stats')
      .delete()
      .match({ id: data[0].id });
  }
}

async function main() {
  const problemIds = await analyzeForeignKeyIssue();
  
  console.log('\n\n🔧 RECOMMENDED APPROACH:');
  console.log('1. First, ensure all MLB players exist in the players table');
  console.log('2. Then insert stats with proper player_id references');
  console.log('3. Or create a dedicated mlb_player_stats table');
  
  // Implement Solution 1
  await solution1_ensurePlayersExist();
  
  // Show other solutions
  await solution2_createMLBStatsTable();
  await solution3_useSupabaseRPC();
  
  // Test
  await testStatsInsertion();
}

main().catch(console.error);
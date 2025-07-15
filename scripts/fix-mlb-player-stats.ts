#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Using our MCP tools - Supabase direct access
const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

const mlbApi = axios.create({
  baseURL: 'https://statsapi.mlb.com/api/v1'
});

async function findUnusedPlayerIdRange() {
  console.log('🔍 Finding unused player ID range...\n');
  
  // Check what player IDs are currently in use
  const { data: maxId } = await supabase
    .from('player_stats')
    .select('player_id')
    .order('player_id', { ascending: false })
    .limit(1);
    
  const { data: minId } = await supabase
    .from('player_stats')
    .select('player_id')
    .order('player_id', { ascending: true })
    .limit(1);
    
  console.log(`Current player ID range: ${minId?.[0]?.player_id} to ${maxId?.[0]?.player_id}`);
  
  // Find a safe range for MLB players
  // Let's check if 3000000-4000000 range is available
  const testRange = 3000000;
  const { data: existing } = await supabase
    .from('player_stats')
    .select('player_id')
    .gte('player_id', testRange)
    .lte('player_id', testRange + 1000)
    .limit(10);
    
  if (!existing || existing.length === 0) {
    console.log(`✅ Range ${testRange} to ${testRange + 999999} is available for MLB players`);
    return testRange;
  }
  
  // Try another range
  const altRange = 4000000;
  const { data: altExisting } = await supabase
    .from('player_stats')
    .select('player_id')
    .gte('player_id', altRange)
    .lte('player_id', altRange + 1000)
    .limit(10);
    
  if (!altExisting || altExisting.length === 0) {
    console.log(`✅ Range ${altRange} to ${altRange + 999999} is available for MLB players`);
    return altRange;
  }
  
  return 5000000; // Fallback
}

async function createMLBPlayerMappingTable() {
  console.log('\n📊 Creating MLB player mapping system...\n');
  
  // First, let's create a mapping in the players table metadata
  // We'll use a deterministic approach: MLB player ID numeric part + offset
  
  const baseOffset = await findUnusedPlayerIdRange();
  
  // Test with one game
  const { data: testGame } = await supabase
    .from('games')
    .select('id, external_id')
    .eq('sport', 'MLB')
    .eq('status', 'final')
    .limit(1)
    .single();
    
  if (!testGame) {
    console.log('No MLB games found');
    return;
  }
  
  const gamePk = parseInt(testGame.external_id.replace('mlb_', ''));
  console.log(`\nTesting with game ${testGame.id} (MLB: ${gamePk})`);
  
  // Fetch game stats
  const response = await mlbApi.get(`/game/${gamePk}/boxscore`);
  const statsToInsert = [];
  const playerMappings = new Map();
  
  // Process players
  const allPlayers = [];
  if (response.data.teams?.home?.players) {
    allPlayers.push(...Object.values(response.data.teams.home.players));
  }
  if (response.data.teams?.away?.players) {
    allPlayers.push(...Object.values(response.data.teams.away.players));
  }
  
  console.log(`\nProcessing ${allPlayers.length} players...`);
  
  // Create mappings
  for (const player of allPlayers as any[]) {
    const mlbPlayerId = player.person.id;
    const numericId = baseOffset + mlbPlayerId; // Simple mapping: offset + MLB ID
    
    playerMappings.set(mlbPlayerId, {
      numericId,
      name: player.person.fullName,
      mlbId: `mlb_${mlbPlayerId}`
    });
    
    // Create stats entries
    if (player.stats?.batting && player.stats.batting.atBats > 0) {
      const batting = player.stats.batting;
      
      // Just one stat per player for testing
      statsToInsert.push({
        player_id: numericId,
        game_id: testGame.id,
        stat_type: 'batting_avg',
        stat_value: batting.avg || '0.000',
        fantasy_points: (batting.hits || 0) * 3 + (batting.homeRuns || 0) * 10
      });
    }
    
    if (player.stats?.pitching && parseFloat(player.stats.pitching.inningsPitched || '0') > 0) {
      const pitching = player.stats.pitching;
      
      statsToInsert.push({
        player_id: numericId,
        game_id: testGame.id,
        stat_type: 'era',
        stat_value: pitching.era || '0.00',
        fantasy_points: parseFloat(pitching.inningsPitched || '0') * 3 + (pitching.strikeOuts || 0) * 2
      });
    }
  }
  
  console.log(`\nInserting ${statsToInsert.length} stats...`);
  
  // Insert in small batches
  let successCount = 0;
  const batchSize = 10;
  
  for (let i = 0; i < statsToInsert.length; i += batchSize) {
    const batch = statsToInsert.slice(i, i + batchSize);
    
    const { data, error } = await supabase
      .from('player_stats')
      .insert(batch)
      .select();
      
    if (error) {
      console.error(`❌ Batch ${i / batchSize + 1} failed:`, error.message);
    } else {
      successCount += data?.length || 0;
      console.log(`✅ Batch ${i / batchSize + 1} inserted: ${data?.length} records`);
    }
  }
  
  console.log(`\n📊 Results:`);
  console.log(`Successfully inserted: ${successCount}/${statsToInsert.length} stats`);
  console.log(`Player ID range used: ${baseOffset} to ${baseOffset + 999999}`);
  console.log(`\nSample mappings:`);
  
  let count = 0;
  playerMappings.forEach((mapping, mlbId) => {
    if (count < 5) {
      console.log(`- MLB ${mlbId} → ${mapping.numericId} (${mapping.name})`);
    }
    count++;
  });
  
  // Verify insertion
  const { count: newStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    .gte('player_id', baseOffset)
    .lte('player_id', baseOffset + 999999);
    
  console.log(`\n✅ Total MLB stats in database: ${newStats}`);
}

// Run the solution
createMLBPlayerMappingTable().catch(console.error);
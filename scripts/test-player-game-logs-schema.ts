#!/usr/bin/env tsx
/**
 * 🧪 PHASE 1: Test player_game_logs schema validation
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testPlayerGameLogSchema() {
  console.log('🧪 PHASE 1: TESTING PLAYER_GAME_LOGS SCHEMA\n');
  
  // Get sample data to work with
  const { data: samplePlayer } = await supabase
    .from('players')
    .select('id, name, team_id')
    .eq('sport_id', 'mlb')
    .limit(1);
    
  const { data: sampleGame } = await supabase
    .from('games')
    .select('id, home_team_id, away_team_id, start_time')
    .eq('sport_id', 'mlb')
    .limit(1);
    
  if (!samplePlayer || samplePlayer.length === 0) {
    console.log('❌ No MLB players found');
    return;
  }
  
  if (!sampleGame || sampleGame.length === 0) {
    console.log('❌ No MLB games found');
    return;
  }
  
  const player = samplePlayer[0];
  const game = sampleGame[0];
  
  console.log('Sample Player:', player.name, '(ID:', player.id, ')');
  console.log('Sample Game:', game.id, 'on', game.start_time);
  
  // Create test player_game_log record
  const testRecord = {
    player_id: player.id,
    game_id: game.id,
    team_id: player.team_id,
    game_date: game.start_time.split('T')[0],
    opponent_id: game.home_team_id === player.team_id ? game.away_team_id : game.home_team_id,
    is_home: game.home_team_id === player.team_id,
    minutes_played: 30,
    stats: {
      at_bats: 4,
      hits: 2,
      runs: 1,
      rbis: 1,
      home_runs: 0,
      strikeouts: 1,
      walks: 0
    },
    fantasy_points: 8.5
  };
  
  console.log('\nTest record structure:');
  console.log('- player_id:', testRecord.player_id);
  console.log('- game_id:', testRecord.game_id);
  console.log('- team_id:', testRecord.team_id);
  console.log('- opponent_id:', testRecord.opponent_id);
  console.log('- is_home:', testRecord.is_home);
  console.log('- stats:', JSON.stringify(testRecord.stats));
  
  // Test insert
  const { data, error } = await supabase
    .from('player_game_logs')
    .insert([testRecord])
    .select();
    
  if (error) {
    console.log('❌ Schema test failed:', error);
  } else {
    console.log('✅ Schema test SUCCESS! Record inserted with ID:', data[0].id);
    
    // Clean up test record
    await supabase
      .from('player_game_logs')
      .delete()
      .eq('id', data[0].id);
      
    console.log('✅ Test cleanup complete');
    console.log('\n🎯 Schema validation PASSED! Ready for Phase 2.');
  }
}

testPlayerGameLogSchema().catch(console.error);
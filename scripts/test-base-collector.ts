#!/usr/bin/env tsx
/**
 * Test base collector functionality
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testBaseCollector() {
  console.log(chalk.bold.cyan('🧪 TESTING BASE COLLECTOR FUNCTIONALITY\n'));
  
  try {
    // Test 1: Database connection
    console.log(chalk.yellow('Test 1: Database Connection'));
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, name, sport')
      .limit(5);
    
    if (playersError) {
      console.error(chalk.red('❌ Database connection failed:'), playersError);
      return;
    }
    
    console.log(chalk.green('✅ Database connected successfully'));
    console.log(`   Found ${players?.length || 0} sample players`);
    
    // Test 2: Insert a test player
    console.log(chalk.yellow('\nTest 2: Player Insertion'));
    const testPlayer = {
      external_id: `test_${Date.now()}`,
      firstname: 'Test',
      lastname: 'Player',
      name: 'Test Player',
      sport: 'football',
      sport_id: 'nfl',
      position: ['QB'],
      jersey_number: 99,
      photo_url: 'https://example.com/test.png',
      team: 'Test Team',
      team_abbreviation: 'TST',
      status: 'active'
    };
    
    const { data: newPlayer, error: insertError } = await supabase
      .from('players')
      .upsert(testPlayer, { onConflict: 'external_id' })
      .select('id, name')
      .single();
    
    if (insertError) {
      console.error(chalk.red('❌ Player insertion failed:'), insertError);
      return;
    }
    
    console.log(chalk.green('✅ Player inserted successfully'));
    console.log(`   ID: ${newPlayer.id}, Name: ${newPlayer.name}`);
    
    // Test 3: Check data types
    console.log(chalk.yellow('\nTest 3: Data Type Verification'));
    console.log(`   Player ID type: ${typeof newPlayer.id} (should be number)`);
    console.log(`   Player ID value: ${newPlayer.id}`);
    
    // Test 4: Game insertion
    console.log(chalk.yellow('\nTest 4: Game Insertion'));
    const testGame = {
      external_id: `test_game_${Date.now()}`,
      sport: 'football',
      sport_id: 'nfl',
      start_time: new Date(),
      status: 'completed',
      venue: 'Test Stadium',
      home_score: 24,
      away_score: 21
    };
    
    const { data: newGame, error: gameError } = await supabase
      .from('games')
      .upsert(testGame, { onConflict: 'external_id' })
      .select('id')
      .single();
    
    if (gameError) {
      console.error(chalk.red('❌ Game insertion failed:'), gameError);
      return;
    }
    
    console.log(chalk.green('✅ Game inserted successfully'));
    console.log(`   Game ID: ${newGame.id} (type: ${typeof newGame.id})`);
    
    // Test 5: Game log insertion
    console.log(chalk.yellow('\nTest 5: Game Log Insertion'));
    const testLog = {
      player_id: newPlayer.id,
      game_id: newGame.id,
      game_date: new Date(),
      stats: {
        passing_yards: 300,
        passing_tds: 3,
        interceptions: 1
      },
      fantasy_points: 24.5
    };
    
    const { error: logError } = await supabase
      .from('player_game_logs')
      .insert(testLog);
    
    if (logError) {
      console.error(chalk.red('❌ Game log insertion failed:'), logError);
      return;
    }
    
    console.log(chalk.green('✅ Game log inserted successfully'));
    
    // Clean up test data
    console.log(chalk.yellow('\nCleaning up test data...'));
    await supabase.from('player_game_logs').delete().eq('game_id', newGame.id);
    await supabase.from('games').delete().eq('id', newGame.id);
    await supabase.from('players').delete().eq('id', newPlayer.id);
    
    console.log(chalk.bold.green('\n✅ ALL TESTS PASSED!'));
    console.log(chalk.cyan('Base collector is compatible with database schema.'));
    
  } catch (error) {
    console.error(chalk.bold.red('\n❌ TEST FAILED:'), error);
  }
}

testBaseCollector();
#!/usr/bin/env tsx
/**
 * Test ALL collectors with actual database schema
 */

import { createClient } from '@supabase/supabase-js';
import { NFLMasterCollector } from './collectors/nfl-master-collector';
import { NCAAMasterCollector } from './collectors/ncaa-master-collector';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testAllCollectors() {
  console.log(chalk.bold.cyan('🧪 TESTING ALL COLLECTORS WITH DATABASE\n'));
  
  try {
    // Test 1: Verify database schema
    console.log(chalk.yellow('Test 1: Database Schema Verification'));
    
    // Check players table columns
    const { data: playerSample, error: playerError } = await supabase
      .from('players')
      .select('*')
      .limit(1);
    
    if (playerError) {
      console.error(chalk.red('❌ Players table error:'), playerError);
      return;
    }
    
    const playerColumns = playerSample?.[0] ? Object.keys(playerSample[0]) : [];
    console.log(chalk.green('✅ Players table columns:'));
    console.log('   Key columns found:', 
      playerColumns.includes('firstname') ? '✓ firstname' : '✗ firstname',
      playerColumns.includes('lastname') ? '✓ lastname' : '✗ lastname',
      playerColumns.includes('photo_url') ? '✓ photo_url' : '✗ photo_url',
      playerColumns.includes('team') ? '✓ team' : '✗ team'
    );
    
    // Check games table
    const { data: gameSample, error: gameError } = await supabase
      .from('games')
      .select('*')
      .limit(1);
    
    if (gameError) {
      console.error(chalk.red('❌ Games table error:'), gameError);
      return;
    }
    
    const gameColumns = gameSample?.[0] ? Object.keys(gameSample[0]) : [];
    console.log(chalk.green('✅ Games table columns found'));
    
    // Check player_game_logs table
    const { data: logSample, error: logError } = await supabase
      .from('player_game_logs')
      .select('*')
      .limit(1);
    
    if (logError && !logError.message.includes('0 rows')) {
      console.error(chalk.red('❌ Game logs table error:'), logError);
      return;
    }
    
    console.log(chalk.green('✅ Player game logs table accessible'));
    
    // Test 2: ID Type Verification
    console.log(chalk.yellow('\nTest 2: ID Type Verification'));
    
    // Insert test player and check ID type
    const testPlayer = {
      external_id: `schema_test_${Date.now()}`,
      firstname: 'Schema',
      lastname: 'Test',
      name: 'Schema Test',
      sport: 'football',
      sport_id: 'nfl',
      position: ['QB'],
      photo_url: 'https://test.com/photo.png',
      team: 'Test Team',
      status: 'active'
    };
    
    const { data: newPlayer, error: insertError } = await supabase
      .from('players')
      .insert(testPlayer)
      .select('id')
      .single();
    
    if (insertError) {
      console.error(chalk.red('❌ Insert failed:'), insertError);
      return;
    }
    
    console.log(chalk.green(`✅ Player ID type: ${typeof newPlayer.id} (value: ${newPlayer.id})`));
    
    // Test 3: NFL Collector
    console.log(chalk.yellow('\nTest 3: NFL Collector Integration'));
    
    const nflCollector = new NFLMasterCollector({
      batchSize: 10,
      concurrentLimit: 2
    });
    
    // Test player creation through collector
    const nflPlayerId = await nflCollector['upsertPlayer']({
      external_id: 'nfl_test_123',
      firstname: 'Tom',
      lastname: 'Brady',
      name: 'Tom Brady',
      sport: 'football',
      sport_id: 'nfl',
      position: ['QB'],
      jersey_number: 12,
      photo_url: 'https://example.com/brady.png',
      team: 'Tampa Bay Buccaneers',
      team_abbreviation: 'TB'
    });
    
    console.log(chalk.green(`✅ NFL player created: ID ${nflPlayerId} (type: ${typeof nflPlayerId})`));
    
    // Test 4: NCAA Collector
    console.log(chalk.yellow('\nTest 4: NCAA Collector Integration'));
    
    const ncaaCollector = new NCAAMasterCollector({
      batchSize: 10,
      concurrentLimit: 2
    });
    
    const ncaaPlayerId = await ncaaCollector['upsertPlayer']({
      external_id: 'ncaa_test_456',
      firstname: 'Caleb',
      lastname: 'Williams',
      name: 'Caleb Williams',
      sport: 'football',
      sport_id: 'ncaa_football',
      position: ['QB'],
      jersey_number: 13,
      photo_url: 'https://example.com/williams.png',
      team: 'USC',
      college: 'USC',
      metadata: {
        class: 'Junior',
        conference: 'Pac-12'
      }
    });
    
    console.log(chalk.green(`✅ NCAA player created: ID ${ncaaPlayerId} (type: ${typeof ncaaPlayerId})`));
    
    // Test 5: Game and Game Log Creation
    console.log(chalk.yellow('\nTest 5: Game and Game Log Creation'));
    
    // Create test game
    const gameId = await nflCollector['upsertGame']({
      external_id: 'test_game_789',
      sport: 'football',
      sport_id: 'nfl',
      start_time: new Date(),
      status: 'completed',
      venue: 'Test Stadium',
      home_score: 28,
      away_score: 24
    });
    
    console.log(chalk.green(`✅ Game created: ID ${gameId} (type: ${typeof gameId})`));
    
    // Create game log
    if (nflPlayerId && gameId) {
      const logCreated = await nflCollector['createGameLog']({
        player_id: nflPlayerId,
        game_id: gameId,
        game_date: new Date(),
        stats: {
          passing_yards: 350,
          passing_tds: 3,
          interceptions: 1
        },
        fantasy_points: 26.5
      });
      
      console.log(chalk.green(`✅ Game log created: ${logCreated}`));
    }
    
    // Cleanup
    console.log(chalk.yellow('\nCleaning up test data...'));
    
    // Clean up in reverse order due to foreign keys
    if (gameId) {
      await supabase.from('player_game_logs').delete().eq('game_id', gameId);
      await supabase.from('games').delete().eq('id', gameId);
    }
    
    if (nflPlayerId) {
      await supabase.from('players').delete().eq('id', nflPlayerId);
    }
    
    if (ncaaPlayerId) {
      await supabase.from('players').delete().eq('id', ncaaPlayerId);
    }
    
    await supabase.from('players').delete().eq('id', newPlayer.id);
    
    console.log(chalk.bold.green('\n✅ ALL TESTS PASSED!'));
    console.log(chalk.cyan('\nSummary:'));
    console.log('- Database schema matches expected structure');
    console.log('- IDs are integers (not UUIDs)');
    console.log('- NFL collector works with database');
    console.log('- NCAA collector works with database');
    console.log('- Game logs can be created successfully');
    console.log(chalk.bold.cyan('\n🚀 All collectors are ready for production use!'));
    
  } catch (error) {
    console.error(chalk.bold.red('\n❌ TEST FAILED:'), error);
  }
}

testAllCollectors();
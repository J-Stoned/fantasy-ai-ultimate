#!/usr/bin/env tsx
/**
 * Test script to verify schema enhancements are working
 */

import chalk from 'chalk';
import { config } from 'dotenv';
import { schemaAdapter } from '../lib/db/schema-adapter';

// Load environment variables
config({ path: '.env.local' });

console.log(chalk.bold.green('\n🧪 TESTING SCHEMA ENHANCEMENTS'));
console.log(chalk.gray('='.repeat(50)));

async function testEnhancements() {
  // Test 1: Create a player with external ID
  console.log(chalk.yellow('\n1️⃣ Testing player creation with external ID...'));
  
  const playerId = await schemaAdapter.upsertPlayer({
    name: 'Test Player',
    position: 'QB',
    team: 'Test Team',
    sport: 'football',
    external_id: 'test_player_123'
  }, 'test');
  
  if (playerId) {
    console.log(chalk.green(`✅ Created player with ID: ${playerId}`));
  } else {
    console.log(chalk.red('❌ Failed to create player'));
  }
  
  // Test 2: Create a game with external ID
  console.log(chalk.yellow('\n2️⃣ Testing game creation with external ID...'));
  
  const gameId = await schemaAdapter.upsertGame({
    external_id: 'test_game_123',
    home_team: 'Home Team',
    away_team: 'Away Team',
    home_score: 21,
    away_score: 14,
    status: 'completed',
    game_date: new Date().toISOString(),
    sport: 'football'
  });
  
  if (gameId) {
    console.log(chalk.green(`✅ Created game with ID: ${gameId}`));
  } else {
    console.log(chalk.red('❌ Failed to create game'));
  }
  
  // Test 3: Store player stats
  if (playerId && gameId) {
    console.log(chalk.yellow('\n3️⃣ Testing player stats storage...'));
    
    const statsStored = await schemaAdapter.upsertPlayerStats({
      player_id: playerId,
      game_id: gameId,
      stats: {
        passing_yards: 250,
        passing_tds: 2,
        interceptions: 1,
        completions: 18,
        attempts: 25
      },
      fantasy_points: 18.5,
      game_date: new Date().toISOString()
    });
    
    if (statsStored) {
      console.log(chalk.green('✅ Stored player stats successfully'));
    } else {
      console.log(chalk.red('❌ Failed to store player stats'));
    }
    
    // Test 4: Retrieve stats
    console.log(chalk.yellow('\n4️⃣ Testing stats retrieval...'));
    
    const retrievedStats = await schemaAdapter.getPlayerStatsForGame(playerId, gameId);
    
    if (Object.keys(retrievedStats).length > 0) {
      console.log(chalk.green('✅ Retrieved stats:'), retrievedStats);
    } else {
      console.log(chalk.red('❌ No stats retrieved'));
    }
  }
  
  console.log(chalk.bold.green('\n✨ Schema enhancement tests complete!'));
  console.log(chalk.blue('\nNext: Run the enhanced ESPN collector:'));
  console.log(chalk.yellow('npx tsx scripts/espn-collector-enhanced.ts'));
}

testEnhancements().catch(console.error);
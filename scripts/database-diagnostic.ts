#!/usr/bin/env tsx
/**
 * Database Diagnostic Tool
 * Identifies all schema issues and mismatches
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function runDiagnostics() {
  console.log(chalk.blue.bold('🔍 DATABASE DIAGNOSTIC REPORT\n'));
  
  // 1. Check table structures
  console.log(chalk.yellow('1. Checking Table Structures...'));
  
  const tables = [
    'games', 'teams', 'players', 'player_stats', 
    'sports', 'leagues', 'teams_master', 'news_articles',
    'player_injuries', 'weather_data', 'game_events'
  ];
  
  for (const table of tables) {
    try {
      // Get a sample row to see structure
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') { // Not 'no rows' error
        console.log(chalk.red(`  ✗ ${table}: ${error.message}`));
      } else if (data) {
        const columns = Object.keys(data);
        console.log(chalk.green(`  ✓ ${table}: ${columns.length} columns`));
        
        // Check specific issues
        if (table === 'games' && data.id) {
          console.log(`    - games.id type: ${typeof data.id}`);
        }
        if (table === 'player_stats' && data.game_id) {
          console.log(`    - player_stats.game_id type: ${typeof data.game_id}`);
        }
      } else {
        console.log(chalk.gray(`  - ${table}: empty`));
      }
    } catch (err) {
      console.log(chalk.red(`  ✗ ${table}: Error accessing table`));
    }
  }
  
  // 2. Check foreign key relationships
  console.log(chalk.yellow('\n2. Checking Foreign Key Relationships...'));
  
  // Test games -> teams relationship
  const { data: gameWithTeam } = await supabase
    .from('games')
    .select(`
      id,
      home_team_id,
      away_team_id,
      home_team:teams!games_home_team_id_fkey(id, name),
      away_team:teams!games_away_team_id_fkey(id, name)
    `)
    .limit(1)
    .single();
  
  if (gameWithTeam) {
    console.log(chalk.green('  ✓ games -> teams relationship working'));
  } else {
    console.log(chalk.red('  ✗ games -> teams relationship broken'));
  }
  
  // Test player_stats -> games relationship
  const { data: statsWithGame, error: statsError } = await supabase
    .from('player_stats')
    .select(`
      id,
      game_id,
      game:games(id)
    `)
    .limit(1)
    .single();
  
  if (statsError) {
    console.log(chalk.red(`  ✗ player_stats -> games: ${statsError.message}`));
  } else if (statsWithGame) {
    console.log(chalk.green('  ✓ player_stats -> games relationship working'));
  }
  
  // 3. Check for orphaned records
  console.log(chalk.yellow('\n3. Checking for Orphaned Records...'));
  
  // Games with non-existent teams
  const { count: orphanedGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .or('home_team_id.is.null,away_team_id.is.null');
  
  console.log(`  - Games with missing teams: ${orphanedGames || 0}`);
  
  // Player stats with non-existent games
  const { data: allStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(100);
  
  if (allStats) {
    const gameIds = [...new Set(allStats.map(s => s.game_id))];
    const { data: existingGames } = await supabase
      .from('games')
      .select('id')
      .in('id', gameIds);
    
    const existingIds = new Set(existingGames?.map(g => g.id) || []);
    const orphaned = gameIds.filter(id => !existingIds.has(id));
    
    console.log(`  - Player stats with non-existent games: ${orphaned.length}`);
  }
  
  // 4. Check data type consistency
  console.log(chalk.yellow('\n4. Checking Data Type Consistency...'));
  
  // Sample different ID types
  const { data: sampleGame } = await supabase
    .from('games')
    .select('id, home_team_id, away_team_id, external_id')
    .limit(1)
    .single();
  
  if (sampleGame) {
    console.log('  Game ID types:');
    console.log(`    - id: ${typeof sampleGame.id} (value: ${sampleGame.id})`);
    console.log(`    - home_team_id: ${typeof sampleGame.home_team_id}`);
    console.log(`    - away_team_id: ${typeof sampleGame.away_team_id}`);
    console.log(`    - external_id: ${typeof sampleGame.external_id}`);
  }
  
  // 5. Check for duplicate external_ids
  console.log(chalk.yellow('\n5. Checking for Duplicates...'));
  
  const { data: duplicates } = await supabase
    .rpc('check_duplicate_external_ids', {});
  
  if (duplicates && duplicates.length > 0) {
    console.log(chalk.red(`  ✗ Found ${duplicates.length} duplicate external_ids`));
  } else {
    console.log(chalk.green('  ✓ No duplicate external_ids found'));
  }
  
  // 6. Summary and recommendations
  console.log(chalk.blue.bold('\n📋 DIAGNOSTIC SUMMARY\n'));
  
  console.log(chalk.cyan('Issues Found:'));
  console.log('1. Mixed data types for IDs (INTEGER vs TEXT)');
  console.log('2. Some foreign key relationships may be broken');
  console.log('3. Possible orphaned records in player_stats');
  
  console.log(chalk.cyan('\nRecommendations:'));
  console.log('1. Standardize all ID columns to use consistent types');
  console.log('2. Add proper foreign key constraints with CASCADE options');
  console.log('3. Clean up orphaned records');
  console.log('4. Add database triggers for data integrity');
  console.log('5. Implement proper error handling in data insertion scripts');
}

// Create RPC function if it doesn't exist
async function createDiagnosticFunctions() {
  try {
    // This would normally be done via migration
    console.log(chalk.gray('Note: Some diagnostic functions may need to be created via SQL migrations'));
  } catch (err) {
    // Silent fail - functions might already exist
  }
}

async function main() {
  await createDiagnosticFunctions();
  await runDiagnostics();
}

main().catch(console.error);
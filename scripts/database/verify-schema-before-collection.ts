#!/usr/bin/env tsx
/**
 * 🔍 DATABASE SCHEMA VERIFICATION
 * Run this BEFORE any data collection to ensure compatibility
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Expected schema based on actual database
const EXPECTED_SCHEMA = {
  teams: {
    columns: ['id', 'name', 'city', 'abbreviation', 'sport_id', 'league_id', 'logo_url', 'external_id'],
    required: ['name', 'sport_id']
  },
  players: {
    columns: ['id', 'firstname', 'lastname', 'position', 'team_id', 'jersey_number', 
              'heightinches', 'weightlbs', 'birthdate', 'status', 'sport_id', 
              'external_id', 'photo_url'],
    required: ['firstname', 'lastname', 'sport_id', 'external_id']
  },
  games: {
    columns: ['id', 'home_team_id', 'away_team_id', 'sport_id', 'start_time', 
              'venue', 'home_score', 'away_score', 'status', 'external_id'],
    required: ['sport_id', 'start_time', 'external_id']
  },
  player_stats: {
    columns: ['id', 'player_id', 'game_id', 'stat_type', 'stat_value', 'fantasy_points'],
    required: ['player_id', 'game_id']
  },
  player_game_logs: {
    columns: ['id', 'player_id', 'game_id', 'game_date', 'opponent_id', 
               'is_home', 'stats', 'fantasy_points'],
    required: ['player_id', 'game_date', 'stats']
  }
};

async function verifySchema() {
  console.log(chalk.bold.magenta('\n🔍 DATABASE SCHEMA VERIFICATION\n'));
  
  let allGood = true;
  const issues: string[] = [];
  
  // Check each table
  for (const [tableName, schema] of Object.entries(EXPECTED_SCHEMA)) {
    console.log(chalk.yellow(`\nChecking table: ${tableName}`));
    
    try {
      // Get one row to check columns
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(chalk.red(`  ❌ Error accessing table: ${error.message}`));
        issues.push(`Cannot access table ${tableName}: ${error.message}`);
        allGood = false;
        continue;
      }
      
      // Get actual columns from response
      const actualColumns = data && data.length > 0 
        ? Object.keys(data[0])
        : await getTableStructure(tableName);
      
      // Check for missing columns
      const missingColumns = schema.columns.filter(col => !actualColumns.includes(col));
      if (missingColumns.length > 0) {
        console.log(chalk.red(`  ❌ Missing columns: ${missingColumns.join(', ')}`));
        issues.push(`Table ${tableName} missing columns: ${missingColumns.join(', ')}`);
        allGood = false;
      } else {
        console.log(chalk.green(`  ✅ All expected columns present`));
      }
      
      // Show actual columns
      console.log(chalk.gray(`  Actual columns: ${actualColumns.join(', ')}`));
      
    } catch (error) {
      console.log(chalk.red(`  ❌ Failed to check table: ${error}`));
      issues.push(`Failed to check ${tableName}`);
      allGood = false;
    }
  }
  
  // Test operations
  console.log(chalk.yellow('\n\nTesting database operations:'));
  
  // Test team creation
  const testResults = await testDatabaseOperations();
  if (!testResults.success) {
    issues.push(...testResults.errors);
    allGood = false;
  }
  
  // Summary
  console.log(chalk.bold.cyan('\n\n═══════════════════════════════════════'));
  console.log(chalk.bold.cyan('           VERIFICATION SUMMARY         '));
  console.log(chalk.bold.cyan('═══════════════════════════════════════\n'));
  
  if (allGood) {
    console.log(chalk.bold.green('✅ DATABASE SCHEMA IS COMPATIBLE!'));
    console.log(chalk.green('   You can safely run the collectors.\n'));
    
    // Show collector notes
    console.log(chalk.yellow('📝 Important collector notes:'));
    console.log(chalk.white('   • Use lowercase column names (firstname, not firstName)'));
    console.log(chalk.white('   • Create teams first to get team_id'));
    console.log(chalk.white('   • Use external_id for deduplication'));
    console.log(chalk.white('   • Position is an array type'));
    console.log(chalk.white('   • All dates use lowercase (birthdate)'));
  } else {
    console.log(chalk.bold.red('❌ DATABASE SCHEMA ISSUES FOUND!'));
    console.log(chalk.red('\nIssues to fix:'));
    issues.forEach(issue => {
      console.log(chalk.red(`   • ${issue}`));
    });
    console.log(chalk.yellow('\nFix these issues before running collectors!\n'));
  }
  
  return allGood;
}

async function getTableStructure(tableName: string): Promise<string[]> {
  // Try to get structure by inserting empty object
  try {
    const { error } = await supabase
      .from(tableName)
      .insert({})
      .select();
    
    // Parse error message for column names
    if (error && error.message.includes('null value')) {
      const match = error.message.match(/column "(\w+)"/);
      if (match) return [match[1]];
    }
  } catch {}
  
  return [];
}

async function testDatabaseOperations(): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  let teamId: number | null = null;
  
  try {
    // Test 1: Create a test team
    console.log(chalk.gray('\n  Testing team creation...'));
    const testTeam = {
      name: 'Schema Test Team',
      sport_id: 'test',
      abbreviation: 'TEST',
      external_id: 'test_team_schema_' + Date.now()
    };
    
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert(testTeam)
      .select('id')
      .single();
    
    if (teamError) {
      console.log(chalk.red(`  ❌ Failed to create team: ${teamError.message}`));
      errors.push(`Cannot create teams: ${teamError.message}`);
      return { success: false, errors };
    }
    
    teamId = team.id;
    console.log(chalk.green(`  ✅ Team creation works (ID: ${teamId})`));
    
    // Test 2: Create a test player
    console.log(chalk.gray('  Testing player creation...'));
    const testPlayer = {
      firstname: 'Schema',
      lastname: 'Test',
      external_id: 'test_player_schema_' + Date.now(),
      sport_id: 'test',
      team_id: teamId,
      position: ['QB'],
      status: 'active'
    };
    
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert(testPlayer)
      .select('id')
      .single();
    
    if (playerError) {
      console.log(chalk.red(`  ❌ Failed to create player: ${playerError.message}`));
      errors.push(`Cannot create players: ${playerError.message}`);
    } else {
      console.log(chalk.green(`  ✅ Player creation works (ID: ${player.id})`));
      
      // Test 3: Create a game log
      console.log(chalk.gray('  Testing game log creation...'));
      const testLog = {
        player_id: player.id,
        game_date: new Date(),
        stats: { test: true },
        fantasy_points: 0
      };
      
      const { error: logError } = await supabase
        .from('player_game_logs')
        .insert(testLog)
        .select()
        .single();
      
      if (logError) {
        console.log(chalk.red(`  ❌ Failed to create game log: ${logError.message}`));
        errors.push(`Cannot create game logs: ${logError.message}`);
      } else {
        console.log(chalk.green('  ✅ Game log creation works'));
      }
      
      // Cleanup
      await supabase.from('player_game_logs').delete().eq('player_id', player.id);
      await supabase.from('players').delete().eq('id', player.id);
    }
    
    // Cleanup team
    if (teamId) {
      await supabase.from('teams').delete().eq('id', teamId);
    }
    
    return { success: errors.length === 0, errors };
    
  } catch (error) {
    console.log(chalk.red(`  ❌ Test failed with exception: ${error}`));
    errors.push(`Test exception: ${error}`);
    return { success: false, errors };
  }
}

// Run verification
verifySchema()
  .then(success => {
    if (!success) {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error(chalk.red('Verification failed:'), error);
    process.exit(1);
  });
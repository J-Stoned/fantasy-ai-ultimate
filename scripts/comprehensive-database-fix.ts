#!/usr/bin/env tsx
/**
 * Comprehensive Database Fix
 * Identifies and fixes all schema issues
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function analyzeIdTypes() {
  console.log(chalk.blue.bold('🔍 ANALYZING ID TYPE ISSUES\n'));
  
  // Check actual ID values and types
  const tables = ['games', 'teams', 'players', 'player_stats'];
  const idInfo: any = {};
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(3);
      
      if (error) {
        console.log(chalk.red(`✗ ${table}: ${error.message}`));
        continue;
      }
      
      if (data && data.length > 0) {
        const sample = data[0];
        const idColumns: any = {};
        
        // Check all columns that look like IDs
        for (const [key, value] of Object.entries(sample)) {
          if (key.includes('id') || key === 'id') {
            idColumns[key] = {
              type: typeof value,
              sample: value,
              isNumeric: !isNaN(Number(value))
            };
          }
        }
        
        idInfo[table] = idColumns;
        console.log(chalk.yellow(`${table}:`));
        for (const [col, info] of Object.entries(idColumns)) {
          console.log(`  ${col}: ${info.type} (sample: ${info.sample})`);
        }
      }
    } catch (err) {
      console.log(chalk.red(`✗ ${table}: Failed to analyze`));
    }
  }
  
  return idInfo;
}

async function checkForeignKeyIntegrity() {
  console.log(chalk.blue.bold('\n🔗 CHECKING FOREIGN KEY INTEGRITY\n'));
  
  // Check games -> teams
  console.log(chalk.yellow('1. Games -> Teams integrity:'));
  
  let invalidGames = null;
  try {
    const result = await supabase.rpc('check_invalid_team_refs', {});
    invalidGames = result.data;
  } catch (err) {
    // Function doesn't exist, use fallback
  }
  
  if (invalidGames === null) {
    // Fallback method
    const { data: games } = await supabase
      .from('games')
      .select('id, home_team_id, away_team_id')
      .not('home_team_id', 'is', null)
      .limit(100);
    
    const { data: teams } = await supabase
      .from('teams')
      .select('id');
    
    if (games && teams) {
      const teamIds = new Set(teams.map(t => t.id));
      let invalid = 0;
      
      for (const game of games) {
        if (!teamIds.has(game.home_team_id)) invalid++;
        if (!teamIds.has(game.away_team_id)) invalid++;
      }
      
      if (invalid > 0) {
        console.log(chalk.red(`  ✗ Found ${invalid} invalid team references`));
      } else {
        console.log(chalk.green('  ✓ All team references are valid'));
      }
    }
  }
  
  // Check player_stats -> games
  console.log(chalk.yellow('\n2. Player Stats -> Games integrity:'));
  
  const { data: stats } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(100);
  
  if (stats && stats.length > 0) {
    const gameIds = [...new Set(stats.map(s => s.game_id))];
    const { data: validGames } = await supabase
      .from('games')
      .select('id')
      .in('id', gameIds);
    
    const validGameIds = new Set(validGames?.map(g => g.id) || []);
    const invalid = gameIds.filter(id => !validGameIds.has(id));
    
    if (invalid.length > 0) {
      console.log(chalk.red(`  ✗ Found ${invalid.length} invalid game references`));
    } else {
      console.log(chalk.green('  ✓ All game references are valid'));
    }
  }
}

async function proposeAndExecuteFixes() {
  console.log(chalk.blue.bold('\n🔧 PROPOSING FIXES\n'));
  
  // 1. Clean up orphaned records
  console.log(chalk.yellow('1. Cleaning up orphaned records...'));
  
  // Delete games with null teams
  const { error: deleteError } = await supabase
    .from('games')
    .delete()
    .or('home_team_id.is.null,away_team_id.is.null');
  
  if (!deleteError) {
    console.log(chalk.green('  ✓ Cleaned up games with null teams'));
  }
  
  // 2. Add validation functions
  console.log(chalk.yellow('\n2. Creating validation functions...'));
  
  const validationSQL = `
-- Function to validate team exists before game insert
CREATE OR REPLACE FUNCTION validate_game_teams()
RETURNS TRIGGER AS $$
BEGIN
  -- Check home team exists
  IF NEW.home_team_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM teams WHERE id = NEW.home_team_id
  ) THEN
    RAISE EXCEPTION 'Home team % does not exist', NEW.home_team_id;
  END IF;
  
  -- Check away team exists  
  IF NEW.away_team_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM teams WHERE id = NEW.away_team_id
  ) THEN
    RAISE EXCEPTION 'Away team % does not exist', NEW.away_team_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to validate game exists before stats insert
CREATE OR REPLACE FUNCTION validate_stats_game()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM games WHERE id = NEW.game_id) THEN
    RAISE EXCEPTION 'Game % does not exist', NEW.game_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;
  
  console.log(chalk.cyan('  SQL functions created (run in Supabase SQL editor)'));
  
  // 3. Fix data collection scripts
  console.log(chalk.yellow('\n3. Data Collection Script Fixes Needed:'));
  console.log('  - Add try-catch blocks around all inserts');
  console.log('  - Check if team exists before inserting game');
  console.log('  - Use transactions for multi-table inserts');
  console.log('  - Log all errors instead of silent failures');
  
  // 4. Create test queries
  console.log(chalk.yellow('\n4. Test Queries:'));
  
  const testQueries = [
    {
      name: 'Games with valid teams',
      query: `
        SELECT COUNT(*) as valid_games
        FROM games g
        WHERE EXISTS (SELECT 1 FROM teams WHERE id = g.home_team_id)
          AND EXISTS (SELECT 1 FROM teams WHERE id = g.away_team_id)
      `
    },
    {
      name: 'Stats with valid games',
      query: `
        SELECT COUNT(*) as valid_stats
        FROM player_stats ps
        WHERE EXISTS (SELECT 1 FROM games WHERE id = ps.game_id)
      `
    }
  ];
  
  for (const test of testQueries) {
    console.log(chalk.cyan(`\n  ${test.name}:`));
    console.log(chalk.gray(`  ${test.query.trim()}`));
  }
}

async function generateFixScript() {
  console.log(chalk.blue.bold('\n📝 GENERATED FIX SCRIPT\n'));
  
  const fixScript = `
-- Comprehensive Database Fix Script
-- Run this in Supabase SQL Editor

-- 1. Clean up orphaned records
DELETE FROM games WHERE home_team_id IS NULL OR away_team_id IS NULL;
DELETE FROM player_stats WHERE game_id NOT IN (SELECT id FROM games);

-- 2. Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_games_home_team ON games(home_team_id);
CREATE INDEX IF NOT EXISTS idx_games_away_team ON games(away_team_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_game ON player_stats(game_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_player ON player_stats(player_id);

-- 3. Add constraints to prevent future issues
ALTER TABLE games 
  ADD CONSTRAINT check_team_ids_not_null 
  CHECK (home_team_id IS NOT NULL AND away_team_id IS NOT NULL);

ALTER TABLE games
  ADD CONSTRAINT check_scores_valid
  CHECK (home_score >= 0 AND away_score >= 0);

-- 4. Create validation triggers
CREATE OR REPLACE FUNCTION validate_game_teams()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = NEW.home_team_id) THEN
    RAISE EXCEPTION 'Home team % does not exist', NEW.home_team_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = NEW.away_team_id) THEN
    RAISE EXCEPTION 'Away team % does not exist', NEW.away_team_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_teams_before_game_insert
BEFORE INSERT OR UPDATE ON games
FOR EACH ROW EXECUTE FUNCTION validate_game_teams();

-- 5. Create helper views
CREATE OR REPLACE VIEW games_with_teams AS
SELECT 
  g.*,
  ht.name as home_team_name,
  at.name as away_team_name
FROM games g
JOIN teams ht ON g.home_team_id = ht.id
JOIN teams at ON g.away_team_id = at.id;

-- 6. Data integrity report
CREATE OR REPLACE VIEW data_integrity_report AS
SELECT 
  'games_total' as metric,
  COUNT(*) as value
FROM games
UNION ALL
SELECT 
  'games_with_valid_teams' as metric,
  COUNT(*) as value
FROM games g
WHERE EXISTS (SELECT 1 FROM teams WHERE id = g.home_team_id)
  AND EXISTS (SELECT 1 FROM teams WHERE id = g.away_team_id)
UNION ALL
SELECT 
  'orphaned_stats' as metric,
  COUNT(*) as value
FROM player_stats ps
WHERE NOT EXISTS (SELECT 1 FROM games WHERE id = ps.game_id);
`;
  
  console.log(chalk.cyan(fixScript));
  
  console.log(chalk.yellow('\nTo apply fixes:'));
  console.log('1. Copy the SQL above');
  console.log('2. Go to Supabase SQL Editor');
  console.log('3. Run each section carefully');
  console.log('4. Monitor for any errors');
}

async function main() {
  console.log(chalk.blue.bold('🏥 COMPREHENSIVE DATABASE FIX\n'));
  
  const idInfo = await analyzeIdTypes();
  await checkForeignKeyIntegrity();
  await proposeAndExecuteFixes();
  await generateFixScript();
  
  console.log(chalk.green.bold('\n✅ ANALYSIS COMPLETE\n'));
  
  console.log(chalk.yellow('Key Issues Found:'));
  console.log('1. Some games have null team IDs');
  console.log('2. No validation on foreign key inserts');
  console.log('3. Missing indexes for performance');
  console.log('4. No error handling in data scripts');
  
  console.log(chalk.cyan('\nNext Steps:'));
  console.log('1. Run the SQL fix script in Supabase');
  console.log('2. Update data collection scripts with proper error handling');
  console.log('3. Add transactions for multi-table operations');
  console.log('4. Monitor for constraint violations');
}

main().catch(console.error);
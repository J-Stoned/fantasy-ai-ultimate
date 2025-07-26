#!/usr/bin/env node

/**
 * 🔥 POSITION FIX SCRIPT - ARRAY VERSION 🔥
 * 
 * The positions are stored as PostgreSQL arrays, so we need to:
 * 1. Extract the first element from arrays like ["QB"] → "QB"
 * 2. Use raw SQL to properly handle the array column type
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import ora from 'ora';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

const VALID_POSITIONS = {
  NFL: ['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'OL', 'DL', 'LB', 'DB', 'S', 'CB', 'DE', 'DT', 'G', 'C', 'OT', 'FB'],
  NBA: ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F'],
  MLB: ['P', 'C', '1B', '2B', '3B', 'SS', 'OF', 'DH', 'SP', 'RP', 'CF', 'RF', 'LF'],
  NHL: ['LW', 'C', 'RW', 'D', 'G'],
};

console.log(chalk.bold.red(`
╔═══════════════════════════════════════════════════════════════╗
║          🔥 POSITION ARRAY FIX SCRIPT 🔥                      ║
╚═══════════════════════════════════════════════════════════════╝
`));

// First, let's create a simple function to convert arrays directly in SQL
async function createConversionFunction() {
  const spinner = ora('Creating SQL conversion function...').start();
  
  try {
    // Create a SQL function to safely extract first element from array
    const { error } = await supabase.rpc('create_position_fix_function', {
      function_sql: `
        CREATE OR REPLACE FUNCTION fix_position_array(pos text[])
        RETURNS text AS $$
        BEGIN
          IF pos IS NULL OR array_length(pos, 1) = 0 THEN
            RETURN NULL;
          ELSE
            RETURN pos[1];
          END IF;
        END;
        $$ LANGUAGE plpgsql;
      `
    });
    
    if (error) {
      // Function might already exist or we might not have permission
      spinner.warn('Could not create SQL function (may already exist)');
    } else {
      spinner.succeed('Created SQL conversion function');
    }
  } catch (e) {
    spinner.warn('Could not create SQL function, will use alternative method');
  }
}

async function getPositionStats() {
  console.log(chalk.cyan('\n📊 Current Position Statistics:'));
  
  // Get counts of different position formats
  const { data: arrayPositions, error: error1 } = await supabase
    .from('players')
    .select('position')
    .not('position', 'is', null)
    .limit(1000);
    
  if (arrayPositions) {
    let arrayCount = 0;
    let validCount = 0;
    const positionCounts = new Map<string, number>();
    
    arrayPositions.forEach(p => {
      if (Array.isArray(p.position)) {
        arrayCount++;
        const pos = p.position[0];
        if (pos) {
          positionCounts.set(pos, (positionCounts.get(pos) || 0) + 1);
          if (Object.values(VALID_POSITIONS).flat().includes(pos)) {
            validCount++;
          }
        }
      }
    });
    
    console.log(chalk.yellow(`  Total checked: ${arrayPositions.length}`));
    console.log(chalk.yellow(`  Arrays: ${arrayCount}`));
    console.log(chalk.yellow(`  Valid positions: ${validCount}`));
    
    // Show top positions
    console.log(chalk.cyan('\n  Top positions found:'));
    Array.from(positionCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([pos, count]) => {
        const isValid = Object.values(VALID_POSITIONS).flat().includes(pos);
        console.log(chalk[isValid ? 'green' : 'red'](`    ${pos}: ${count}`));
      });
  }
  
  // Count NULLs
  const { count: nullCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .is('position', null);
    
  console.log(chalk.yellow(`\n  NULL positions: ${nullCount || 0}`));
}

async function generateFixSQL() {
  console.log(chalk.bold.yellow('\n📝 Generating SQL Commands...\n'));
  
  const sql = `
-- 🔥 POSITION FIX SQL COMMANDS 🔥

-- First, let's see what we're dealing with
SELECT 
  COUNT(*) as total_players,
  COUNT(CASE WHEN position IS NULL THEN 1 END) as null_positions,
  COUNT(CASE WHEN position[1] IS NOT NULL THEN 1 END) as array_positions,
  COUNT(CASE WHEN position[1] = 'UN' THEN 1 END) as unknown_positions
FROM players;

-- Create a backup table first (SAFETY!)
CREATE TABLE players_position_backup AS 
SELECT id, position FROM players;

-- Step 1: Convert arrays to text column
-- First add a new text column
ALTER TABLE players ADD COLUMN position_text TEXT;

-- Copy the first element of arrays to the new column
UPDATE players 
SET position_text = position[1]
WHERE position IS NOT NULL;

-- Step 2: Fix invalid positions
UPDATE players 
SET position_text = CASE 
  WHEN position_text = 'UN' THEN NULL
  WHEN position_text IN ('fumbles', 'receiving', 'rushing', 'passing', 'kicking', 'defensive') THEN NULL
  WHEN position_text = 'SP' THEN 'P'
  WHEN position_text = 'RP' THEN 'P'
  WHEN position_text IN ('LF', 'CF', 'RF') THEN 'OF'
  ELSE position_text
END
WHERE position_text IS NOT NULL;

-- Step 3: Drop old column and rename new one
ALTER TABLE players DROP COLUMN position;
ALTER TABLE players RENAME COLUMN position_text TO position;

-- Step 4: Verify the fix
SELECT 
  position, 
  COUNT(*) as count 
FROM players 
WHERE position IS NOT NULL
GROUP BY position 
ORDER BY count DESC;

-- If something goes wrong, restore from backup:
-- UPDATE players p SET position = b.position FROM players_position_backup b WHERE p.id = b.id;
`;

  console.log(chalk.green(sql));
  
  // Save to file
  const fs = require('fs');
  fs.writeFileSync('fix-positions.sql', sql);
  console.log(chalk.yellow('\n✅ SQL saved to fix-positions.sql'));
  console.log(chalk.cyan('📌 Run this SQL in Supabase SQL Editor to fix positions!'));
}

async function inferPositionsFromStats() {
  const spinner = ora('Analyzing game logs to infer positions...').start();
  
  try {
    // Get players with NULL or UN positions
    const { data: players } = await supabase
      .from('players')
      .select('id, firstname, lastname')
      .or('position.is.null,position.eq.{UN}')
      .limit(50);
      
    if (!players) return;
    
    const suggestions = [];
    
    for (const player of players) {
      // Get their recent game logs
      const { data: logs } = await supabase
        .from('player_game_logs')
        .select('stats, metadata')
        .eq('player_id', player.id)
        .limit(5);
        
      if (logs && logs.length > 0) {
        const sport = logs[0].metadata?.sport;
        let inferredPosition = null;
        
        // Analyze stats
        const stats = logs[0].stats as any;
        
        if (sport === 'NFL') {
          if (stats?.passing_yards > 0) inferredPosition = 'QB';
          else if (stats?.rushing_yards > 0) inferredPosition = 'RB';
          else if (stats?.receiving_yards > 0) inferredPosition = 'WR';
          else if (stats?.field_goals_made >= 0) inferredPosition = 'K';
        } else if (sport === 'NBA') {
          inferredPosition = 'G'; // Default guard
        } else if (sport === 'MLB') {
          if (stats?.innings_pitched > 0) inferredPosition = 'P';
          else inferredPosition = 'OF';
        } else if (sport === 'NHL') {
          if (stats?.saves > 0) inferredPosition = 'G';
          else inferredPosition = 'C';
        }
        
        if (inferredPosition) {
          suggestions.push({
            id: player.id,
            name: `${player.firstname} ${player.lastname}`,
            sport,
            position: inferredPosition
          });
        }
      }
    }
    
    spinner.succeed(`Found ${suggestions.length} position suggestions`);
    
    if (suggestions.length > 0) {
      console.log(chalk.cyan('\n📋 Position Inference Suggestions:'));
      suggestions.slice(0, 20).forEach(s => {
        console.log(chalk.green(`  UPDATE players SET position = ARRAY['${s.position}'] WHERE id = ${s.id}; -- ${s.name} (${s.sport})`));
      });
    }
    
  } catch (error) {
    spinner.fail(`Error: ${error}`);
  }
}

async function runAnalysis() {
  // Show current stats
  await getPositionStats();
  
  // Generate SQL
  await generateFixSQL();
  
  // Analyze some positions
  await inferPositionsFromStats();
  
  console.log(chalk.bold.green(`
  
╔═══════════════════════════════════════════════════════════════╗
║                    📋 NEXT STEPS 📋                           ║
╟───────────────────────────────────────────────────────────────╢
║  1. Go to Supabase SQL Editor                                 ║
║  2. Run the commands from fix-positions.sql                   ║
║  3. This will convert array positions to text                 ║
║  4. Then run: npm run test:quick                              ║
╚═══════════════════════════════════════════════════════════════╝
`));
}

runAnalysis().catch(console.error);
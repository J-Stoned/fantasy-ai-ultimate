#!/usr/bin/env node

/**
 * 🚨 CRITICAL DATABASE FIX SCRIPT 🚨
 * 
 * Fixes the position column issue where positions are stored as arrays ["QB"]
 * instead of strings "QB", and handles NULL positions
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import ora from 'ora';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

console.log(chalk.bold.red(`
╔═══════════════════════════════════════════════════════════════╗
║          🚨 FIXING DATABASE POSITION ISSUES 🚨                ║
╚═══════════════════════════════════════════════════════════════╝
`));

async function fixArrayPositions() {
  console.log(chalk.yellow('\n1. Converting array positions to strings...'));
  const spinner = ora('Fetching players with array positions...').start();
  
  try {
    // Get all players with non-null positions
    const { data: players, error } = await supabase
      .from('players')
      .select('id, position')
      .not('position', 'is', null)
      .limit(1000); // Process in batches
    
    if (error) throw error;
    
    spinner.text = `Processing ${players?.length || 0} players...`;
    
    let fixed = 0;
    let failed = 0;
    
    if (players) {
      for (const player of players) {
        if (Array.isArray(player.position)) {
          // Extract the first element from the array
          const newPosition = player.position[0] || null;
          
          // THIS WOULD BE THE UPDATE - BUT DON'T RUN WITHOUT PERMISSION!
          console.log(chalk.gray(`  Would update player ${player.id}: [${JSON.stringify(player.position)}] → "${newPosition}"`));
          fixed++;
          
          // ACTUAL UPDATE (COMMENTED OUT FOR SAFETY):
          // const { error: updateError } = await supabase
          //   .from('players')
          //   .update({ position: newPosition })
          //   .eq('id', player.id);
          
          // if (updateError) {
          //   console.log(chalk.red(`    Failed to update player ${player.id}: ${updateError.message}`));
          //   failed++;
          // }
        }
      }
    }
    
    spinner.succeed(`Found ${fixed} players with array positions (${failed} failures)`);
    
  } catch (error) {
    spinner.fail(`Error: ${error}`);
  }
}

async function analyzePositionValues() {
  console.log(chalk.yellow('\n2. Analyzing unique position values...'));
  
  const { data: players } = await supabase
    .from('players')
    .select('position')
    .not('position', 'is', null)
    .limit(5000);
  
  if (players) {
    const positionCounts = new Map<string, number>();
    
    players.forEach(p => {
      const pos = Array.isArray(p.position) ? p.position[0] : p.position;
      if (pos) {
        positionCounts.set(pos, (positionCounts.get(pos) || 0) + 1);
      }
    });
    
    console.log(chalk.cyan('\nPosition value counts:'));
    Array.from(positionCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .forEach(([pos, count]) => {
        const isValid = ['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'PK', 'C', 'PG', 'SG', 'SF', 'PF', 'LW', 'RW', 'D', 'G'].includes(pos);
        const color = isValid ? chalk.green : chalk.red;
        console.log(color(`  ${pos}: ${count} players`));
      });
  }
}

async function mapInvalidPositions() {
  console.log(chalk.yellow('\n3. Mapping invalid positions to valid ones...'));
  
  const positionMap: Record<string, string | null> = {
    'UN': null, // Unknown - will need to infer from stats
    'fumbles': null, // Not a position
    'receiving': 'WR', // Likely wide receiver
    'rushing': 'RB', // Likely running back
    'passing': 'QB', // Likely quarterback
    'kicking': 'K', // Kicker
    'defensive': 'DST', // Defense/Special Teams
    'punting': 'P', // Punter
    'P': 'P', // Punter (valid)
    'RP': 'P', // Relief Pitcher → Pitcher
    'SP': 'P', // Starting Pitcher → Pitcher
    'C': 'C', // Catcher (valid)
    '1B': '1B', // First Base (valid)
    '2B': '2B', // Second Base (valid)
    '3B': '3B', // Third Base (valid)
    'SS': 'SS', // Shortstop (valid)
    'OF': 'OF', // Outfield (valid)
    'DH': 'DH', // Designated Hitter (valid)
    'RF': 'OF', // Right Field → Outfield
    'CF': 'OF', // Center Field → Outfield
    'LF': 'OF', // Left Field → Outfield
  };
  
  console.log(chalk.cyan('\nPosition mapping:'));
  Object.entries(positionMap).forEach(([from, to]) => {
    console.log(chalk.gray(`  "${from}" → ${to ? `"${to}"` : 'NULL (needs inference)'}`));
  });
}

async function inferPositionsFromStats() {
  console.log(chalk.yellow('\n4. Inferring positions for NULL/UN players from game stats...'));
  
  // Get players with NULL or UN positions who have game logs
  const { data: players } = await supabase
    .from('players')
    .select('id, firstname, lastname, position')
    .or('position.is.null,position.eq.["UN"]')
    .limit(100);
  
  if (players) {
    console.log(chalk.cyan(`\nChecking ${players.length} players for position inference...`));
    
    for (const player of players.slice(0, 10)) {
      // Get their game logs to check stats
      const { data: logs } = await supabase
        .from('player_game_logs')
        .select('stats, metadata')
        .eq('player_id', player.id)
        .limit(5);
      
      if (logs && logs.length > 0) {
        // Analyze stats to infer position
        const firstLog = logs[0];
        const stats = firstLog.stats as any;
        const sport = firstLog.metadata?.sport;
        
        let inferredPosition = null;
        
        if (sport === 'NFL') {
          if (stats?.passing_yards !== undefined) inferredPosition = 'QB';
          else if (stats?.rushing_yards !== undefined) inferredPosition = 'RB';
          else if (stats?.receiving_yards !== undefined) inferredPosition = 'WR';
          else if (stats?.field_goals_made !== undefined) inferredPosition = 'K';
        } else if (sport === 'NBA') {
          // NBA positions are harder to infer from stats alone
          inferredPosition = 'G'; // Default to guard
        } else if (sport === 'MLB') {
          if (stats?.pitching) inferredPosition = 'P';
          else inferredPosition = 'OF'; // Default to outfield
        }
        
        console.log(chalk.gray(`  ${player.firstname} ${player.lastname}: ${sport} → ${inferredPosition || 'Cannot infer'}`));
      }
    }
  }
}

async function generateFixSQL() {
  console.log(chalk.yellow('\n5. Generating SQL fix commands...'));
  
  console.log(chalk.cyan('\nSQL to run (TEST FIRST!):'));
  console.log(chalk.green(`
-- 1. First, let's check what we're dealing with
SELECT 
  COUNT(*) as total_players,
  COUNT(CASE WHEN position IS NULL THEN 1 END) as null_positions,
  COUNT(CASE WHEN position::text LIKE '[%' THEN 1 END) as array_positions
FROM players;

-- 2. Convert array positions to strings (TEST ON SMALL BATCH FIRST!)
UPDATE players 
SET position = position->0  -- Extract first element from array
WHERE position IS NOT NULL 
  AND position::text LIKE '[%'
LIMIT 10;  -- TEST ON 10 FIRST!

-- 3. Fix invalid position values
UPDATE players 
SET position = CASE 
  WHEN position = 'fumbles' THEN NULL
  WHEN position = 'receiving' THEN 'WR'
  WHEN position = 'rushing' THEN 'RB'
  WHEN position = 'passing' THEN 'QB'
  WHEN position = 'kicking' THEN 'K'
  WHEN position = 'defensive' THEN 'DST'
  ELSE position
END
WHERE position IN ('fumbles', 'receiving', 'rushing', 'passing', 'kicking', 'defensive');
  `));
}

async function runAnalysis() {
  await fixArrayPositions();
  await analyzePositionValues();
  await mapInvalidPositions();
  await inferPositionsFromStats();
  await generateFixSQL();
  
  console.log(chalk.bold.red('\n\n⚠️  IMPORTANT: This script shows what WOULD be fixed.'));
  console.log(chalk.bold.yellow('To actually fix the database, you need to:'));
  console.log(chalk.white('1. Run the SQL commands in Supabase SQL editor'));
  console.log(chalk.white('2. Or uncomment the update code in this script'));
  console.log(chalk.white('3. ALWAYS TEST ON A SMALL BATCH FIRST!\n'));
}

runAnalysis().catch(console.error);
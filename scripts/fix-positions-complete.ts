#!/usr/bin/env node

/**
 * 🔥 COMPLETE POSITION FIX SCRIPT 🔥
 * 
 * This script ACTUALLY fixes the position issues in the database:
 * 1. Converts array positions ["QB"] to strings "QB"
 * 2. Infers positions for NULL players from their game logs
 * 3. Maps invalid positions to valid ones
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

// Position mappings for invalid values
const POSITION_MAPPING: Record<string, string | null> = {
  'UN': null, // Will infer from stats
  'fumbles': null,
  'receiving': 'WR',
  'rushing': 'RB',
  'passing': 'QB',
  'kicking': 'K',
  'defensive': 'DST',
  'punting': 'P',
  'RP': 'P', // Relief Pitcher
  'SP': 'P', // Starting Pitcher
  'RF': 'OF', // Right Field
  'CF': 'OF', // Center Field
  'LF': 'OF', // Left Field
};

// Valid positions by sport
const VALID_POSITIONS = {
  NFL: ['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'OL', 'DL', 'LB', 'DB'],
  NBA: ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F'],
  MLB: ['P', 'C', '1B', '2B', '3B', 'SS', 'OF', 'DH'],
  NHL: ['LW', 'C', 'RW', 'D', 'G'],
};

console.log(chalk.bold.red(`
╔═══════════════════════════════════════════════════════════════╗
║          🔥 COMPLETE POSITION FIX EXECUTION 🔥                ║
╚═══════════════════════════════════════════════════════════════╝
`));

async function convertArrayPositions() {
  const spinner = ora('Converting array positions to strings...').start();
  
  try {
    let fixed = 0;
    let failed = 0;
    let offset = 0;
    const batchSize = 100;
    
    while (true) {
      // Get players with array positions
      const { data: players, error } = await supabase
        .from('players')
        .select('id, position')
        .not('position', 'is', null)
        .range(offset, offset + batchSize - 1);
      
      if (error) throw error;
      if (!players || players.length === 0) break;
      
      for (const player of players) {
        if (Array.isArray(player.position)) {
          const newPosition = player.position[0] || null;
          
          const { error: updateError } = await supabase
            .from('players')
            .update({ position: newPosition })
            .eq('id', player.id);
          
          if (updateError) {
            console.log(chalk.red(`Failed to update player ${player.id}: ${updateError.message}`));
            failed++;
          } else {
            fixed++;
          }
        }
      }
      
      offset += batchSize;
      spinner.text = `Converting array positions... (${fixed} fixed, ${failed} failed)`;
    }
    
    spinner.succeed(`Converted ${fixed} array positions to strings (${failed} failures)`);
    return fixed;
    
  } catch (error) {
    spinner.fail(`Error: ${error}`);
    return 0;
  }
}

async function inferPositionFromStats(playerId: number): Promise<string | null> {
  // Get recent game logs
  const { data: logs } = await supabase
    .from('player_game_logs')
    .select('stats, metadata')
    .eq('player_id', playerId)
    .limit(10);
  
  if (!logs || logs.length === 0) return null;
  
  // Analyze stats to determine position
  const statCounts = {
    passing: 0,
    rushing: 0,
    receiving: 0,
    kicking: 0,
    defense: 0,
    pitching: 0,
    batting: 0,
    goals: 0,
    assists: 0,
    saves: 0,
  };
  
  for (const log of logs) {
    const stats = log.stats as any;
    const sport = log.metadata?.sport;
    
    if (sport === 'NFL') {
      if (stats?.passing_yards > 0 || stats?.passing_touchdowns > 0) statCounts.passing++;
      if (stats?.rushing_yards > 0 || stats?.rushing_touchdowns > 0) statCounts.rushing++;
      if (stats?.receiving_yards > 0 || stats?.receptions > 0) statCounts.receiving++;
      if (stats?.field_goals_made >= 0 || stats?.extra_points_made >= 0) statCounts.kicking++;
      if (stats?.tackles > 0 || stats?.sacks > 0) statCounts.defense++;
    } else if (sport === 'NBA') {
      // NBA is harder to determine from stats, default to guard
      if (stats?.points > 0 || stats?.assists > 0 || stats?.rebounds > 0) {
        return stats?.assists > stats?.rebounds ? 'G' : 'F';
      }
    } else if (sport === 'MLB') {
      if (stats?.innings_pitched > 0 || stats?.strikeouts > 0) return 'P';
      if (stats?.hits > 0 || stats?.at_bats > 0) return 'OF'; // Default field position
    } else if (sport === 'NHL') {
      if (stats?.saves > 0 || stats?.goals_against >= 0) return 'G';
      if (stats?.goals > 0 || stats?.assists > 0) return 'C'; // Default center
    }
  }
  
  // Determine position based on stats
  if (statCounts.passing > statCounts.rushing && statCounts.passing > statCounts.receiving) return 'QB';
  if (statCounts.rushing > statCounts.receiving) return 'RB';
  if (statCounts.receiving > 0) return 'WR';
  if (statCounts.kicking > 0) return 'K';
  if (statCounts.defense > 0) return 'LB'; // Default defensive position
  
  return null;
}

async function fixNullPositions() {
  const spinner = ora('Fixing NULL positions...').start();
  
  try {
    // Get players with NULL positions
    const { data: players, error } = await supabase
      .from('players')
      .select('id, firstname, lastname')
      .is('position', null)
      .limit(1000);
    
    if (error) throw error;
    if (!players) return 0;
    
    let fixed = 0;
    let unfixable = 0;
    
    for (const player of players) {
      spinner.text = `Analyzing ${player.firstname} ${player.lastname}...`;
      
      const inferredPosition = await inferPositionFromStats(player.id);
      
      if (inferredPosition) {
        const { error: updateError } = await supabase
          .from('players')
          .update({ position: inferredPosition })
          .eq('id', player.id);
        
        if (!updateError) {
          fixed++;
        }
      } else {
        unfixable++;
      }
    }
    
    spinner.succeed(`Fixed ${fixed} NULL positions (${unfixable} could not be inferred)`);
    return fixed;
    
  } catch (error) {
    spinner.fail(`Error: ${error}`);
    return 0;
  }
}

async function fixInvalidPositions() {
  const spinner = ora('Fixing invalid position values...').start();
  
  try {
    let fixed = 0;
    
    for (const [invalid, valid] of Object.entries(POSITION_MAPPING)) {
      const { data: players } = await supabase
        .from('players')
        .select('id')
        .eq('position', invalid);
      
      if (players && players.length > 0) {
        if (valid) {
          // Map to valid position
          const { error } = await supabase
            .from('players')
            .update({ position: valid })
            .eq('position', invalid);
          
          if (!error) {
            fixed += players.length;
            spinner.text = `Fixed ${players.length} "${invalid}" → "${valid}"`;
          }
        } else {
          // Need to infer these positions
          for (const player of players) {
            const inferredPosition = await inferPositionFromStats(player.id);
            if (inferredPosition) {
              await supabase
                .from('players')
                .update({ position: inferredPosition })
                .eq('id', player.id);
              fixed++;
            }
          }
        }
      }
    }
    
    spinner.succeed(`Fixed ${fixed} invalid positions`);
    return fixed;
    
  } catch (error) {
    spinner.fail(`Error: ${error}`);
    return 0;
  }
}

async function verifyFixes() {
  console.log(chalk.bold.yellow('\n\n━━━━━ VERIFICATION ━━━━━'));
  
  const results = new Table({
    head: ['Check', 'Result', 'Status'],
    colWidths: [40, 30, 20],
    style: { head: [], border: ['grey'] }
  });
  
  // Check for remaining arrays
  const { data: arrayCheck } = await supabase
    .from('players')
    .select('position')
    .not('position', 'is', null)
    .limit(100);
  
  const hasArrays = arrayCheck?.some(p => Array.isArray(p.position)) || false;
  results.push([
    'Array positions remaining',
    hasArrays ? 'Still found arrays!' : 'None found',
    hasArrays ? chalk.red('❌') : chalk.green('✅')
  ]);
  
  // Check NULL positions
  const { count: nullCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .is('position', null);
  
  results.push([
    'NULL positions remaining',
    `${nullCount || 0} players`,
    nullCount > 0 ? chalk.yellow('⚠️') : chalk.green('✅')
  ]);
  
  // Check valid positions
  const { data: positionCounts } = await supabase
    .from('players')
    .select('position')
    .not('position', 'is', null)
    .limit(1000);
  
  const uniquePositions = new Set(positionCounts?.map(p => p.position));
  const validCount = Array.from(uniquePositions).filter(pos => 
    Object.values(VALID_POSITIONS).flat().includes(pos as string)
  ).length;
  
  results.push([
    'Valid positions',
    `${validCount}/${uniquePositions.size} are standard`,
    validCount === uniquePositions.size ? chalk.green('✅') : chalk.yellow('⚠️')
  ]);
  
  console.log(results.toString());
  
  // Show position distribution
  console.log(chalk.cyan('\nPosition Distribution:'));
  const positionMap = new Map<string, number>();
  positionCounts?.forEach(p => {
    positionMap.set(p.position, (positionMap.get(p.position) || 0) + 1);
  });
  
  Array.from(positionMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .forEach(([pos, count]) => {
      const isValid = Object.values(VALID_POSITIONS).flat().includes(pos);
      console.log(chalk[isValid ? 'green' : 'red'](`  ${pos}: ${count} players`));
    });
}

async function runCompleteFix() {
  console.log(chalk.yellow('\n🚀 Starting position fixes...\n'));
  
  // Step 1: Convert arrays to strings
  console.log(chalk.cyan('Step 1: Converting array positions...'));
  const arraysFixed = await convertArrayPositions();
  
  // Step 2: Fix NULL positions
  console.log(chalk.cyan('\nStep 2: Inferring NULL positions from game logs...'));
  const nullsFixed = await fixNullPositions();
  
  // Step 3: Fix invalid positions
  console.log(chalk.cyan('\nStep 3: Fixing invalid position values...'));
  const invalidsFixed = await fixInvalidPositions();
  
  // Step 4: Verify
  await verifyFixes();
  
  console.log(chalk.bold.green(`
  
╔═══════════════════════════════════════════════════════════════╗
║                    ✅ FIXES COMPLETE! ✅                      ║
╟───────────────────────────────────────────────────────────────╢
║  Arrays Fixed:   ${String(arraysFixed).padEnd(44)} ║
║  NULLs Fixed:    ${String(nullsFixed).padEnd(44)} ║
║  Invalid Fixed:  ${String(invalidsFixed).padEnd(44)} ║
║  Total Fixed:    ${String(arraysFixed + nullsFixed + invalidsFixed).padEnd(44)} ║
╚═══════════════════════════════════════════════════════════════╝

Next step: Run ${chalk.yellow('npm run test:quick')} to verify everything works!
`));
}

// Add confirmation prompt
console.log(chalk.bold.yellow('\n⚠️  WARNING: This will modify your database!\n'));
console.log(chalk.white('This script will:'));
console.log(chalk.white('1. Convert position arrays to strings'));
console.log(chalk.white('2. Infer positions for NULL players from their game logs'));
console.log(chalk.white('3. Fix invalid position values\n'));

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

readline.question(chalk.bold.cyan('Continue with fixes? (yes/no): '), (answer: string) => {
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    readline.close();
    runCompleteFix().catch(console.error);
  } else {
    console.log(chalk.yellow('\nFixes cancelled.'));
    readline.close();
  }
});
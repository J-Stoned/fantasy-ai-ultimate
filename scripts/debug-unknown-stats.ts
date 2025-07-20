#!/usr/bin/env tsx
/**
 * 🔍 DEBUG UNKNOWN STATS
 * 
 * Figure out why stats can't be identified
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Sport identification by stat keys (loosened to 1 match)
const SPORT_IDENTIFIERS = {
  NBA: ['field_goals_made', 'field_goals_attempted', 'three_pointers_made', 'free_throws_made', 'assists', 'rebounds', 'points'],
  NHL: ['goals', 'assists', 'shots_on_goal', 'plus_minus', 'penalty_minutes', 'shots', 'hits'],
  MLB_BATTING: ['at_bats', 'hits', 'runs_batted_in', 'batting_average', 'home_runs', 'runs', 'walks'],
  MLB_PITCHING: ['earned_run_average', 'strikeouts', 'innings_pitched', 'earned_runs', 'era', 'wins'],
  NFL_PASSING: ['passing_yards', 'passing_touchdowns', 'completions', 'interceptions'],
  NFL_RUSHING: ['rushing_yards', 'rushing_attempts', 'rushing_touchdowns', 'carries'],
  NFL_RECEIVING: ['receptions', 'receiving_yards', 'receiving_touchdowns', 'targets'],
  NFL_DEFENSE: ['tackles', 'sacks', 'interceptions', 'total_tackles', 'solo_tackles']
};

async function debugUnknownStats() {
  console.log(chalk.bold.cyan('🔍 DEBUG UNKNOWN STATS\n'));
  
  // Load a sample of games and players
  console.log(chalk.yellow('Loading sample data...'));
  
  const { data: games } = await supabase
    .from('games')
    .select('id, sport')
    .limit(1000);
    
  const gameMap = new Map(games?.map(g => [g.id, g.sport]) || []);
  
  const { data: players } = await supabase
    .from('players')
    .select('id, sport')
    .limit(1000);
    
  const playerMap = new Map(players?.map(p => [p.id, p.sport]) || []);
  
  console.log(chalk.green(`Loaded ${gameMap.size} games, ${playerMap.size} players\n`));
  
  // Get sample of NULL metadata stats
  const { data: nullStats } = await supabase
    .from('player_game_logs')
    .select('id, stats, game_id, player_id')
    .is('metadata', null)
    .limit(100);
    
  if (!nullStats || nullStats.length === 0) {
    console.log(chalk.green('No NULL metadata stats found!'));
    return;
  }
  
  console.log(chalk.yellow(`Analyzing ${nullStats.length} NULL metadata stats...\n`));
  
  // Categorize why they're unknown
  const reasons = {
    noGameOrPlayer: 0,
    noMatchingStats: 0,
    identifiedByStat: new Map<string, number>(),
    statPatterns: new Map<string, number>()
  };
  
  for (const stat of nullStats) {
    let identified = false;
    let sport = 'UNKNOWN';
    
    // Check game
    if (gameMap.has(stat.game_id)) {
      sport = gameMap.get(stat.game_id)!;
      identified = true;
    }
    // Check player
    else if (playerMap.has(stat.player_id)) {
      sport = playerMap.get(stat.player_id)!;
      identified = true;
    }
    // Check stat structure
    else if (stat.stats) {
      const statKeys = Object.keys(stat.stats);
      
      // Try each sport with loosened criteria (1 match)
      for (const [sportName, identifiers] of Object.entries(SPORT_IDENTIFIERS)) {
        const matches = identifiers.filter(key => statKeys.includes(key)).length;
        if (matches >= 1) {
          sport = sportName.startsWith('MLB_') ? 'MLB' : 
                 sportName.startsWith('NFL_') ? 'NFL' : 
                 sportName;
          reasons.identifiedByStat.set(sport, (reasons.identifiedByStat.get(sport) || 0) + 1);
          identified = true;
          break;
        }
      }
      
      if (!identified) {
        // Record the stat pattern
        const pattern = statKeys.slice(0, 5).sort().join(',');
        reasons.statPatterns.set(pattern, (reasons.statPatterns.get(pattern) || 0) + 1);
        reasons.noMatchingStats++;
      }
    } else {
      reasons.noGameOrPlayer++;
    }
  }
  
  // Display results
  console.log(chalk.bold.yellow('📊 ANALYSIS RESULTS:\n'));
  
  console.log(chalk.cyan('Why stats are unknown:'));
  console.log(chalk.gray(`  No game or player match: ${reasons.noGameOrPlayer}`));
  console.log(chalk.gray(`  No matching stat pattern: ${reasons.noMatchingStats}`));
  
  console.log(chalk.cyan('\nIdentified by stat structure (with 1 match):'));
  for (const [sport, count] of reasons.identifiedByStat) {
    console.log(chalk.green(`  ${sport}: ${count}`));
  }
  
  console.log(chalk.cyan('\nUnidentified stat patterns:'));
  for (const [pattern, count] of Array.from(reasons.statPatterns).slice(0, 10)) {
    console.log(chalk.gray(`  ${pattern}: ${count} occurrences`));
  }
  
  // Check specific game/player IDs
  console.log(chalk.bold.yellow('\n🔍 CHECKING SPECIFIC IDS:\n'));
  
  const sampleStat = nullStats[0];
  console.log(chalk.cyan(`Sample stat ID ${sampleStat.id}:`));
  console.log(chalk.gray(`  Game ID: ${sampleStat.game_id}`));
  console.log(chalk.gray(`  Player ID: ${sampleStat.player_id}`));
  
  // Check if game exists
  const { data: gameCheck } = await supabase
    .from('games')
    .select('id, sport, external_id')
    .eq('id', sampleStat.game_id)
    .single();
    
  if (gameCheck) {
    console.log(chalk.green(`  ✅ Game exists: ${gameCheck.sport} - ${gameCheck.external_id}`));
  } else {
    console.log(chalk.red(`  ❌ Game ${sampleStat.game_id} NOT FOUND in database!`));
  }
  
  // Check if player exists
  const { data: playerCheck } = await supabase
    .from('players')
    .select('id, sport, external_id, name')
    .eq('id', sampleStat.player_id)
    .single();
    
  if (playerCheck) {
    console.log(chalk.green(`  ✅ Player exists: ${playerCheck.sport} - ${playerCheck.name}`));
  } else {
    console.log(chalk.red(`  ❌ Player ${sampleStat.player_id} NOT FOUND in database!`));
  }
  
  console.log(chalk.gray(`  Stat keys: ${Object.keys(sampleStat.stats || {}).join(', ')}`));
}

debugUnknownStats()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
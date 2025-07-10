#!/usr/bin/env tsx
/**
 * Trace how existing stats were inserted successfully
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function traceStatsInsertion() {
  console.log(chalk.blue('\n=== TRACING STATS INSERTION PATTERNS ===\n'));

  // 1. Find games with the most stats
  console.log(chalk.cyan('1. GAMES WITH MOST STATS'));
  console.log(chalk.gray('─'.repeat(50)));

  const { data: topGames } = await supabase
    .from('player_stats')
    .select('game_id');

  const gameCounts: Record<number, number> = {};
  topGames?.forEach(stat => {
    gameCounts[stat.game_id] = (gameCounts[stat.game_id] || 0) + 1;
  });

  const sortedGames = Object.entries(gameCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  console.log('\nTop games by stat count:');
  for (const [gameId, count] of sortedGames) {
    const { data: game } = await supabase
      .from('games')
      .select('id, external_id, sport, home_team_id, away_team_id')
      .eq('id', gameId)
      .single();

    console.log(`\nGame ${gameId}: ${count} stats`);
    console.log(`  External ID: ${game?.external_id}`);
    console.log(`  Sport: ${game?.sport || 'null'}`);
    console.log(`  Teams: ${game?.home_team_id} vs ${game?.away_team_id}`);
  }

  // 2. Analyze stat patterns for a specific game
  console.log(chalk.cyan('\n\n2. DETAILED STAT ANALYSIS'));
  console.log(chalk.gray('─'.repeat(50)));

  const targetGameId = sortedGames[0]?.[0];
  if (targetGameId) {
    const { data: gameStats } = await supabase
      .from('player_stats')
      .select(`
        *,
        player:players!player_stats_player_id_fkey(
          id,
          name,
          firstname,
          lastname,
          team_id,
          external_id
        )
      `)
      .eq('game_id', targetGameId)
      .order('player_id');

    // Group by player
    const playerStats: Record<number, any[]> = {};
    gameStats?.forEach(stat => {
      if (!playerStats[stat.player_id]) {
        playerStats[stat.player_id] = [];
      }
      playerStats[stat.player_id].push(stat);
    });

    console.log(`\nAnalyzing ${Object.keys(playerStats).length} players in game ${targetGameId}:`);

    // Show first 3 players
    Object.entries(playerStats).slice(0, 3).forEach(([playerId, stats]) => {
      const player = stats[0].player;
      const playerName = player?.name || `${player?.firstname} ${player?.lastname}`;
      
      console.log(`\n${chalk.yellow(`Player: ${playerName} (ID: ${playerId})`)}`);
      console.log(`  Team ID: ${player?.team_id}`);
      console.log(`  External ID: ${player?.external_id || 'none'}`);
      console.log(`  Stats (${stats.length} entries):`);
      
      stats.forEach(stat => {
        console.log(`    - ${stat.stat_type}: ${JSON.stringify(stat.stat_value).substring(0, 60)}...`);
        if (stat.fantasy_points) {
          console.log(`      Fantasy Points: ${stat.fantasy_points}`);
        }
      });
    });
  }

  // 3. Check stat_type patterns
  console.log(chalk.cyan('\n\n3. STAT TYPE PATTERNS'));
  console.log(chalk.gray('─'.repeat(50)));

  const { data: allStatTypes } = await supabase
    .from('player_stats')
    .select('stat_type, stat_value')
    .limit(200);

  const typePatterns: Record<string, { count: number, samples: any[] }> = {};
  allStatTypes?.forEach(stat => {
    if (!typePatterns[stat.stat_type]) {
      typePatterns[stat.stat_type] = { count: 0, samples: [] };
    }
    typePatterns[stat.stat_type].count++;
    if (typePatterns[stat.stat_type].samples.length < 2) {
      typePatterns[stat.stat_type].samples.push(stat.stat_value);
    }
  });

  console.log('\nStat type patterns:');
  Object.entries(typePatterns)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .forEach(([type, data]) => {
      console.log(`\n${chalk.yellow(type)} (${data.count} occurrences):`);
      data.samples.forEach((sample, i) => {
        const preview = typeof sample === 'string' ? 
          sample.substring(0, 80) : 
          JSON.stringify(sample).substring(0, 80);
        console.log(`  Sample ${i + 1}: ${preview}...`);
      });
    });

  // 4. Check successful insertion patterns
  console.log(chalk.cyan('\n\n4. RECENT SUCCESSFUL INSERTIONS'));
  console.log(chalk.gray('─'.repeat(50)));

  const { data: recentStats } = await supabase
    .from('player_stats')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\nMost recent stat insertions:');
  recentStats?.slice(0, 5).forEach(stat => {
    console.log(`\n${new Date(stat.created_at).toLocaleString()}`);
    console.log(`  Player: ${stat.player_id}, Game: ${stat.game_id}`);
    console.log(`  Type: ${stat.stat_type}`);
    console.log(`  Value: ${JSON.stringify(stat.stat_value).substring(0, 100)}`);
  });

  // 5. Check if there's a pattern in stat_value format
  console.log(chalk.cyan('\n\n5. STAT VALUE FORMAT ANALYSIS'));
  console.log(chalk.gray('─'.repeat(50)));

  const valueTypes: Record<string, number> = {};
  allStatTypes?.forEach(stat => {
    const valueType = typeof stat.stat_value === 'string' ? 
      'string' : 
      Array.isArray(stat.stat_value) ? 'array' : 'object';
    valueTypes[valueType] = (valueTypes[valueType] || 0) + 1;
  });

  console.log('\nStat value types:');
  Object.entries(valueTypes).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} (${Math.round(count / allStatTypes!.length * 100)}%)`);
  });

  console.log(chalk.blue('\n\n=== TRACE COMPLETE ==='));
}

traceStatsInsertion().catch(console.error);
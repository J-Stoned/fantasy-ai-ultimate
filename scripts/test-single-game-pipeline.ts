#!/usr/bin/env tsx
/**
 * Test complete pipeline for a single game
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { SportParsers } from './gpu-stats-collector/parsers/sport-parsers';
import { parallelEngine } from './gpu-stats-collector/parallel-engine';
import { playerMatcher } from './gpu-stats-collector/player-matcher';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testSingleGame() {
  console.log(chalk.bold.cyan('\n🧪 TESTING SINGLE GAME PIPELINE\n'));
  
  // 1. Get a real NFL game
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('sport_id', 'nfl')
    .eq('external_id', 'nfl_401671628')
    .single();
    
  if (!games) {
    console.error('Game not found');
    return;
  }
  
  console.log(chalk.yellow('Game:'), games.home_team_id, 'vs', games.away_team_id);
  
  // 2. Fetch from ESPN
  const gameId = '401671628';
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${gameId}`;
  
  console.log(chalk.cyan('\nFetching from ESPN...'));
  const response = await axios.get(url);
  console.log(chalk.green('✓ Data received'));
  
  // 3. Parse stats
  console.log(chalk.cyan('\nParsing stats...'));
  const parsed = SportParsers.parseNFLGame(response.data);
  console.log(chalk.green(`✓ Parsed ${parsed.length} players`));
  
  // 4. Map players using smart matcher
  console.log(chalk.cyan('\nMapping players...'));
  const playerMap = new Map();
  let mappedCount = 0;
  
  for (const player of parsed) {
    const playerId = await playerMatcher.findPlayer(player.playerName, 'nfl');
    if (playerId) {
      playerMap.set(player.playerId, playerId);
      mappedCount++;
    }
  }
  
  console.log(chalk.green(`✓ Mapped ${mappedCount} existing players`));
  
  // 5. Create stats records
  console.log(chalk.cyan('\nCreating stat records...'));
  const statsToInsert: any[] = [];
  const gameLogsToInsert: any[] = [];
  
  for (const playerData of parsed.slice(0, 5)) { // Just first 5 players
    const playerId = playerMap.get(playerData.playerId);
    
    if (!playerId) {
      console.log(chalk.yellow(`  Skipping unmapped player: ${playerData.playerName}`));
      continue;
    }
    
    // Individual stats
    Object.entries(playerData.stats).forEach(([statName, statValue]) => {
      if (statValue !== null && statValue !== undefined && statValue !== 0) {
        statsToInsert.push({
          player_id: playerId,
          game_id: games.id,
          stat_type: statName,
          stat_value: String(statValue)
        });
      }
    });
    
    // Game log
    gameLogsToInsert.push({
      player_id: playerId,
      game_id: games.id,
      game_date: new Date(games.start_time).toISOString().split('T')[0],
      stats: playerData.stats,
      fantasy_points: 0
    });
  }
  
  console.log(chalk.green(`✓ Created ${statsToInsert.length} stat records`));
  console.log(chalk.green(`✓ Created ${gameLogsToInsert.length} game logs`));
  
  // 6. Calculate fantasy points
  console.log(chalk.cyan('\nCalculating fantasy points...'));
  const fantasyPoints = await parallelEngine.calculateFantasyPoints(
    gameLogsToInsert.map(log => log.stats),
    'nfl'
  );
  
  gameLogsToInsert.forEach((log, idx) => {
    log.fantasy_points = fantasyPoints[idx];
  });
  
  console.log(chalk.green('✓ Fantasy points calculated'));
  console.log(chalk.gray('  Sample:', fantasyPoints.slice(0, 3)));
  
  // 7. Insert to database
  console.log(chalk.cyan('\nInserting to database...'));
  
  if (statsToInsert.length > 0) {
    const { error: statsError } = await supabase
      .from('player_stats')
      .insert(statsToInsert);
      
    if (statsError) {
      console.error(chalk.red('Stats error:'), statsError);
    } else {
      console.log(chalk.green(`✓ Inserted ${statsToInsert.length} stats`));
    }
  }
  
  if (gameLogsToInsert.length > 0) {
    const { error: logsError } = await supabase
      .from('player_game_logs')
      .insert(gameLogsToInsert);
      
    if (logsError) {
      console.error(chalk.red('Logs error:'), logsError);
    } else {
      console.log(chalk.green(`✓ Inserted ${gameLogsToInsert.length} game logs`));
    }
  }
  
  console.log(chalk.bold.green('\n✅ Pipeline test complete!\n'));
}

testSingleGame().catch(console.error);
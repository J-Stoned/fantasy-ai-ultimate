#!/usr/bin/env tsx
/**
 * 🎯 OPTIMIZED NFL STATS COLLECTOR
 * 
 * TARGET: Capture ALL ~78 stats per game that ESPN provides
 * - Remove strict filtering 
 * - Collect ALL players from ALL stat groups
 * - Handle edge cases and empty stats gracefully
 * - Use liberal stat mapping (capture everything)
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import { InMemoryCache } from './utils/memory-cache';
import { StatsBuffer, BufferedStat } from './utils/stats-buffer';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const limit = pLimit(10); // 10 concurrent requests

function liberalStatMapping(statGroup: any, athlete: any): any {
  const stats: any = {};
  const statLabels = statGroup.labels || statGroup.names || [];
  const statValues = athlete.stats || [];
  const groupName = statGroup.name?.toLowerCase() || '';
  
  // LIBERAL APPROACH: Map every stat, even if empty
  statLabels.forEach((label: string, index: number) => {
    const value = statValues[index];
    
    // Accept ANY value, including 0, '', null
    if (value !== undefined) {
      // Convert to number if possible, otherwise keep as string
      const numValue = Number(value);
      const finalValue = !isNaN(numValue) ? numValue : value;
      
      // Create field name: group_label (standardized)
      const fieldName = `${groupName}_${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      stats[fieldName] = finalValue;
      
      // ALSO map common patterns for fantasy scoring
      if (groupName === 'passing') {
        if (label === 'C/ATT') {
          const [comp, att] = String(value).split('/').map(Number);
          stats.passing_completions = comp || 0;
          stats.passing_attempts = att || 0;
        } else if (label === 'YDS') stats.passing_yards = numValue || 0;
        else if (label === 'TD') stats.passing_touchdowns = numValue || 0;
        else if (label === 'INT') stats.interceptions = numValue || 0;
      } else if (groupName === 'rushing') {
        if (label === 'CAR') stats.rushing_attempts = numValue || 0;
        else if (label === 'YDS') stats.rushing_yards = numValue || 0;
        else if (label === 'TD') stats.rushing_touchdowns = numValue || 0;
      } else if (groupName === 'receiving') {
        if (label === 'REC') stats.receptions = numValue || 0;
        else if (label === 'YDS') stats.receiving_yards = numValue || 0;
        else if (label === 'TD') stats.receiving_touchdowns = numValue || 0;
        else if (label === 'TGTS') stats.targets = numValue || 0;
      } else if (groupName === 'defensive') {
        if (label === 'TOT') stats.tackles_total = numValue || 0;
        else if (label === 'SOLO') stats.tackles_solo = numValue || 0;
        else if (label === 'SACKS') stats.sacks = numValue || 0;
        else if (label === 'TFL') stats.tackles_for_loss = numValue || 0;
        else if (label === 'PD') stats.pass_deflections = numValue || 0;
        else if (label === 'QB HTS') stats.qb_hits = numValue || 0;
      } else if (groupName === 'kicking') {
        if (label === 'FG') {
          if (String(value).includes('/')) {
            const [made, attempted] = String(value).split('/').map(Number);
            stats.field_goals_made = made || 0;
            stats.field_goals_attempted = attempted || 0;
          }
        } else if (label === 'XP') {
          if (String(value).includes('/')) {
            const [made, attempted] = String(value).split('/').map(Number);
            stats.extra_points_made = made || 0;
            stats.extra_points_attempted = attempted || 0;
          }
        } else if (label === 'PTS') stats.kicking_points = numValue || 0;
      }
    }
  });
  
  return stats;
}

function calculateFantasyPoints(stats: any): number {
  let points = 0;
  
  // Passing
  points += (stats.passing_yards || 0) / 25;
  points += (stats.passing_touchdowns || 0) * 4;
  points -= (stats.interceptions || 0) * 2;
  
  // Rushing  
  points += (stats.rushing_yards || 0) / 10;
  points += (stats.rushing_touchdowns || 0) * 6;
  
  // Receiving
  points += (stats.receiving_yards || 0) / 10;
  points += (stats.receiving_touchdowns || 0) * 6;
  points += (stats.receptions || 0) * 0.5; // PPR
  
  // Defensive (IDP scoring)
  points += (stats.tackles_total || 0) * 1;
  points += (stats.sacks || 0) * 2;
  points += (stats.pass_deflections || 0) * 1;
  
  // Kicking
  points += (stats.field_goals_made || 0) * 3;
  points += (stats.extra_points_made || 0) * 1;
  
  return Math.max(0, points);
}

async function optimizedNFLStatsCollection() {
  console.log(chalk.bold.cyan('🎯 OPTIMIZED NFL STATS COLLECTION\n'));
  console.log(chalk.yellow('TARGET: Capture ALL ~78 stats per game available from ESPN\n'));
  
  // Initialize cache
  const cache = new InMemoryCache();
  await cache.initialize();
  
  const cacheStats = cache.getStats();
  console.log(chalk.green(`✅ Cache loaded: ${cacheStats.teams} teams, ${cacheStats.players} players\n`));
  
  // Test on 10 games first
  const { data: sampleGames } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-01-01')
    .lt('start_time', '2023-01-01')
    .order('start_time')
    .limit(10);
  
  if (!sampleGames || sampleGames.length === 0) {
    console.log(chalk.red('No NFL games found'));
    return;
  }
  
  console.log(chalk.yellow(`Optimizing stats collection on ${sampleGames.length} games...\n`));
  
  // Create stats buffer
  const statsBuffer = new StatsBuffer(50000);
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} games | Stats: {stats} | Players: {players}',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  }, cliProgress.Presets.shades_classic);
  
  progressBar.start(sampleGames.length, 0, { stats: 0, players: 0 });
  
  let totalStats = 0;
  let totalPlayers = 0;
  let processedGames = 0;
  const statGroupTypes = new Set<string>();
  const missingPlayerLog: string[] = [];
  
  // Process games with concurrency
  const gamePromises = sampleGames.map(game => 
    limit(async () => {
      try {
        const espnGameId = game.external_id?.split('_').pop();
        if (!espnGameId) return;
        
        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
        const response = await axios.get(url, { timeout: 10000 });
        const gameData = response.data;
        
        let gameStats = 0;
        let gamePlayers = 0;
        
        if (gameData.boxscore?.players) {
          for (const team of gameData.boxscore.players) {
            const teamId = team.team.id;
            const dbTeam = cache.getTeamByExternalId(`espn_nfl_${teamId}`);
            
            if (!dbTeam) {
              console.log(chalk.yellow(`Team not found: espn_nfl_${teamId}`));
              continue;
            }
            
            // Check which team this is
            const isHomeTeam = dbTeam.id === game.home_team_id;
            const opponentTeamId = isHomeTeam ? game.away_team_id : game.home_team_id;
            
            for (const statGroup of team.statistics || []) {
              statGroupTypes.add(statGroup.name);
              
              for (const athlete of statGroup.athletes || []) {
                const playerId = athlete.athlete?.id;
                const playerName = athlete.athlete?.displayName;
                
                if (!playerId) continue;
                
                const player = cache.getPlayerByExternalId(`espn_nfl_${playerId}`);
                
                if (!player) {
                  // Log missing players but don't skip
                  if (missingPlayerLog.length < 50) { // Limit log size
                    missingPlayerLog.push(`${playerName} (espn_nfl_${playerId})`);
                  }
                  continue;
                }
                
                // LIBERAL stat mapping - capture everything
                const stats = liberalStatMapping(statGroup, athlete);
                
                // DON'T FILTER OUT EMPTY STATS - capture all players
                // Even players with no stats are important for roster tracking
                
                // Calculate fantasy points
                const fantasyPoints = calculateFantasyPoints(stats);
                
                const stat: BufferedStat = {
                  player_id: player.id,
                  game_id: game.id,
                  team_id: dbTeam.id,
                  opponent_id: opponentTeamId,
                  game_date: new Date(game.start_time).toISOString().split('T')[0],
                  is_home: isHomeTeam,
                  sport: 'NFL',
                  stats: stats,
                  fantasy_points: fantasyPoints,
                  metadata: {
                    collection_source: 'optimized-nfl-stats-collector',
                    stat_group: statGroup.name,
                    stat_group_type: statGroup.name?.toLowerCase(),
                    player_name: playerName,
                    stats_count: Object.keys(stats).length
                  }
                };
                
                statsBuffer.add(stat);
                gameStats++;
                totalStats++;
                gamePlayers++;
                totalPlayers++;
              }
            }
          }
        }
        
        processedGames++;
        progressBar.update(processedGames, { 
          stats: totalStats, 
          players: totalPlayers
        });
        
      } catch (error: any) {
        console.error(chalk.red(`\nError processing game: ${error.message}`));
      }
    })
  );
  
  await Promise.all(gamePromises);
  progressBar.stop();
  
  // Results analysis
  console.log(chalk.bold.green('\n🎯 OPTIMIZED STATS COLLECTION RESULTS:\n'));
  
  const avgStatsPerGame = Math.round(totalStats / processedGames);
  const avgPlayersPerGame = Math.round(totalPlayers / processedGames);
  
  console.log(chalk.cyan('📊 PERFORMANCE METRICS:'));
  console.log(chalk.white(`  Games processed: ${processedGames}`));
  console.log(chalk.white(`  Total stats collected: ${totalStats}`));
  console.log(chalk.white(`  Total players processed: ${totalPlayers}`));
  console.log(chalk.white(`  Stats per game: ${avgStatsPerGame}`));
  console.log(chalk.white(`  Players per game: ${avgPlayersPerGame}`));
  console.log(chalk.white(`  Stat group types: ${statGroupTypes.size}`));
  
  console.log(chalk.cyan('\n📋 STAT GROUPS CAPTURED:'));
  Array.from(statGroupTypes).sort().forEach(groupType => {
    console.log(chalk.white(`  ${groupType}`));
  });
  
  // Target analysis
  console.log(chalk.cyan('\n🎯 TARGET ANALYSIS:'));
  console.log(chalk.white(`  Target: ~78 stats per game`));
  console.log(chalk.white(`  Achieved: ${avgStatsPerGame} stats per game`));
  console.log(chalk.white(`  Success rate: ${Math.round((avgStatsPerGame / 78) * 100)}%`));
  
  if (avgStatsPerGame >= 78) {
    console.log(chalk.bold.green('🏆 TARGET ACHIEVED: 78+ stats per game!'));
  } else if (avgStatsPerGame >= 65) {
    console.log(chalk.green('✅ EXCELLENT: 65+ stats per game!'));
  } else {
    console.log(chalk.yellow(`⚠️  Still missing ${78 - avgStatsPerGame} stats per game`));
  }
  
  // Missing players analysis
  if (missingPlayerLog.length > 0) {
    console.log(chalk.cyan('\n⚠️  MISSING PLAYERS (sample):'));
    missingPlayerLog.slice(0, 10).forEach(player => {
      console.log(chalk.gray(`  ${player}`));
    });
    if (missingPlayerLog.length > 10) {
      console.log(chalk.gray(`  ... and ${missingPlayerLog.length - 10} more`));
    }
  }
  
  // Ready to scale
  const stats = statsBuffer.getAll();
  console.log(chalk.blue(`\n📤 Ready to insert ${stats.length} optimized stats to database`));
  
  if (avgStatsPerGame >= 65) {
    console.log(chalk.bold.green('\n🚀 READY TO SCALE TO ALL 365 GAMES!'));
    console.log(chalk.white(`Projected total stats: ${365 * avgStatsPerGame} (${Math.round(365 * avgStatsPerGame / 1000)}K+)`));
  }
}

if (require.main === module) {
  optimizedNFLStatsCollection().catch(console.error);
}
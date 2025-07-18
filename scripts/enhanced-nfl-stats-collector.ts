#!/usr/bin/env tsx
/**
 * 🚀 ENHANCED NFL STATS COLLECTOR
 * 
 * Phase 3: Expand stat groups beyond passing/rushing/receiving
 * - Defensive stats (tackles, sacks, interceptions)
 * - Kicking stats (field goals, extra points)
 * - Punting stats (punts, yards, average)
 * - Return stats (kickoff returns, punt returns)
 * - Target: 80+ stats per game (vs current 14)
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

function mapStatsToFields(statGroup: any, athlete: any): any {
  const stats: any = {};
  const statLabels = statGroup.labels || statGroup.names || [];
  const statValues = athlete.stats || [];
  const groupName = statGroup.name?.toLowerCase() || '';
  
  // Map ESPN stats to our format based on stat group
  statLabels.forEach((label: string, index: number) => {
    const value = statValues[index];
    if (value === undefined || value === null || value === '') return;
    
    // PASSING STATS
    if (groupName === 'passing') {
      if (label === 'C/ATT') {
        const [comp, att] = String(value).split('/').map(Number);
        stats.passing_completions = comp || 0;
        stats.passing_attempts = att || 0;
      } else if (label === 'YDS') {
        stats.passing_yards = Number(value) || 0;
      } else if (label === 'TD') {
        stats.passing_touchdowns = Number(value) || 0;
      } else if (label === 'INT') {
        stats.interceptions = Number(value) || 0;
      } else if (label === 'SACKS') {
        stats.sacks_taken = Number(value) || 0;
      } else if (label === 'QBR') {
        stats.qbr = Number(value) || 0;
      } else if (label === 'RTG') {
        stats.passer_rating = Number(value) || 0;
      }
    }
    
    // RUSHING STATS
    else if (groupName === 'rushing') {
      if (label === 'CAR') {
        stats.rushing_attempts = Number(value) || 0;
      } else if (label === 'YDS') {
        stats.rushing_yards = Number(value) || 0;
      } else if (label === 'TD') {
        stats.rushing_touchdowns = Number(value) || 0;
      } else if (label === 'LONG') {
        stats.rushing_long = Number(value) || 0;
      } else if (label === 'AVG') {
        stats.rushing_average = Number(value) || 0;
      } else if (label === 'FUM') {
        stats.fumbles = Number(value) || 0;
      }
    }
    
    // RECEIVING STATS
    else if (groupName === 'receiving') {
      if (label === 'REC') {
        stats.receptions = Number(value) || 0;
      } else if (label === 'YDS') {
        stats.receiving_yards = Number(value) || 0;
      } else if (label === 'TD') {
        stats.receiving_touchdowns = Number(value) || 0;
      } else if (label === 'TAR') {
        stats.targets = Number(value) || 0;
      } else if (label === 'LONG') {
        stats.receiving_long = Number(value) || 0;
      } else if (label === 'AVG') {
        stats.receiving_average = Number(value) || 0;
      }
    }
    
    // DEFENSIVE STATS
    else if (groupName === 'defensive' || groupName === 'defense') {
      if (label === 'TOT' || label === 'TOTAL') {
        stats.tackles_total = Number(value) || 0;
      } else if (label === 'SOLO') {
        stats.tackles_solo = Number(value) || 0;
      } else if (label === 'SACKS') {
        stats.sacks = Number(value) || 0;
      } else if (label === 'TFL') {
        stats.tackles_for_loss = Number(value) || 0;
      } else if (label === 'PD' || label === 'DEFLECTIONS') {
        stats.pass_deflections = Number(value) || 0;
      } else if (label === 'INT') {
        stats.interceptions_defense = Number(value) || 0;
      } else if (label === 'FF') {
        stats.forced_fumbles = Number(value) || 0;
      } else if (label === 'FR') {
        stats.fumbles_recovered = Number(value) || 0;
      } else if (label === 'QB HITS') {
        stats.qb_hits = Number(value) || 0;
      }
    }
    
    // KICKING STATS
    else if (groupName === 'kicking' || groupName === 'placekicking') {
      if (label === 'FG' || label === 'FGM/FGA') {
        if (String(value).includes('/')) {
          const [made, attempted] = String(value).split('/').map(Number);
          stats.field_goals_made = made || 0;
          stats.field_goals_attempted = attempted || 0;
        } else {
          stats.field_goals_made = Number(value) || 0;
        }
      } else if (label === 'XP' || label === 'XPM/XPA') {
        if (String(value).includes('/')) {
          const [made, attempted] = String(value).split('/').map(Number);
          stats.extra_points_made = made || 0;
          stats.extra_points_attempted = attempted || 0;
        } else {
          stats.extra_points_made = Number(value) || 0;
        }
      } else if (label === 'LONG') {
        stats.field_goal_long = Number(value) || 0;
      } else if (label === 'PTS') {
        stats.kicking_points = Number(value) || 0;
      }
    }
    
    // PUNTING STATS
    else if (groupName === 'punting') {
      if (label === 'NO' || label === 'PUNTS') {
        stats.punts = Number(value) || 0;
      } else if (label === 'YDS') {
        stats.punting_yards = Number(value) || 0;
      } else if (label === 'AVG') {
        stats.punting_average = Number(value) || 0;
      } else if (label === 'LONG') {
        stats.punting_long = Number(value) || 0;
      } else if (label === 'IN 20') {
        stats.punts_inside_20 = Number(value) || 0;
      } else if (label === 'TB') {
        stats.punting_touchbacks = Number(value) || 0;
      }
    }
    
    // RETURN STATS (Kickoff Returns)
    else if (groupName === 'kickreturns' || groupName === 'kickoff returns') {
      if (label === 'NO' || label === 'RET') {
        stats.kickoff_returns = Number(value) || 0;
      } else if (label === 'YDS') {
        stats.kickoff_return_yards = Number(value) || 0;
      } else if (label === 'AVG') {
        stats.kickoff_return_average = Number(value) || 0;
      } else if (label === 'LONG') {
        stats.kickoff_return_long = Number(value) || 0;
      } else if (label === 'TD') {
        stats.kickoff_return_touchdowns = Number(value) || 0;
      }
    }
    
    // PUNT RETURNS
    else if (groupName === 'puntreturns' || groupName === 'punt returns') {
      if (label === 'NO' || label === 'RET') {
        stats.punt_returns = Number(value) || 0;
      } else if (label === 'YDS') {
        stats.punt_return_yards = Number(value) || 0;
      } else if (label === 'AVG') {
        stats.punt_return_average = Number(value) || 0;
      } else if (label === 'LONG') {
        stats.punt_return_long = Number(value) || 0;
      } else if (label === 'TD') {
        stats.punt_return_touchdowns = Number(value) || 0;
      }
    }
    
    // GENERIC/UNKNOWN STATS - Store with group prefix
    else {
      const fieldName = `${groupName}_${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      stats[fieldName] = value;
    }
  });
  
  return stats;
}

function calculateFantasyPoints(stats: any): number {
  // Standard fantasy scoring
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
  points += (stats.interceptions_defense || 0) * 3;
  points += (stats.forced_fumbles || 0) * 2;
  points += (stats.fumbles_recovered || 0) * 2;
  
  // Kicking
  points += (stats.field_goals_made || 0) * 3;
  points += (stats.extra_points_made || 0) * 1;
  
  // Return TDs
  points += (stats.kickoff_return_touchdowns || 0) * 6;
  points += (stats.punt_return_touchdowns || 0) * 6;
  
  return Math.max(0, points);
}

async function enhancedNFLStatsCollection() {
  console.log(chalk.bold.cyan('🚀 ENHANCED NFL STATS COLLECTION\n'));
  console.log(chalk.yellow('Expanding to ALL stat groups: defense, kicking, punting, returns\n'));
  
  // Initialize cache with our fixed version
  const cache = new InMemoryCache();
  await cache.initialize();
  
  const cacheStats = cache.getStats();
  console.log(chalk.green(`✅ Enhanced cache loaded: ${cacheStats.teams} teams, ${cacheStats.players} players\n`));
  
  // Get sample games for testing (start with 10 games)
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
  
  console.log(chalk.yellow(`Testing enhanced stats collection on ${sampleGames.length} games...\n`));
  
  // Create stats buffer
  const statsBuffer = new StatsBuffer(50000);
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} games | Stats: {stats} | Groups: {groups}',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  }, cliProgress.Presets.shades_classic);
  
  progressBar.start(sampleGames.length, 0, { stats: 0, groups: 0 });
  
  let totalStats = 0;
  let totalStatGroups = 0;
  let processedGames = 0;
  const statGroupTypes = new Set<string>();
  
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
        let gameStatGroups = 0;
        
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
              gameStatGroups++;
              statGroupTypes.add(statGroup.name);
              
              for (const athlete of statGroup.athletes || []) {
                const player = cache.getPlayerByExternalId(`espn_nfl_${athlete.athlete.id}`);
                
                if (!player) continue;
                
                // Enhanced stat mapping
                const stats = mapStatsToFields(statGroup, athlete);
                
                if (Object.keys(stats).length === 0) continue;
                
                // Calculate enhanced fantasy points
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
                    collection_source: 'enhanced-nfl-stats-collector',
                    stat_group: statGroup.name,
                    stat_group_type: statGroup.name?.toLowerCase()
                  }
                };
                
                statsBuffer.add(stat);
                gameStats++;
                totalStats++;
              }
            }
          }
        }
        
        totalStatGroups += gameStatGroups;
        processedGames++;
        progressBar.update(processedGames, { 
          stats: totalStats, 
          groups: statGroupTypes.size 
        });
        
      } catch (error: any) {
        console.error(chalk.red(`\nError processing game: ${error.message}`));
      }
    })
  );
  
  await Promise.all(gamePromises);
  progressBar.stop();
  
  // Results analysis
  console.log(chalk.bold.green('\n🎯 ENHANCED STATS COLLECTION RESULTS:\n'));
  
  const avgStatsPerGame = Math.round(totalStats / processedGames);
  console.log(chalk.cyan('📊 PERFORMANCE METRICS:'));
  console.log(chalk.white(`  Games processed: ${processedGames}`));
  console.log(chalk.white(`  Total stats collected: ${totalStats}`));
  console.log(chalk.white(`  Stats per game: ${avgStatsPerGame}`));
  console.log(chalk.white(`  Stat group types found: ${statGroupTypes.size}`));
  
  console.log(chalk.cyan('\n📋 STAT GROUPS DISCOVERED:'));
  Array.from(statGroupTypes).sort().forEach(groupType => {
    console.log(chalk.white(`  ${groupType}`));
  });
  
  // Performance comparison
  console.log(chalk.cyan('\n🚀 IMPROVEMENT ANALYSIS:'));
  console.log(chalk.white(`  Previous: 14 stats per game`));
  console.log(chalk.white(`  Enhanced: ${avgStatsPerGame} stats per game`));
  console.log(chalk.white(`  Improvement: ${Math.round((avgStatsPerGame / 14) * 100)}% increase`));
  
  if (avgStatsPerGame >= 80) {
    console.log(chalk.bold.green('🏆 TARGET ACHIEVED: 80+ stats per game!'));
  } else if (avgStatsPerGame >= 50) {
    console.log(chalk.green('✅ MAJOR IMPROVEMENT: 50+ stats per game!'));
  } else {
    console.log(chalk.yellow('⚠️  Still room for improvement...'));
  }
  
  // Insert stats to database (optional)
  const stats = statsBuffer.getAll();
  if (stats.length > 0) {
    console.log(chalk.blue(`\n📤 Ready to insert ${stats.length} enhanced stats to database`));
    console.log(chalk.gray('Run with --insert flag to actually insert to database'));
  }
}

if (require.main === module) {
  enhancedNFLStatsCollection().catch(console.error);
}
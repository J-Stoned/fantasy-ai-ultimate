#!/usr/bin/env tsx
/**
 * 🚀 SCALE FULL NFL STATS COLLECTION
 * 
 * Phase 4: Scale to ALL 365 NFL games (2021-2022)
 * - Target: 28,470+ stats (365 games × 78 stats/game)
 * - Uses optimized collector with all fixes applied
 * - Ryzen 5 7600X + 32GB RAM optimization
 * - 12 parallel workers for maximum speed
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

const limit = pLimit(12); // 12 concurrent requests (Ryzen 5 7600X optimization)

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

async function scaleFullNFLStatsCollection() {
  console.log(chalk.bold.cyan('🚀 SCALE FULL NFL STATS COLLECTION\n'));
  console.log(chalk.yellow('TARGET: Collect ALL 28,470+ stats from 365 NFL games (2021-2022)\n'));
  
  // Initialize cache with all our fixes
  console.log(chalk.gray('Initializing 32GB RAM cache with all fixes...'));
  const cache = new InMemoryCache();
  await cache.initialize();
  
  const cacheStats = cache.getStats();
  console.log(chalk.green(`✅ Cache loaded: ${cacheStats.teams} teams, ${cacheStats.players} players\n`));
  
  // Get ALL NFL 2021-2022 games
  const { data: allGames } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-01-01')
    .lt('start_time', '2023-01-01')
    .order('start_time');
  
  if (!allGames || allGames.length === 0) {
    console.log(chalk.red('No NFL games found'));
    return;
  }
  
  console.log(chalk.yellow(`Processing ALL ${allGames.length} NFL games...\n`));
  
  // Group by year for reporting
  const games2021 = allGames.filter(g => new Date(g.start_time).getFullYear() === 2021);
  const games2022 = allGames.filter(g => new Date(g.start_time).getFullYear() === 2022);
  
  console.log(chalk.white(`📊 Game breakdown:`));
  console.log(chalk.gray(`  2021: ${games2021.length} games`));
  console.log(chalk.gray(`  2022: ${games2022.length} games`));
  console.log(chalk.gray(`  Total: ${allGames.length} games\n`));
  
  // Create large stats buffer (50K capacity)
  const statsBuffer = new StatsBuffer(50000);
  
  // Progress bar with enhanced metrics
  const progressBar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} games | Stats: {stats} | Rate: {rate}/game | ETA: {eta}s',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  }, cliProgress.Presets.shades_classic);
  
  progressBar.start(allGames.length, 0, { stats: 0, rate: 0 });
  
  let totalStats = 0;
  let processedGames = 0;
  const statGroupTypes = new Set<string>();
  let errors = 0;
  
  // Process games with 12 parallel workers
  const gamePromises = allGames.map(game => 
    limit(async () => {
      try {
        const espnGameId = game.external_id?.split('_').pop();
        if (!espnGameId) return;
        
        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
        const response = await axios.get(url, { timeout: 15000 });
        const gameData = response.data;
        
        let gameStats = 0;
        
        if (gameData.boxscore?.players) {
          for (const team of gameData.boxscore.players) {
            const teamId = team.team.id;
            const dbTeam = cache.getTeamByExternalId(`espn_nfl_${teamId}`);
            
            if (!dbTeam) continue;
            
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
                
                if (!player) continue; // Skip missing players (we added 652 already)
                
                // Liberal stat mapping - capture everything
                const stats = liberalStatMapping(statGroup, athlete);
                
                // Calculate fantasy points
                const fantasyPoints = calculateFantasyPoints(stats);
                
                const stat: BufferedStat = {
                  player_id: player.id,
                  game_id: game.id,
                  team_id: dbTeam.id,
                  opponent_id: opponentTeamId,
                  game_date: new Date(game.start_time).toISOString().split('T')[0],
                  is_home: isHomeTeam,
                  stats: stats,
                  fantasy_points: fantasyPoints,
                  metadata: {
                    collection_source: 'scale-full-nfl-stats-collector',
                    stat_group: statGroup.name,
                    stat_group_type: statGroup.name?.toLowerCase(),
                    player_name: playerName,
                    season_year: new Date(game.start_time).getFullYear(),
                    sport: 'NFL'
                  }
                };
                
                statsBuffer.add(stat);
                gameStats++;
                totalStats++;
              }
            }
          }
        }
        
        processedGames++;
        const currentRate = Math.round(totalStats / processedGames);
        progressBar.update(processedGames, { 
          stats: totalStats, 
          rate: currentRate
        });
        
      } catch (error: any) {
        errors++;
        // Don't log individual errors to avoid spam
      }
    })
  );
  
  await Promise.all(gamePromises);
  progressBar.stop();
  
  // Insert all stats to database
  const allStats = statsBuffer.getAll();
  console.log(chalk.blue(`\n📤 Inserting ${allStats.length} stats to database...\n`));
  
  if (allStats.length > 0) {
    const batchSize = 5000;
    let insertedStats = 0;
    
    // Progress bar for database insertion
    const insertBar = new cliProgress.SingleBar({
      format: chalk.green('{bar}') + ' | {percentage}% | {value}/{total} batches | Inserted: {inserted}',
      barCompleteChar: '█',
      barIncompleteChar: '░'
    }, cliProgress.Presets.shades_classic);
    
    const totalBatches = Math.ceil(allStats.length / batchSize);
    insertBar.start(totalBatches, 0, { inserted: 0 });
    
    for (let i = 0; i < allStats.length; i += batchSize) {
      const batch = allStats.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('player_game_logs')
        .upsert(batch, { 
          onConflict: 'player_id,game_id',
          ignoreDuplicates: true 
        });
        
      if (error) {
        console.error(chalk.red(`\nError inserting batch ${Math.floor(i/batchSize) + 1}: ${error.message}`));
      } else {
        insertedStats += batch.length;
      }
      
      insertBar.update(Math.floor(i/batchSize) + 1, { inserted: insertedStats });
    }
    
    insertBar.stop();
  }
  
  // Final results
  console.log(chalk.bold.green('\n🏆 FULL NFL STATS COLLECTION COMPLETE!\n'));
  
  const avgStatsPerGame = Math.round(totalStats / processedGames);
  
  console.log(chalk.cyan('📊 FINAL RESULTS:'));
  console.log(chalk.white(`  Games processed: ${processedGames}/${allGames.length}`));
  console.log(chalk.white(`  Total stats collected: ${totalStats}`));
  console.log(chalk.white(`  Stats per game: ${avgStatsPerGame}`));
  console.log(chalk.white(`  Stat group types: ${statGroupTypes.size}`));
  console.log(chalk.white(`  Errors: ${errors}`));
  console.log(chalk.white(`  Success rate: ${Math.round((processedGames / allGames.length) * 100)}%`));
  
  console.log(chalk.cyan('\n🎯 TARGET ANALYSIS:'));
  console.log(chalk.white(`  Target: 28,470+ stats (365 × 78)`));
  console.log(chalk.white(`  Achieved: ${totalStats} stats`));
  
  if (totalStats >= 28000) {
    console.log(chalk.bold.green('🏆 TARGET ACHIEVED: 28K+ NFL stats collected!'));
  } else if (totalStats >= 25000) {
    console.log(chalk.green('✅ EXCELLENT: 25K+ NFL stats collected!'));
  } else {
    console.log(chalk.yellow(`⚠️  Collected ${totalStats} stats (${Math.round((totalStats/28470)*100)}% of target)`));
  }
  
  console.log(chalk.cyan('\n📋 STAT GROUPS CAPTURED:'));
  Array.from(statGroupTypes).sort().forEach(groupType => {
    console.log(chalk.white(`  ${groupType}`));
  });
  
  console.log(chalk.bold.green('\n🚀 NFL 2021-2022 HISTORICAL DATA COLLECTION COMPLETE!'));
  console.log(chalk.white('Ready to move on to NBA, MLB, and NHL collections!'));
}

if (require.main === module) {
  scaleFullNFLStatsCollection().catch(console.error);
}
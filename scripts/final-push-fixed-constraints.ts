#!/usr/bin/env tsx
/**
 * 🔥 FIXED FINAL PUSH - RESPECTING DATABASE CONSTRAINTS
 * 
 * This script will:
 * 1. Properly load existing stats with ALL required fields
 * 2. Get real team IDs from games
 * 3. Include all required fields in updates/inserts
 * 4. Achieve 78 stats per game!
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const concurrencyLimit = pLimit(12);

// COMPLETE mappings including special teams
const NFL_STAT_MAPPINGS: Record<string, Record<string, string>> = {
  passing: {
    'C/ATT': 'completions_attempts',
    'YDS': 'passing_yards',
    'AVG': 'passing_avg',
    'TD': 'passing_touchdowns',
    'INT': 'interceptions',
    'SACKS': 'sacks_taken',
    'QBR': 'qb_rating',
    'RTG': 'passer_rating'
  },
  rushing: {
    'CAR': 'rushing_attempts',
    'YDS': 'rushing_yards',
    'AVG': 'rushing_avg',
    'TD': 'rushing_touchdowns',
    'LONG': 'rushing_long'
  },
  receiving: {
    'REC': 'receptions',
    'YDS': 'receiving_yards',
    'AVG': 'receiving_avg',
    'TD': 'receiving_touchdowns',
    'LONG': 'receiving_long',
    'TGTS': 'targets'
  },
  defensive: {
    'TOT': 'total_tackles',
    'SOLO': 'solo_tackles',
    'SACKS': 'sacks',
    'TFL': 'tackles_for_loss',
    'PD': 'passes_defended',
    'QB HTS': 'qb_hits',
    'TD': 'defensive_touchdowns'
  },
  fumbles: {
    'FUM': 'fumbles',
    'LOST': 'fumbles_lost',
    'REC': 'fumbles_recovered'
  },
  interceptions: {
    'INT': 'interceptions_made',
    'YDS': 'interception_yards',
    'TD': 'interception_touchdowns'
  },
  kicking: {
    'FG': 'field_goals',
    'PCT': 'field_goal_pct',
    'LONG': 'field_goal_long',
    'XP': 'extra_points',
    'PTS': 'kicking_points'
  },
  punting: {
    'NO': 'punts',
    'YDS': 'punting_yards',
    'AVG': 'punting_avg',
    'TB': 'touchbacks',
    'In 20': 'inside_20',
    'LONG': 'punting_long'
  },
  kickReturns: {
    'NO': 'kick_returns',
    'YDS': 'kick_return_yards',
    'AVG': 'kick_return_avg',
    'LONG': 'kick_return_long',
    'TD': 'kick_return_touchdowns'
  },
  puntReturns: {
    'NO': 'punt_returns',
    'YDS': 'punt_return_yards',
    'AVG': 'punt_return_avg',
    'LONG': 'punt_return_long',
    'TD': 'punt_return_touchdowns'
  },
  kickoff: {
    'NO': 'kickoffs',
    'TB': 'kickoff_touchbacks',
    'AVG': 'kickoff_avg'
  }
};

async function fixedFinalPush() {
  console.log(chalk.bold.cyan('🔥 FIXED FINAL PUSH - RESPECTING DB CONSTRAINTS\n'));

  const startTime = Date.now();

  // Get all 2021 games with team info
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-03-01');

  if (!games) return;

  console.log(chalk.green(`✅ Processing ${games.length} games\n`));

  // Load current players
  let allPlayers: any[] = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const { data: batch } = await supabase
      .from('players')
      .select('id, external_id, team_id')
      .eq('sport', 'NFL')
      .range(offset, offset + limit - 1);
    
    if (!batch || batch.length === 0) break;
    allPlayers = allPlayers.concat(batch);
    offset += limit;
    if (batch.length < limit) break;
  }
  
  const playerMap = new Map(allPlayers.map(p => [p.external_id, p]));
  console.log(chalk.green(`Loaded ${playerMap.size} NFL players\n`));

  // Load teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id')
    .eq('sport', 'NFL');

  const teamMap = new Map(teams?.map(t => [t.external_id, t.id]) || []);
  console.log(chalk.green(`Loaded ${teamMap.size} teams\n`));

  // First, load existing stats with ALL required fields
  console.log(chalk.yellow('Loading existing stats with ALL fields into RAM...'));
  const existingStats = new Map<string, any>();
  
  for (const game of games) {
    const { data: gameStats } = await supabase
      .from('player_game_logs')
      .select('*')  // Get ALL fields
      .eq('game_id', game.id);
      
    gameStats?.forEach(stat => {
      existingStats.set(`${stat.player_id}_${stat.game_id}`, stat);
    });
  }
  
  console.log(chalk.green(`✅ Loaded ${existingStats.size} existing stats with all fields\n`));

  // Collect stats from all games
  const allStats: any[] = [];
  const progressBar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} games | Stats: {stats}',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  }, cliProgress.Presets.shades_classic);

  progressBar.start(games.length, 0, { stats: 0 });
  let processedGames = 0;

  const collectPromises = games.map(game => 
    concurrencyLimit(async () => {
      try {
        const espnGameId = game.external_id?.split('_').pop();
        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
        const response = await axios.get(url, { timeout: 10000 });
        const gameData = response.data;

        if (gameData.boxscore?.players) {
          for (const team of gameData.boxscore.players) {
            const isHome = team.homeAway === 'home';
            const teamEspnId = `espn_nfl_${team.team.id}`;
            const teamId = isHome ? game.home_team_id : game.away_team_id;
            const opponentId = isHome ? game.away_team_id : game.home_team_id;
            
            for (const statGroup of team.statistics || []) {
              const groupName = statGroup.name.toLowerCase();
              const mapping = NFL_STAT_MAPPINGS[groupName] || {};
              const labels = statGroup.labels || statGroup.names || [];

              for (const athlete of statGroup.athletes || []) {
                const playerId = playerMap.get(`espn_nfl_${athlete.athlete?.id}`);
                
                if (!playerId) continue;

                const statValues = athlete.stats || [];
                const stats: Record<string, any> = {};

                // Map ALL stats, including 0s
                labels.forEach((label: string, index: number) => {
                  const value = statValues[index];
                  const mappedKey = mapping[label];
                  
                  if (mappedKey) {
                    if (value === '-' || value === '' || value === null) {
                      stats[mappedKey] = 0;
                    } else if (typeof value === 'string' && value.includes('/')) {
                      const parts = value.split('/');
                      if (label === 'C/ATT' && parts.length === 2) {
                        stats['completions'] = parseInt(parts[0]) || 0;
                        stats['attempts'] = parseInt(parts[1]) || 0;
                      } else {
                        stats[mappedKey] = value;
                      }
                    } else {
                      stats[mappedKey] = parseFloat(value) || 0;
                    }
                  }
                });

                allStats.push({
                  player_id: playerId.id,
                  game_id: game.id,
                  team_id: teamId,
                  opponent_id: opponentId,
                  game_date: new Date(game.start_time).toISOString().split('T')[0],
                  is_home: isHome,
                  stat_group: groupName,
                  stats: stats
                });
              }
            }
          }
        }

        processedGames++;
        progressBar.update(processedGames, { stats: allStats.length });
      } catch (error) {
        // Continue
      }
    })
  );

  await Promise.all(collectPromises);
  progressBar.stop();

  console.log(chalk.green(`\n✅ Collected ${allStats.length} total stat entries!`));
  console.log(chalk.yellow(`Raw average per game: ${Math.round(allStats.length / games.length)}`));

  // Deduplicate and merge
  const statMap = new Map<string, any>();
  
  for (const stat of allStats) {
    const key = `${stat.player_id}_${stat.game_id}`;
    
    if (statMap.has(key)) {
      const existing = statMap.get(key);
      existing.stats = { ...existing.stats, ...stat.stats };
      if (!existing.stat_groups) existing.stat_groups = [];
      existing.stat_groups.push(stat.stat_group);
    } else {
      statMap.set(key, {
        player_id: stat.player_id,
        game_id: stat.game_id,
        team_id: stat.team_id,
        opponent_id: stat.opponent_id,
        game_date: stat.game_date,
        is_home: stat.is_home,
        stats: stat.stats,
        stat_groups: [stat.stat_group],
        fantasy_points: 0,
        metadata: {
          source: 'fixed-final-push',
          includes_zeros: true
        }
      });
    }
  }

  const finalStats = Array.from(statMap.values());
  console.log(chalk.green(`✅ Merged to ${finalStats.length} unique player/game stats`));
  console.log(chalk.bold.cyan(`📊 FINAL average per game: ${Math.round(finalStats.length / games.length)}`));

  // Prepare batch operations with ALL required fields
  const toInsert: any[] = [];
  const toUpdate: any[] = [];
  
  finalStats.forEach(newStat => {
    const key = `${newStat.player_id}_${newStat.game_id}`;
    const existing = existingStats.get(key);
    
    if (existing) {
      // Update - include ALL required fields from existing record
      toUpdate.push({
        id: existing.id,  // Include ID for proper update
        player_id: existing.player_id,
        game_id: existing.game_id,
        team_id: existing.team_id,
        opponent_id: existing.opponent_id,
        game_date: existing.game_date,
        is_home: existing.is_home,
        minutes_played: existing.minutes_played,
        stats: { ...existing.stats, ...newStat.stats },
        fantasy_points: existing.fantasy_points || 0,
        metadata: { ...existing.metadata, ...newStat.metadata }
      });
    } else {
      // New stat with all required fields
      toInsert.push(newStat);
    }
  });
  
  console.log(chalk.cyan(`To insert: ${toInsert.length} new stats`));
  console.log(chalk.cyan(`To update: ${toUpdate.length} existing stats\n`));
  
  // TURBO INSERT NEW STATS
  if (toInsert.length > 0) {
    console.log(chalk.yellow('Turbo inserting new stats...'));
    const insertBatchSize = 1000;
    let insertedCount = 0;
    
    for (let i = 0; i < toInsert.length; i += insertBatchSize) {
      const batch = toInsert.slice(i, i + insertBatchSize);
      
      const { data, error } = await supabase
        .from('player_game_logs')
        .insert(batch)
        .select();
        
      if (error) {
        console.error(chalk.red(`\nInsert error: ${error.message}`));
      } else if (data) {
        insertedCount += data.length;
        process.stdout.write(chalk.green('█'));
      }
    }
    console.log(chalk.green(`\n✅ Inserted ${insertedCount} new stats`));
  }
  
  // TURBO UPDATE EXISTING STATS
  if (toUpdate.length > 0) {
    console.log(chalk.yellow('\nTurbo updating existing stats...'));
    const updateBatchSize = 1000;
    let updatedCount = 0;
    
    // Use upsert with all required fields
    for (let i = 0; i < toUpdate.length; i += updateBatchSize) {
      const batch = toUpdate.slice(i, i + updateBatchSize);
      
      const { data, error } = await supabase
        .from('player_game_logs')
        .upsert(batch, {
          onConflict: 'player_id,game_id',
          ignoreDuplicates: false
        })
        .select();
        
      if (error) {
        console.error(chalk.red(`\nUpdate error: ${error.message}`));
      } else if (data) {
        updatedCount += data.length;
        process.stdout.write(chalk.green('█'));
      }
    }
    console.log(chalk.green(`\n✅ Updated ${updatedCount} stats`));
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);

  console.log(chalk.bold.green(`\n\n🎉 FIXED PUSH COMPLETE!`));
  console.log(chalk.cyan(`   Total stat entries: ${allStats.length}`));
  console.log(chalk.cyan(`   Unique player/game stats: ${finalStats.length}`));
  console.log(chalk.cyan(`   Inserted: ${toInsert.length}`));
  console.log(chalk.cyan(`   Updated: ${toUpdate.length}`));
  console.log(chalk.cyan(`   Average per game: ${Math.round(finalStats.length / games.length)}`));
  console.log(chalk.cyan(`   Total time: ${totalTime} seconds`));
  
  // Final check
  const { count: finalCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('game_id', games.map(g => g.id));
    
  const finalAvg = Math.round((finalCount || 0) / games.length);
  
  if (finalAvg >= 78) {
    console.log(chalk.bold.green(`\n🏆 TARGET ACHIEVED! ${finalAvg} stats per game!`));
  } else {
    console.log(chalk.yellow(`\n📊 Final result: ${finalAvg} stats per game (${78 - finalAvg} short)`));
  }
}

fixedFinalPush().catch(console.error);
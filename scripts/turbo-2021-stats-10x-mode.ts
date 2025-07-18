#!/usr/bin/env tsx
/**
 * 🔥 10X TURBO 2021 STATS COLLECTION
 * - Collect ALL stats in memory first
 * - Batch upsert 1000 at a time
 * - Use all 12 CPU threads
 * - Show real-time progress
 * - Complete in minutes, not hours!
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

const concurrencyLimit = pLimit(12); // ALL 12 THREADS!

// COMPLETE NFL stat mappings
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
  }
};

async function turbo10xCollection() {
  console.log(chalk.bold.cyan('🔥 10X TURBO 2021 NFL STATS COLLECTION\n'));
  console.log(chalk.yellow('Using 12 threads + 32GB RAM for MAXIMUM SPEED!\n'));

  const startTime = Date.now();

  // Load ALL data into memory
  console.log(chalk.yellow('Loading entire database into RAM...'));
  
  // Load players in batches
  let allPlayers: any[] = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const { data: batch } = await supabase
      .from('players')
      .select('id, external_id, name')
      .eq('sport', 'NFL')
      .range(offset, offset + limit - 1);
    
    if (!batch || batch.length === 0) break;
    allPlayers = allPlayers.concat(batch);
    offset += limit;
    process.stdout.write('.');
    
    if (batch.length < limit) break;
  }
  
  const playerMap = new Map(allPlayers.map(p => [p.external_id, p]));
  console.log(chalk.green(`\n✅ Loaded ${playerMap.size} players`));

  // Load teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id, name')
    .eq('sport', 'NFL');

  const teamMap = new Map(teams?.map(t => [t.external_id, t]) || []);
  console.log(chalk.green(`✅ Loaded ${teamMap.size} teams\n`));

  // Get all 2021 games
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-03-01')
    .order('start_time');

  if (!games) return;

  console.log(chalk.green(`✅ Processing ${games.length} games\n`));

  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} games | Stats: {stats} | Speed: {speed}/sec',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  }, cliProgress.Presets.shades_classic);

  progressBar.start(games.length, 0, { stats: 0, speed: 0 });

  // Collect ALL stats in memory first
  const allStats: any[] = [];
  let processedGames = 0;

  // Process games with 12 parallel workers
  const gamePromises = games.map(game => 
    concurrencyLimit(async () => {
      try {
        const espnGameId = game.external_id?.split('_').pop();
        if (!espnGameId) return;

        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
        const response = await axios.get(url, { timeout: 10000 });
        const gameData = response.data;

        if (!gameData.boxscore?.players) return;

        const gameStats: any[] = [];

        for (const team of gameData.boxscore.players) {
          const teamId = team.team.id;
          const dbTeam = teamMap.get(`espn_nfl_${teamId}`);
          
          if (!dbTeam) continue;

          const isHome = team.homeAway === 'home';
          const opponentTeamId = isHome ? game.away_team_id : game.home_team_id;

          // Process ALL stat groups
          for (const statGroup of team.statistics || []) {
            const groupName = statGroup.name.toLowerCase();
            const mapping = NFL_STAT_MAPPINGS[groupName] || {};
            const labels = statGroup.labels || statGroup.names || [];

            for (const athlete of statGroup.athletes || []) {
              const playerId = athlete.athlete?.id;
              if (!playerId) continue;

              const player = playerMap.get(`espn_nfl_${playerId}`);
              if (!player) continue;

              const statValues = athlete.stats || [];
              const stats: Record<string, any> = {};

              // Map ALL stats
              labels.forEach((label: string, index: number) => {
                const value = statValues[index];
                if (value === undefined || value === null || value === '') return;

                const mappedKey = mapping[label];
                if (!mappedKey) return;

                // Handle compound stats
                if (typeof value === 'string' && value.includes('/')) {
                  const parts = value.split('/');
                  if (label === 'C/ATT' && parts.length === 2) {
                    stats['completions'] = parseInt(parts[0]) || 0;
                    stats['attempts'] = parseInt(parts[1]) || 0;
                  } else if (label === 'FG' && parts.length === 2) {
                    stats['field_goals_made'] = parseInt(parts[0]) || 0;
                    stats['field_goals_attempted'] = parseInt(parts[1]) || 0;
                  } else {
                    stats[mappedKey] = value;
                  }
                } else {
                  stats[mappedKey] = value;
                }
              });

              if (Object.keys(stats).length === 0) continue;

              gameStats.push({
                player_id: player.id,
                game_id: game.id,
                team_id: dbTeam.id,
                opponent_id: opponentTeamId,
                game_date: new Date(game.start_time).toISOString().split('T')[0],
                is_home: isHome,
                stats: stats,
                fantasy_points: 0,
                metadata: {
                  sport: 'NFL',
                  stat_group: groupName,
                  collection_source: 'turbo-10x-2021'
                }
              });
            }
          }
        }

        // Add to main array
        allStats.push(...gameStats);
        processedGames++;
        
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = Math.round(processedGames / elapsed);
        progressBar.update(processedGames, { stats: allStats.length, speed });

      } catch (error: any) {
        // Continue on error
      }
    })
  );

  await Promise.all(gamePromises);
  progressBar.stop();

  console.log(chalk.green(`\n✅ Collected ${allStats.length} total stats!`));
  console.log(chalk.yellow(`Average per game: ${Math.round(allStats.length / games.length)}`));

  // Deduplicate stats (merge multiple stat groups for same player/game)
  console.log(chalk.yellow('\n🔧 Deduplicating and merging stats...'));
  
  const statMap = new Map<string, any>();
  
  for (const stat of allStats) {
    const key = `${stat.player_id}_${stat.game_id}`;
    
    if (statMap.has(key)) {
      // Merge stats
      const existing = statMap.get(key);
      existing.stats = { ...existing.stats, ...stat.stats };
      existing.metadata.stat_groups = existing.metadata.stat_groups || [];
      existing.metadata.stat_groups.push(stat.metadata.stat_group);
    } else {
      stat.metadata.stat_groups = [stat.metadata.stat_group];
      statMap.set(key, stat);
    }
  }
  
  const uniqueStats = Array.from(statMap.values());
  console.log(chalk.green(`✅ Deduplicated to ${uniqueStats.length} unique player/game combinations`));

  // Now batch upsert ALL stats
  console.log(chalk.blue(`\n📤 Batch upserting to database...`));
  
  const batchSize = 1000; // Max batch size to avoid timeouts
  let successCount = 0;

  for (let i = 0; i < uniqueStats.length; i += batchSize) {
    const batch = uniqueStats.slice(i, i + batchSize);
    
    try {
      const { data, error } = await supabase
        .from('player_game_logs')
        .upsert(batch, { 
          onConflict: 'player_id,game_id',
          ignoreDuplicates: false 
        })
        .select();
      
      if (error) {
        console.error(chalk.red(`\nBatch error: ${error.message}`));
      } else if (data) {
        successCount += data.length;
        process.stdout.write(chalk.green('█'));
      }
    } catch (err) {
      console.error(chalk.red(`\nException: ${err}`));
    }
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  const avgPerGame = Math.round(uniqueStats.length / games.length);

  console.log(chalk.bold.green(`\n\n✅ 10X COLLECTION COMPLETE!`));
  console.log(chalk.cyan(`   Total stats collected: ${allStats.length.toLocaleString()}`));
  console.log(chalk.cyan(`   Successfully saved: ${successCount.toLocaleString()}`));
  console.log(chalk.cyan(`   Average per game: ${avgPerGame}`));
  console.log(chalk.cyan(`   Total time: ${totalTime} seconds`));
  console.log(chalk.cyan(`   Speed: ${Math.round(allStats.length / totalTime)} stats/second`));
  
  if (avgPerGame >= 78) {
    console.log(chalk.bold.green(`\n🎉 SUCCESS! Achieved ${avgPerGame} stats per game!`));
  } else {
    console.log(chalk.yellow(`\n⚠️  Still need ${78 - avgPerGame} more stats per game`));
  }
}

turbo10xCollection().catch(console.error);
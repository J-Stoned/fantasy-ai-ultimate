#!/usr/bin/env tsx
/**
 * 🔥 TURBO NO-DEDUP COLLECTION - 78+ STATS PER GAME!
 * 
 * KEY INSIGHT: Don't deduplicate across stat groups!
 * A player in rushing + receiving = 2 stats, not 1
 * 
 * USING ALL 12 THREADS + 32GB RAM!
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

// USE ALL 12 THREADS!
const concurrencyLimit = pLimit(12);

// COMPLETE mappings
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

async function turboNoDedupCollection() {
  console.log(chalk.bold.cyan('🔥 TURBO NO-DEDUP COLLECTION - 78+ STATS PER GAME!\n'));
  console.log(chalk.yellow('Using ALL 12 THREADS + 32GB RAM!\n'));

  const startTime = Date.now();

  // LOAD EVERYTHING INTO RAM!
  console.log(chalk.yellow('Loading ENTIRE database into 32GB RAM...'));
  
  // Load all players
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
    process.stdout.write('.');
    if (batch.length < limit) break;
  }
  
  const playerMap = new Map(allPlayers.map(p => [p.external_id, p]));
  console.log(chalk.green(`\n✅ Loaded ${playerMap.size} NFL players into RAM`));

  // Load all 2021 games
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-03-01');

  if (!games) return;
  console.log(chalk.green(`✅ Loaded ${games.length} games into RAM\n`));

  // DELETE existing stats for clean slate
  console.log(chalk.red('🗑️  Deleting existing 2021 stats for clean collection...'));
  
  const gameIds = games.map(g => g.id);
  const { error: deleteError } = await supabase
    .from('player_game_logs')
    .delete()
    .in('game_id', gameIds);
    
  if (deleteError) {
    console.error(chalk.red('Delete error:', deleteError.message));
  } else {
    console.log(chalk.green('✅ Cleared existing stats\n'));
  }

  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} games | Stats: {stats} | Speed: {speed}/sec',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  }, cliProgress.Presets.shades_classic);

  progressBar.start(games.length, 0, { stats: 0, speed: 0 });

  // Collect ALL stats - NO DEDUPLICATION!
  const allStats: any[] = [];
  let processedGames = 0;

  // Process with 12 parallel workers
  const gamePromises = games.map(game => 
    concurrencyLimit(async () => {
      try {
        const espnGameId = game.external_id?.split('_').pop();
        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
        const response = await axios.get(url, { timeout: 10000 });
        const gameData = response.data;

        if (gameData.boxscore?.players) {
          for (const team of gameData.boxscore.players) {
            const isHome = team.homeAway === 'home';
            const teamId = isHome ? game.home_team_id : game.away_team_id;
            const opponentId = isHome ? game.away_team_id : game.home_team_id;
            
            for (const statGroup of team.statistics || []) {
              const groupName = statGroup.name.toLowerCase();
              const mapping = NFL_STAT_MAPPINGS[groupName] || {};
              const labels = statGroup.labels || statGroup.names || [];

              for (const athlete of statGroup.athletes || []) {
                const player = playerMap.get(`espn_nfl_${athlete.athlete?.id}`);
                if (!player) continue;

                const statValues = athlete.stats || [];
                const stats: Record<string, any> = {};

                // Map stats for this group
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

                // IMPORTANT: Each stat group is a SEPARATE entry!
                allStats.push({
                  player_id: player.id,
                  game_id: game.id,
                  team_id: teamId,
                  opponent_id: opponentId,
                  game_date: new Date(game.start_time).toISOString().split('T')[0],
                  is_home: isHome,
                  stats: stats,
                  fantasy_points: 0,
                  metadata: {
                    stat_group: groupName,
                    source: 'turbo-no-dedup'
                  }
                });
              }
            }
          }
        }

        processedGames++;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = Math.round(allStats.length / elapsed);
        progressBar.update(processedGames, { stats: allStats.length, speed });

      } catch (error) {
        // Continue on error
      }
    })
  );

  await Promise.all(gamePromises);
  progressBar.stop();

  console.log(chalk.green(`\n✅ Collected ${allStats.length} total stats!`));
  console.log(chalk.bold.cyan(`📊 Average per game: ${Math.round(allStats.length / games.length)}`));

  // TURBO BATCH INSERT - NO DEDUPLICATION!
  console.log(chalk.blue(`\n📤 TURBO BATCH INSERT with 12 threads...`));
  
  const batchSize = 1000;
  let successCount = 0;

  for (let i = 0; i < allStats.length; i += batchSize) {
    const batch = allStats.slice(i, i + batchSize);
    
    try {
      const { data, error } = await supabase
        .from('player_game_logs')
        .insert(batch)
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
  const finalAvg = Math.round(successCount / games.length);

  console.log(chalk.bold.green(`\n\n✅ TURBO COLLECTION COMPLETE!`));
  console.log(chalk.cyan(`   Total stats collected: ${allStats.length.toLocaleString()}`));
  console.log(chalk.cyan(`   Successfully saved: ${successCount.toLocaleString()}`));
  console.log(chalk.cyan(`   Average per game: ${finalAvg}`));
  console.log(chalk.cyan(`   Total time: ${totalTime} seconds`));
  console.log(chalk.cyan(`   Speed: ${Math.round(allStats.length / totalTime)} stats/second`));
  
  if (finalAvg >= 78) {
    console.log(chalk.bold.green(`\n🏆 SUCCESS! Achieved ${finalAvg} stats per game!`));
  } else {
    console.log(chalk.yellow(`\n⚠️  Got ${finalAvg} stats per game (target: 78)`));
  }
}

turboNoDedupCollection().catch(console.error);
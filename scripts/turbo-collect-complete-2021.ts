#!/usr/bin/env tsx
/**
 * 🚀 DIRECT TURBO COLLECTION FOR 2021 NFL STATS
 * With COMPLETE stat mappings to get 78 stats per game
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

const concurrencyLimit = pLimit(12); // Use all 12 threads

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

async function collect2021Stats() {
  console.log(chalk.bold.cyan('🚀 TURBO 2021 NFL STATS COLLECTION\n'));
  console.log(chalk.yellow('Target: 78 stats per game with COMPLETE mappings\n'));

  // Get all 2021 NFL games
  const { data: games, error } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-03-01')
    .order('start_time');

  if (error || !games) {
    console.error('Error fetching games:', error);
    return;
  }

  console.log(chalk.green(`Found ${games.length} NFL games from 2021 season\n`));

  // Load players and teams for quick lookup
  console.log(chalk.yellow('Loading player and team data...'));
  
  // Load ALL NFL players
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
    
    if (batch.length < limit) break;
  }
  
  const players = allPlayers;

  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id, name');

  const playerMap = new Map(players?.map(p => [p.external_id, p]) || []);
  const teamMap = new Map(teams?.map(t => [t.external_id, t]) || []);
  
  console.log(chalk.green(`✅ Loaded ${playerMap.size} players, ${teamMap.size} teams\n`));

  // Progress tracking
  const progressBar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} stats | Speed: {speed}/sec | ETA: {eta_formatted}',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  }, cliProgress.Presets.shades_classic);

  const expectedStats = games.length * 78; // Target 78 per game
  progressBar.start(expectedStats, 0, { speed: 0 });

  let totalStats = 0;
  const startTime = Date.now();
  const statsBatch: any[] = [];

  // Process games in parallel
  const gamePromises = games.map(game => 
    concurrencyLimit(async () => {
      try {
        const espnGameId = game.external_id?.split('_').pop();
        if (!espnGameId) return;

        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
        const response = await axios.get(url, { timeout: 10000 });
        const gameData = response.data;

        if (!gameData.boxscore?.players) return;

        let gameStats = 0;

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

              // Map ALL stats using complete mappings
              labels.forEach((label: string, index: number) => {
                const value = statValues[index];
                if (value === undefined || value === null || value === '') return;

                const mappedKey = mapping[label];
                if (!mappedKey) return;

                // Handle compound stats like "18/32"
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

              statsBatch.push({
                player_id: player.id,
                game_id: game.id,
                team_id: dbTeam.id,
                opponent_id: opponentTeamId,
                game_date: new Date(game.start_time).toISOString().split('T')[0],
                is_home: isHome,
                stats: stats,
                fantasy_points: 0, // Calculate later
                metadata: {
                  sport: 'NFL',
                  stat_group: groupName,
                  collection_source: 'turbo-complete-2021',
                  labels_count: labels.length,
                  stats_count: Object.keys(stats).length
                }
              });

              gameStats++;
              totalStats++;
            }
          }
        }

        const elapsed = (Date.now() - startTime) / 1000;
        const speed = Math.round(totalStats / elapsed);
        progressBar.update(totalStats, { speed });

      } catch (error: any) {
        console.error(chalk.red(`\nError processing game ${game.external_id}: ${error.message}`));
      }
    })
  );

  await Promise.all(gamePromises);
  progressBar.stop();

  // Insert all stats
  if (statsBatch.length > 0) {
    console.log(chalk.blue(`\n📤 Inserting ${statsBatch.length} stats to database...`));
    
    const batchSize = 1000;
    for (let i = 0; i < statsBatch.length; i += batchSize) {
      const batch = statsBatch.slice(i, i + batchSize);
      
      // First try to update existing records
      for (const record of batch) {
        const { error: updateError } = await supabase
          .from('player_game_logs')
          .update({
            stats: { ...record.stats },
            metadata: { ...record.metadata }
          })
          .eq('player_id', record.player_id)
          .eq('game_id', record.game_id);
          
        if (updateError) {
          // If update fails, try insert
          const { error: insertError } = await supabase
            .from('player_game_logs')
            .insert(record);
            
          if (insertError && !insertError.message.includes('duplicate key')) {
            console.error(chalk.red(`Error: ${insertError.message}`));
          }
        }
      }
      
      process.stdout.write('.');
    }
  }

  const avgPerGame = Math.round(totalStats / games.length);
  
  console.log(chalk.bold.green(`\n\n✅ COLLECTION COMPLETE!`));
  console.log(chalk.cyan(`   Total stats collected: ${totalStats.toLocaleString()}`));
  console.log(chalk.cyan(`   Average per game: ${avgPerGame}`));
  console.log(chalk.cyan(`   Target per game: 78`));
  
  if (avgPerGame >= 78) {
    console.log(chalk.bold.green(`\n🎉 SUCCESS! Achieved ${avgPerGame} stats per game!`));
  } else {
    console.log(chalk.yellow(`\n⚠️  Still ${78 - avgPerGame} stats per game short of target`));
  }
}

collect2021Stats().catch(console.error);
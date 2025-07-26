#!/usr/bin/env tsx
/**
 * 🏈 COLLECT NFL STATS ONLY
 * 
 * Focused collection of just NFL 2021-2022 stats
 * - We already have the games
 * - Just need to collect the stats
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

async function collectNFLStats() {
  console.log(chalk.bold.cyan('🏈 NFL STATS COLLECTION\n'));
  
  // Initialize cache
  const cache = new InMemoryCache();
  await cache.initialize();
  
  // Get all NFL games from 2021-2022 directly from database
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
  
  // Group by year for reporting
  const games2021 = allGames.filter(g => new Date(g.start_time).getFullYear() === 2021);
  const games2022 = allGames.filter(g => new Date(g.start_time).getFullYear() === 2022);
  
  console.log(chalk.yellow(`Found ${allGames.length} NFL games to process`));
  console.log(chalk.gray(`  2021: ${games2021.length} games`));
  console.log(chalk.gray(`  2022: ${games2022.length} games\n`));
  
  // Create stats buffer
  const statsBuffer = new StatsBuffer(50000);
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} games | Stats: {stats}',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  }, cliProgress.Presets.shades_classic);
  
  progressBar.start(allGames.length, 0, { stats: 0 });
  
  let totalStats = 0;
  let processedGames = 0;
  
  // Process games with concurrency
  const gamePromises = allGames.map(game => 
    limit(async () => {
      try {
        const espnGameId = game.external_id?.split('_').pop();
        if (!espnGameId) return;
        
        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
        const response = await axios.get(url, { timeout: 10000 });
        const gameData = response.data;
        
        let gameStats = 0;
        
        if (gameData.boxscore?.players) {
          for (const team of gameData.boxscore.players) {
            const teamId = team.team.id;
            const dbTeam = cache.getTeamByExternalId(`espn_nfl_${teamId}`);
            
            if (!dbTeam) continue;
            
            // Check which team this is by comparing IDs
            const isHomeTeam = dbTeam.id === game.home_team_id;
            const opponentTeamId = isHomeTeam ? game.away_team_id : game.home_team_id;
            
            for (const statGroup of team.statistics || []) {
              for (const athlete of statGroup.athletes || []) {
                const player = cache.getPlayerByExternalId(`espn_nfl_${athlete.athlete.id}`);
                
                if (!player) {
                  // Log first few missing players for debugging
                  if (processedGames < 2 && gameStats < 5) {
                    console.log(chalk.yellow(`  Missing player: ${athlete.athlete.displayName} (espn_nfl_${athlete.athlete.id})`));
                  }
                  continue;
                } else {
                  // Log found players for debugging
                  if (processedGames < 2 && gameStats < 3) {
                    console.log(chalk.green(`  Found player: ${athlete.athlete.displayName} (${player.name})`));
                  }
                }
                
                // Transform stats based on stat group
                const stats: any = {};
                const statLabels = statGroup.labels || statGroup.names || [];
                const statValues = athlete.stats || [];
                
                // Map ESPN stats to our format
                statLabels.forEach((label: string, index: number) => {
                  const value = statValues[index];
                  if (value === undefined) return;
                  
                  // Passing stats
                  if (label === 'C/ATT') {
                    const [comp, att] = value.split('/').map(Number);
                    stats.passing_completions = comp || 0;
                    stats.passing_attempts = att || 0;
                  } else if (label === 'YDS' && statGroup.name === 'passing') {
                    stats.passing_yards = value;
                  } else if (label === 'TD' && statGroup.name === 'passing') {
                    stats.passing_touchdowns = value;
                  } else if (label === 'INT') {
                    stats.interceptions = value;
                  }
                  // Rushing stats
                  else if (label === 'CAR') {
                    stats.rushing_attempts = value;
                  } else if (label === 'YDS' && statGroup.name === 'rushing') {
                    stats.rushing_yards = value;
                  } else if (label === 'TD' && statGroup.name === 'rushing') {
                    stats.rushing_touchdowns = value;
                  }
                  // Receiving stats
                  else if (label === 'REC') {
                    stats.receptions = value;
                  } else if (label === 'YDS' && statGroup.name === 'receiving') {
                    stats.receiving_yards = value;
                  } else if (label === 'TD' && statGroup.name === 'receiving') {
                    stats.receiving_touchdowns = value;
                  } else if (label === 'TAR') {
                    stats.targets = value;
                  }
                });
                
                if (Object.keys(stats).length === 0) {
                  // Log first few empty stats for debugging
                  if (processedGames < 2 && gameStats < 5) {
                    console.log(chalk.yellow(`  Empty stats for: ${athlete.athlete.displayName} (${statGroup.name})`));
                  }
                  continue;
                }
                
                // Calculate fantasy points
                const fantasyPoints = 
                  (stats.passing_yards || 0) / 25 + 
                  (stats.passing_touchdowns || 0) * 4 - 
                  (stats.interceptions || 0) * 2 +
                  (stats.rushing_yards || 0) / 10 + 
                  (stats.rushing_touchdowns || 0) * 6 + 
                  (stats.receiving_yards || 0) / 10 + 
                  (stats.receiving_touchdowns || 0) * 6 + 
                  (stats.receptions || 0) * 0.5;
                
                const stat: BufferedStat = {
                  player_id: player.id,
                  game_id: game.id,
                  team_id: dbTeam.id,
                  opponent_id: opponentTeamId,
                  game_date: new Date(game.start_time).toISOString().split('T')[0],
                  is_home: isHomeTeam,
                  sport: 'NFL',
                  stats: stats,
                  fantasy_points: Math.max(0, fantasyPoints),
                  metadata: {
                    collection_source: 'nfl-stats-collector'
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
        progressBar.update(processedGames, { stats: totalStats });
        
      } catch (error: any) {
        console.error(chalk.red(`\nError processing game: ${error.message}`));
      }
    })
  );
  
  await Promise.all(gamePromises);
  progressBar.stop();
  
  // Insert stats to database
  const stats = statsBuffer.getAll();
  console.log(chalk.blue(`\n📤 Inserting ${stats.length} stats to database...`));
  
  const batchSize = 5000;
  for (let i = 0; i < stats.length; i += batchSize) {
    const batch = stats.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('player_game_logs')
      .upsert(batch, { 
        onConflict: 'player_id,game_id',
        ignoreDuplicates: true 
      });
      
    if (error) {
      console.error(chalk.red('Error inserting batch:', error));
    } else {
      console.log(chalk.green(`  ✅ Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(stats.length/batchSize)}`));
    }
  }
  
  console.log(chalk.bold.green(`\n✅ NFL STATS COLLECTION COMPLETE!`));
  console.log(chalk.white(`Games processed: ${processedGames}`));
  console.log(chalk.white(`Stats collected: ${totalStats}`));
  console.log(chalk.white(`Average per game: ${Math.round(totalStats / processedGames)}`));
}

if (require.main === module) {
  collectNFLStats().catch(console.error);
}
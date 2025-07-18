import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const HTTP_CONCURRENCY = 100;
const DB_BATCH_SIZE = 1000;
const STATS_BATCH_SIZE = 5000;

const httpLimit = pLimit(HTTP_CONCURRENCY);

async function collectMiLBStatsProperly() {
  console.log(chalk.cyan('⚡ MiLB FIXED Stats Collector\n'));
  console.log(chalk.yellow('📊 Now handling empty stats objects properly!\n'));
  
  const startTime = Date.now();
  
  try {
    // Load players
    const { data: players } = await supabase
      .from('players')
      .select('id, external_id')
      .eq('sport', 'MILB');
      
    const playerMap = new Map<string, number>();
    players?.forEach(p => {
      playerMap.set(p.external_id, p.id);
    });
    
    console.log(chalk.green(`✅ Loaded ${playerMap.size} players\n`));
    
    // Get ALL games
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'MILB');
      
    console.log(chalk.blue(`📊 Processing ${totalGames} games...\n`));
    
    let offset = 0;
    let totalStats = 0;
    let gamesWithStats = 0;
    let emptyStatsSkipped = 0;
    const statsBuffer: any[] = [];
    
    while (offset < totalGames!) {
      const { data: games } = await supabase
        .from('games')
        .select('*')
        .eq('sport', 'MILB')
        .order('id')
        .range(offset, offset + DB_BATCH_SIZE - 1);
        
      if (!games || games.length === 0) break;
      
      const gamePromises = games.map(game =>
        httpLimit(async () => {
          try {
            const gameId = parseInt(game.external_id.replace('mlb_milb_', ''));
            
            const response = await axios.get(`https://statsapi.mlb.com/api/v1/game/${gameId}/boxscore`);
            const boxscore = response.data;
            
            if (!boxscore.teams) return;
            
            let gameHasValidStats = false;
            
            for (const side of ['away', 'home'] as const) {
              const teamData = boxscore.teams[side];
              if (!teamData?.players) continue;
              
              const teamId = teamData.team.id;
              
              for (const playerId in teamData.players) {
                const player = teamData.players[playerId];
                
                if (!player || !player.stats) continue;
                
                // Extract numeric ID (handle "ID123456" format)
                const numericPlayerId = playerId.replace(/^\D+/, '');
                const playerExtId = `mlb_milb_${numericPlayerId}`;
                const dbPlayerId = playerMap.get(playerExtId);
                
                if (!dbPlayerId) continue;
                
                // Check if batting stats exist AND have actual data
                if (player.stats.batting) {
                  const batting = player.stats.batting;
                  
                  // Skip if all values are empty/zero
                  const hasValidData = Object.keys(batting).some(key => 
                    batting[key] !== null && 
                    batting[key] !== undefined && 
                    batting[key] !== '' &&
                    batting[key] !== 0
                  );
                  
                  if (hasValidData) {
                    statsBuffer.push({
                      player_id: dbPlayerId,
                      game_id: game.id,
                      team_id: side === 'home' ? game.home_team_id : game.away_team_id,
                      opponent_id: side === 'home' ? game.away_team_id : game.home_team_id,
                      game_date: game.start_time,
                      is_home: side === 'home',
                      stats: {
                        ...batting,
                        statType: 'batting'
                      }
                    });
                    
                    totalStats++;
                    gameHasValidStats = true;
                  } else {
                    emptyStatsSkipped++;
                  }
                }
                
                // Check if pitching stats exist AND have actual data
                if (player.stats.pitching) {
                  const pitching = player.stats.pitching;
                  
                  // Must have at least inningsPitched or outs
                  const hasValidData = pitching.inningsPitched || pitching.outs || 
                    Object.keys(pitching).some(key => 
                      pitching[key] !== null && 
                      pitching[key] !== undefined && 
                      pitching[key] !== '' &&
                      pitching[key] !== 0
                    );
                  
                  if (hasValidData) {
                    statsBuffer.push({
                      player_id: dbPlayerId,
                      game_id: game.id,
                      team_id: side === 'home' ? game.home_team_id : game.away_team_id,
                      opponent_id: side === 'home' ? game.away_team_id : game.home_team_id,
                      game_date: game.start_time,
                      is_home: side === 'home',
                      stats: {
                        ...pitching,
                        statType: 'pitching'
                      }
                    });
                    
                    totalStats++;
                    gameHasValidStats = true;
                  } else {
                    emptyStatsSkipped++;
                  }
                }
                
                // Check fielding stats
                if (player.stats.fielding) {
                  for (const position in player.stats.fielding) {
                    const fielding = player.stats.fielding[position];
                    
                    if (fielding && Object.keys(fielding).length > 0) {
                      const hasValidData = Object.keys(fielding).some(key => 
                        fielding[key] !== null && 
                        fielding[key] !== undefined && 
                        fielding[key] !== '' &&
                        fielding[key] !== 0
                      );
                      
                      if (hasValidData) {
                        statsBuffer.push({
                          player_id: dbPlayerId,
                          game_id: game.id,
                          team_id: side === 'home' ? game.home_team_id : game.away_team_id,
                          opponent_id: side === 'home' ? game.away_team_id : game.home_team_id,
                          game_date: game.start_time,
                          is_home: side === 'home',
                          stats: {
                            ...fielding,
                            position,
                            statType: 'fielding'
                          }
                        });
                        
                        totalStats++;
                        gameHasValidStats = true;
                      }
                    }
                  }
                }
                
                if (statsBuffer.length >= STATS_BATCH_SIZE) {
                  await flushStats(statsBuffer);
                }
              }
            }
            
            if (gameHasValidStats) {
              gamesWithStats++;
            }
            
          } catch (error) {
            // Skip errors
          }
        })
      );
      
      await Promise.all(gamePromises);
      
      const progress = Math.round((offset + games.length) / totalGames! * 100);
      const elapsed = (Date.now() - startTime) / 1000;
      console.log(chalk.green(
        `Progress: ${progress}% | ${gamesWithStats} games with valid stats | ` +
        `${totalStats} stats | ${emptyStatsSkipped} empty stats skipped`
      ));
      
      offset += DB_BATCH_SIZE;
    }
    
    // Final flush
    if (statsBuffer.length > 0) {
      await flushStats(statsBuffer);
    }
    
    const totalTime = (Date.now() - startTime) / 1000;
    console.log(chalk.cyan('\n\n🏆 FIXED COLLECTION COMPLETE!'));
    console.log(chalk.green(`✅ Games with valid stats: ${gamesWithStats}/${totalGames} (${Math.round(gamesWithStats/totalGames!*100)}%)`));
    console.log(chalk.green(`✅ Valid stats collected: ${totalStats}`));
    console.log(chalk.yellow(`⚠️  Empty stats skipped: ${emptyStatsSkipped}`));
    console.log(chalk.yellow(`⏱️  Time: ${(totalTime/60).toFixed(1)} minutes`));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

async function flushStats(buffer: any[]) {
  const batch = [...buffer];
  buffer.length = 0;
  
  console.log(chalk.blue(`💾 Flushing ${batch.length} stats...`));
  
  // Remove duplicates
  const uniqueStats = new Map();
  batch.forEach(stat => {
    const key = `${stat.player_id}-${stat.game_id}-${stat.stats.statType}`;
    uniqueStats.set(key, stat);
  });
  
  const dedupedBatch = Array.from(uniqueStats.values());
  
  for (let i = 0; i < dedupedBatch.length; i += 1000) {
    const chunk = dedupedBatch.slice(i, i + 1000);
    
    const { error } = await supabase
      .from('player_game_logs')
      .upsert(chunk, {
        onConflict: 'player_id,game_id',
        ignoreDuplicates: true
      });
      
    if (error) {
      console.error(chalk.red('Insert error:', error.message));
    }
  }
}

collectMiLBStatsProperly().catch(console.error);
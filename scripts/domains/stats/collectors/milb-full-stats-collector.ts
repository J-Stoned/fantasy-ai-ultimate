import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import { MiLBAdapter } from './adapters/milb-adapter';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🚀 ULTRA TURBO SETTINGS
const HTTP_CONCURRENCY = 100;
const DB_BATCH_SIZE = 1000;
const STATS_BATCH_SIZE = 5000;

const httpLimit = pLimit(HTTP_CONCURRENCY);

// Enhanced adapter that collects ALL stats
class EnhancedMiLBAdapter extends MiLBAdapter {
  async getGameStats(gameId: number): Promise<any[]> {
    try {
      const response = await fetch(`https://statsapi.mlb.com/api/v1/game/${gameId}/boxscore`);
      const boxscore = await response.json();
      const stats: any[] = [];

      // Process both teams
      for (const side of ['away', 'home'] as const) {
        const teamData = boxscore.teams[side];
        const teamId = teamData.team.id;
        
        // Process all players
        for (const playerId in teamData.players || {}) {
          const player = teamData.players[playerId];
          
          if (!player || !player.stats) {
            continue;
          }
          
          // Extract numeric ID
          const numericPlayerId = playerId.replace(/^\D+/, '');
          
          // Collect ALL batting stats
          if (player.stats.batting && Object.keys(player.stats.batting).length > 0) {
            stats.push({
              playerId: parseInt(numericPlayerId),
              gameId: gameId,
              teamId: teamId,
              stats: {
                ...player.stats.batting, // Get ALL batting fields
                statType: 'batting'
              },
              isHome: side === 'home',
              isPitcher: false
            });
          }
          
          // Collect ALL pitching stats
          if (player.stats.pitching && Object.keys(player.stats.pitching).length > 0) {
            stats.push({
              playerId: parseInt(numericPlayerId),
              gameId: gameId,
              teamId: teamId,
              stats: {
                ...player.stats.pitching, // Get ALL pitching fields
                statType: 'pitching'
              },
              isHome: side === 'home',
              isPitcher: true
            });
          }
          
          // Also check for fielding stats
          if (player.stats.fielding && Object.keys(player.stats.fielding).length > 0) {
            stats.push({
              playerId: parseInt(numericPlayerId),
              gameId: gameId,
              teamId: teamId,
              stats: {
                ...player.stats.fielding,
                statType: 'fielding'
              },
              isHome: side === 'home',
              isFielding: true
            });
          }
        }
      }
      
      return stats;
    } catch (error) {
      console.error(`Error fetching game stats for ${gameId}:`, error);
      return [];
    }
  }
}

async function collectFullStats() {
  console.log(chalk.cyan('⚡ MiLB FULL Stats Collector - ALL FIELDS!\n'));
  console.log(chalk.yellow('📊 Collecting 84+ stat fields instead of 33\n'));
  
  const startTime = Date.now();
  
  try {
    // Load players
    console.log(chalk.blue('Loading MiLB players...'));
    const { data: players } = await supabase
      .from('players')
      .select('id, external_id')
      .eq('sport', 'MILB');
      
    const playerMap = new Map<string, number>();
    players?.forEach(p => {
      playerMap.set(p.external_id, p.id);
    });
    
    console.log(chalk.green(`✅ Loaded ${playerMap.size} players\n`));
    
    // Get games without stats first
    console.log(chalk.blue('Finding games without stats...'));
    
    // Get all game IDs with existing stats
    const { data: gamesWithStats } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('player_id', Array.from(playerMap.values()));
      
    const existingGameIds = new Set(gamesWithStats?.map(s => s.game_id) || []);
    
    // Get all MiLB games
    const { data: allGames } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'MILB')
      .order('id');
      
    // Filter to games without stats
    const gamesWithoutStats = allGames?.filter(g => !existingGameIds.has(g.id)) || [];
    
    console.log(chalk.yellow(`Found ${gamesWithoutStats.length} games without stats\n`));
    
    let totalStats = 0;
    const statsBuffer: any[] = [];
    let gamesProcessed = 0;
    
    // Process games in chunks
    for (let i = 0; i < gamesWithoutStats.length; i += 50) {
      const chunk = gamesWithoutStats.slice(i, i + 50);
      
      const promises = chunk.map(game =>
        httpLimit(async () => {
          try {
            const gameId = parseInt(game.external_id.replace('mlb_milb_', ''));
            const adapter = new EnhancedMiLBAdapter(
              game.league === 'Triple-A' ? 'MILB_AAA' :
              game.league === 'Double-A' ? 'MILB_AA' :
              game.league === 'High-A' ? 'MILB_A+' :
              game.league === 'Single-A' ? 'MILB_A' :
              'MILB_ROOKIE'
            );
            
            const gameStats = await adapter.getGameStats(gameId);
            
            for (const stat of gameStats) {
              const playerId = playerMap.get(`mlb_milb_${stat.playerId}`);
              
              if (playerId) {
                statsBuffer.push({
                  player_id: playerId,
                  game_id: game.id,
                  team_id: stat.isHome ? game.home_team_id : game.away_team_id,
                  opponent_id: stat.isHome ? game.away_team_id : game.home_team_id,
                  game_date: game.start_time,
                  is_home: stat.isHome,
                  stats: stat.stats
                });
                
                totalStats++;
                
                if (statsBuffer.length >= STATS_BATCH_SIZE) {
                  await flushStats(statsBuffer);
                }
              }
            }
            
            gamesProcessed++;
          } catch (error) {
            // Skip errors
          }
        })
      );
      
      await Promise.all(promises);
      
      const progress = Math.round(gamesProcessed / gamesWithoutStats.length * 100);
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = Math.round(totalStats / elapsed);
      
      console.log(chalk.green(
        `Progress: ${progress}% | ${gamesProcessed}/${gamesWithoutStats.length} games | ` +
        `${totalStats} stats | ${rate} stats/sec`
      ));
    }
    
    // Final flush
    if (statsBuffer.length > 0) {
      await flushStats(statsBuffer);
    }
    
    const totalTime = (Date.now() - startTime) / 1000;
    console.log(chalk.cyan('\n\n🏆 FULL STATS COLLECTION COMPLETE!'));
    console.log(chalk.green(`✅ Games processed: ${gamesProcessed}`));
    console.log(chalk.green(`✅ New stats collected: ${totalStats}`));
    console.log(chalk.yellow(`⏱️  Time: ${(totalTime/60).toFixed(1)} minutes`));
    console.log(chalk.cyan(`📊 Now collecting ALL 84+ fields per game!`));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

async function flushStats(buffer: any[]) {
  const batch = [...buffer];
  buffer.length = 0;
  
  console.log(chalk.blue(`💾 Flushing ${batch.length} stats...`));
  
  for (let i = 0; i < batch.length; i += 1000) {
    const chunk = batch.slice(i, i + 1000);
    
    const { error } = await supabase
      .from('player_game_logs')
      .insert(chunk);
      
    if (error) {
      console.error(chalk.red('Insert error:', error.message));
    }
  }
}

collectFullStats().catch(console.error);
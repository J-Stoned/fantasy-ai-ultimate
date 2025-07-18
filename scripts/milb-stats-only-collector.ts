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

// 🚀 TURBO SETTINGS
const HTTP_CONCURRENCY = 100;
const DB_BATCH_SIZE = 1000;
const STATS_BATCH_SIZE = 5000;

const httpLimit = pLimit(HTTP_CONCURRENCY);

async function collectStatsOnly() {
  console.log(chalk.cyan('⚡ MiLB Stats-Only Collector\n'));
  
  const startTime = Date.now();
  
  try {
    // Load all players
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
    
    // Get all games
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'MILB');
      
    console.log(chalk.blue(`📊 Processing ${totalGames} games...\n`));
    
    let offset = 0;
    let totalStats = 0;
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
            const adapter = new MiLBAdapter(
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
          } catch (error) {
            // Skip errors
          }
        })
      );
      
      await Promise.all(gamePromises);
      
      const progress = Math.round((offset + games.length) / totalGames! * 100);
      const elapsed = (Date.now() - startTime) / 1000;
      console.log(chalk.green(
        `Progress: ${progress}% | ${totalStats} stats | ${Math.round(totalStats/elapsed)} stats/sec`
      ));
      
      offset += DB_BATCH_SIZE;
    }
    
    // Final flush
    if (statsBuffer.length > 0) {
      await flushStats(statsBuffer);
    }
    
    const totalTime = (Date.now() - startTime) / 1000;
    console.log(chalk.cyan('\n\n🏆 STATS COLLECTION COMPLETE!'));
    console.log(chalk.green(`✅ Total stats: ${totalStats}`));
    console.log(chalk.yellow(`⏱️  Time: ${(totalTime/60).toFixed(1)} minutes`));
    
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
      console.error(chalk.red('Error:', error.message));
    }
  }
}

collectStatsOnly().catch(console.error);
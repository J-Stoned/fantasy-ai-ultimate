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

// 🚀 TURBO SETTINGS - RYZEN 5 7600X + 32GB RAM
const HTTP_CONCURRENCY = 100; // Max out HTTP threads
const DB_BATCH_SIZE = 2000; // Larger batches for efficiency
const PLAYER_CACHE_SIZE = 50000; // Cache more in RAM
const STATS_BUFFER_SIZE = 5000; // Bigger buffer

const httpLimit = pLimit(HTTP_CONCURRENCY);

// Caches
const playerCache = new Map<string, any>();
const teamCache = new Map<number, any>();
const gameCache = new Map<number, any>();
const processedGames = new Set<number>();

async function turboCollectMiLBStats() {
  console.log(chalk.cyan('⚡ MiLB TURBO STATS COLLECTOR - MAXIMUM OVERDRIVE!\n'));
  console.log(chalk.yellow(`🚀 Settings: ${HTTP_CONCURRENCY} HTTP threads | ${DB_BATCH_SIZE} DB batch`));
  console.log(chalk.yellow(`💾 RAM Usage: Up to 32GB available\n`));
  
  const startTime = Date.now();
  
  try {
    // Load all games into memory
    console.log(chalk.blue('📥 Loading all MiLB games into RAM...'));
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'MILB')
      .order('start_time', { ascending: false });
      
    if (!games || games.length === 0) {
      console.error(chalk.red('No MiLB games found!'));
      return;
    }
    
    games.forEach(game => {
      gameCache.set(game.id, game);
    });
    
    console.log(chalk.green(`✅ Loaded ${games.length} games into memory\n`));
    
    // Load all teams
    console.log(chalk.blue('📥 Loading all MiLB teams...'));
    const { data: teams } = await supabase
      .from('teams')
      .select('*')
      .eq('sport', 'MILB');
      
    teams?.forEach(team => {
      teamCache.set(team.id, team);
    });
    
    console.log(chalk.green(`✅ Loaded ${teams?.length || 0} teams\n`));
    
    // Process games in parallel batches
    let totalStats = 0;
    let totalPlayers = 0;
    const statsBuffer: any[] = [];
    const playersToInsert: any[] = [];
    
    console.log(chalk.magenta('🏃 Processing games at MAXIMUM SPEED...\n'));
    
    // Split games into chunks for parallel processing
    const gameChunks = [];
    for (let i = 0; i < games.length; i += 50) {
      gameChunks.push(games.slice(i, i + 50));
    }
    
    let chunksProcessed = 0;
    
    for (const chunk of gameChunks) {
      const chunkPromises = chunk.map(game => 
        httpLimit(async () => {
          try {
            const gameId = parseInt(game.external_id.replace('mlb_milb_', ''));
            
            if (processedGames.has(gameId)) {
              return;
            }
            
            // Determine adapter based on league
            const level = game.league;
            const adapter = new MiLBAdapter(
              level === 'Triple-A' ? 'MILB_AAA' :
              level === 'Double-A' ? 'MILB_AA' :
              level === 'High-A' ? 'MILB_A+' :
              level === 'Single-A' ? 'MILB_A' :
              'MILB_ROOKIE'
            );
            
            const gameStats = await adapter.getGameStats(gameId);
            
            for (const stat of gameStats) {
              // Check if we need player info
              const playerExtId = `mlb_milb_${stat.playerId}`;
              
              if (!playerCache.has(playerExtId)) {
                // Get player details
                try {
                  const players = await adapter.getPlayers(stat.teamId);
                  const player = players.find(p => p.id === stat.playerId);
                  
                  if (player) {
                    const teamId = teamCache.get(game.home_team_id)?.external_id === `mlb_milb_${stat.teamId}` 
                      ? game.home_team_id 
                      : game.away_team_id;
                    
                    const playerData = {
                      external_id: player.externalId,
                      name: player.name,
                      firstname: player.firstName,
                      lastname: player.lastName,
                      team_id: teamId,
                      position: [player.position],
                      jersey_number: player.jerseyNumber,
                      sport: 'MILB',
                      metadata: player.metadata
                    };
                    
                    playerCache.set(playerExtId, playerData);
                    playersToInsert.push(playerData);
                    totalPlayers++;
                  }
                } catch (error) {
                  // Skip player fetch errors
                }
              }
              
              // Add stat to buffer
              const player = playerCache.get(playerExtId);
              if (player) {
                statsBuffer.push({
                  player_id: null, // Will be set after player insertion
                  external_player_id: playerExtId,
                  game_id: game.id,
                  team_id: player.team_id,
                  opponent_id: stat.isHome ? game.away_team_id : game.home_team_id,
                  game_date: game.start_time,
                  is_home: stat.isHome,
                  stats: stat.stats,
                  sport: 'MILB'
                });
                
                totalStats++;
              }
            }
            
            processedGames.add(gameId);
            
            // Flush buffers if getting large
            if (playersToInsert.length >= DB_BATCH_SIZE) {
              await flushPlayers(playersToInsert);
            }
            
            if (statsBuffer.length >= STATS_BUFFER_SIZE) {
              await flushStats(statsBuffer);
            }
            
          } catch (error) {
            // Silently skip errors
          }
        })
      );
      
      await Promise.all(chunkPromises);
      
      chunksProcessed++;
      const progress = Math.round((chunksProcessed / gameChunks.length) * 100);
      console.log(chalk.blue(
        `Progress: ${progress}% | ${processedGames.size} games | ${totalPlayers} players | ${totalStats} stats | ` +
        `${Math.round((Date.now() - startTime) / 1000)}s`
      ));
    }
    
    // Final flush
    if (playersToInsert.length > 0) {
      await flushPlayers(playersToInsert);
    }
    
    if (statsBuffer.length > 0) {
      await flushStats(statsBuffer);
    }
    
    // Summary
    const totalTime = (Date.now() - startTime) / 1000;
    const statsPerSecond = Math.round(totalStats / totalTime);
    
    console.log(chalk.cyan('\n\n🏆 TURBO COLLECTION COMPLETE!'));
    console.log(chalk.green(`✅ Games processed: ${processedGames.size}`));
    console.log(chalk.green(`✅ Players collected: ${totalPlayers}`));
    console.log(chalk.green(`✅ Stats collected: ${totalStats}`));
    console.log(chalk.yellow(`⚡ Performance: ${statsPerSecond} stats/second`));
    console.log(chalk.yellow(`⏱️  Total time: ${totalTime.toFixed(1)} seconds`));
    
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
  }
}

async function flushPlayers(players: any[]) {
  const batch = [...players];
  players.length = 0;
  
  // Upsert players
  const { data: inserted, error } = await supabase
    .from('players')
    .upsert(batch, {
      onConflict: 'external_id',
      ignoreDuplicates: false
    })
    .select('id, external_id');
    
  if (!error && inserted) {
    // Update cache with internal IDs
    inserted.forEach(player => {
      const cached = playerCache.get(player.external_id);
      if (cached) {
        cached.id = player.id;
      }
    });
  }
}

async function flushStats(stats: any[]) {
  // Map external player IDs to internal IDs
  const mappedStats = stats.map(stat => {
    const player = playerCache.get(stat.external_player_id);
    return {
      ...stat,
      player_id: player?.id,
      external_player_id: undefined
    };
  }).filter(stat => stat.player_id);
  
  stats.length = 0;
  
  if (mappedStats.length > 0) {
    const { error } = await supabase
      .from('player_game_logs')
      .insert(mappedStats);
      
    if (error) {
      console.error(chalk.red('Error inserting stats:', error.message));
    }
  }
}

// Run it!
turboCollectMiLBStats()
  .then(() => {
    console.log(chalk.cyan('\n✅ Turbo collection complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
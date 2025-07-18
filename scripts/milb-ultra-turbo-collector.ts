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

// 🚀 ULTRA TURBO SETTINGS - MAX OUT RYZEN 5 7600X + 32GB RAM
const HTTP_CONCURRENCY = 100; // 100 parallel HTTP requests
const DB_BATCH_SIZE = 1000; // DB query limit
const PLAYER_BATCH_SIZE = 2000; // Player insert batch
const STATS_BATCH_SIZE = 5000; // Stats buffer size
const GAMES_PER_CHUNK = 100; // Process 100 games at a time

const httpLimit = pLimit(HTTP_CONCURRENCY);

// Global caches to maximize RAM usage
const teamCache = new Map<number, any>();
const playerCache = new Map<string, any>(); // external_id -> player data
const playerIdMap = new Map<string, number>(); // external_id -> internal_id

async function ultraTurboCollect() {
  console.log(chalk.cyan('⚡⚡⚡ ULTRA TURBO MiLB COLLECTOR ⚡⚡⚡\n'));
  console.log(chalk.yellow(`🚀 CPU: Ryzen 5 7600X | RAM: 32GB | HTTP: ${HTTP_CONCURRENCY} threads`));
  console.log(chalk.yellow(`📊 DB Batch: ${DB_BATCH_SIZE} | Stats Buffer: ${STATS_BATCH_SIZE}\n`));
  
  const startTime = Date.now();
  
  try {
    // 1️⃣ LOAD ALL TEAMS INTO RAM
    console.log(chalk.blue('1️⃣ Loading all MiLB teams into RAM...'));
    const { data: teams } = await supabase
      .from('teams')
      .select('*')
      .eq('sport', 'MILB');
      
    teams?.forEach(team => {
      teamCache.set(team.id, team);
    });
    console.log(chalk.green(`✅ Loaded ${teamCache.size} teams\n`));
    
    // 2️⃣ GET TOTAL GAME COUNT
    const { count: totalGameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'MILB');
      
    console.log(chalk.blue(`2️⃣ Found ${totalGameCount} MiLB games to process\n`));
    
    // 3️⃣ PROCESS GAMES IN CHUNKS WITH PAGINATION
    let offset = 0;
    let totalStats = 0;
    let totalPlayers = 0;
    let gamesProcessed = 0;
    
    const playersBuffer: any[] = [];
    const statsBuffer: any[] = [];
    
    while (offset < totalGameCount!) {
      // Load batch of games
      const { data: gameBatch } = await supabase
        .from('games')
        .select('*')
        .eq('sport', 'MILB')
        .order('id')
        .range(offset, Math.min(offset + DB_BATCH_SIZE - 1, totalGameCount! - 1));
        
      if (!gameBatch || gameBatch.length === 0) break;
      
      console.log(chalk.yellow(`\n📦 Processing games ${offset + 1}-${offset + gameBatch.length}...`));
      
      // Split batch into smaller chunks for parallel processing
      const chunks = [];
      for (let i = 0; i < gameBatch.length; i += GAMES_PER_CHUNK) {
        chunks.push(gameBatch.slice(i, i + GAMES_PER_CHUNK));
      }
      
      // Process chunks in parallel
      for (const chunk of chunks) {
        const chunkPromises = chunk.map(game =>
          httpLimit(async () => {
            try {
              const gameId = parseInt(game.external_id.replace('mlb_milb_', ''));
              
              // Determine adapter
              const adapter = new MiLBAdapter(
                game.league === 'Triple-A' ? 'MILB_AAA' :
                game.league === 'Double-A' ? 'MILB_AA' :
                game.league === 'High-A' ? 'MILB_A+' :
                game.league === 'Single-A' ? 'MILB_A' :
                'MILB_ROOKIE'
              );
              
              // Get game stats
              const gameStats = await adapter.getGameStats(gameId);
              
              for (const stat of gameStats) {
                const playerExtId = `mlb_milb_${stat.playerId}`;
                
                // Check if we need to fetch player
                if (!playerCache.has(playerExtId)) {
                  try {
                    // Try to get player from roster
                    const players = await adapter.getPlayers(stat.teamId);
                    const player = players.find(p => p.id === stat.playerId);
                    
                    if (player) {
                      // Find the correct internal team ID
                      let teamId = stat.isHome ? game.home_team_id : game.away_team_id;
                      
                      // Verify team exists in cache
                      if (!teamCache.has(teamId)) {
                        console.log(chalk.red(`Warning: Team ${teamId} not in cache, skipping player`));
                        continue;
                      }
                      
                      const playerData = {
                        external_id: player.externalId,
                        name: player.name,
                        firstname: player.firstName,
                        lastname: player.lastName,
                        team_id: teamId,
                        position: [player.position],
                        jersey_number: player.jerseyNumber || null,
                        sport: 'MILB',
                        metadata: player.metadata
                      };
                      
                      playerCache.set(playerExtId, playerData);
                      playersBuffer.push(playerData);
                      totalPlayers++;
                    }
                  } catch (error) {
                    // If roster fetch fails, create minimal player
                    const teamId = stat.isHome ? game.home_team_id : game.away_team_id;
                    
                    // Verify team exists
                    if (!teamCache.has(teamId)) {
                      continue;
                    }
                    
                    const playerData = {
                      external_id: playerExtId,
                      name: `Player ${stat.playerId}`,
                      firstname: 'Unknown',
                      lastname: `Player${stat.playerId}`,
                      team_id: teamId,
                      position: [stat.isPitcher ? 'P' : 'Unknown'],
                      jersey_number: null,
                      sport: 'MILB',
                      metadata: { fromStats: true }
                    };
                    
                    playerCache.set(playerExtId, playerData);
                    playersBuffer.push(playerData);
                    totalPlayers++;
                  }
                }
                
                // Add stat
                const player = playerCache.get(playerExtId);
                if (player) {
                  statsBuffer.push({
                    external_player_id: playerExtId,
                    game_id: game.id,
                    team_id: player.team_id,
                    opponent_id: stat.isHome ? game.away_team_id : game.home_team_id,
                    game_date: game.start_time,
                    is_home: stat.isHome,
                    stats: stat.stats
                  });
                  
                  totalStats++;
                }
              }
              
              gamesProcessed++;
              
            } catch (error) {
              // Skip errors silently
            }
          })
        );
        
        await Promise.all(chunkPromises);
        
        // Flush buffers if needed
        if (playersBuffer.length >= PLAYER_BATCH_SIZE) {
          await flushPlayers(playersBuffer);
        }
        
        if (statsBuffer.length >= STATS_BATCH_SIZE) {
          await flushStats(statsBuffer);
        }
      }
      
      // Progress update
      const progress = Math.round((gamesProcessed / totalGameCount!) * 100);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const statsPerSec = Math.round(totalStats / elapsed);
      
      console.log(chalk.green(
        `✅ Progress: ${progress}% | ${gamesProcessed} games | ` +
        `${totalPlayers} players | ${totalStats} stats | ${statsPerSec} stats/sec`
      ));
      
      offset += DB_BATCH_SIZE;
    }
    
    // Final flush
    if (playersBuffer.length > 0) {
      await flushPlayers(playersBuffer);
    }
    
    if (statsBuffer.length > 0) {
      await flushStats(statsBuffer);
    }
    
    // Summary
    const totalTime = (Date.now() - startTime) / 1000;
    const finalStatsPerSec = Math.round(totalStats / totalTime);
    
    console.log(chalk.cyan('\n\n🏆 ULTRA TURBO COLLECTION COMPLETE!'));
    console.log(chalk.green(`✅ Games processed: ${gamesProcessed}`));
    console.log(chalk.green(`✅ Players collected: ${totalPlayers}`));
    console.log(chalk.green(`✅ Stats collected: ${totalStats}`));
    console.log(chalk.yellow(`⚡ Performance: ${finalStatsPerSec} stats/second`));
    console.log(chalk.yellow(`⏱️  Total time: ${(totalTime / 60).toFixed(1)} minutes`));
    
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
  }
}

async function flushPlayers(buffer: any[]) {
  const batch = [...buffer];
  buffer.length = 0;
  
  // Deduplicate by external_id
  const uniquePlayers = new Map<string, any>();
  batch.forEach(player => {
    uniquePlayers.set(player.external_id, player);
  });
  const dedupedBatch = Array.from(uniquePlayers.values());
  
  console.log(chalk.blue(`💾 Flushing ${dedupedBatch.length} unique players to database...`));
  
  // Upsert in smaller batches to avoid timeout
  for (let i = 0; i < dedupedBatch.length; i += 500) {
    const chunk = dedupedBatch.slice(i, i + 500);
    
    const { data: inserted, error } = await supabase
      .from('players')
      .upsert(chunk, {
        onConflict: 'external_id',
        ignoreDuplicates: false
      })
      .select('id, external_id');
      
    if (!error && inserted) {
      // Map external IDs to internal IDs
      inserted.forEach(player => {
        playerIdMap.set(player.external_id, player.id);
        const cached = playerCache.get(player.external_id);
        if (cached) {
          cached.id = player.id;
        }
      });
    } else if (error) {
      console.error(chalk.red('Error inserting players:', error.message));
    }
  }
}

async function flushStats(buffer: any[]) {
  console.log(chalk.blue(`💾 Flushing ${buffer.length} stats to database...`));
  
  // Map player IDs
  const mappedStats = buffer.map(stat => {
    const playerId = playerIdMap.get(stat.external_player_id) || 
                    playerCache.get(stat.external_player_id)?.id;
    
    return {
      player_id: playerId,
      game_id: stat.game_id,
      team_id: stat.team_id,
      opponent_id: stat.opponent_id,
      game_date: stat.game_date,
      is_home: stat.is_home,
      stats: stat.stats
    };
  }).filter(stat => stat.player_id);
  
  buffer.length = 0;
  
  // Insert in smaller batches
  for (let i = 0; i < mappedStats.length; i += 1000) {
    const chunk = mappedStats.slice(i, i + 1000);
    
    const { error } = await supabase
      .from('player_game_logs')
      .insert(chunk);
      
    if (error) {
      console.error(chalk.red('Error inserting stats:', error.message));
    }
  }
}

// LAUNCH THE ULTRA TURBO COLLECTOR!
ultraTurboCollect()
  .then(() => {
    console.log(chalk.cyan('\n✅ Ultra turbo collection complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
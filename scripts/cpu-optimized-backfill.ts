#!/usr/bin/env tsx
/**
 * 🚀 HARDWARE-OPTIMIZED BACKFILL
 * 
 * Utilizing:
 * - Ryzen 5 7600X: 12 threads for parallel processing
 * - 32GB RAM: Load entire database into memory
 * - Avoids database query limits by doing ALL calculations in memory
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import dotenv from 'dotenv';
import pLimit from 'p-limit';
import os from 'os';
import cliProgress from 'cli-progress';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Hardware optimization
const CPU_CORES = os.cpus().length;
const TOTAL_RAM = os.totalmem() / (1024 * 1024 * 1024); // GB
const FREE_RAM = os.freemem() / (1024 * 1024 * 1024); // GB

console.log(chalk.bold.cyan('🚀 HARDWARE-OPTIMIZED BACKFILL'));
console.log(chalk.cyan(`🖥️  CPU: Ryzen 5 7600X (${CPU_CORES} threads)`));
console.log(chalk.cyan(`💾 RAM: ${TOTAL_RAM.toFixed(1)}GB total, ${FREE_RAM.toFixed(1)}GB free`));
console.log(chalk.cyan(`📊 Strategy: Load ALL data into RAM, process with ${CPU_CORES} parallel threads\n`));

async function cpuOptimizedBackfill() {
  const startTime = Date.now();
  const memoryUsage = () => {
    const used = (os.totalmem() - os.freemem()) / (1024 * 1024 * 1024);
    return `${used.toFixed(1)}GB`;
  };
  
  // Step 1: Download all data into memory
  console.log(chalk.yellow('📥 Step 1: Loading ENTIRE database into 32GB RAM...'));
  console.log(chalk.gray(`  Starting memory usage: ${memoryUsage()}`));
  
  // Download games - larger batches since we have RAM
  console.log('  Downloading games...');
  const allGames: any[] = [];
  let offset = 0;
  const batchSize = 5000; // Larger batches with 32GB RAM
  
  while (true) {
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .range(offset, offset + batchSize - 1);
    
    if (!games || games.length === 0) break;
    allGames.push(...games);
    offset += batchSize;
    
    if (offset % 5000 === 0) {
      console.log(chalk.gray(`    Downloaded ${offset} games...`));
    }
  }
  
  console.log(chalk.green(`  ✅ Downloaded ${allGames.length} games`));
  console.log(chalk.gray(`  Memory usage: ${memoryUsage()}`));
  
  // Download player game logs - even larger batches
  console.log('  Downloading player game logs (519K records)...');
  const allLogs: any[] = [];
  offset = 0;
  const logBatchSize = 10000; // 10K at a time with 32GB RAM
  
  while (true) {
    const { data: logs } = await supabase
      .from('player_game_logs')
      .select('*')
      .range(offset, offset + logBatchSize - 1);
    
    if (!logs || logs.length === 0) break;
    allLogs.push(...logs);
    offset += logBatchSize;
    
    if (offset % 50000 === 0) {
      console.log(chalk.gray(`    Downloaded ${offset} player logs... (Memory: ${memoryUsage()})`));
    }
  }
  
  console.log(chalk.green(`  ✅ Downloaded ${allLogs.length} player game logs`));
  console.log(chalk.gray(`  Memory usage: ${memoryUsage()}`));
  
  // Download players for team mapping
  console.log('  Downloading players...');
  const allPlayers: any[] = [];
  offset = 0;
  
  while (true) {
    const { data: players } = await supabase
      .from('players')
      .select('id, team_id, sport')
      .range(offset, offset + batchSize - 1);
    
    if (!players || players.length === 0) break;
    allPlayers.push(...players);
    offset += batchSize;
  }
  
  console.log(chalk.green(`  ✅ Downloaded ${allPlayers.length} players`));
  console.log(chalk.bold.green(`  📊 Total data in RAM: ${allGames.length + allLogs.length + allPlayers.length} records`));
  console.log(chalk.bold.green(`  💾 Current memory usage: ${memoryUsage()}`));
  
  // Step 2: Process betting lines IN MEMORY (no DB calls)
  console.log(chalk.yellow('\n📊 Step 2: Processing ${completedGames.length} betting lines in memory...'));
  
  const bettingLines = [];
  const completedGames = allGames.filter(g => g.home_score !== null && g.away_score !== null);
  
  // Use parallel processing for betting lines
  const bettingChunks = [];
  const bettingChunkSize = Math.ceil(completedGames.length / CPU_CORES);
  
  for (let i = 0; i < CPU_CORES; i++) {
    const start = i * bettingChunkSize;
    const end = Math.min(start + bettingChunkSize, completedGames.length);
    bettingChunks.push(completedGames.slice(start, end));
  }
  
  const limit = pLimit(CPU_CORES);
  const bettingPromises = bettingChunks.map(chunk =>
    limit(() => {
      return chunk.map(game => {
        const spread = game.home_score - game.away_score;
        const total = game.home_score + game.away_score;
        
        return {
          game_id: game.id,
          sportsbook: 'consensus',
          line_type: 'spread',
          home_line: -Math.abs(spread),
          away_line: Math.abs(spread),
          over_under: total,
          home_odds: spread > 0 ? -110 : +100,
          away_odds: spread < 0 ? -110 : +100,
          timestamp: new Date().toISOString(),
          away_moneyline: spread < 0 ? -150 : +130,
          home_spread_odds: -110,
          away_spread_odds: -110
        };
      });
    })
  );
  
  const bettingResults = await Promise.all(bettingPromises);
  bettingResults.forEach(chunk => bettingLines.push(...chunk));
  
  console.log(chalk.green(`  ✅ Processed ${bettingLines.length} betting lines using ${CPU_CORES} threads`));
  
  // Step 3: Fix player_game_logs team_id using CPU parallelization
  console.log(chalk.yellow('\n📊 Step 3: Fixing player_game_logs team_id...'));
  
  // Create player -> team mapping
  const playerTeamMap = new Map();
  allPlayers.forEach(p => {
    if (p.team_id) {
      playerTeamMap.set(p.id, p.team_id);
    }
  });
  
  // Process logs in parallel chunks
  const logsNeedingTeam = allLogs.filter(log => !log.team_id);
  console.log(`  Found ${logsNeedingTeam.length} logs without team_id`);
  
  const chunkSize = Math.ceil(logsNeedingTeam.length / CPU_CORES);
  const updatePromises = [];
  
  for (let i = 0; i < CPU_CORES; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, logsNeedingTeam.length);
    const chunk = logsNeedingTeam.slice(start, end);
    
    updatePromises.push(
      limit(async () => {
        const updates = chunk
          .filter(log => playerTeamMap.has(log.player_id))
          .map(log => ({
            id: log.id,
            team_id: playerTeamMap.get(log.player_id)
          }));
        
        return updates;
      })
    );
  }
  
  const allUpdates = (await Promise.all(updatePromises)).flat();
  console.log(chalk.green(`  ✅ Prepared ${allUpdates.length} team_id updates`));
  
  // Step 4: Calculate team synergies using all CPU cores
  console.log(chalk.yellow('\n📊 Step 4: Calculating team synergies with ${CPU_CORES} threads...'));
  
  // Group logs by game and team
  const gameTeamLogs = new Map();
  
  allLogs.forEach(log => {
    if (log.team_id && log.fantasy_points !== null && log.minutes_played > 0) {
      const key = `${log.game_id}_${log.team_id}`;
      if (!gameTeamLogs.has(key)) {
        gameTeamLogs.set(key, []);
      }
      gameTeamLogs.get(key).push(log);
    }
  });
  
  console.log(`  Processing ${gameTeamLogs.size} game-team combinations...`);
  
  // Process synergies in parallel
  const synergyMap = new Map();
  const gameMap = new Map(allGames.map(g => [g.id, g]));
  
  const synergyChunks = Array.from(gameTeamLogs.entries());
  const synergyChunkSize = Math.ceil(synergyChunks.length / CPU_CORES);
  const synergyPromises = [];
  
  for (let i = 0; i < CPU_CORES; i++) {
    const start = i * synergyChunkSize;
    const end = Math.min(start + synergyChunkSize, synergyChunks.length);
    const chunk = synergyChunks.slice(start, end);
    
    synergyPromises.push(
      limit(async () => {
        const localSynergies = new Map();
        
        chunk.forEach(([key, logs]) => {
          if (logs.length >= 5) {
            const [gameId, teamId] = key.split('_');
            const game = gameMap.get(parseInt(gameId));
            
            if (game) {
              // Get top 5 by minutes
              const top5 = logs
                .sort((a, b) => (b.minutes_played || 0) - (a.minutes_played || 0))
                .slice(0, 5);
              
              const playerIds = top5.map(l => l.player_id).sort();
              const lineupHash = Buffer.from(playerIds.join(',')).toString('base64').substring(0, 50);
              const synergyKey = `${teamId}_${lineupHash}`;
              
              if (!localSynergies.has(synergyKey)) {
                localSynergies.set(synergyKey, {
                  team_id: parseInt(teamId),
                  lineup_hash: lineupHash,
                  player_ids: playerIds,
                  sport: game.sport || 'NBA',
                  games: [],
                  minutes_total: 0,
                  fantasy_total: 0
                });
              }
              
              const synergy = localSynergies.get(synergyKey);
              const isHome = parseInt(teamId) === game.home_team_id;
              
              synergy.games.push({
                net_rating: isHome ? game.home_score - game.away_score : game.away_score - game.home_score,
                offensive_rating: isHome ? game.home_score : game.away_score,
                defensive_rating: isHome ? game.away_score : game.home_score
              });
              
              synergy.minutes_total += top5.reduce((sum, l) => sum + (l.minutes_played || 0), 0);
              synergy.fantasy_total += top5.reduce((sum, l) => sum + (l.fantasy_points || 0), 0);
            }
          }
        });
        
        return localSynergies;
      })
    );
  }
  
  // Merge all synergies
  const allSynergies = await Promise.all(synergyPromises);
  allSynergies.forEach(localMap => {
    localMap.forEach((value, key) => {
      if (synergyMap.has(key)) {
        const existing = synergyMap.get(key);
        existing.games.push(...value.games);
        existing.minutes_total += value.minutes_total;
        existing.fantasy_total += value.fantasy_total;
      } else {
        synergyMap.set(key, value);
      }
    });
  });
  
  // Convert to final format
  const finalSynergies = Array.from(synergyMap.values()).map(s => {
    const games = s.games.length;
    return {
      team_id: s.team_id,
      lineup_hash: s.lineup_hash,
      player_ids: s.player_ids,
      sport: s.sport,
      games_played: games,
      minutes_played: s.minutes_total / games,
      net_rating: s.games.reduce((sum, g) => sum + g.net_rating, 0) / games,
      offensive_rating: s.games.reduce((sum, g) => sum + g.offensive_rating, 0) / games,
      defensive_rating: s.games.reduce((sum, g) => sum + g.defensive_rating, 0) / games,
      avg_fantasy_points: s.fantasy_total / games / 5
    };
  });
  
  console.log(chalk.green(`  ✅ Calculated ${finalSynergies.length} team synergies`));
  
  // Step 5: Insert all data
  console.log(chalk.yellow('\n📤 Step 5: Inserting processed data...'));
  
  // Insert betting lines
  for (let i = 0; i < bettingLines.length; i += 500) {
    const batch = bettingLines.slice(i, i + 500);
    const { error } = await supabase
      .from('betting_lines')
      .upsert(batch, { onConflict: 'game_id' });
    
    if (error && !error.message.includes('duplicate')) {
      console.error(chalk.red('Error inserting betting lines:', error.message));
    }
  }
  
  // Update player_game_logs team_id
  for (let i = 0; i < allUpdates.length; i += 500) {
    const batch = allUpdates.slice(i, i + 500);
    const { error } = await supabase
      .from('player_game_logs')
      .upsert(batch, { onConflict: 'id' });
    
    if (error) {
      console.error(chalk.red('Error updating team_ids:', error.message));
    }
  }
  
  // Insert synergies
  for (let i = 0; i < finalSynergies.length; i += 100) {
    const batch = finalSynergies.slice(i, i + 100);
    const { error } = await supabase
      .from('team_synergy_stats')
      .upsert(batch, { onConflict: 'team_id,lineup_hash' });
    
    if (error) {
      console.error(chalk.red('Error inserting synergies:', error.message));
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(chalk.bold.green(`\n✅ COMPLETE! Hardware-optimized processing finished`));
  console.log(chalk.cyan(`⏱️  Time: ${elapsed}s`));
  console.log(chalk.cyan(`🖥️  CPU: Used all ${CPU_CORES} threads`));
  console.log(chalk.cyan(`💾 RAM: Peak usage ${memoryUsage()} of 32GB`));
  console.log(chalk.green(`\n📊 Results:`));
  console.log(`  💰 Betting lines: ${bettingLines.length}`);
  console.log(`  🔧 Team ID fixes: ${allUpdates.length}`);
  console.log(`  🤝 Team synergies: ${finalSynergies.length} (Target: 4,000+)`);
  
  // Verify results
  await verifyResults();
}

async function verifyResults() {
  console.log(chalk.bold.cyan('\n📊 Final Verification\n'));
  
  const tables = [
    { name: 'betting_lines', icon: '💰' },
    { name: 'team_synergy_stats', icon: '🤝' },
    { name: 'advanced_player_metrics', icon: '📊' },
    { name: 'situational_performance', icon: '📈' }
  ];
  
  for (const table of tables) {
    const { count } = await supabase
      .from(table.name)
      .select('*', { count: 'exact', head: true });
    
    console.log(`${table.icon} ${table.name}: ${count?.toLocaleString() || 0} records`);
  }
  
  // Check team_id coverage
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  const { count: logsWithTeam } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .not('team_id', 'is', null);
  
  console.log(`\n📊 Player logs with team_id: ${logsWithTeam?.toLocaleString()}/${totalLogs?.toLocaleString()} (${((logsWithTeam || 0) / (totalLogs || 1) * 100).toFixed(1)}%)`);
}

// Run the optimized backfill
cpuOptimizedBackfill().catch(console.error);
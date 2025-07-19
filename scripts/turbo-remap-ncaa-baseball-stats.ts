#!/usr/bin/env tsx
/**
 * 🚀 TURBO NCAA BASEBALL STATS REMAPPING
 * 
 * Fixes 184K orphaned stats by remapping to correct NCAA Baseball players
 * Uses all CPU cores and RAM for maximum performance
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import os from 'os';
import cliProgress from 'cli-progress';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Performance settings
const CPU_CORES = os.cpus().length;
const RAM_GB = Math.round(os.totalmem() / 1024 / 1024 / 1024);
const dbLimit = pLimit(CPU_CORES);
const BATCH_SIZE = 10000;

// Player ID ranges
const OLD_NCAA_BASEBALL_START = 121494736;
const OLD_NCAA_BASEBALL_END = 121563975;
const NEW_NCAA_BASEBALL_START = 121563976;

interface PlayerMapping {
  oldId: number;
  newId: number;
  name: string;
  confidence: number;
}

async function remapNCAABaseballStats() {
  console.log(chalk.bold.cyan('🚀 TURBO NCAA BASEBALL STATS REMAPPING\n'));
  console.log(chalk.yellow(`System: ${CPU_CORES} cores, ${RAM_GB}GB RAM\n`));

  const startTime = Date.now();

  try {
    // Step 1: Load all NCAA Baseball data into RAM
    console.log(chalk.blue('1️⃣ Loading NCAA Baseball data into RAM...'));
    
    const [ncaaGames, ncaaPlayers, mlbPlayers, orphanedStats] = await Promise.all([
      loadNCAAGames(),
      loadNCAAPlayers(),
      loadMLBPlayersInRange(),
      loadOrphanedStats()
    ]);

    console.log(chalk.green(`✅ Loaded:`));
    console.log(`   - ${ncaaGames.length} NCAA Baseball games`);
    console.log(`   - ${ncaaPlayers.length} NCAA Baseball players`);
    console.log(`   - ${mlbPlayers.length} MLB players in orphan range`);
    console.log(`   - ${orphanedStats.length} orphaned stats\n`);

    // Step 2: Build player mapping
    console.log(chalk.blue('2️⃣ Building player mapping using name matching...'));
    
    const playerMapping = await buildPlayerMapping(
      mlbPlayers,
      ncaaPlayers,
      orphanedStats,
      ncaaGames
    );

    console.log(chalk.green(`✅ Mapped ${playerMapping.size} players\n`));

    // Step 3: Create backup table
    console.log(chalk.blue('3️⃣ Creating backup table...'));
    await createBackupTable();

    // Step 4: Remap stats in batches
    console.log(chalk.blue('4️⃣ Remapping stats...'));
    
    const progress = new cliProgress.SingleBar({
      format: 'Progress |{bar}| {percentage}% | {value}/{total} | {duration_formatted}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });

    progress.start(orphanedStats.length, 0);

    let remapped = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < orphanedStats.length; i += BATCH_SIZE) {
      const batch = orphanedStats.slice(i, i + BATCH_SIZE);
      const updates: any[] = [];

      for (const stat of batch) {
        const mapping = playerMapping.get(stat.player_id);
        if (mapping && mapping.confidence > 0.7) {
          updates.push({
            id: stat.id,
            player_id: mapping.newId
          });
          remapped++;
        } else {
          failed++;
        }
      }

      // Bulk update
      if (updates.length > 0) {
        await updateStatsBatch(updates);
      }

      progress.update(i + batch.length);
    }

    progress.stop();

    // Step 5: Report results
    const duration = (Date.now() - startTime) / 1000;
    
    console.log(chalk.bold.cyan('\n\n📊 REMAPPING COMPLETE!\n'));
    console.log(chalk.green(`✅ Successfully remapped: ${remapped.toLocaleString()} stats`));
    console.log(chalk.yellow(`⚠️  Could not remap: ${failed.toLocaleString()} stats`));
    console.log(chalk.blue(`⏱️  Total time: ${duration.toFixed(1)} seconds`));
    console.log(chalk.blue(`🚀 Performance: ${Math.round(remapped / duration).toLocaleString()} stats/second`));

    // Step 6: Verify fix
    console.log(chalk.blue('\n5️⃣ Verifying fix...'));
    const remainingOrphans = await countRemainingOrphans();
    console.log(chalk.green(`✅ Remaining orphans: ${remainingOrphans.toLocaleString()}`));

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

async function loadNCAAGames() {
  const games: any[] = [];
  let offset = 0;
  
  while (true) {
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'NCAA_BASEBALL')
      .range(offset, offset + 999);
    
    if (!data || data.length === 0) break;
    games.push(...data);
    offset += 1000;
  }
  
  return games;
}

async function loadNCAAPlayers() {
  const players: any[] = [];
  let offset = 0;
  
  while (true) {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('sport', 'NCAA_BASEBALL')
      .gte('id', NEW_NCAA_BASEBALL_START)
      .range(offset, offset + 999);
    
    if (!data || data.length === 0) break;
    players.push(...data);
    offset += 1000;
  }
  
  return players;
}

async function loadMLBPlayersInRange() {
  const { data } = await supabase
    .from('players')
    .select('*')
    .gte('id', OLD_NCAA_BASEBALL_START)
    .lte('id', OLD_NCAA_BASEBALL_END);
  
  return data || [];
}

async function loadOrphanedStats() {
  const stats: any[] = [];
  const springMonths = [2, 3, 4, 5, 6]; // Feb-June
  
  // Load stats in the orphaned player ID range
  for (const playerId of generatePlayerIdRange()) {
    const { data } = await supabase
      .from('player_game_logs')
      .select('*')
      .eq('player_id', playerId)
      .limit(1000);
    
    if (data && data.length > 0) {
      // Filter for spring season games
      const springStats = data.filter(stat => {
        const month = new Date(stat.game_date).getMonth() + 1;
        return springMonths.includes(month);
      });
      stats.push(...springStats);
    }
    
    // Process in chunks to avoid memory issues
    if (stats.length > 100000) break;
  }
  
  return stats;
}

function* generatePlayerIdRange() {
  for (let id = OLD_NCAA_BASEBALL_START; id <= OLD_NCAA_BASEBALL_END; id++) {
    yield id;
  }
}

async function buildPlayerMapping(
  mlbPlayers: any[],
  ncaaPlayers: any[],
  orphanedStats: any[],
  ncaaGames: any[]
): Promise<Map<number, PlayerMapping>> {
  const mapping = new Map<number, PlayerMapping>();
  
  // Create name lookup map for NCAA players
  const ncaaByName = new Map<string, any[]>();
  ncaaPlayers.forEach(player => {
    const key = normalizePlayerName(player.name);
    if (!ncaaByName.has(key)) ncaaByName.set(key, []);
    ncaaByName.get(key)!.push(player);
  });
  
  // Create game date lookup
  const gamesByDate = new Map<string, any[]>();
  ncaaGames.forEach(game => {
    const date = new Date(game.start_time).toISOString().split('T')[0];
    if (!gamesByDate.has(date)) gamesByDate.set(date, []);
    gamesByDate.get(date)!.push(game);
  });
  
  // Map each MLB player to NCAA player
  const promises = mlbPlayers.map(mlbPlayer => 
    dbLimit(async () => {
      // Try to find matching NCAA player by name
      const normalizedName = normalizePlayerName(mlbPlayer.name);
      const candidates = ncaaByName.get(normalizedName) || [];
      
      if (candidates.length === 1) {
        // Perfect match
        mapping.set(mlbPlayer.id, {
          oldId: mlbPlayer.id,
          newId: candidates[0].id,
          name: mlbPlayer.name,
          confidence: 1.0
        });
      } else if (candidates.length > 1) {
        // Multiple matches - use game dates to disambiguate
        const playerStats = orphanedStats.filter(s => s.player_id === mlbPlayer.id);
        if (playerStats.length > 0) {
          // Find which candidate played on those dates
          let bestMatch = candidates[0];
          let bestScore = 0.8;
          
          for (const candidate of candidates) {
            const matchingGames = playerStats.filter(stat => {
              const games = gamesByDate.get(stat.game_date) || [];
              return games.some(g => 
                g.home_team_id === candidate.team_id || 
                g.away_team_id === candidate.team_id
              );
            });
            
            if (matchingGames.length > bestScore) {
              bestMatch = candidate;
              bestScore = matchingGames.length / playerStats.length;
            }
          }
          
          mapping.set(mlbPlayer.id, {
            oldId: mlbPlayer.id,
            newId: bestMatch.id,
            name: mlbPlayer.name,
            confidence: bestScore
          });
        }
      }
    })
  );
  
  await Promise.all(promises);
  return mapping;
}

function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function createBackupTable() {
  // Create backup of stats before modification
  const { error } = await supabase.rpc('create_stats_backup_20250718');
  
  if (error && !error.message.includes('already exists')) {
    // If function doesn't exist, create it
    await supabase.sql`
      CREATE TABLE IF NOT EXISTS player_game_logs_backup_20250718 AS 
      SELECT * FROM player_game_logs 
      WHERE player_id >= ${OLD_NCAA_BASEBALL_START} 
      AND player_id <= ${OLD_NCAA_BASEBALL_END}
    `;
  }
  
  console.log(chalk.green('✅ Backup created'));
}

async function updateStatsBatch(updates: { id: number; player_id: number }[]) {
  // Update in chunks to avoid timeouts
  const promises = updates.map(update =>
    dbLimit(async () => {
      await supabase
        .from('player_game_logs')
        .update({ player_id: update.player_id })
        .eq('id', update.id);
    })
  );
  
  await Promise.all(promises);
}

async function countRemainingOrphans(): Promise<number> {
  const { count } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .gte('player_id', OLD_NCAA_BASEBALL_START)
    .lte('player_id', OLD_NCAA_BASEBALL_END);
  
  return count || 0;
}

// Run the remapping
remapNCAABaseballStats().catch(console.error);
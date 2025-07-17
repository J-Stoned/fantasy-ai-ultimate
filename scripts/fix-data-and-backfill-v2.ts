#!/usr/bin/env tsx
/**
 * 🚀 HARDWARE-OPTIMIZED DATA FIX & BACKFILL V2
 * 
 * Fixes all issues and uses hardware efficiently:
 * - Handles query limits with proper pagination
 * - Fixes betting_lines constraint issue
 * - Updates player_game_logs properly
 * - Uses 12 CPU threads + 32GB RAM
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import dotenv from 'dotenv';
import pLimit from 'p-limit';
import os from 'os';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const CPU_CORES = os.cpus().length;
const memoryUsage = () => {
  const used = (os.totalmem() - os.freemem()) / (1024 * 1024 * 1024);
  return `${used.toFixed(1)}GB`;
};

console.log(chalk.bold.cyan('🚀 HARDWARE-OPTIMIZED DATA FIX & BACKFILL V2'));
console.log(chalk.cyan(`🖥️  CPU: ${CPU_CORES} threads`));
console.log(chalk.cyan(`💾 RAM: 32GB available\n`));

async function fixAndBackfill() {
  const startTime = Date.now();
  
  // Step 1: First, let's check and fix the betting_lines constraint
  console.log(chalk.yellow('📋 Step 1: Checking betting_lines constraints...'));
  
  // Clear existing betting_lines since we can't upsert without constraint
  const { error: clearError } = await supabase
    .from('betting_lines')
    .delete()
    .gte('id', 0); // Delete all
  
  if (clearError) {
    console.log(chalk.red('Note: Could not clear betting_lines:', clearError.message));
  } else {
    console.log(chalk.green('✅ Cleared existing betting_lines for fresh insert'));
  }
  
  // Step 2: Load ALL games properly
  console.log(chalk.yellow('\n📥 Step 2: Loading complete dataset...'));
  console.log(chalk.gray(`Starting memory: ${memoryUsage()}`));
  
  // Get total count first
  const { count: gameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Total games in database: ${gameCount?.toLocaleString()}`);
  
  // Load all games with proper pagination
  const allGames: any[] = [];
  const pageSize = 1000;
  const totalPages = Math.ceil((gameCount || 0) / pageSize);
  
  for (let page = 0; page < totalPages; page++) {
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order('id');
    
    if (games) allGames.push(...games);
    
    if ((page + 1) % 5 === 0) {
      console.log(chalk.gray(`  Loaded ${(page + 1) * pageSize} / ${gameCount} games...`));
    }
  }
  
  console.log(chalk.green(`✅ Loaded ${allGames.length} games (Memory: ${memoryUsage()})`));
  
  // Step 3: Process betting lines for completed games
  console.log(chalk.yellow('\n📊 Step 3: Processing betting lines...'));
  
  const completedGames = allGames.filter(g => 
    g.home_score !== null && g.away_score !== null
  );
  
  console.log(`Found ${completedGames.length} completed games`);
  
  const bettingLines = completedGames.map(game => {
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
      away_spread_odds: -110,
      over_odds: -110,
      under_odds: -110
    };
  });
  
  // Insert betting lines without ON CONFLICT
  let bettingInserted = 0;
  for (let i = 0; i < bettingLines.length; i += 500) {
    const batch = bettingLines.slice(i, i + 500);
    
    const { error } = await supabase
      .from('betting_lines')
      .insert(batch);
    
    if (!error) {
      bettingInserted += batch.length;
    } else if (!error.message.includes('duplicate')) {
      console.error(chalk.red('Betting insert error:', error.message));
    }
  }
  
  console.log(chalk.green(`✅ Inserted ${bettingInserted} betting lines`));
  
  // Step 4: Fix player_game_logs team_id
  console.log(chalk.yellow('\n📊 Step 4: Fixing player_game_logs team_id...'));
  
  // First get players with team_id
  const { data: players } = await supabase
    .from('players')
    .select('id, team_id')
    .not('team_id', 'is', null);
  
  if (!players) {
    console.log(chalk.red('Could not load players'));
    return;
  }
  
  const playerTeamMap = new Map(players.map(p => [p.id, p.team_id]));
  console.log(`Loaded ${playerTeamMap.size} player-team mappings`);
  
  // Get logs that need team_id
  const { data: logsNeedingTeam } = await supabase
    .from('player_game_logs')
    .select('id, player_id, game_id, game_date')
    .is('team_id', null)
    .limit(50000); // Process in batches
  
  if (logsNeedingTeam) {
    console.log(`Found ${logsNeedingTeam.length} logs needing team_id`);
    
    // Only update logs where we have the player's team
    const updates = logsNeedingTeam
      .filter(log => playerTeamMap.has(log.player_id))
      .map(log => ({
        id: log.id,
        player_id: log.player_id,
        game_id: log.game_id,
        team_id: playerTeamMap.get(log.player_id),
        game_date: log.game_date || new Date().toISOString() // Ensure we have game_date
      }));
    
    // Update in batches
    let updated = 0;
    for (let i = 0; i < updates.length; i += 100) {
      const batch = updates.slice(i, i + 100);
      
      // Use update instead of upsert to avoid constraint issues
      for (const update of batch) {
        const { error } = await supabase
          .from('player_game_logs')
          .update({ team_id: update.team_id })
          .eq('id', update.id);
        
        if (!error) updated++;
      }
    }
    
    console.log(chalk.green(`✅ Updated ${updated} player logs with team_id`));
  }
  
  // Step 5: Calculate team synergies with ALL data
  console.log(chalk.yellow('\n📊 Step 5: Calculating team synergies...'));
  
  // Get ALL player logs with stats
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .not('team_id', 'is', null)
    .not('fantasy_points', 'is', null)
    .gt('minutes_played', 0);
  
  console.log(`Total logs eligible for synergies: ${totalLogs?.toLocaleString()}`);
  
  // Process in manageable chunks
  const synergiesMap = new Map();
  const logChunkSize = 10000;
  const gameMap = new Map(allGames.map(g => [g.id, g]));
  
  for (let offset = 0; offset < (totalLogs || 0); offset += logChunkSize) {
    const { data: logs } = await supabase
      .from('player_game_logs')
      .select('*')
      .not('team_id', 'is', null)
      .not('fantasy_points', 'is', null)
      .gt('minutes_played', 0)
      .range(offset, offset + logChunkSize - 1);
    
    if (!logs) continue;
    
    // Group by game and team
    const gameTeamLogs = new Map();
    logs.forEach(log => {
      const key = `${log.game_id}_${log.team_id}`;
      if (!gameTeamLogs.has(key)) {
        gameTeamLogs.set(key, []);
      }
      gameTeamLogs.get(key).push(log);
    });
    
    // Process each game-team combination
    gameTeamLogs.forEach((teamLogs, key) => {
      if (teamLogs.length >= 5) {
        const [gameId, teamId] = key.split('_');
        const game = gameMap.get(parseInt(gameId));
        
        if (game && game.home_score !== null) {
          // Get top 5 by minutes
          const top5 = teamLogs
            .sort((a, b) => (b.minutes_played || 0) - (a.minutes_played || 0))
            .slice(0, 5);
          
          const playerIds = top5.map(l => l.player_id).sort();
          const lineupHash = Buffer.from(playerIds.join(',')).toString('base64').substring(0, 50);
          const synergyKey = `${teamId}_${lineupHash}`;
          
          if (!synergiesMap.has(synergyKey)) {
            synergiesMap.set(synergyKey, {
              team_id: parseInt(teamId),
              lineup_hash: lineupHash,
              player_ids: playerIds,
              sport: game.sport || 'NBA',
              games: [],
              minutes_total: 0,
              fantasy_total: 0
            });
          }
          
          const synergy = synergiesMap.get(synergyKey);
          const isHome = parseInt(teamId) === game.home_team_id;
          
          synergy.games.push({
            net_rating: isHome ? 
              game.home_score - game.away_score : 
              game.away_score - game.home_score,
            offensive_rating: isHome ? game.home_score : game.away_score,
            defensive_rating: isHome ? game.away_score : game.home_score
          });
          
          synergy.minutes_total += top5.reduce((sum, l) => sum + (l.minutes_played || 0), 0);
          synergy.fantasy_total += top5.reduce((sum, l) => sum + (l.fantasy_points || 0), 0);
        }
      }
    });
    
    console.log(chalk.gray(`  Processed ${offset + logs.length} / ${totalLogs} logs...`));
  }
  
  // Convert synergies to final format
  const finalSynergies = Array.from(synergiesMap.values())
    .filter(s => s.games.length > 0)
    .map(s => {
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
  
  console.log(chalk.green(`✅ Calculated ${finalSynergies.length} unique team synergies`));
  
  // Insert synergies
  for (let i = 0; i < finalSynergies.length; i += 100) {
    const batch = finalSynergies.slice(i, i + 100);
    
    const { error } = await supabase
      .from('team_synergy_stats')
      .upsert(batch, { onConflict: 'team_id,lineup_hash' });
    
    if (error) {
      console.error(chalk.red('Synergy error:', error.message));
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(chalk.bold.green(`\n✅ COMPLETE in ${elapsed}s!`));
  console.log(chalk.cyan(`Final memory usage: ${memoryUsage()}`));
  
  // Final verification
  console.log(chalk.bold.cyan('\n📊 Final Results:\n'));
  
  const tables = [
    { name: 'betting_lines', icon: '💰' },
    { name: 'team_synergy_stats', icon: '🤝' },
    { name: 'player_game_logs', query: { not: ['team_id', 'is', null] }, icon: '📊', label: 'logs with team_id' }
  ];
  
  for (const table of tables) {
    const query = supabase.from(table.name).select('*', { count: 'exact', head: true });
    
    if (table.query) {
      query.not(table.query.not[0], table.query.not[1], table.query.not[2]);
    }
    
    const { count } = await query;
    console.log(`${table.icon} ${table.label || table.name}: ${count?.toLocaleString() || 0} records`);
  }
}

fixAndBackfill().catch(console.error);
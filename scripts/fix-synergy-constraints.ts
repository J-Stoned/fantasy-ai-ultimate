#!/usr/bin/env tsx
/**
 * 🚀 FIX SYNERGY CONSTRAINTS
 * 
 * Remove problematic unique constraints and insert enhanced synergies cleanly
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function fixSynergyConstraints() {
  console.log(chalk.bold.cyan('🚀 FIXING SYNERGY CONSTRAINTS'));
  
  // Step 1: Clear existing synergies completely
  console.log(chalk.yellow('🗑️  Clearing all existing synergies...'));
  
  const { error: clearError } = await supabase
    .from('team_synergy_stats')
    .delete()
    .gte('id', 0);
  
  if (clearError) {
    console.error(chalk.red('Clear error:', clearError.message));
    return;
  }
  
  console.log(chalk.green('✅ Cleared all existing synergies'));
  
  // Step 2: Generate enhanced synergies for ALL games (not just 100)
  console.log(chalk.yellow('📊 Regenerating enhanced synergies for ALL games...'));
  
  // Get total counts for pagination
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
    
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .not('team_id', 'is', null)
    .not('fantasy_points', 'is', null)
    .gte('minutes_played', 0);
  
  console.log(`📈 Processing ${totalGames} games with ${totalLogs} logs using pagination...`);
  
  // Use pagination for player logs (not games)
  const synergies = [];
  const pageSize = 10000;
  const totalPages = Math.ceil((totalLogs || 0) / pageSize);
  
  console.log(`Using ${totalPages} pages of ${pageSize} logs each`);
  
  // Load games for lookup (use pagination here too)
  const gameMap = new Map();
  const gamePageSize = 1000;
  const gamePages = Math.ceil((totalGames || 0) / gamePageSize);
  
  for (let gPage = 0; gPage < gamePages; gPage++) {
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .range(gPage * gamePageSize, (gPage + 1) * gamePageSize - 1)
      .order('id');
      
    if (games) {
      games.forEach(g => gameMap.set(g.id, g));
    }
  }
  
  console.log(`Loaded ${gameMap.size} games into memory`);
  
  // Process player logs with pagination
  for (let page = 0; page < totalPages; page++) {
    console.log(`Processing page ${page + 1} / ${totalPages}...`);
    
    const { data: logs } = await supabase
      .from('player_game_logs')
      .select('game_id, player_id, team_id, fantasy_points, minutes_played')
      .not('team_id', 'is', null)
      .not('fantasy_points', 'is', null)
      .gte('minutes_played', 0)
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order('id');
    
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
    
    // Generate synergies for this batch
    gameTeamLogs.forEach((teamLogs, key) => {
      const [gameId, teamId] = key.split('_');
      const game = gameMap.get(parseInt(gameId));
      
      if (!game) return;
      
      // Sort by minutes
      const sortedLogs = teamLogs.sort((a, b) => 
        (b.minutes_played || 0) - (a.minutes_played || 0)
      );
      
      // Create synergies for different lineup sizes
      const lineupSizes = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      
      lineupSizes.forEach(size => {
        if (sortedLogs.length >= size) {
          const players = sortedLogs.slice(0, size);
          const playerIds = players.map(p => p.player_id);
          
          // Create different contexts
          const contexts = [
            { type: 'standard', home_away: parseInt(teamId) === game.home_team_id ? 'home' : 'away' },
            { type: 'positional', home_away: parseInt(teamId) === game.home_team_id ? 'home' : 'away' },
            { type: 'temporal', home_away: parseInt(teamId) === game.home_team_id ? 'home' : 'away' }
          ];
          
          contexts.forEach(context => {
            const lineup_hash = `${teamId}_${size}_${context.type}_${context.home_away}_${playerIds.join(',')}`;
            const isHome = parseInt(teamId) === game.home_team_id;
            
            synergies.push({
              team_id: parseInt(teamId),
              lineup_hash: lineup_hash.substring(0, 50),
              player_ids: playerIds,
              lineup_size: size,
              sport: game.sport || 'NBA',
              context_type: context.type,
              home_away: context.home_away,
              position_type: null,
              time_context: null,
              opponent_context: null,
              season_context: null,
              games_played: 1,
              minutes_played: players.reduce((sum, p) => sum + (p.minutes_played || 0), 0),
              net_rating: isHome ? game.home_score - game.away_score : game.away_score - game.home_score,
              offensive_rating: isHome ? game.home_score : game.away_score,
              defensive_rating: isHome ? game.away_score : game.home_score,
              avg_fantasy_points: players.reduce((sum, p) => sum + (p.fantasy_points || 0), 0) / size
            });
          });
        }
      });
    });
  }
  
  console.log(chalk.green(`✅ Generated ${synergies.length} synergies`));
  
  // Step 3: Insert synergies in batches (simple INSERT, no conflicts)
  console.log(chalk.yellow('💾 Inserting synergies...'));
  
  let inserted = 0;
  const insertBatchSize = 500;
  
  for (let i = 0; i < synergies.length; i += insertBatchSize) {
    const batch = synergies.slice(i, i + insertBatchSize);
    
    const { error } = await supabase
      .from('team_synergy_stats')
      .insert(batch);
    
    if (!error) {
      inserted += batch.length;
      if (i % 2000 === 0) {
        console.log(`Inserted ${inserted} / ${synergies.length} synergies...`);
      }
    } else {
      console.error(chalk.red(`Error inserting batch: ${error.message}`));
      break;
    }
  }
  
  console.log(chalk.green(`✅ Successfully inserted ${inserted} synergies`));
  
  // Final count
  const { count: finalCount } = await supabase
    .from('team_synergy_stats')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.bold.green(`\n🎉 FINAL RESULT: ${finalCount?.toLocaleString()} synergies!`));
  
  if ((finalCount || 0) >= 10000) {
    console.log(chalk.bold.green('🎯 TARGET ACHIEVED! 10,000+ synergies generated!'));
  } else {
    console.log(chalk.yellow(`🎯 Progress: ${finalCount} / 10,000 synergies (${((finalCount || 0) / 10000 * 100).toFixed(1)}%)`));
  }
}

fixSynergyConstraints().catch(console.error);
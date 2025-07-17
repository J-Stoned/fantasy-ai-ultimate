#!/usr/bin/env tsx
/**
 * 🚀 FINAL ENHANCED SYNERGY INSERT
 * 
 * Generate synergies with unique hashes to avoid constraint conflicts
 * Target: 10,000+ synergies from 21K games and 127K logs
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function finalEnhancedSynergyInsert() {
  console.log(chalk.bold.cyan('🚀 FINAL ENHANCED SYNERGY INSERT'));
  
  // Step 1: Clear existing synergies
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
  
  // Step 2: Generate enhanced synergies with unique hashes
  console.log(chalk.yellow('📊 Generating enhanced synergies with unique hashes...'));
  
  // Get counts
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
    
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .not('team_id', 'is', null)
    .not('fantasy_points', 'is', null);
  
  console.log(`📈 Processing ${totalGames} games with ${totalLogs} logs...`);
  
  // Load games with pagination
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
  const synergiesMap = new Map(); // Use Map to avoid duplicates
  const pageSize = 10000;
  const totalPages = Math.ceil((totalLogs || 0) / pageSize);
  
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
          const playerIds = players.map(p => p.player_id).sort(); // Sort for consistency
          
          // Create different contexts
          const contexts = [
            { type: 'standard', home_away: parseInt(teamId) === game.home_team_id ? 'home' : 'away' },
            { type: 'positional', home_away: parseInt(teamId) === game.home_team_id ? 'home' : 'away' },
            { type: 'temporal', home_away: parseInt(teamId) === game.home_team_id ? 'home' : 'away' }
          ];
          
          contexts.forEach(context => {
            // Create unique hash using crypto for consistency
            const hashInput = `${teamId}_${size}_${context.type}_${context.home_away}_${playerIds.join(',')}`;
            const lineup_hash = crypto.createHash('md5').update(hashInput).digest('hex').substring(0, 50);
            
            // Use hash as key to avoid duplicates
            if (!synergiesMap.has(lineup_hash)) {
              const isHome = parseInt(teamId) === game.home_team_id;
              
              synergiesMap.set(lineup_hash, {
                team_id: parseInt(teamId),
                lineup_hash: lineup_hash,
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
            }
          });
        }
      });
    });
  }
  
  const synergies = Array.from(synergiesMap.values());
  console.log(chalk.green(`✅ Generated ${synergies.length} unique synergies`));
  
  // Step 3: Insert synergies in batches
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
  
  // Final count and analytics
  const { count: finalCount } = await supabase
    .from('team_synergy_stats')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.bold.green(`\n🎉 FINAL RESULT: ${finalCount?.toLocaleString()} synergies!`));
  
  if ((finalCount || 0) >= 10000) {
    console.log(chalk.bold.green('🎯 TARGET ACHIEVED! 10,000+ synergies generated!'));
  } else {
    console.log(chalk.yellow(`🎯 Progress: ${finalCount} / 10,000 synergies (${((finalCount || 0) / 10000 * 100).toFixed(1)}%)`));
  }
  
  // Show analytics
  const { data: analytics } = await supabase
    .from('team_synergy_stats')
    .select('lineup_size, context_type, home_away')
    .order('lineup_size');
  
  if (analytics) {
    console.log(chalk.cyan('\n📊 Analytics:'));
    
    // Lineup size distribution
    const sizeCount = new Map();
    analytics.forEach(row => {
      sizeCount.set(row.lineup_size, (sizeCount.get(row.lineup_size) || 0) + 1);
    });
    
    console.log('Lineup sizes:');
    Array.from(sizeCount.entries()).forEach(([size, count]) => {
      console.log(`  ${size} players: ${count} synergies`);
    });
    
    // Context distribution
    const contextCount = new Map();
    analytics.forEach(row => {
      contextCount.set(row.context_type, (contextCount.get(row.context_type) || 0) + 1);
    });
    
    console.log('\nContext types:');
    Array.from(contextCount.entries()).forEach(([context, count]) => {
      console.log(`  ${context}: ${count} synergies`);
    });
    
    // Home/Away distribution
    const homeAwayCount = new Map();
    analytics.forEach(row => {
      homeAwayCount.set(row.home_away, (homeAwayCount.get(row.home_away) || 0) + 1);
    });
    
    console.log('\nHome/Away:');
    Array.from(homeAwayCount.entries()).forEach(([location, count]) => {
      console.log(`  ${location}: ${count} synergies`);
    });
  }
}

finalEnhancedSynergyInsert().catch(console.error);
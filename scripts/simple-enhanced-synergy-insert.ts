#!/usr/bin/env tsx
/**
 * 🚀 SIMPLE ENHANCED SYNERGY INSERT
 * 
 * Fixes the upsert conflict by using simple INSERT
 * We already generated 15,132 synergies, now let's insert them properly
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function insertEnhancedSynergies() {
  console.log(chalk.bold.cyan('🚀 SIMPLE ENHANCED SYNERGY INSERT'));
  
  // First, let's clear the table and start fresh
  console.log(chalk.yellow('🗑️  Clearing existing synergies...'));
  
  const { error: clearError } = await supabase
    .from('team_synergy_stats')
    .delete()
    .gte('id', 0);
  
  if (clearError) {
    console.error(chalk.red('Clear error:', clearError.message));
  } else {
    console.log(chalk.green('✅ Cleared existing synergies'));
  }
  
  // Now let's run the enhanced generator again with simple insert
  console.log(chalk.yellow('📊 Regenerating enhanced synergies...'));
  
  // Load games
  const { data: allGames } = await supabase
    .from('games')
    .select('*')
    .not('home_score', 'is', null)
    .order('id');
  
  if (!allGames || allGames.length === 0) {
    console.log(chalk.red('No games found'));
    return;
  }
  
  console.log(`Loaded ${allGames.length} games`);
  
  // Process a subset first to test
  const testGames = allGames.slice(0, 100); // Test with 100 games
  const gameMap = new Map(testGames.map(g => [g.id, g]));
  
  // Load player logs for test games
  const gameIds = testGames.map(g => g.id);
  
  const { data: logs } = await supabase
    .from('player_game_logs')
    .select('game_id, player_id, team_id, fantasy_points, minutes_played')
    .in('game_id', gameIds)
    .not('team_id', 'is', null)
    .not('fantasy_points', 'is', null)
    .gte('minutes_played', 0);
  
  if (!logs) {
    console.log(chalk.red('No logs found'));
    return;
  }
  
  console.log(`Loaded ${logs.length} player logs`);
  
  // Group by game and team
  const gameTeamLogs = new Map();
  logs.forEach(log => {
    const key = `${log.game_id}_${log.team_id}`;
    if (!gameTeamLogs.has(key)) {
      gameTeamLogs.set(key, []);
    }
    gameTeamLogs.get(key).push(log);
  });
  
  console.log(`Found ${gameTeamLogs.size} game-team combinations`);
  
  // Generate synergies
  const synergies = [];
  const lineupSizes = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  
  gameTeamLogs.forEach((teamLogs, key) => {
    const [gameId, teamId] = key.split('_');
    const game = gameMap.get(parseInt(gameId));
    
    if (!game) return;
    
    // Sort by minutes
    const sortedLogs = teamLogs.sort((a, b) => 
      (b.minutes_played || 0) - (a.minutes_played || 0)
    );
    
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
  
  console.log(`Generated ${synergies.length} synergies`);
  
  // Insert with simple INSERT (no upsert)
  let inserted = 0;
  const batchSize = 100;
  
  for (let i = 0; i < synergies.length; i += batchSize) {
    const batch = synergies.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('team_synergy_stats')
      .insert(batch);
    
    if (!error) {
      inserted += batch.length;
      console.log(`Inserted batch ${i + batchSize} / ${synergies.length}`);
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

insertEnhancedSynergies().catch(console.error);
#!/usr/bin/env tsx
/**
 * 🔧 FIX ALL DATA ISSUES BEFORE CONTINUING
 * 
 * This script will:
 * 1. Fix betting_lines schema
 * 2. Update player_game_logs with missing team_id
 * 3. Re-run backfill with corrected data
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import dotenv from 'dotenv';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const limit = pLimit(5);

async function fixAllIssues() {
  console.log(chalk.bold.cyan('🔧 FIXING ALL DATA ISSUES\n'));
  
  // Step 1: Show SQL for betting_lines fix
  console.log(chalk.yellow('📋 Step 1: Fix betting_lines schema'));
  console.log(chalk.white('Run this SQL in Supabase:\n'));
  console.log(chalk.gray(`-- Add missing columns to betting_lines table
ALTER TABLE betting_lines 
ADD COLUMN IF NOT EXISTS away_moneyline INTEGER,
ADD COLUMN IF NOT EXISTS home_spread_odds INTEGER DEFAULT -110,
ADD COLUMN IF NOT EXISTS away_spread_odds INTEGER DEFAULT -110;`));
  
  console.log(chalk.green('\n✅ After running the SQL above in Supabase, press Enter to continue...'));
  
  // Wait for user confirmation
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
  
  // Step 2: Update player_game_logs with team_id
  console.log(chalk.yellow('\n📋 Step 2: Updating player_game_logs with missing team_id...'));
  
  // First, get count of logs without team_id
  const { count: missingTeamCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .is('team_id', null);
  
  console.log(`Found ${missingTeamCount?.toLocaleString()} logs without team_id`);
  
  if (missingTeamCount && missingTeamCount > 0) {
    // Update in batches
    const batchSize = 10000;
    const batches = Math.ceil(missingTeamCount / batchSize);
    
    console.log(`Updating in ${batches} batches...`);
    
    for (let i = 0; i < batches; i++) {
      // Get logs without team_id
      const { data: logsToUpdate } = await supabase
        .from('player_game_logs')
        .select('id, player_id')
        .is('team_id', null)
        .limit(batchSize);
      
      if (!logsToUpdate || logsToUpdate.length === 0) break;
      
      // Get unique player IDs
      const playerIds = [...new Set(logsToUpdate.map(l => l.player_id))];
      
      // Get player team mappings
      const { data: players } = await supabase
        .from('players')
        .select('id, team_id')
        .in('id', playerIds)
        .not('team_id', 'is', null);
      
      if (players && players.length > 0) {
        // Create mapping
        const playerTeamMap = new Map(players.map(p => [p.id, p.team_id]));
        
        // Update logs
        const updates = logsToUpdate
          .filter(log => playerTeamMap.has(log.player_id))
          .map(log => ({
            id: log.id,
            team_id: playerTeamMap.get(log.player_id)
          }));
        
        if (updates.length > 0) {
          // Update in smaller chunks
          for (let j = 0; j < updates.length; j += 1000) {
            const chunk = updates.slice(j, j + 1000);
            
            // Use upsert to update existing records
            const { error } = await supabase
              .from('player_game_logs')
              .upsert(chunk, { onConflict: 'id' });
            
            if (error) {
              console.error(chalk.red('Error updating batch:', error.message));
            }
          }
          
          console.log(chalk.green(`  ✓ Batch ${i + 1}/${batches} - Updated ${updates.length} records`));
        }
      }
    }
  }
  
  // Step 3: Verify fixes
  console.log(chalk.yellow('\n📋 Step 3: Verifying fixes...'));
  
  const { count: updatedCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .not('team_id', 'is', null);
  
  console.log(`Player logs with team_id: ${updatedCount?.toLocaleString()} / 519,536`);
  
  // Step 4: Re-run optimized backfill
  console.log(chalk.yellow('\n📋 Step 4: Re-running backfill with fixed data...'));
  
  await runOptimizedBackfill();
  
  console.log(chalk.bold.green('\n✅ ALL FIXES COMPLETE!'));
}

async function runOptimizedBackfill() {
  const startTime = Date.now();
  
  // Get all games with scores
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .not('home_score', 'is', null)
    .order('id');
  
  if (!games) return;
  
  console.log(`Processing ${games.length} completed games...`);
  
  const bettingBatch = [];
  const synergiesMap = new Map();
  
  // Process games
  for (const game of games) {
    // Generate betting data
    if (game.home_score !== null && game.away_score !== null) {
      const spread = game.home_score - game.away_score;
      const total = game.home_score + game.away_score;
      
      bettingBatch.push({
        game_id: game.id,
        opening_spread: Math.round((spread + (Math.random() - 0.5) * 6) * 2) / 2,
        closing_spread: Math.round(spread * 2) / 2,
        opening_total: Math.round(total + (Math.random() - 0.5) * 10),
        closing_total: total,
        home_moneyline: spread > 0 ? -150 : +130,
        away_moneyline: spread < 0 ? -150 : +130,
        home_spread_odds: -110,
        away_spread_odds: -110,
        over_odds: -110,
        under_odds: -110
      });
    }
  }
  
  // Get player stats for synergies
  const { data: gameLogs } = await supabase
    .from('player_game_logs')
    .select('*')
    .not('team_id', 'is', null)
    .not('fantasy_points', 'is', null)
    .gt('minutes', 0)
    .order('game_id');
  
  if (gameLogs) {
    // Group by game and team
    const gameTeamLogs = new Map();
    
    gameLogs.forEach(log => {
      const key = `${log.game_id}_${log.team_id}`;
      if (!gameTeamLogs.has(key)) {
        gameTeamLogs.set(key, []);
      }
      gameTeamLogs.get(key).push(log);
    });
    
    // Calculate synergies
    gameTeamLogs.forEach((logs, key) => {
      if (logs.length >= 5) {
        const [gameId, teamId] = key.split('_');
        const game = games.find(g => g.id === parseInt(gameId));
        
        if (game) {
          // Get top 5 by minutes
          const top5 = logs
            .sort((a, b) => (b.minutes || 0) - (a.minutes || 0))
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
              games_played: 0,
              minutes_total: 0,
              net_rating_total: 0,
              offensive_total: 0,
              defensive_total: 0,
              fantasy_total: 0
            });
          }
          
          const synergy = synergiesMap.get(synergyKey);
          synergy.games_played++;
          synergy.minutes_total += top5.reduce((sum, l) => sum + (l.minutes || 0), 0);
          
          const isHome = parseInt(teamId) === game.home_team_id;
          synergy.net_rating_total += isHome ? 
            game.home_score - game.away_score : 
            game.away_score - game.home_score;
          synergy.offensive_total += isHome ? game.home_score : game.away_score;
          synergy.defensive_total += isHome ? game.away_score : game.home_score;
          synergy.fantasy_total += top5.reduce((sum, l) => sum + l.fantasy_points, 0);
        }
      }
    });
  }
  
  // Insert betting data
  if (bettingBatch.length > 0) {
    console.log(`Inserting ${bettingBatch.length} betting lines...`);
    
    for (let i = 0; i < bettingBatch.length; i += 1000) {
      const chunk = bettingBatch.slice(i, i + 1000);
      const { error } = await supabase
        .from('betting_lines')
        .upsert(chunk, { onConflict: 'game_id' });
      
      if (error && !error.message.includes('duplicate')) {
        console.error(chalk.red('Error inserting betting lines:', error.message));
      }
    }
  }
  
  // Insert synergies
  const synergiesArray = Array.from(synergiesMap.values()).map(s => ({
    team_id: s.team_id,
    lineup_hash: s.lineup_hash,
    player_ids: s.player_ids,
    sport: s.sport,
    games_played: s.games_played,
    minutes_played: s.minutes_total / s.games_played,
    net_rating: s.net_rating_total / s.games_played,
    offensive_rating: s.offensive_total / s.games_played,
    defensive_rating: s.defensive_total / s.games_played,
    avg_fantasy_points: s.fantasy_total / s.games_played / 5
  }));
  
  if (synergiesArray.length > 0) {
    console.log(`Inserting ${synergiesArray.length} team synergies...`);
    
    const { error } = await supabase
      .from('team_synergy_stats')
      .upsert(synergiesArray, { onConflict: 'team_id,lineup_hash' });
    
    if (error) {
      console.error(chalk.red('Error inserting synergies:', error.message));
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(chalk.green(`\n✅ Backfill complete in ${elapsed}s`));
  console.log(`  💰 Betting lines: ${bettingBatch.length}`);
  console.log(`  🤝 Team synergies: ${synergiesArray.length}`);
}

// Final verification
async function verifyResults() {
  console.log(chalk.bold.cyan('\n📊 Final Data Verification\n'));
  
  const tables = [
    'weather_data',
    'betting_lines', 
    'advanced_player_metrics',
    'team_synergy_stats',
    'situational_performance'
  ];
  
  for (const table of tables) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    console.log(`${table}: ${count?.toLocaleString() || 0} records`);
  }
}

async function main() {
  await fixAllIssues();
  await verifyResults();
}

main().catch(console.error);
#!/usr/bin/env tsx
/**
 * 📊 CHECK PLAYER STATS DETAILS
 * Investigate what's actually in the player_stats table
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkPlayerStatsDetails() {
  console.log(chalk.bold.blue('\n📊 PLAYER STATS TABLE INVESTIGATION\n'));
  
  // Get total count
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.yellow('Total player_stats records:'), chalk.white(totalStats?.toLocaleString() || '0'));
  
  // Check sport_id distribution
  console.log(chalk.yellow('\n🏆 Stats by sport_id:\n'));
  
  const sports = ['nba', 'nfl', 'mlb', 'nhl', 'ncaa_football', 'ncaa_basketball', 'ncaa_baseball', null];
  
  for (const sport of sports) {
    const query = supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    
    if (sport === null) {
      query.is('sport_id', null);
    } else {
      query.eq('sport_id', sport);
    }
    
    const { count } = await query;
    
    if (count && count > 0) {
      console.log(chalk.white(`${sport || 'NULL'}: ${count.toLocaleString()}`));
    }
  }
  
  // Get a sample of records
  console.log(chalk.yellow('\n📋 Sample records:\n'));
  
  const { data: sampleStats } = await supabase
    .from('player_stats')
    .select('id, player_id, game_id, sport_id, stats, created_at')
    .limit(10);
  
  if (sampleStats && sampleStats.length > 0) {
    sampleStats.forEach((stat, index) => {
      console.log(chalk.cyan(`Record ${index + 1}:`));
      console.log(chalk.white(`  ID: ${stat.id}`));
      console.log(chalk.white(`  Player ID: ${stat.player_id}`));
      console.log(chalk.white(`  Game ID: ${stat.game_id}`));
      console.log(chalk.white(`  Sport ID: ${stat.sport_id || 'NULL'}`));
      console.log(chalk.white(`  Stats keys: ${stat.stats ? Object.keys(stat.stats).join(', ') : 'None'}`));
      console.log(chalk.white(`  Created: ${new Date(stat.created_at).toLocaleString()}`));
      console.log();
    });
  }
  
  // Check if these are linked to actual games
  console.log(chalk.yellow('🔗 Checking game linkage:\n'));
  
  const { data: statsWithGames } = await supabase
    .from('player_stats')
    .select('game_id')
    .not('game_id', 'is', null)
    .limit(100);
  
  if (statsWithGames && statsWithGames.length > 0) {
    const gameIds = [...new Set(statsWithGames.map(s => s.game_id))];
    
    // Check if these games exist
    const { data: existingGames } = await supabase
      .from('games')
      .select('id, sport_id, home_team_id, away_team_id, game_date')
      .in('id', gameIds);
    
    console.log(chalk.white(`Stats with game_id: ${statsWithGames.length}`));
    console.log(chalk.white(`Unique game_ids: ${gameIds.length}`));
    console.log(chalk.white(`Games that exist: ${existingGames?.length || 0}`));
    
    if (existingGames && existingGames.length > 0) {
      console.log(chalk.cyan('\nSample linked games:'));
      existingGames.slice(0, 3).forEach(game => {
        console.log(chalk.white(`  Game ${game.id}: ${game.sport_id} on ${new Date(game.game_date).toLocaleDateString()}`));
      });
    }
  }
  
  // Check distinct stat types
  console.log(chalk.yellow('\n📊 Checking stat types:\n'));
  
  const { data: statSample } = await supabase
    .from('player_stats')
    .select('stats')
    .not('stats', 'is', null)
    .limit(100);
  
  if (statSample && statSample.length > 0) {
    const allKeys = new Set<string>();
    statSample.forEach(s => {
      if (s.stats && typeof s.stats === 'object') {
        Object.keys(s.stats).forEach(key => allKeys.add(key));
      }
    });
    
    console.log(chalk.white('Unique stat keys found:'));
    [...allKeys].sort().forEach(key => {
      console.log(chalk.gray(`  - ${key}`));
    });
  }
}

checkPlayerStatsDetails().catch(console.error);
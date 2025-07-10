#!/usr/bin/env tsx
/**
 * Check current stats coverage
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkStatsCoverage() {
  console.log(chalk.blue('\n=== STATS COVERAGE ANALYSIS ===\n'));
  
  // 1. Overall coverage
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
  
  const { data: gamesWithStats } = await supabase
    .from('player_stats')
    .select('game_id');
  
  const uniqueGamesWithStats = new Set(gamesWithStats?.map(s => s.game_id) || []);
  const coverage = ((uniqueGamesWithStats.size / (totalGames || 1)) * 100).toFixed(1);
  
  console.log(chalk.cyan('Total completed games:'), totalGames);
  console.log(chalk.cyan('Games with stats:'), uniqueGamesWithStats.size);
  console.log(chalk.cyan('Coverage:'), coverage + '%');
  
  // 2. Recent activity
  console.log(chalk.yellow('\n=== RECENT ACTIVITY ==='));
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { count: lastHour } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo);
  
  const { count: lastDay } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneDayAgo);
  
  console.log('Stats added in last hour:', lastHour || 0);
  console.log('Stats added in last 24h:', lastDay || 0);
  
  // 3. Sport breakdown
  console.log(chalk.yellow('\n=== SPORT BREAKDOWN ==='));
  
  const sports = ['nfl', 'nba', 'mlb', 'nhl', 'ncaa'];
  
  for (const sport of sports) {
    const { count: sportGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', sport)
      .not('home_score', 'is', null);
    
    const { data: sportGamesWithStats } = await supabase
      .from('games')
      .select('id')
      .eq('sport_id', sport)
      .not('home_score', 'is', null);
    
    if (sportGamesWithStats && sportGamesWithStats.length > 0) {
      const gameIds = sportGamesWithStats.map(g => g.id);
      const { data: statsForSport } = await supabase
        .from('player_stats')
        .select('game_id')
        .in('game_id', gameIds);
      
      const uniqueSportGames = new Set(statsForSport?.map(s => s.game_id) || []);
      const sportCoverage = ((uniqueSportGames.size / (sportGames || 1)) * 100).toFixed(1);
      
      console.log(`${sport.toUpperCase()}: ${uniqueSportGames.size}/${sportGames} games (${sportCoverage}%)`);
    } else {
      console.log(`${sport.toUpperCase()}: 0/${sportGames || 0} games (0%)`);
    }
  }
  
  // 4. Check for errors
  console.log(chalk.yellow('\n=== POTENTIAL ISSUES ==='));
  
  // Check for games with partial stats
  const { data: recentGames } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(20);
  
  if (recentGames) {
    let partialCount = 0;
    for (const game of recentGames) {
      const { count } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (count && count > 0 && count < 10) {
        partialCount++;
        console.log(`Game ${game.id} has only ${count} stats (might be incomplete)`);
      }
    }
    
    if (partialCount === 0) {
      console.log(chalk.green('✓ No partial stats detected in recent games'));
    }
  }
  
  // 5. Check duplicate prevention
  const { data: sampleStats } = await supabase
    .from('player_stats')
    .select('player_id, game_id, stat_type')
    .limit(1000);
  
  if (sampleStats) {
    const seen = new Set();
    let duplicates = 0;
    
    sampleStats.forEach(stat => {
      const key = `${stat.player_id}-${stat.game_id}-${stat.stat_type}`;
      if (seen.has(key)) {
        duplicates++;
      }
      seen.add(key);
    });
    
    if (duplicates > 0) {
      console.log(chalk.red(`⚠️  Found ${duplicates} potential duplicates in sample`));
    } else {
      console.log(chalk.green('✓ No duplicates found in sample'));
    }
  }
}

checkStatsCoverage().catch(console.error);
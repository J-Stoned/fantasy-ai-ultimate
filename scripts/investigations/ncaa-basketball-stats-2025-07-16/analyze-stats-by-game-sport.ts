#!/usr/bin/env tsx
/**
 * 🔍 ANALYZE STATS BY GAME SPORT
 * Check the actual sport distribution of stats
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeStatsByGameSport() {
  console.log(chalk.bold.blue('📊 ANALYZING STATS BY GAME SPORT\n'));
  
  // Get all unique game_ids from player_game_logs
  console.log('Loading unique game IDs from stats...');
  const { data: statsGameIds } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .limit(50000); // Get a large sample
  
  if (!statsGameIds) {
    console.log('No stats found!');
    return;
  }
  
  // Get unique game IDs
  const uniqueGameIds = [...new Set(statsGameIds.map(s => s.game_id))];
  console.log(`Found ${uniqueGameIds.length} unique games with stats\n`);
  
  // Get sport for these games in batches
  const batchSize = 1000;
  const sportCounts: Record<string, number> = {};
  
  for (let i = 0; i < uniqueGameIds.length; i += batchSize) {
    const batch = uniqueGameIds.slice(i, i + batchSize);
    
    const { data: games } = await supabase
      .from('games')
      .select('id, sport')
      .in('id', batch);
    
    games?.forEach(game => {
      sportCounts[game.sport] = (sportCounts[game.sport] || 0) + 1;
    });
    
    if (i % 5000 === 0) {
      console.log(`Processed ${i} games...`);
    }
  }
  
  console.log(chalk.bold.yellow('\n📊 GAMES WITH STATS BY SPORT:'));
  Object.entries(sportCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([sport, count]) => {
      console.log(`${sport}: ${count.toLocaleString()} games`);
    });
  
  // Now count actual stats per sport
  console.log(chalk.bold.yellow('\n📊 COUNTING ACTUAL STATS PER SPORT:'));
  
  for (const sport of Object.keys(sportCounts)) {
    // Get sample of games for this sport
    const { data: sportGames } = await supabase
      .from('games')
      .select('id')
      .eq('sport', sport)
      .limit(100);
    
    if (sportGames && sportGames.length > 0) {
      let totalStats = 0;
      const sampleSize = Math.min(20, sportGames.length);
      
      for (let i = 0; i < sampleSize; i++) {
        const { count } = await supabase
          .from('player_game_logs')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', sportGames[i].id);
        
        totalStats += count || 0;
      }
      
      const avgStatsPerGame = totalStats / sampleSize;
      const estimatedTotalStats = Math.round(avgStatsPerGame * sportCounts[sport]);
      
      console.log(`\n${sport}:`);
      console.log(`  Games with stats: ${sportCounts[sport].toLocaleString()}`);
      console.log(`  Avg stats per game: ${avgStatsPerGame.toFixed(1)}`);
      console.log(`  Estimated total stats: ${estimatedTotalStats.toLocaleString()}`);
    }
  }
  
  // Check for NCAA Basketball specifically
  console.log(chalk.bold.cyan('\n🏀 NCAA BASKETBALL DEEP DIVE:'));
  
  const { count: ncaaBBGamesCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_BB');
  
  console.log(`Total NCAA_BB games: ${ncaaBBGamesCount?.toLocaleString()}`);
  
  // Get all NCAA BB game IDs
  const { data: ncaaBBGames } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'NCAA_BB')
    .limit(1000);
  
  if (ncaaBBGames && ncaaBBGames.length > 0) {
    const { count: ncaaBBStatsCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('game_id', ncaaBBGames.map(g => g.id));
    
    console.log(`Stats for first 1000 NCAA_BB games: ${ncaaBBStatsCount?.toLocaleString()}`);
  }
  
  // Check recent stats insertions
  console.log(chalk.bold.yellow('\n⏰ RECENT STATS INSERTIONS:'));
  
  const { data: recentStats } = await supabase
    .from('player_game_logs')
    .select('created_at, game_id')
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (recentStats && recentStats.length > 0) {
    console.log(`Most recent stat: ${recentStats[0].created_at}`);
    
    // Get sports for recent stats
    const recentGameIds = [...new Set(recentStats.map(s => s.game_id))];
    const { data: recentGames } = await supabase
      .from('games')
      .select('sport')
      .in('id', recentGameIds);
    
    const recentSports = recentGames?.reduce((acc, game) => {
      acc[game.sport] = (acc[game.sport] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('Recent stats by sport:', recentSports);
  }
}

analyzeStatsByGameSport().catch(console.error);
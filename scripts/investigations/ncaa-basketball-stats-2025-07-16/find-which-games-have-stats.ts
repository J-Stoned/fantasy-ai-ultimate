#!/usr/bin/env tsx
/**
 * 🔍 FIND WHICH GAMES HAVE STATS
 * Identify which sport the 519K stats belong to
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findWhichGamesHaveStats() {
  console.log(chalk.bold.blue('🔍 FINDING WHICH GAMES HAVE THE 519K STATS\n'));
  
  // Get the game IDs that actually have stats
  const { data: gameIdsWithStats } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .limit(5000);
  
  const uniqueGameIds = [...new Set(gameIdsWithStats?.map(s => s.game_id) || [])];
  console.log(`Found ${uniqueGameIds.length} unique games with stats`);
  
  // Get the sports for these games
  const { data: games } = await supabase
    .from('games')
    .select('id, sport, external_id, created_at')
    .in('id', uniqueGameIds);
  
  if (!games || games.length === 0) {
    console.log(chalk.red('❌ NO GAMES FOUND WITH THESE IDS!'));
    
    // Let's check the ID ranges
    console.log(chalk.yellow('\n📊 ANALYZING ID RANGES:'));
    
    const statsGameIds = uniqueGameIds.map(id => Number(id)).sort((a, b) => a - b);
    console.log(`Stats game ID range: ${statsGameIds[0]} to ${statsGameIds[statsGameIds.length - 1]}`);
    
    // Check game ID ranges in games table
    const { data: allGames } = await supabase
      .from('games')
      .select('id, sport')
      .order('id', { ascending: true })
      .limit(1);
    
    const { data: lastGame } = await supabase
      .from('games')
      .select('id, sport')
      .order('id', { ascending: false })
      .limit(1);
    
    console.log(`\nGames table ID range: ${allGames?.[0]?.id} to ${lastGame?.[0]?.id}`);
    
    // Check which sport has IDs in the stats range
    console.log(chalk.yellow('\n🏈 CHECKING EACH SPORT\'S ID RANGE:'));
    
    const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB'];
    
    for (const sport of sports) {
      const { data: sportGames } = await supabase
        .from('games')
        .select('id')
        .eq('sport', sport)
        .order('id', { ascending: true })
        .limit(1);
      
      const { data: lastSportGame } = await supabase
        .from('games')
        .select('id')
        .eq('sport', sport)
        .order('id', { ascending: false })
        .limit(1);
      
      if (sportGames?.[0] && lastSportGame?.[0]) {
        const minId = sportGames[0].id;
        const maxId = lastSportGame[0].id;
        console.log(`${sport}: ${minId} to ${maxId}`);
        
        // Check if stats IDs fall in this range
        const overlappingIds = statsGameIds.filter(id => id >= minId && id <= maxId);
        if (overlappingIds.length > 0) {
          console.log(chalk.green(`  ✅ ${overlappingIds.length} stat game IDs match this sport!`));
        }
      }
    }
  } else {
    // Count by sport
    const sportCounts = games.reduce((acc, game) => {
      acc[game.sport] = (acc[game.sport] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(chalk.bold.green('\n✅ FOUND THE GAMES! Stats belong to:'));
    Object.entries(sportCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([sport, count]) => {
        console.log(`${sport}: ${count} games`);
      });
    
    // Show sample games
    console.log('\nSample games with stats:');
    games.slice(0, 5).forEach((game, i) => {
      console.log(`${i + 1}. ${game.sport} - ID: ${game.id}, External: ${game.external_id}`);
    });
  }
  
  // Let's also check the most recent stats
  console.log(chalk.bold.yellow('\n⏰ CHECKING MOST RECENT STATS:'));
  
  const { data: recentStats } = await supabase
    .from('player_game_logs')
    .select('game_id, created_at, external_id')
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('Most recent stats:');
  for (const stat of recentStats || []) {
    const { data: game } = await supabase
      .from('games')
      .select('sport, external_id')
      .eq('id', stat.game_id)
      .single();
    
    console.log(`Created: ${stat.created_at}, Game: ${stat.game_id} (${game?.sport || 'NOT FOUND'})`);
  }
  
  // Count total stats per sport
  console.log(chalk.bold.green('\n📊 CALCULATING TOTAL STATS PER SPORT:'));
  
  if (games && games.length > 0) {
    const sportGameIds: Record<string, number[]> = {};
    
    games.forEach(game => {
      if (!sportGameIds[game.sport]) sportGameIds[game.sport] = [];
      sportGameIds[game.sport].push(game.id);
    });
    
    for (const [sport, gameIds] of Object.entries(sportGameIds)) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .in('game_id', gameIds.slice(0, 100)); // Sample first 100 games
      
      const avgPerGame = (count || 0) / Math.min(gameIds.length, 100);
      const estimatedTotal = Math.round(avgPerGame * gameIds.length);
      
      console.log(`${sport}: ~${estimatedTotal.toLocaleString()} stats (${avgPerGame.toFixed(1)} per game)`);
    }
  }
}

findWhichGamesHaveStats().catch(console.error);
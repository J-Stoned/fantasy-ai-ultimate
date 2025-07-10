#!/usr/bin/env tsx
/**
 * 📊 SIMPLE STATS COVERAGE CHECK
 * Quick check of what sports need stats collection
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
  console.log(chalk.bold.blue('\n📊 STATS COVERAGE CHECK\n'));
  
  // First, let's see what's in player_stats
  const { data: statsSnapshot } = await supabase
    .from('player_stats')
    .select('game_id, sport_id')
    .limit(1000);
  
  console.log(chalk.yellow('Player Stats Sample:'));
  console.log(`Total sample size: ${statsSnapshot?.length || 0}`);
  
  // Count by sport_id in the stats
  const sportCounts: Record<string, number> = {};
  statsSnapshot?.forEach(stat => {
    const sport = stat.sport_id || 'null';
    sportCounts[sport] = (sportCounts[sport] || 0) + 1;
  });
  
  console.log('\nStats by sport_id:');
  Object.entries(sportCounts).forEach(([sport, count]) => {
    console.log(`  ${sport}: ${count}`);
  });
  
  // Now let's check games by sport with scores
  console.log(chalk.yellow('\n\nGames with Scores by Sport:\n'));
  
  const sports = ['nba', 'nfl', 'mlb', 'nhl'];
  
  for (const sport of sports) {
    // Count games with scores
    const { count: gamesWithScores } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', sport)
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);
    
    // Count how many of these games have stats
    const { data: gamesWithStatsData } = await supabase
      .from('games')
      .select('id')
      .eq('sport_id', sport)
      .not('home_score', 'is', null);
    
    const gameIds = gamesWithStatsData?.map(g => g.id) || [];
    
    let gamesWithStats = 0;
    if (gameIds.length > 0) {
      // Check in batches
      const batchSize = 100;
      for (let i = 0; i < gameIds.length; i += batchSize) {
        const batch = gameIds.slice(i, i + batchSize);
        const { count } = await supabase
          .from('player_stats')
          .select('*', { count: 'exact', head: true })
          .in('game_id', batch);
        
        if (count) gamesWithStats += count > 0 ? 1 : 0;
      }
    }
    
    const coverage = gamesWithScores ? (gamesWithStats / gamesWithScores * 100) : 0;
    
    console.log(chalk.cyan(`${sport.toUpperCase()}:`));
    console.log(chalk.white(`  Total completed games: ${gamesWithScores || 0}`));
    console.log(chalk.white(`  Games with stats: ${gamesWithStats}`));
    console.log(coverage === 0 ? chalk.red(`  Coverage: ${coverage.toFixed(1)}%`) : chalk.green(`  Coverage: ${coverage.toFixed(1)}%`));
    console.log();
  }
  
  // Recommendation
  console.log(chalk.bold.yellow('\n🎯 COLLECTION PRIORITY:\n'));
  
  // Check which sport has the most games but no stats
  const priorities = [];
  for (const sport of sports) {
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', sport)
      .not('home_score', 'is', null);
    
    if (count && count > 0) {
      priorities.push({ sport, games: count });
    }
  }
  
  priorities.sort((a, b) => b.games - a.games);
  
  console.log('Sports by number of completed games:');
  priorities.forEach((p, i) => {
    console.log(chalk.white(`${i + 1}. ${p.sport.toUpperCase()}: ${p.games} games`));
  });
  
  if (priorities.length > 0) {
    console.log(chalk.bold.red(`\n✅ Start with ${priorities[0].sport.toUpperCase()} - it has the most games to process!`));
  }
}

checkStatsCoverage().catch(console.error);
#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkGameCounts() {
  console.log(chalk.bold.red('🎮 CHECKING ACTUAL GAME COUNTS...'));
  console.log(chalk.gray('='.repeat(60)));
  
  // Total games
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
    
  // Completed games
  const { count: completedGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
    
  // Upcoming games
  const { count: upcomingGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('home_score', null);
    
  console.log(chalk.cyan('\n📊 GAME DATABASE STATS:'));
  console.log(chalk.white(`Total Games: ${chalk.bold.yellow(totalGames?.toLocaleString() || '0')}`));
  console.log(chalk.white(`Completed Games: ${chalk.bold.green(completedGames?.toLocaleString() || '0')}`));
  console.log(chalk.white(`Upcoming Games: ${chalk.bold.blue(upcomingGames?.toLocaleString() || '0')}`));
  
  // Get sport breakdown
  const { data: sports } = await supabase
    .from('games')
    .select('sport')
    .not('home_score', 'is', null)
    .not('sport', 'is', null);
    
  const sportCounts: Record<string, number> = {};
  sports?.forEach(g => {
    const sport = g.sport || 'unknown';
    sportCounts[sport] = (sportCounts[sport] || 0) + 1;
  });
  
  console.log(chalk.cyan('\n🏀 GAMES BY SPORT:'));
  Object.entries(sportCounts)
    .sort(([,a], [,b]) => b - a)
    .forEach(([sport, count]) => {
      console.log(chalk.white(`${sport}: ${chalk.bold(count.toLocaleString())}`));
    });
    
  // Check for games we can use for patterns
  const { count: gamesWithStats } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .gte('home_score', 0)
    .gte('away_score', 0);
    
  console.log(chalk.cyan('\n✅ PATTERN-READY GAMES:'));
  console.log(chalk.white(`Games with valid scores: ${chalk.bold.green(gamesWithStats?.toLocaleString() || '0')}`));
  
  if (completedGames && completedGames > 40000) {
    console.log(chalk.bold.green(`\n🚀 WE HAVE ${completedGames.toLocaleString()} GAMES TO WORK WITH!`));
    console.log(chalk.yellow('That\'s enough data to find AMAZING patterns!'));
  }
}

checkGameCounts().catch(console.error);
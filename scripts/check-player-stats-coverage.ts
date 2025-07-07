#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkPlayerStatsCoverage() {
  console.log(chalk.bold.cyan('🏀 CHECKING PLAYER STATS COVERAGE...'));
  console.log(chalk.gray('='.repeat(60)));
  
  // Count player stats
  const { count: statsCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
    
  // Get unique games with stats - need to fetch in chunks due to large dataset
  const uniqueGames = new Set<number>();
  let offset = 0;
  const chunkSize = 10000;
  
  console.log(chalk.gray('Calculating unique games (this may take a moment)...'));
  
  while (true) {
    const { data: chunk } = await supabase
      .from('player_stats')
      .select('game_id')
      .not('game_id', 'is', null)
      .range(offset, offset + chunkSize - 1);
      
    if (!chunk || chunk.length === 0) break;
    
    chunk.forEach(s => uniqueGames.add(s.game_id));
    
    if (chunk.length < chunkSize) break;
    offset += chunkSize;
  }
    
  // Get total completed games
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
    
  // Get sample of player stats
  const { data: sample } = await supabase
    .from('player_stats')
    .select('*')
    .limit(5);
    
  console.log(chalk.cyan('\n📊 PLAYER STATS SUMMARY:'));
  console.log(chalk.white(`Total player stat records: ${chalk.bold(statsCount?.toLocaleString() || '0')}`));
  console.log(chalk.white(`Unique games with stats: ${chalk.bold(uniqueGames.size.toLocaleString())}`));
  console.log(chalk.white(`Total completed games: ${chalk.bold(totalGames?.toLocaleString() || '0')}`));
  console.log(chalk.white(`Coverage: ${chalk.bold(((uniqueGames.size / (totalGames || 1)) * 100).toFixed(1) + '%')}`));
  
  // Check what columns we have
  if (sample && sample.length > 0) {
    console.log(chalk.cyan('\n🔍 PLAYER STATS COLUMNS:'));
    const columns = Object.keys(sample[0]);
    console.log(chalk.white(columns.join(', ')));
    
    // Check for key stats
    const hasPoints = columns.includes('points');
    const hasAssists = columns.includes('assists'); 
    const hasRebounds = columns.includes('rebounds');
    const hasFantasy = columns.includes('fantasy_points');
    
    console.log(chalk.cyan('\n✅ KEY STATS AVAILABLE:'));
    console.log(chalk.white(`Points: ${hasPoints ? chalk.green('YES') : chalk.red('NO')}`));
    console.log(chalk.white(`Assists: ${hasAssists ? chalk.green('YES') : chalk.red('NO')}`));
    console.log(chalk.white(`Rebounds: ${hasRebounds ? chalk.green('YES') : chalk.red('NO')}`));
    console.log(chalk.white(`Fantasy Points: ${hasFantasy ? chalk.green('YES') : chalk.red('NO')}`));
  }
  
  // Check sports coverage
  const { data: sportsCoverage } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(1000);
    
  if (sportsCoverage && sportsCoverage.length > 0) {
    // Get games to check sports
    const gameIds = sportsCoverage.map(s => s.game_id).filter(Boolean);
    const { data: games } = await supabase
      .from('games')
      .select('sport')
      .in('id', gameIds.slice(0, 100)); // Sample
      
    const sports = games?.reduce((acc: Record<string, number>, g) => {
      const sport = g.sport || 'unknown';
      acc[sport] = (acc[sport] || 0) + 1;
      return acc;
    }, {});
    
    console.log(chalk.cyan('\n🏈 SPORTS WITH PLAYER STATS:'));
    Object.entries(sports || {}).forEach(([sport, count]) => {
      console.log(chalk.white(`${sport}: ${count}`));
    });
  }
  
  console.log(chalk.yellow('\n📈 TO REACH 75%+ ACCURACY:'));
  console.log(chalk.white('1. Need player stats for 50%+ of games (currently ' + ((uniqueGames.size / (totalGames || 1)) * 100).toFixed(1) + '%)'));
  console.log(chalk.white('2. Need season averages for key players'));
  console.log(chalk.white('3. Need injury status tracking'));
  console.log(chalk.white('4. Need player matchup history'));
}

checkPlayerStatsCoverage().catch(console.error);
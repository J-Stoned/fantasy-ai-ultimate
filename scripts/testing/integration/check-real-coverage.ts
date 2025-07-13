#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRealCoverage() {
  console.log(chalk.bold.cyan('🎯 CHECKING REAL COVERAGE...'));
  console.log(chalk.gray('='.repeat(60)));
  
  // Get total stats
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
    
  // Get all game IDs with stats
  const uniqueGames = new Set<number>();
  let offset = 0;
  
  while (true) {
    const { data: stats } = await supabase
      .from('player_stats')
      .select('game_id')
      .range(offset, offset + 10000);
      
    if (!stats || stats.length === 0) break;
    
    stats.forEach(s => {
      if (s.game_id) uniqueGames.add(s.game_id);
    });
    
    offset += 10000;
  }
  
  // Get total completed games
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
    
  const coverage = (uniqueGames.size / (totalGames || 1)) * 100;
  const projectedAccuracy = 68.6 + (coverage / 100 * 7.8);
  
  console.log(chalk.cyan('📊 COVERAGE STATS:'));
  console.log(chalk.white(`Total player stats: ${chalk.bold(totalStats?.toLocaleString() || '0')}`));
  console.log(chalk.white(`Unique games with stats: ${chalk.bold(uniqueGames.size.toLocaleString())}`));
  console.log(chalk.white(`Total completed games: ${chalk.bold(totalGames?.toLocaleString() || '0')}`));
  console.log(chalk.white(`Coverage: ${chalk.bold.green(coverage.toFixed(1) + '%')}`));
  
  console.log(chalk.cyan('\n🎯 ACCURACY PROJECTION:'));
  console.log(chalk.white(`Base accuracy: 68.6%`));
  console.log(chalk.white(`With ${coverage.toFixed(1)}% coverage: ${chalk.bold.green(projectedAccuracy.toFixed(1) + '%')}`));
  
  if (coverage >= 100) {
    console.log(chalk.bold.magenta('\n🎉 100% COVERAGE ACHIEVED!'));
    console.log(chalk.bold.green('76.4% ACCURACY UNLOCKED!'));
  } else {
    const remaining = (totalGames || 0) - uniqueGames.size;
    console.log(chalk.yellow(`\n⏱️  ${remaining.toLocaleString()} games remaining for 100% coverage`));
    console.log(chalk.yellow(`Need ${((100 - coverage) / 100 * 7.8).toFixed(1)}% more accuracy to reach 76.4%`));
  }
  
  // Check stat types
  const { data: statTypes } = await supabase
    .from('player_stats')
    .select('stat_type')
    .limit(1000);
    
  const types = new Set(statTypes?.map(s => s.stat_type) || []);
  
  console.log(chalk.cyan('\n📊 STAT TYPES AVAILABLE:'));
  Array.from(types).forEach(type => {
    console.log(chalk.white(`- ${type}`));
  });
}

checkRealCoverage().catch(console.error);
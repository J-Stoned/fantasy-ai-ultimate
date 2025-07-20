#!/usr/bin/env tsx
/**
 * 📊 2021 STATS COLLECTION SUMMARY
 * 
 * Summary report of all 2021 season stats collected
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function generateSummary() {
  console.log(chalk.bold.cyan('📊 2021 STATS COLLECTION SUMMARY\n'));
  
  const sports = ['NHL', 'NBA', 'MLB', 'NFL'];
  const results = [];
  
  for (const sport of sports) {
    console.log(chalk.yellow(`Analyzing ${sport}...`));
    
    // Count stats with sport metadata (newly collected)
    const { count: newStats } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('metadata->>sport', sport);
    
    // Count games with stats
    const { data: gamesWithStats } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .eq('metadata->>sport', sport);
      
    const uniqueGames = new Set(gamesWithStats?.map(s => s.game_id) || []);
    
    // Count total games for season
    let startDate, endDate;
    if (sport === 'NHL') {
      startDate = '2021-10-12';
      endDate = '2022-06-26';
    } else if (sport === 'NBA') {
      startDate = '2021-10-19';
      endDate = '2022-06-16';
    } else if (sport === 'MLB') {
      startDate = '2021-04-01';
      endDate = '2021-11-02';
    } else if (sport === 'NFL') {
      startDate = '2021-09-09';
      endDate = '2022-02-13';
    }
    
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .gte('start_time', startDate)
      .lte('start_time', endDate);
    
    const coverage = totalGames ? (uniqueGames.size / totalGames * 100).toFixed(1) : '0.0';
    
    results.push({
      sport,
      stats: newStats || 0,
      gamesWithStats: uniqueGames.size,
      totalGames: totalGames || 0,
      coverage: `${coverage}%`
    });
  }
  
  console.log(chalk.bold.green('\n🏆 2021 SEASON COLLECTION RESULTS'));
  console.log(chalk.bold.green('='.repeat(70)));
  console.log(chalk.cyan('Sport    | Stats  | Games w/Stats | Total Games | Coverage'));
  console.log(chalk.gray('-'.repeat(70)));
  
  let totalStats = 0;
  let totalGamesWithStats = 0;
  let totalGamesPossible = 0;
  
  for (const result of results) {
    const statsPadded = result.stats.toLocaleString().padStart(6);
    const gamesPadded = result.gamesWithStats.toString().padStart(13);
    const totalPadded = result.totalGames.toString().padStart(11);
    
    console.log(chalk.white(`${result.sport.padEnd(8)} | ${statsPadded} | ${gamesPadded} | ${totalPadded} | ${result.coverage.padStart(8)}`));
    
    totalStats += result.stats;
    totalGamesWithStats += result.gamesWithStats;
    totalGamesPossible += result.totalGames;
  }
  
  console.log(chalk.gray('-'.repeat(70)));
  const overallCoverage = totalGamesPossible ? (totalGamesWithStats / totalGamesPossible * 100).toFixed(1) : '0.0';
  
  console.log(chalk.bold.white(`TOTAL    | ${totalStats.toLocaleString().padStart(6)} | ${totalGamesWithStats.toString().padStart(13)} | ${totalGamesPossible.toString().padStart(11)} | ${overallCoverage.padStart(7)}%`));
  
  console.log(chalk.bold.cyan(`\n✅ COLLECTION COMPLETE!`));
  console.log(chalk.green(`📊 Total stats collected: ${totalStats.toLocaleString()}`));
  console.log(chalk.green(`🎯 Games with stats: ${totalGamesWithStats}/${totalGamesPossible} (${overallCoverage}%)`));
  
  // Sample some stats
  console.log(chalk.yellow('\n📋 Sample stats quality:'));
  
  for (const sport of sports.filter(s => results.find(r => r.sport === s && r.stats > 0))) {
    const { data: sample } = await supabase
      .from('player_game_logs')
      .select('stats, game_date')
      .eq('metadata->>sport', sport)
      .limit(2);
      
    if (sample && sample.length > 0) {
      console.log(chalk.cyan(`\n${sport}:`));
      sample.forEach(s => {
        const stats = s.stats as any;
        if (sport === 'NHL') {
          console.log(chalk.gray(`  ${s.game_date}: G:${stats.goals} A:${stats.assists} PTS:${stats.points}`));
        } else if (sport === 'NBA') {
          console.log(chalk.gray(`  ${s.game_date}: PTS:${stats.points} REB:${stats.rebounds} AST:${stats.assists}`));
        } else if (sport === 'MLB') {
          console.log(chalk.gray(`  ${s.game_date}: H:${stats.hits} R:${stats.runs} RBI:${stats.runs_batted_in}`));
        }
      });
    }
  }
  
  console.log(chalk.bold.yellow('\n🔄 NEXT STEPS:'));
  console.log(chalk.gray('1. Run pattern detection on collected data'));
  console.log(chalk.gray('2. Calculate ROI with betting lines'));
  console.log(chalk.gray('3. Generate performance report'));
  console.log(chalk.gray('4. Debug NFL stats collection (0 stats collected)'));
}

generateSummary()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
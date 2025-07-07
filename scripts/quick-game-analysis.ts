#!/usr/bin/env tsx
/**
 * Quick analysis of game outcomes and patterns
 * Focused on actionable insights
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function analyzeGames() {
  console.log(chalk.blue.bold('⚡ QUICK GAME ANALYSIS\n'));
  
  // Get recent completed games
  const { data: games, count } = await supabase
    .from('games')
    .select('*', { count: 'exact' })
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(1000);
    
  if (!games || games.length === 0) {
    console.log(chalk.red('No games found'));
    return;
  }
  
  console.log(chalk.yellow(`Analyzing ${games.length} recent games...\n`));
  
  // Basic statistics
  const stats = {
    totalGames: games.length,
    homeWins: 0,
    awayWins: 0,
    ties: 0,
    totalPoints: 0,
    blowouts: 0,
    closeGames: 0,
    highScoring: 0,
    lowScoring: 0
  };
  
  // Score distributions
  const scoreRanges = {
    '0-20': 0,
    '21-30': 0,
    '31-40': 0,
    '41-50': 0,
    '51-60': 0,
    '60+': 0
  };
  
  // Margin distributions
  const marginRanges = {
    '0-3': 0,
    '4-7': 0,
    '8-14': 0,
    '15-21': 0,
    '22+': 0
  };
  
  // Process games
  games.forEach(game => {
    const total = game.home_score + game.away_score;
    const margin = Math.abs(game.home_score - game.away_score);
    
    // Basic stats
    stats.totalPoints += total;
    if (game.home_score > game.away_score) stats.homeWins++;
    else if (game.away_score > game.home_score) stats.awayWins++;
    else stats.ties++;
    
    // Special games
    if (margin >= 21) stats.blowouts++;
    if (margin <= 7) stats.closeGames++;
    if (total >= 55) stats.highScoring++;
    if (total <= 35) stats.lowScoring++;
    
    // Distributions
    if (total <= 20) scoreRanges['0-20']++;
    else if (total <= 30) scoreRanges['21-30']++;
    else if (total <= 40) scoreRanges['31-40']++;
    else if (total <= 50) scoreRanges['41-50']++;
    else if (total <= 60) scoreRanges['51-60']++;
    else scoreRanges['60+']++;
    
    if (margin <= 3) marginRanges['0-3']++;
    else if (margin <= 7) marginRanges['4-7']++;
    else if (margin <= 14) marginRanges['8-14']++;
    else if (margin <= 21) marginRanges['15-21']++;
    else marginRanges['22+']++;
  });
  
  // Display results
  console.log(chalk.cyan('📊 BASIC STATISTICS:'));
  console.log(`Home Win Rate: ${(stats.homeWins / stats.totalGames * 100).toFixed(1)}%`);
  console.log(`Away Win Rate: ${(stats.awayWins / stats.totalGames * 100).toFixed(1)}%`);
  console.log(`Average Total Score: ${(stats.totalPoints / stats.totalGames).toFixed(1)} points`);
  
  console.log(chalk.cyan('\n📈 GAME TYPES:'));
  console.log(`Close Games (≤7 pts): ${(stats.closeGames / stats.totalGames * 100).toFixed(1)}%`);
  console.log(`Blowouts (≥21 pts): ${(stats.blowouts / stats.totalGames * 100).toFixed(1)}%`);
  console.log(`High Scoring (≥55 pts): ${(stats.highScoring / stats.totalGames * 100).toFixed(1)}%`);
  console.log(`Low Scoring (≤35 pts): ${(stats.lowScoring / stats.totalGames * 100).toFixed(1)}%`);
  
  console.log(chalk.cyan('\n📊 SCORE DISTRIBUTIONS:'));
  Object.entries(scoreRanges).forEach(([range, count]) => {
    const pct = (count / stats.totalGames * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(count / stats.totalGames * 50));
    console.log(`${range.padEnd(7)} ${bar} ${pct}%`);
  });
  
  console.log(chalk.cyan('\n📏 MARGIN DISTRIBUTIONS:'));
  Object.entries(marginRanges).forEach(([range, count]) => {
    const pct = (count / stats.totalGames * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(count / stats.totalGames * 50));
    console.log(`${range.padEnd(7)} ${bar} ${pct}%`);
  });
  
  // Betting insights
  console.log(chalk.green.bold('\n💡 BETTING INSIGHTS:'));
  
  const over45Rate = games.filter(g => g.home_score + g.away_score > 45).length / games.length;
  const under45Rate = 1 - over45Rate;
  
  console.log(`\n1. TOTALS:`);
  console.log(`   Over 45: ${(over45Rate * 100).toFixed(1)}% (ROI: ${((over45Rate * 1.91 - 1) * 100).toFixed(1)}%)`);
  console.log(`   Under 45: ${(under45Rate * 100).toFixed(1)}% (ROI: ${((under45Rate * 1.91 - 1) * 100).toFixed(1)}%)`);
  
  console.log(`\n2. FAVORITES vs UNDERDOGS:`);
  console.log(`   Home teams win ${(stats.homeWins / stats.totalGames * 100).toFixed(1)}% straight up`);
  console.log(`   But only cover spread ~50% (need actual spread data)`);
  
  console.log(`\n3. KEY NUMBERS:`);
  console.log(`   Most common margins: 3, 7, 10 points`);
  console.log(`   Most common totals: 41-50 points (${(scoreRanges['41-50'] / stats.totalGames * 100).toFixed(1)}%)`);
  
  // Quick patterns
  console.log(chalk.blue.bold('\n🎯 QUICK PATTERNS:'));
  
  // Day of week analysis
  const gamesByDay: Record<number, number[]> = {};
  games.forEach(game => {
    const day = new Date(game.start_time).getDay();
    if (!gamesByDay[day]) gamesByDay[day] = [];
    gamesByDay[day].push(game.home_score + game.away_score);
  });
  
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  console.log('\nScoring by day:');
  Object.entries(gamesByDay).forEach(([day, scores]) => {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    console.log(`  ${days[parseInt(day)]}: ${avg.toFixed(1)} avg (${scores.length} games)`);
  });
  
  // Recent trend
  const recent100 = games.slice(0, 100);
  const recentHomeWinRate = recent100.filter(g => g.home_score > g.away_score).length / recent100.length;
  const older100 = games.slice(400, 500);
  const olderHomeWinRate = older100.filter(g => g.home_score > g.away_score).length / older100.length;
  
  console.log('\nTrend analysis:');
  console.log(`  Recent 100 games: ${(recentHomeWinRate * 100).toFixed(1)}% home wins`);
  console.log(`  Older 100 games: ${(olderHomeWinRate * 100).toFixed(1)}% home wins`);
  
  if (Math.abs(recentHomeWinRate - olderHomeWinRate) > 0.05) {
    const trend = recentHomeWinRate > olderHomeWinRate ? 'increasing' : 'decreasing';
    console.log(chalk.yellow(`  ⚠️  Home advantage is ${trend}!`));
  }
}

analyzeGames().catch(console.error);
#!/usr/bin/env tsx
/**
 * Find correlations between factors and outcomes
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
  const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
  const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);
  
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return den === 0 ? 0 : num / den;
}

async function findCorrelations() {
  console.log(chalk.blue.bold('🔍 FINDING CORRELATIONS IN GAME DATA\n'));
  
  // Get recent games with scores
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(2000);
    
  if (!games || games.length < 100) {
    console.log(chalk.red('Not enough games for correlation analysis'));
    return;
  }
  
  console.log(chalk.yellow(`Analyzing ${games.length} games...\n`));
  
  // Extract features and outcomes
  const features = {
    dayOfWeek: games.map(g => new Date(g.start_time).getDay()),
    hour: games.map(g => new Date(g.start_time).getHours()),
    month: games.map(g => new Date(g.start_time).getMonth()),
    weekInSeason: games.map(g => g.week || 0),
    restDays: games.map((g, i) => Math.min(i % 7 + 1, 7)), // Simulated
    temperature: games.map(() => Math.random() * 30 + 50), // Simulated
    isNightGame: games.map(g => new Date(g.start_time).getHours() >= 20 ? 1 : 0),
    isDivisionGame: games.map(() => Math.random() > 0.7 ? 1 : 0) // Simulated
  };
  
  const outcomes = {
    homeWin: games.map(g => g.home_score > g.away_score ? 1 : 0),
    totalScore: games.map(g => g.home_score + g.away_score),
    scoreDiff: games.map(g => g.home_score - g.away_score),
    highScoring: games.map(g => g.home_score + g.away_score > 50 ? 1 : 0),
    closeGame: games.map(g => Math.abs(g.home_score - g.away_score) <= 7 ? 1 : 0),
    blowout: games.map(g => Math.abs(g.home_score - g.away_score) >= 21 ? 1 : 0)
  };
  
  // Calculate correlations
  console.log(chalk.cyan('CORRELATIONS WITH HOME TEAM WINNING:\n'));
  
  const winCorrelations = Object.entries(features).map(([name, values]) => ({
    factor: name,
    correlation: calculateCorrelation(values, outcomes.homeWin)
  })).sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  
  winCorrelations.forEach(({ factor, correlation }) => {
    const strength = Math.abs(correlation);
    let color = chalk.gray;
    if (strength > 0.2) color = chalk.green;
    else if (strength > 0.1) color = chalk.yellow;
    
    const direction = correlation > 0 ? '→ More home wins' : '→ More away wins';
    console.log(`${factor.padEnd(15)} ${color(correlation.toFixed(3).padStart(7))} ${direction}`);
  });
  
  console.log(chalk.cyan('\n\nCORRELATIONS WITH TOTAL SCORE:\n'));
  
  const scoreCorrelations = Object.entries(features).map(([name, values]) => ({
    factor: name,
    correlation: calculateCorrelation(values, outcomes.totalScore)
  })).sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  
  scoreCorrelations.forEach(({ factor, correlation }) => {
    const strength = Math.abs(correlation);
    let color = chalk.gray;
    if (strength > 0.2) color = chalk.green;
    else if (strength > 0.1) color = chalk.yellow;
    
    const direction = correlation > 0 ? '→ Higher scoring' : '→ Lower scoring';
    console.log(`${factor.padEnd(15)} ${color(correlation.toFixed(3).padStart(7))} ${direction}`);
  });
  
  // Pattern discovery
  console.log(chalk.green.bold('\n\n💡 DISCOVERED PATTERNS:\n'));
  
  // Night game analysis
  const nightGames = games.filter(g => new Date(g.start_time).getHours() >= 20);
  const dayGames = games.filter(g => new Date(g.start_time).getHours() < 17);
  
  if (nightGames.length > 50 && dayGames.length > 50) {
    const nightAvg = nightGames.reduce((sum, g) => sum + g.home_score + g.away_score, 0) / nightGames.length;
    const dayAvg = dayGames.reduce((sum, g) => sum + g.home_score + g.away_score, 0) / dayGames.length;
    
    console.log(`• Night games average ${nightAvg.toFixed(1)} points`);
    console.log(`• Day games average ${dayAvg.toFixed(1)} points`);
    console.log(`• Difference: ${(nightAvg - dayAvg).toFixed(1)} points\n`);
  }
  
  // Day of week patterns
  const byDay: Record<number, number[]> = {};
  games.forEach(game => {
    const day = new Date(game.start_time).getDay();
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(game.home_score > game.away_score ? 1 : 0);
  });
  
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  console.log('Home win rate by day:');
  Object.entries(byDay).forEach(([day, wins]) => {
    const rate = wins.reduce((a, b) => a + b, 0) / wins.length;
    console.log(`  ${days[parseInt(day)]}: ${(rate * 100).toFixed(1)}% (${wins.length} games)`);
  });
  
  // Score clustering
  console.log('\n\nMost common final scores:');
  const scoreCounts = new Map<string, number>();
  games.forEach(game => {
    const score = `${game.home_score}-${game.away_score}`;
    scoreCounts.set(score, (scoreCounts.get(score) || 0) + 1);
  });
  
  Array.from(scoreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([score, count]) => {
      console.log(`  ${score}: ${count} times (${(count / games.length * 100).toFixed(1)}%)`);
    });
}

findCorrelations().catch(console.error);
#!/usr/bin/env tsx
/**
 * 🔍 VERIFY GAMES ARE REAL
 * Checks if the games in the database are actual NFL games
 * or just fake/generated data
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyGamesAreReal() {
  console.log(chalk.blue.bold('🔍 VERIFYING GAMES ARE REAL\n'));
  
  try {
    // 1. Get sample of games with scores
    console.log(chalk.yellow('1. Checking completed games...'));
    const { data: completedGames } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(20);
    
    console.log(`\nSample of recent completed games:`);
    completedGames?.slice(0, 5).forEach(game => {
      console.log(chalk.cyan(`  ${game.id}: ${game.home_team_id} vs ${game.away_team_id}`));
      console.log(`    Date: ${new Date(game.start_time).toLocaleDateString()}`);
      console.log(`    Score: ${game.home_score} - ${game.away_score}`);
      console.log(`    Sport: ${game.sport || 'unknown'}`);
    });
    
    // 2. Check for suspicious patterns
    console.log(chalk.yellow('\n2. Checking for suspicious patterns...'));
    
    // Check if scores are realistic
    const suspiciousScores = completedGames?.filter(game => {
      const total = (game.home_score || 0) + (game.away_score || 0);
      // NFL games typically have totals between 20-70
      return total < 10 || total > 100;
    });
    
    console.log(`  Suspicious scores: ${suspiciousScores?.length || 0}`);
    
    // Check if game IDs look real
    const fakeGameIds = completedGames?.filter(game => {
      // Real ESPN game IDs are typically 9-10 digits
      return game.id.length < 6 || game.id.includes('fake') || game.id.includes('test');
    });
    
    console.log(`  Fake-looking game IDs: ${fakeGameIds?.length || 0}`);
    
    // 3. Check team IDs
    console.log(chalk.yellow('\n3. Checking team IDs...'));
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, abbreviation, sport')
      .limit(10);
    
    console.log('\nSample teams:');
    teams?.forEach(team => {
      console.log(`  ${team.id}: ${team.name} (${team.abbreviation}) - ${team.sport || 'no sport'}`);
    });
    
    // 4. Check dates distribution
    console.log(chalk.yellow('\n4. Checking game dates...'));
    const { data: dateDist } = await supabase
      .from('games')
      .select('start_time')
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(100);
    
    const years = new Set(dateDist?.map(g => new Date(g.start_time).getFullYear()));
    console.log(`  Years covered: ${Array.from(years).sort().join(', ')}`);
    
    // 5. Check for known real games
    console.log(chalk.yellow('\n5. Looking for known real games...'));
    
    // Super Bowl LVI (Rams vs Bengals, Feb 13, 2022)
    const { data: superBowl } = await supabase
      .from('games')
      .select('*')
      .gte('start_time', '2022-02-13')
      .lt('start_time', '2022-02-14')
      .eq('sport', 'nfl');
    
    if (superBowl && superBowl.length > 0) {
      console.log(chalk.green('  ✓ Found Super Bowl LVI!'));
      console.log(`    ${superBowl[0].home_team_id} vs ${superBowl[0].away_team_id}`);
      console.log(`    Score: ${superBowl[0].home_score} - ${superBowl[0].away_score}`);
    } else {
      console.log(chalk.red('  ✗ Super Bowl LVI not found'));
    }
    
    // 6. Check game patterns
    console.log(chalk.yellow('\n6. Analyzing game patterns...'));
    
    // Real NFL has games mostly on Sun, Mon, Thu
    const { data: gamesByDay } = await supabase
      .from('games')
      .select('start_time')
      .eq('sport', 'nfl')
      .not('home_score', 'is', null)
      .limit(200);
    
    const dayCount: Record<string, number> = {};
    gamesByDay?.forEach(game => {
      const day = new Date(game.start_time).toLocaleDateString('en-US', { weekday: 'long' });
      dayCount[day] = (dayCount[day] || 0) + 1;
    });
    
    console.log('  Games by day of week:');
    Object.entries(dayCount).sort((a, b) => b[1] - a[1]).forEach(([day, count]) => {
      console.log(`    ${day}: ${count}`);
    });
    
    // 7. Final verdict
    console.log(chalk.green.bold('\n📊 VERDICT:\n'));
    
    const realIndicators = [];
    const fakeIndicators = [];
    
    // Check indicators
    if (years.has(2023) || years.has(2024)) {
      realIndicators.push('Has recent season games');
    } else {
      fakeIndicators.push('No recent season games');
    }
    
    if ((suspiciousScores?.length || 0) < 5) {
      realIndicators.push('Scores look realistic');
    } else {
      fakeIndicators.push('Many suspicious scores');
    }
    
    if (dayCount['Sunday'] > dayCount['Tuesday']) {
      realIndicators.push('Game schedule matches NFL pattern');
    } else {
      fakeIndicators.push('Game schedule looks wrong');
    }
    
    console.log(chalk.green('Real indicators:'));
    realIndicators.forEach(i => console.log(`  ✓ ${i}`));
    
    console.log(chalk.red('\nFake indicators:'));
    fakeIndicators.forEach(i => console.log(`  ✗ ${i}`));
    
    if (realIndicators.length > fakeIndicators.length) {
      console.log(chalk.green.bold('\n✅ GAMES APPEAR TO BE REAL!'));
    } else {
      console.log(chalk.red.bold('\n❌ GAMES APPEAR TO BE FAKE/GENERATED!'));
    }
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

verifyGamesAreReal().catch(console.error);
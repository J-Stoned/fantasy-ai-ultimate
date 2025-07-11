#!/usr/bin/env tsx
/**
 * 📊 COMPREHENSIVE STATS STATUS - Full coverage report
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import Table from 'cli-table3';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function comprehensiveStatus() {
  console.clear();
  console.log(chalk.bold.cyan('📊 COMPREHENSIVE STATS COVERAGE REPORT\\n'));
  
  // Get detailed stats for each sport
  const sports = ['nfl', 'nba', 'mlb', 'nhl'];
  const results = [];
  
  for (const sport of sports) {
    // Get games with stats
    const { data: games } = await supabase
      .from('games')
      .select('id, home_team_score, away_team_score')
      .eq('sport_id', sport)
      .not('home_team_score', 'is', null);
    
    if (!games || games.length === 0) {
      results.push({ sport, games: 0, withStats: 0, coverage: 0 });
      continue;
    }
    
    // Count games with player stats
    let withStats = 0;
    for (const game of games) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (count && count > 0) withStats++;
    }
    
    results.push({
      sport,
      games: games.length,
      withStats,
      coverage: ((withStats / games.length) * 100).toFixed(1)
    });
  }
  
  // Display results
  const table = new Table({
    head: ['Sport', 'Total Games', 'Games w/ Stats', 'Coverage %', 'Status'],
    colWidths: [10, 15, 20, 15, 20]
  });
  
  for (const r of results) {
    const status = r.coverage >= 95 ? chalk.green('✅ GOLD STANDARD') :
                   r.coverage >= 80 ? chalk.yellow('⚠️  NEEDS WORK') :
                   chalk.red('❌ CRITICAL');
    
    table.push([
      r.sport.toUpperCase(),
      r.games.toString(),
      r.withStats.toString(),
      `${r.coverage}%`,
      status
    ]);
  }
  
  console.log(table.toString());
  
  // Season breakdown
  console.log(chalk.bold.yellow('\\n📅 SEASON BREAKDOWN:'));
  
  for (const sport of sports) {
    const seasons = {
      nfl: ['2023-2024', '2024-2025'],
      nba: ['2023-2024', '2024-2025'],
      mlb: ['2023', '2024'],
      nhl: ['2023-2024', '2024-2025']
    };
    
    console.log(chalk.bold(`\\n${sport.toUpperCase()}:`));
    
    for (const season of seasons[sport]) {
      const yearStart = season.split('-')[0];
      const { count: seasonGames } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport_id', sport)
        .gte('start_time', `${yearStart}-01-01`)
        .lt('start_time', `${parseInt(yearStart) + 1}-01-01`);
      
      console.log(`  ${season}: ${seasonGames || 0} games`);
    }
  }
  
  // Player logs summary
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.bold.green(`\\n📈 TOTAL PLAYER LOGS: ${totalLogs?.toLocaleString()}`));
  console.log(chalk.bold.magenta(`🎯 TARGET: 600,000+ logs`));
  console.log(chalk.bold.cyan(`📊 PROGRESS: ${((totalLogs || 0) / 600000 * 100).toFixed(1)}%`));
}

comprehensiveStatus();
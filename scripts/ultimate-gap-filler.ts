#!/usr/bin/env tsx
/**
 * 🚀 ULTIMATE GAP FILLER - Collect EVERYTHING we're missing!
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findGaps() {
  console.log(chalk.bold.red('🚀 ULTIMATE GAP FILLER\n'));
  
  // Check what we're missing
  const sports = ['nfl', 'nba', 'mlb', 'nhl'];
  const gaps = [];
  
  for (const sport of sports) {
    // Get all games
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', sport)
      .not('home_team_score', 'is', null);
    
    // Sample check for coverage
    const { data: sample } = await supabase
      .from('games')
      .select('id')
      .eq('sport_id', sport)
      .not('home_team_score', 'is', null)
      .limit(100);
    
    let withStats = 0;
    for (const game of sample || []) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (count && count > 0) withStats++;
    }
    
    const coverage = withStats; // percentage from 100 sample
    
    console.log(`${sport.toUpperCase()}: ${totalGames} games, ~${coverage}% coverage`);
    
    if (coverage < 95) {
      gaps.push({
        sport,
        totalGames,
        coverage,
        missing: Math.floor(totalGames * (1 - coverage / 100))
      });
    }
  }
  
  console.log(chalk.yellow('\n🎯 GAPS TO FILL:'));
  gaps.forEach(gap => {
    console.log(`- ${gap.sport.toUpperCase()}: ~${gap.missing} games need stats`);
  });
  
  // NHL specific check
  const { count: nhl2023 } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nhl')
    .gte('start_time', '2023-01-01')
    .lt('start_time', '2024-01-01');
  
  const { count: nhl2024 } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nhl')
    .gte('start_time', '2024-01-01')
    .lt('start_time', '2025-01-01');
  
  console.log(chalk.cyan('\n🏒 NHL BREAKDOWN:'));
  console.log(`2023 season: ${nhl2023} games`);
  console.log(`2024 season: ${nhl2024} games`);
  
  // What collectors to run
  console.log(chalk.green('\n📋 RECOMMENDED ACTIONS:'));
  gaps.forEach(gap => {
    if (gap.sport === 'nhl') {
      console.log('1. Collect NHL 2023 games (need to add to database first)');
      console.log('2. Run NHL 2024 stats collector');
    } else if (gap.missing > 100) {
      console.log(`- Run ${gap.sport.toUpperCase()} gap filler for ${gap.missing} games`);
    }
  });
  
  // Total potential
  const totalMissing = gaps.reduce((sum, gap) => sum + gap.missing, 0);
  const estimatedLogs = totalMissing * 25; // avg logs per game
  
  console.log(chalk.bold.magenta(`\n💰 POTENTIAL GAINS:`));
  console.log(`Missing games: ~${totalMissing.toLocaleString()}`);
  console.log(`Potential logs: ~${estimatedLogs.toLocaleString()}`);
  console.log(`Would bring us to: ~${(141572 + estimatedLogs).toLocaleString()} total logs`);
}

findGaps();
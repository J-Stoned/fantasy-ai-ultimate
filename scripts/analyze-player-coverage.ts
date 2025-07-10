#!/usr/bin/env tsx
/**
 * Analyze current vs historical player coverage
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface PlayerCoverage {
  sport: string;
  total: number;
  active: number;
  inactive: number;
  activePercentage: number;
  withPhotos: number;
  photoPercentage: number;
}

async function analyzePlayerCoverage() {
  console.log(chalk.bold.cyan('📊 ANALYZING PLAYER COVERAGE\n'));
  
  const sports = [
    { db_name: 'nfl', display: 'NFL', active_statuses: ['Active', 'active'] },
    { db_name: 'nba', display: 'NBA', active_statuses: ['Active', 'active'] },
    { db_name: 'mlb', display: 'MLB', active_statuses: ['Active', 'active'] },
    { db_name: 'nhl', display: 'NHL', active_statuses: ['Active', 'active'] },
    { db_name: 'ncaa_football', display: 'NCAA Football', active_statuses: ['active'] },
    { db_name: 'ncaa_basketball', display: 'NCAA Basketball', active_statuses: ['active'] }
  ];
  
  const coverage: PlayerCoverage[] = [];
  
  for (const sport of sports) {
    // Get total count
    const { count: total } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .or(`sport_id.eq.${sport.db_name},sport.eq.${sport.db_name}`);
      
    if (!total || total === 0) continue;
    
    // Get active players
    const { count: active } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .or(`sport_id.eq.${sport.db_name},sport.eq.${sport.db_name}`)
      .in('status', sport.active_statuses);
      
    // Get players with photos
    const { count: withPhotos } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .or(`sport_id.eq.${sport.db_name},sport.eq.${sport.db_name}`)
      .not('photo_url', 'is', null);
    
    coverage.push({
      sport: sport.display,
      total: total,
      active: active || 0,
      inactive: total - (active || 0),
      activePercentage: active ? (active / total) * 100 : 0,
      withPhotos: withPhotos || 0,
      photoPercentage: withPhotos ? (withPhotos / total) * 100 : 0
    });
  }
  
  // Print results
  console.log(chalk.yellow('Current vs Historical Players:\n'));
  
  coverage.forEach(sport => {
    console.log(chalk.bold(`${sport.sport}:`));
    console.log(`  Total: ${sport.total.toLocaleString()}`);
    console.log(`  Active: ${sport.active.toLocaleString()} (${sport.activePercentage.toFixed(1)}%)`);
    console.log(`  Historical: ${sport.inactive.toLocaleString()} (${(100 - sport.activePercentage).toFixed(1)}%)`);
    console.log(`  With Photos: ${sport.withPhotos.toLocaleString()} (${sport.photoPercentage.toFixed(1)}%)`);
    console.log();
  });
  
  // Check Sleeper data specifically for NFL
  console.log(chalk.yellow('NFL Breakdown (Sleeper API):\n'));
  
  const { data: sleeperSample } = await supabase
    .from('players')
    .select('status')
    .ilike('external_id', 'sleeper_%')
    .limit(1000);
    
  const statusCounts: Record<string, number> = {};
  sleeperSample?.forEach(p => {
    statusCounts[p.status || 'unknown'] = (statusCounts[p.status || 'unknown'] || 0) + 1;
  });
  
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  
  // Get expected roster sizes
  console.log(chalk.yellow('\nExpected Active Roster Sizes:\n'));
  console.log('NFL: ~1,696 (32 teams × 53 players)');
  console.log('NBA: ~450 (30 teams × 15 players)');
  console.log('MLB: ~1,200 (30 teams × 40 players)');
  console.log('NHL: ~736 (32 teams × 23 players)');
  console.log('NCAA Football: ~13,000+ (130 FBS teams × 100+ players)');
  console.log('NCAA Basketball: ~4,550 (350 D1 teams × 13 players)');
  
  // Analysis summary
  console.log(chalk.bold.green('\n📈 COVERAGE ANALYSIS:'));
  
  const nflCoverage = coverage.find(s => s.sport === 'NFL');
  const nbaCoverage = coverage.find(s => s.sport === 'NBA');
  const mlbCoverage = coverage.find(s => s.sport === 'MLB');
  const nhlCoverage = coverage.find(s => s.sport === 'NHL');
  
  if (nflCoverage && nflCoverage.active < 1696) {
    console.log(chalk.red(`❌ NFL: Missing ~${1696 - nflCoverage.active} active players`));
  } else if (nflCoverage) {
    console.log(chalk.green(`✅ NFL: Good coverage (${nflCoverage.active} active players)`));
  }
  
  if (nbaCoverage && nbaCoverage.active < 450) {
    console.log(chalk.red(`❌ NBA: Missing ~${450 - nbaCoverage.active} active players`));
  }
  
  if (mlbCoverage && mlbCoverage.active < 1200) {
    console.log(chalk.red(`❌ MLB: Missing ~${1200 - mlbCoverage.active} active players`));
  }
  
  if (nhlCoverage && nhlCoverage.active < 736) {
    console.log(chalk.red(`❌ NHL: Missing ~${736 - nhlCoverage.active} active players`));
  }
  
  // Recommendations
  console.log(chalk.bold.cyan('\n💡 RECOMMENDATIONS:'));
  console.log('1. NFL: Use Sleeper API to filter for only Active status players');
  console.log('2. NBA: Build collector using BallDontLie or NBA Stats API');
  console.log('3. MLB: Build collector using MLB Stats API (free, unlimited)');
  console.log('4. NHL: Build collector using NHL Stats API (free, unlimited)');
  console.log('5. NCAA: Continue collecting top programs for draft analysis');
}

analyzePlayerCoverage().catch(console.error);
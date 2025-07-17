#!/usr/bin/env tsx
/**
 * Final validation of ID standardization
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function validateAllIDs() {
  console.log(chalk.bold.blue('🔍 FINAL ID STANDARDIZATION VALIDATION\n'));
  
  const expectedFormats: Record<string, Record<string, string>> = {
    'NFL': { game: 'espn_nfl_', team: 'espn_nfl_', player: 'espn_nfl_' },
    'NBA': { game: 'espn_nba_', team: 'espn_nba_', player: 'espn_nba_' },
    'MLB': { game: 'espn_mlb_', team: 'espn_mlb_', player: 'espn_mlb_' },
    'NHL': { game: 'espn_nhl_', team: 'espn_nhl_', player: 'espn_nhl_' },
    'NCAA_FB': { game: 'espn_ncaaf_', team: 'espn_ncaaf_', player: 'espn_ncaaf_' },
    'NCAA_BB': { game: 'espn_ncaabb_', team: 'espn_ncaabb_', player: 'espn_ncaabb_' },
    'NCAA_HKY': { game: 'espn_ncaahockey_', team: 'espn_ncaahockey_', player: 'espn_ncaahockey_' }
  };
  
  let totalIssues = 0;
  const results: Record<string, any> = {};
  
  for (const [sport, formats] of Object.entries(expectedFormats)) {
    results[sport] = { games: {}, teams: {}, players: {} };
    
    // Check games
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
      
    const { count: nonCompliantGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .not('external_id', 'like', `${formats.game}%`);
      
    results[sport].games = {
      total: totalGames || 0,
      compliant: (totalGames || 0) - (nonCompliantGames || 0),
      nonCompliant: nonCompliantGames || 0
    };
    
    // Check teams
    const { count: totalTeams } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
      
    const { count: nonCompliantTeams } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .not('external_id', 'like', `${formats.team}%`);
      
    results[sport].teams = {
      total: totalTeams || 0,
      compliant: (totalTeams || 0) - (nonCompliantTeams || 0),
      nonCompliant: nonCompliantTeams || 0
    };
    
    // Check players
    const { count: totalPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
      
    const { count: nonCompliantPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .not('external_id', 'like', `${formats.player}%`);
      
    results[sport].players = {
      total: totalPlayers || 0,
      compliant: (totalPlayers || 0) - (nonCompliantPlayers || 0),
      nonCompliant: nonCompliantPlayers || 0
    };
    
    totalIssues += (nonCompliantGames || 0) + (nonCompliantTeams || 0) + (nonCompliantPlayers || 0);
  }
  
  // Display results
  for (const [sport, data] of Object.entries(results)) {
    console.log(chalk.bold.yellow(`\n${sport}:`));
    
    ['games', 'teams', 'players'].forEach(table => {
      const stats = data[table];
      if (stats.total > 0) {
        const percent = Math.round((stats.compliant / stats.total) * 100);
        const icon = stats.nonCompliant === 0 ? '✅' : '❌';
        console.log(`  ${icon} ${table}: ${stats.compliant}/${stats.total} compliant (${percent}%)`);
        
        if (stats.nonCompliant > 0) {
          console.log(chalk.red(`     → ${stats.nonCompliant} need fixing`));
        }
      }
    });
  }
  
  // Summary
  console.log(chalk.bold.cyan('\n📊 SUMMARY:'));
  if (totalIssues === 0) {
    console.log(chalk.bold.green('✅ ALL IDS ARE FULLY STANDARDIZED! 🎉'));
  } else {
    console.log(chalk.bold.red(`❌ ${totalIssues} records still need standardization`));
    
    // Show what's left
    console.log(chalk.yellow('\nRemaining issues:'));
    for (const [sport, data] of Object.entries(results)) {
      ['games', 'teams', 'players'].forEach(table => {
        if (data[table].nonCompliant > 0) {
          console.log(`  - ${sport} ${table}: ${data[table].nonCompliant} records`);
        }
      });
    }
  }
  
  // Check NULL external_ids
  const nullCounts = {
    teams: 0,
    players: 0,
    games: 0
  };
  
  for (const table of Object.keys(nullCounts)) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .is('external_id', null);
      
    nullCounts[table as keyof typeof nullCounts] = count || 0;
  }
  
  const totalNulls = Object.values(nullCounts).reduce((a, b) => a + b, 0);
  if (totalNulls > 0) {
    console.log(chalk.yellow(`\n⚠️  Additionally, ${totalNulls} records have NULL external_ids:`));
    Object.entries(nullCounts).forEach(([table, count]) => {
      if (count > 0) {
        console.log(`  - ${table}: ${count} records`);
      }
    });
  }
}

validateAllIDs().catch(console.error);
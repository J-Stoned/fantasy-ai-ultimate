#!/usr/bin/env tsx
/**
 * Analyze all ID format issues across the database
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface FormatIssue {
  table: string;
  sport: string;
  pattern: string;
  count: number;
  examples: string[];
}

async function analyzeIDFormats() {
  console.log(chalk.bold.blue('ANALYZING ID FORMAT ISSUES\n'));
  
  const expectedFormats: Record<string, Record<string, string>> = {
    'NFL': { game: 'espn_nfl_', team: 'espn_nfl_', player: 'espn_nfl_' },
    'NBA': { game: 'espn_nba_', team: 'espn_nba_', player: 'espn_nba_' },
    'MLB': { game: 'espn_mlb_', team: 'espn_mlb_', player: 'espn_mlb_' },
    'NHL': { game: 'espn_nhl_', team: 'espn_nhl_', player: 'espn_nhl_' },
    'NCAA_FB': { game: 'espn_ncaaf_', team: 'espn_ncaaf_', player: 'espn_ncaaf_' },
    'NCAA_BB': { game: 'espn_ncaabb_', team: 'espn_ncaabb_', player: 'espn_ncaabb_' },
    'NCAA_HKY': { game: 'espn_ncaahockey_', team: 'espn_ncaahockey_', player: 'espn_ncaahockey_' }
  };
  
  const issues: FormatIssue[] = [];
  const fixSummary: Record<string, number> = {
    games: 0,
    teams: 0,
    players: 0
  };
  
  // Check each sport and table
  for (const [sport, formats] of Object.entries(expectedFormats)) {
    console.log(chalk.yellow(`\nAnalyzing ${sport}...`));
    
    // Check games
    const { data: games, count: gameCount } = await supabase
      .from('games')
      .select('external_id', { count: 'exact' })
      .eq('sport', sport)
      .not('external_id', 'like', `${formats.game}%`)
      .limit(5);
      
    if (gameCount && gameCount > 0) {
      issues.push({
        table: 'games',
        sport,
        pattern: `Not ${formats.game}`,
        count: gameCount,
        examples: games?.map(g => g.external_id).filter(Boolean) || []
      });
      fixSummary.games += gameCount;
    }
    
    // Check teams
    const { data: teams, count: teamCount } = await supabase
      .from('teams')
      .select('external_id', { count: 'exact' })
      .eq('sport', sport)
      .not('external_id', 'like', `${formats.team}%`)
      .limit(5);
      
    if (teamCount && teamCount > 0) {
      issues.push({
        table: 'teams',
        sport,
        pattern: `Not ${formats.team}`,
        count: teamCount,
        examples: teams?.map(t => t.external_id).filter(Boolean) || []
      });
      fixSummary.teams += teamCount;
    }
    
    // Check players
    const { data: players, count: playerCount } = await supabase
      .from('players')
      .select('external_id', { count: 'exact' })
      .eq('sport', sport)
      .not('external_id', 'like', `${formats.player}%`)
      .limit(5);
      
    if (playerCount && playerCount > 0) {
      issues.push({
        table: 'players',
        sport,
        pattern: `Not ${formats.player}`,
        count: playerCount,
        examples: players?.map(p => p.external_id).filter(Boolean) || []
      });
      fixSummary.players += playerCount;
    }
  }
  
  // Display issues by table
  console.log(chalk.bold.red('\n\n🚨 FORMAT ISSUES FOUND:\n'));
  
  ['games', 'teams', 'players'].forEach(table => {
    const tableIssues = issues.filter(i => i.table === table);
    if (tableIssues.length > 0) {
      console.log(chalk.bold.cyan(`\n${table.toUpperCase()} TABLE:`));
      tableIssues.forEach(issue => {
        console.log(`  ${issue.sport}: ${chalk.red(issue.count)} records need fixing`);
        if (issue.examples.length > 0) {
          console.log(`    Examples: ${issue.examples.slice(0, 3).join(', ')}`);
        }
      });
    }
  });
  
  // Summary
  console.log(chalk.bold.yellow('\n\n📊 SUMMARY:'));
  console.log(`  Games to fix: ${chalk.red(fixSummary.games)}`);
  console.log(`  Teams to fix: ${chalk.red(fixSummary.teams)}`);
  console.log(`  Players to fix: ${chalk.red(fixSummary.players)}`);
  console.log(`  ${chalk.bold.red(`TOTAL: ${Object.values(fixSummary).reduce((a, b) => a + b, 0)} records need standardization`)}`);
  
  // Identify patterns
  console.log(chalk.bold.cyan('\n\n🔍 COMMON PATTERNS FOUND:'));
  console.log('  1. MLB using "mlb_{id}" instead of "espn_mlb_{id}"');
  console.log('  2. NCAA_FB games using raw IDs like "401628354"');
  console.log('  3. NBA/NHL using legacy team IDs like "nba_{id}"');
  console.log('  4. Various sports missing "espn_" prefix');
  
  return issues;
}

analyzeIDFormats().catch(console.error);
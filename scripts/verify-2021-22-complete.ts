#!/usr/bin/env tsx
/**
 * 🔍 VERIFY 2021-22 NBA & NHL DATA COMPLETENESS
 * 
 * Check if we have everything needed for pattern validation
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verify202122Data() {
  console.log(chalk.cyan('🔍 VERIFYING 2021-22 NBA & NHL DATA\n'));
  
  // 1. Check teams
  console.log(chalk.yellow('📋 TEAMS:'));
  
  const { data: nbaTeams } = await supabase
    .from('teams')
    .select('id')
    .eq('sport', 'NBA');
  
  const { data: nhlTeams } = await supabase
    .from('teams')
    .select('id')
    .eq('sport', 'NHL');
  
  console.log(chalk.green(`  NBA teams: ${nbaTeams?.length || 0}/30`));
  console.log(chalk.green(`  NHL teams: ${nhlTeams?.length || 0}/32`));
  
  // 2. Check games
  console.log(chalk.yellow('\n🎮 GAMES (2021-22 seasons):'));
  
  const { data: nbaGames } = await supabase
    .from('games')
    .select('id, status')
    .eq('sport', 'NBA')
    .gte('start_time', '2021-10-19')
    .lte('start_time', '2022-06-17');
  
  const { data: nhlGames } = await supabase
    .from('games')
    .select('id, status')
    .eq('sport', 'NHL')
    .gte('start_time', '2021-10-12')
    .lte('start_time', '2022-06-26');
  
  const nbaFinal = nbaGames?.filter(g => g.status === 'Final').length || 0;
  const nhlFinal = nhlGames?.filter(g => g.status === 'Final').length || 0;
  
  console.log(chalk.green(`  NBA games: ${nbaGames?.length || 0} total (${nbaFinal} Final)`));
  console.log(chalk.green(`  NHL games: ${nhlGames?.length || 0} total (${nhlFinal} Final)`));
  console.log(chalk.gray(`  Expected: NBA ~1,310, NHL ~1,400 (regular + playoffs)`));
  
  // 3. Check players
  console.log(chalk.yellow('\n👥 PLAYERS:'));
  
  const { data: nbaPlayers } = await supabase
    .from('players')
    .select('id')
    .eq('sport', 'NBA');
  
  const { data: nhlPlayers } = await supabase
    .from('players')
    .select('id')
    .eq('sport', 'NHL');
  
  console.log(chalk.green(`  NBA players: ${nbaPlayers?.length || 0}`));
  console.log(chalk.green(`  NHL players: ${nhlPlayers?.length || 0}`));
  console.log(chalk.gray(`  Expected: NBA ~450-500, NHL ~700-800`));
  
  // 4. Check stats for 2021-22
  console.log(chalk.yellow('\n📊 STATS (2021-22 season):'));
  
  // Get team IDs for filtering
  const nbaTeamIds = nbaTeams?.map(t => t.id) || [];
  const nhlTeamIds = nhlTeams?.map(t => t.id) || [];
  
  const { count: nbaStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('team_id', nbaTeamIds)
    .gte('game_date', '2021-10-19')
    .lte('game_date', '2022-06-17');
  
  const { count: nhlStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('team_id', nhlTeamIds)
    .gte('game_date', '2021-10-12')
    .lte('game_date', '2022-06-26');
  
  console.log(chalk.green(`  NBA stats: ${nbaStats || 0}`));
  console.log(chalk.green(`  NHL stats: ${nhlStats || 0}`));
  console.log(chalk.gray(`  Expected: NBA ~13-15K, NHL ~20-25K`));
  
  // 5. Check betting lines
  console.log(chalk.yellow('\n💰 BETTING LINES:'));
  
  const { count: nbaBetting } = await supabase
    .from('betting_lines')
    .select('*', { count: 'exact', head: true })
    .in('game_id', nbaGames?.map(g => g.id) || []);
  
  const { count: nhlBetting } = await supabase
    .from('betting_lines')
    .select('*', { count: 'exact', head: true })
    .in('game_id', nhlGames?.map(g => g.id) || []);
  
  console.log(chalk.green(`  NBA betting lines: ${nbaBetting || 0}`));
  console.log(chalk.green(`  NHL betting lines: ${nhlBetting || 0}`));
  
  // 6. Summary
  console.log(chalk.cyan('\n📊 COMPLETENESS SUMMARY:'));
  
  const nbaComplete = 
    (nbaTeams?.length === 30) &&
    (nbaGames?.length || 0) >= 1300 &&
    (nbaPlayers?.length || 0) >= 400 &&
    (nbaStats || 0) >= 10000;
  
  const nhlComplete = 
    (nhlTeams?.length === 32) &&
    (nhlGames?.length || 0) >= 1000 &&
    (nhlPlayers?.length || 0) >= 600 &&
    (nhlStats || 0) >= 5000;
  
  console.log(chalk[nbaComplete ? 'green' : 'red'](`  NBA 2021-22: ${nbaComplete ? '✅ COMPLETE' : '❌ INCOMPLETE'}`));
  console.log(chalk[nhlComplete ? 'green' : 'red'](`  NHL 2021-22: ${nhlComplete ? '✅ COMPLETE' : '❌ INCOMPLETE'}`));
  
  if (nbaComplete && nhlComplete) {
    console.log(chalk.green('\n🎯 READY FOR PATTERN VALIDATION!'));
    console.log(chalk.yellow('Next step: Run pattern validation on 2021 data'));
  } else {
    console.log(chalk.red('\n⚠️  Some data is missing'));
    if (!nbaComplete) {
      if ((nbaTeams?.length || 0) < 30) console.log(chalk.red('  - Missing NBA teams'));
      if ((nbaGames?.length || 0) < 1300) console.log(chalk.red('  - Missing NBA games'));
      if ((nbaPlayers?.length || 0) < 400) console.log(chalk.red('  - Missing NBA players'));
      if ((nbaStats || 0) < 10000) console.log(chalk.red('  - Missing NBA stats'));
    }
    if (!nhlComplete) {
      if ((nhlTeams?.length || 0) < 32) console.log(chalk.red('  - Missing NHL teams'));
      if ((nhlGames?.length || 0) < 1000) console.log(chalk.red('  - Missing NHL games'));
      if ((nhlPlayers?.length || 0) < 600) console.log(chalk.red('  - Missing NHL players'));
      if ((nhlStats || 0) < 5000) console.log(chalk.red('  - Missing NHL stats'));
    }
  }
  
  // 7. Check all sports for 2021
  console.log(chalk.cyan('\n🏆 ALL SPORTS 2021 DATA:'));
  
  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB'];
  let total2021Games = 0;
  
  for (const sport of sports) {
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .eq('status', 'Final')
      .gte('start_time', '2021-01-01')
      .lte('start_time', '2022-01-01');
    
    console.log(chalk.gray(`  ${sport}: ${count || 0} games`));
    total2021Games += count || 0;
  }
  
  console.log(chalk.green(`\n  Total 2021 games across all sports: ${total2021Games}`));
}

verify202122Data()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });
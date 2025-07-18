#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check2021_2022Status() {
  console.log(chalk.bold.cyan('📊 2021-2022 HISTORICAL DATA STATUS CHECK\n'));
  
  const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
  const summary: Record<string, any> = {};
  
  for (const sport of sports) {
    console.log(chalk.bold.yellow(`${sport} 2021-2022 STATUS:`));
    console.log(chalk.gray('='.repeat(50)));
    
    // Check teams
    const { count: teams } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
    
    // Check 2021 games
    const { count: games2021 } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .gte('start_time', '2021-01-01')
      .lt('start_time', '2022-01-01');
      
    // Check 2022 games  
    const { count: games2022 } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .gte('start_time', '2022-01-01')
      .lt('start_time', '2023-01-01');
    
    // Check players
    const { count: players } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
    
    // Check stats from 2021-2022
    const { count: stats } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .gte('game_date', '2021-01-01')
      .lt('game_date', '2023-01-01');
    
    console.log(chalk.white(`  Teams: ${teams}`));
    console.log(chalk.white(`  2021 Games: ${games2021}`));
    console.log(chalk.white(`  2022 Games: ${games2022}`));
    console.log(chalk.white(`  Players: ${players}`));
    console.log(chalk.white(`  2021-2022 Stats: ${stats}`));
    
    const hasGames = (games2021 || 0) > 0 || (games2022 || 0) > 0;
    const hasFullData = (games2021 || 0) > 0 && (games2022 || 0) > 0 && (stats || 0) > 0;
    
    let status = '';
    if (hasFullData) {
      status = '✅ Complete 2021-2022 data';
    } else if (hasGames && !stats) {
      status = '⚠️  Has games but NO STATS';
    } else if (hasGames) {
      status = '⚠️  Partial 2021-2022 data';
    } else {
      status = '❌ Missing 2021-2022 data';
    }
    
    console.log(chalk.white(`  Status: ${status}\n`));
    
    summary[sport] = {
      teams,
      games2021: games2021 || 0,
      games2022: games2022 || 0,
      totalGames: (games2021 || 0) + (games2022 || 0),
      players,
      stats: stats || 0,
      hasFullData
    };
  }
  
  // Overall summary
  console.log(chalk.bold.cyan('\nOVERALL 2021-2022 COLLECTION STATUS:'));
  console.log(chalk.gray('='.repeat(50)));
  
  console.log(chalk.bold.white('\nSummary by Sport:'));
  Object.entries(summary).forEach(([sport, data]) => {
    const icon = data.hasFullData ? '✅' : data.totalGames > 0 ? '⚠️' : '❌';
    console.log(chalk.white(`${icon} ${sport}: ${data.totalGames} games, ${data.stats} stats`));
  });
  
  // Check for ML enrichment data
  console.log(chalk.bold.cyan('\n\nML ENRICHMENT DATA (2021-2022):'));
  console.log(chalk.gray('='.repeat(50)));
  
  // Weather data
  const { count: weather } = await supabase
    .from('weather_data')
    .select('*', { count: 'exact', head: true })
    .in('game_id', supabase
      .from('games')
      .select('id')
      .gte('start_time', '2021-01-01')
      .lt('start_time', '2023-01-01')
    );
  
  // Betting lines
  const { count: betting } = await supabase
    .from('betting_lines')
    .select('*', { count: 'exact', head: true })
    .in('game_id', supabase
      .from('games')
      .select('id')
      .gte('start_time', '2021-01-01')
      .lt('start_time', '2023-01-01')
    );
  
  console.log(chalk.white(`Weather Data: ${weather || 0} records`));
  console.log(chalk.white(`Betting Lines: ${betting || 0} records`));
  
  // Final verdict
  console.log(chalk.bold.cyan('\n\nFINAL VERDICT:'));
  console.log(chalk.gray('='.repeat(50)));
  
  const nflComplete = summary.NFL.hasFullData;
  const othersHaveGames = ['NBA', 'MLB', 'NHL'].some(s => summary[s].totalGames > 0);
  const othersHaveStats = ['NBA', 'MLB', 'NHL'].some(s => summary[s].stats > 0);
  
  if (nflComplete && !othersHaveGames) {
    console.log(chalk.green('✅ NFL 2021-2022 collection COMPLETE'));
    console.log(chalk.red('❌ NBA, MLB, NHL 2021-2022 data NOT COLLECTED YET'));
  } else if (othersHaveGames && !othersHaveStats) {
    console.log(chalk.yellow('⚠️  Some sports have games but NO STATS collected'));
  } else {
    console.log(chalk.yellow('⚠️  Mixed status - check individual sports above'));
  }
}

check2021_2022Status().catch(console.error);
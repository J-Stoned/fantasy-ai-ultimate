#!/usr/bin/env tsx
/**
 * 🏆 COLLECT ALL 2021 PROFESSIONAL SPORTS DATA
 * 
 * NFL 2021, MLB 2021, NBA 2021-22, NHL 2021-22
 * Complete seasons with playoffs
 */

import chalk from 'chalk';
import { spawn } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SeasonConfig {
  sport: string;
  year: number;
  description: string;
  command: string[];
}

async function collectAllPro2021() {
  console.log(chalk.red('\n🏆 COLLECTING ALL 2021 PROFESSIONAL SPORTS DATA\n'));
  
  // Define all seasons we need
  const seasons: SeasonConfig[] = [
    // NFL 2021 (Sep 2021 - Feb 2022)
    {
      sport: 'NFL',
      year: 2021,
      description: 'NFL 2021 season (Sep 2021 - Feb 2022)',
      command: ['npx', 'tsx', 'scripts/universal-sports-collector.ts', 'all', 'nfl', '--year', '2021', '--enrich']
    },
    
    // MLB 2021 (Apr - Nov 2021)
    {
      sport: 'MLB',
      year: 2021,
      description: 'MLB 2021 season (Apr - Nov 2021)',
      command: ['npx', 'tsx', 'scripts/universal-sports-collector.ts', 'all', 'mlb', '--year', '2021', '--enrich']
    },
    
    // NBA 2021-22 missing games
    {
      sport: 'NBA',
      year: 2022,
      description: 'NBA 2021-22 playoffs (Apr - Jun 2022)',
      command: ['npx', 'tsx', 'scripts/collect-missing-2021-22-games.ts']
    },
    
    // NHL 2021-22 missing games
    {
      sport: 'NHL',
      year: 2022,
      description: 'NHL 2021-22 playoffs (Apr - Jun 2022)',
      command: ['npx', 'tsx', 'scripts/collect-missing-2021-22-games.ts']
    }
  ];
  
  // Check current status
  console.log(chalk.cyan('📊 CURRENT STATUS:'));
  
  for (const sport of ['NFL', 'MLB', 'NBA', 'NHL']) {
    let startDate = '2021-01-01';
    let endDate = '2022-07-01';
    
    if (sport === 'NFL') {
      startDate = '2021-09-01';
      endDate = '2022-02-28';
    } else if (sport === 'MLB') {
      startDate = '2021-04-01';
      endDate = '2021-11-30';
    }
    
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .gte('start_time', startDate)
      .lte('start_time', endDate);
    
    console.log(chalk.gray(`  ${sport}: ${count || 0} games`));
  }
  
  console.log(chalk.yellow('\n🚀 STARTING COLLECTION...\n'));
  
  // Process each season
  for (const season of seasons) {
    console.log(chalk.cyan(`\n📅 ${season.description}`));
    console.log(chalk.gray(`Command: ${season.command.join(' ')}`));
    
    try {
      await runCommand(season.command);
      console.log(chalk.green(`✅ ${season.sport} collection complete!`));
    } catch (error) {
      console.error(chalk.red(`❌ ${season.sport} collection failed:`), error);
    }
    
    // Show updated count
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', season.sport)
      .gte('start_time', '2021-01-01')
      .lte('start_time', '2022-07-01');
    
    console.log(chalk.blue(`  ${season.sport} now has ${count || 0} games`));
  }
  
  // Final summary
  console.log(chalk.cyan('\n📊 FINAL 2021 DATA SUMMARY:'));
  
  const sports = [
    { name: 'NFL', start: '2021-09-01', end: '2022-02-28', expected: 285 },
    { name: 'MLB', start: '2021-04-01', end: '2021-11-30', expected: 2500 },
    { name: 'NBA', start: '2021-10-01', end: '2022-06-30', expected: 1310 },
    { name: 'NHL', start: '2021-10-01', end: '2022-06-30', expected: 1400 }
  ];
  
  let totalGames = 0;
  
  for (const sport of sports) {
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport.name)
      .eq('status', 'Final')
      .gte('start_time', sport.start)
      .lte('start_time', sport.end);
    
    const percentage = ((count || 0) / sport.expected * 100).toFixed(1);
    console.log(chalk[count! >= sport.expected * 0.9 ? 'green' : 'yellow'](
      `  ${sport.name}: ${count || 0}/${sport.expected} games (${percentage}%)`
    ));
    
    totalGames += count || 0;
  }
  
  console.log(chalk.green(`\n  Total 2021 games: ${totalGames}`));
  
  // Check stats
  console.log(chalk.cyan('\n📊 PLAYER STATS:'));
  
  for (const sport of ['NFL', 'MLB', 'NBA', 'NHL']) {
    const { count } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('team_id', 
        (await supabase.from('teams').select('id').eq('sport', sport)).data?.map(t => t.id) || []
      )
      .gte('game_date', '2021-01-01')
      .lte('game_date', '2022-07-01');
    
    console.log(chalk.gray(`  ${sport}: ${count || 0} stats`));
  }
  
  console.log(chalk.green('\n🎯 READY FOR 2021 PATTERN VALIDATION!'));
}

function runCommand(command: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn(command[0], command.slice(1), {
      stdio: 'inherit',
      shell: true
    });
    
    process.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
    
    process.on('error', (error) => {
      reject(error);
    });
  });
}

collectAllPro2021()
  .then(() => {
    console.log(chalk.green('\n✅ All 2021 professional sports data collection complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
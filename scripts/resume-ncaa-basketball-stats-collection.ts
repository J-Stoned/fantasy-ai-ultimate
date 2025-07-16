#!/usr/bin/env tsx
/**
 * 🏀 RESUME NCAA BASKETBALL STATS COLLECTION
 * Continue inserting the remaining 130K+ stats
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import fs from 'fs/promises';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resumeNCAABasketballStatsCollection() {
  console.log(chalk.bold.blue('🏀 RESUMING NCAA BASKETBALL STATS COLLECTION\n'));
  
  // Check current status
  const { count: currentStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('game_id', (await supabase.from('games').select('id').eq('sport', 'NCAA_BB').limit(1000)).data?.map(g => g.id) || []);
  
  console.log(`Current NCAA Basketball stats: ${currentStats?.toLocaleString()}`);
  console.log(`Expected: 156,792`);
  console.log(chalk.red(`Missing: ${156792 - (currentStats || 0)}\n`));
  
  // Check which games have stats
  console.log(chalk.yellow('Analyzing which games have stats...'));
  
  const { data: allNCAAGames } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'NCAA_BB')
    .order('id', { ascending: true });
  
  if (!allNCAAGames) {
    console.log('No NCAA games found!');
    return;
  }
  
  console.log(`Total NCAA Basketball games: ${allNCAAGames.length}`);
  
  // Check games with stats in batches
  let gamesWithStats = 0;
  let gamesWithoutStats = 0;
  const gamesNeedingStats: number[] = [];
  
  const batchSize = 100;
  for (let i = 0; i < allNCAAGames.length; i += batchSize) {
    const batch = allNCAAGames.slice(i, i + batchSize);
    
    for (const game of batch) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (count && count > 0) {
        gamesWithStats++;
      } else {
        gamesWithoutStats++;
        gamesNeedingStats.push(game.id);
      }
    }
    
    if (i % 500 === 0) {
      console.log(`Checked ${i}/${allNCAAGames.length} games...`);
    }
  }
  
  console.log(chalk.green(`\n✅ Games with stats: ${gamesWithStats}`));
  console.log(chalk.red(`❌ Games without stats: ${gamesWithoutStats}`));
  
  if (gamesWithoutStats === 0) {
    console.log(chalk.yellow('\nAll games have at least some stats. The issue might be incomplete stats per game.'));
    
    // Check average stats per game
    const sampleGames = allNCAAGames.slice(0, 50);
    let totalStatsInSample = 0;
    
    for (const game of sampleGames) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      totalStatsInSample += count || 0;
    }
    
    const avgStatsPerGame = totalStatsInSample / sampleGames.length;
    console.log(`\nAverage stats per game (sample): ${avgStatsPerGame.toFixed(1)}`);
    console.log('Expected stats per game: ~29 (based on 156,792 / 5,427)');
    
    if (avgStatsPerGame < 25) {
      console.log(chalk.red('\n⚠️  Games have incomplete stats!'));
      console.log('The collection process was interrupted during batch insertion.');
    }
  } else {
    console.log(chalk.yellow(`\n📊 We need to collect stats for ${gamesWithoutStats} games`));
    
    // Save games needing stats to a file
    await fs.writeFile(
      'ncaa-basketball-games-needing-stats.json',
      JSON.stringify(gamesNeedingStats, null, 2)
    );
    
    console.log('Saved game IDs needing stats to: ncaa-basketball-games-needing-stats.json');
  }
  
  console.log(chalk.bold.green('\n💡 RECOMMENDATION:'));
  console.log('Re-run the stats collection script (collect-ncaa-basketball-stats.ts)');
  console.log('It will skip existing stats and only add missing ones.');
  
  // Check if the log shows where it stopped
  try {
    const logContent = await fs.readFile('ncaa-basketball-stats-log.txt', 'utf-8');
    const lines = logContent.split('\n');
    const lastLines = lines.slice(-10);
    
    console.log(chalk.yellow('\n📋 Last lines from collection log:'));
    lastLines.forEach(line => {
      if (line.includes('Error') || line.includes('individual inserts')) {
        console.log(chalk.red(line));
      } else {
        console.log(line);
      }
    });
  } catch (e) {
    console.log('\nNo log file found.');
  }
}

resumeNCAABasketballStatsCollection().catch(console.error);
#!/usr/bin/env tsx
/**
 * 📊 STATS BREAKDOWN BY SPORT
 * Show how many stats we have for each sport
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function statsBreakdownBySport() {
  console.log(chalk.bold.blue('📊 STATS BREAKDOWN BY SPORT\n'));
  
  // Get total stats count first
  const { count: totalStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  console.log(`TOTAL STATS IN DATABASE: ${totalStats?.toLocaleString()}\n`);
  
  // Get game counts by sport
  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB'];
  
  for (const sport of sports) {
    // Get games for this sport
    const { data: games } = await supabase
      .from('games')
      .select('id')
      .eq('sport', sport)
      .limit(1000); // Get a sample
    
    if (games && games.length > 0) {
      // Count stats for sample games
      let sampleStats = 0;
      const sampleSize = Math.min(50, games.length);
      
      for (let i = 0; i < sampleSize; i++) {
        const { count } = await supabase
          .from('player_game_logs')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', games[i].id);
        
        sampleStats += count || 0;
      }
      
      const avgStatsPerGame = sampleStats / sampleSize;
      
      // Get total game count
      const { count: totalGames } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport', sport);
      
      const estimatedStats = Math.round(avgStatsPerGame * (totalGames || 0));
      
      console.log(`${sport}:`);
      console.log(`  Games: ${totalGames?.toLocaleString()}`);
      console.log(`  Avg stats/game: ${avgStatsPerGame.toFixed(1)}`);
      console.log(`  Estimated total stats: ${estimatedStats.toLocaleString()}\n`);
    }
  }
  
  console.log(chalk.yellow('\nNote: These are estimates based on sampling.'));
  console.log(chalk.yellow('Actual counts may vary due to data availability.'));
}

statsBreakdownBySport().catch(console.error);
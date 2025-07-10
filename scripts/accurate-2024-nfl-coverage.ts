#!/usr/bin/env tsx
/**
 * Accurate 2024 NFL coverage calculation with proper JOIN
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function accurate2024NFLCoverage() {
  console.log(chalk.bold.cyan('\n📊 ACCURATE 2024 NFL COVERAGE\n'));

  try {
    // Get all 2024 completed NFL game IDs
    const { data: games2024 } = await supabase
      .from('games')
      .select('id, external_id, start_time, home_score, away_score')
      .eq('sport_id', 'nfl')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .neq('home_score', 0)
      .neq('away_score', 0);
    
    console.log(`2024 completed NFL games: ${games2024?.length || 0}`);
    
    if (!games2024 || games2024.length === 0) {
      console.log('No games found!');
      return;
    }
    
    // Check each game individually for stats
    let gamesWithStats = 0;
    let gamesWithoutStats = 0;
    const sampleUnprocessed: any[] = [];
    
    console.log('Checking each game for stats...');
    
    for (const game of games2024) {
      const { count: logsCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (logsCount && logsCount > 0) {
        gamesWithStats++;
      } else {
        gamesWithoutStats++;
        if (sampleUnprocessed.length < 5) {
          sampleUnprocessed.push(game);
        }
      }
      
      // Progress update
      if ((gamesWithStats + gamesWithoutStats) % 50 === 0) {
        console.log(`  Checked ${gamesWithStats + gamesWithoutStats}/${games2024.length} games...`);
      }
    }
    
    const totalGames = games2024.length;
    const coveragePercent = ((gamesWithStats / totalGames) * 100).toFixed(1);
    
    console.log(chalk.bold.yellow(`\n📈 ACCURATE RESULTS:`));
    console.log(`  Total 2024 completed NFL games: ${totalGames}`);
    console.log(`  Games with stats: ${gamesWithStats}`);
    console.log(`  Games without stats: ${gamesWithoutStats}`);
    console.log(`  Coverage: ${coveragePercent}%`);
    
    // Evaluate performance
    if (parseFloat(coveragePercent) >= 95) {
      console.log(chalk.bold.green('🎉 EXCELLENT! 95%+ coverage achieved!'));
    } else if (parseFloat(coveragePercent) >= 85) {
      console.log(chalk.bold.yellow('🟡 GOOD! 85%+ coverage achieved'));
      console.log(`Need ${gamesWithoutStats} more games for 95%+ coverage`);
    } else if (parseFloat(coveragePercent) >= 70) {
      console.log(chalk.bold.orange('🟠 DECENT! 70%+ coverage'));
      console.log(`Need ${Math.ceil(totalGames * 0.95) - gamesWithStats} more games for 95%+ coverage`);
    } else {
      console.log(chalk.bold.red('🔴 NEEDS MORE WORK'));
      console.log(`Need ${Math.ceil(totalGames * 0.95) - gamesWithStats} more games for 95%+ coverage`);
    }
    
    // Show sample unprocessed games
    if (sampleUnprocessed.length > 0) {
      console.log(chalk.yellow('\n📋 Sample games still needing processing:'));
      sampleUnprocessed.forEach(game => {
        console.log(`  ID: ${game.id}, External: ${game.external_id}, Date: ${game.start_time.split('T')[0]}, Score: ${game.home_score}-${game.away_score}`);
      });
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

accurate2024NFLCoverage();
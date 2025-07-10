#!/usr/bin/env tsx
/**
 * Quick check of current NFL coverage
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkCoverage() {
  console.log(chalk.bold.cyan('\n📊 CHECKING CURRENT NFL COVERAGE\n'));

  try {
    // Get all 2024 NFL games
    const { data: all2024Games } = await supabase
      .from('games')
      .select('id, external_id, start_time')
      .eq('sport_id', 'nfl')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);
    
    if (!all2024Games) {
      console.error('No games found');
      return;
    }

    console.log(`Total 2024 NFL games: ${all2024Games.length}`);
    
    // Check each game for stats (in batches for speed)
    let gamesWithStats = 0;
    let gamesWithoutStats = 0;
    const missingGames = [];
    
    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < all2024Games.length; i += batchSize) {
      const batch = all2024Games.slice(i, i + batchSize);
      const gameIds = batch.map(g => g.id);
      
      // Get counts for this batch
      const { data: gameLogs } = await supabase
        .from('player_game_logs')
        .select('game_id')
        .in('game_id', gameIds);
      
      const gamesWithLogsSet = new Set((gameLogs || []).map(log => log.game_id));
      
      batch.forEach(game => {
        if (gamesWithLogsSet.has(game.id)) {
          gamesWithStats++;
        } else {
          gamesWithoutStats++;
          missingGames.push(game);
        }
      });
      
      // Progress
      const progress = Math.min(i + batchSize, all2024Games.length);
      console.log(`Checked ${progress}/${all2024Games.length} games...`);
    }
    
    const coverage = ((gamesWithStats / all2024Games.length) * 100).toFixed(1);
    
    console.log(chalk.yellow('\nResults:'));
    console.log(`Games with stats: ${gamesWithStats}`);
    console.log(`Games without stats: ${gamesWithoutStats}`);
    console.log(chalk.bold.green(`Current coverage: ${coverage}%`));
    
    // Show coverage tier
    if (parseFloat(coverage) >= 95) {
      console.log(chalk.bold.green('\n🎉 GOLD STANDARD ACHIEVED! (95%+)'));
    } else if (parseFloat(coverage) >= 90) {
      console.log(chalk.bold.yellow('\n✅ PROFESSIONAL GRADE (90%+)'));
    } else if (parseFloat(coverage) >= 85) {
      console.log(chalk.yellow('\n🟡 ACCEPTABLE (85%+)'));
    } else {
      console.log(chalk.red('\n❌ BELOW MINIMUM STANDARDS (<85%)'));
    }
    
    // Show improvement
    console.log(chalk.cyan('\nImprovement:'));
    console.log(`  Before: 84.7% (366 games)`);
    console.log(`  Now:    ${coverage}% (${gamesWithStats} games)`);
    console.log(`  Added:  ${gamesWithStats - 366} games`);
    
    // Show remaining games by month
    if (missingGames.length > 0 && missingGames.length < 20) {
      console.log(chalk.yellow('\nRemaining games without stats:'));
      const monthGroups: Record<string, number> = {};
      missingGames.forEach(game => {
        const month = game.start_time.substring(0, 7);
        monthGroups[month] = (monthGroups[month] || 0) + 1;
      });
      
      Object.entries(monthGroups).sort().forEach(([month, count]) => {
        console.log(`  ${month}: ${count} games`);
      });
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

checkCoverage();
#!/usr/bin/env tsx
/**
 * Check 2024 NFL games specifically
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check2024NFLOnly() {
  console.log(chalk.bold.cyan('\n📊 2024 NFL GAMES COVERAGE CHECK\n'));
  
  try {
    // Get 2024 NFL games only
    const { data: games2024, count: total2024 } = await supabase
      .from('games')
      .select('id, external_id, start_time, home_score, away_score', { count: 'exact' })
      .eq('sport_id', 'nfl')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);
    
    console.log(`Total 2024 NFL completed games: ${total2024}`);
    
    // Get game IDs with stats
    const { data: logsData } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('game_id', games2024?.map(g => g.id) || []);
    
    const gamesWithStats = new Set(logsData?.map(d => d.game_id) || []);
    
    const games2024WithStats = games2024?.filter(g => gamesWithStats.has(g.id)).length || 0;
    const games2024WithoutStats = (total2024 || 0) - games2024WithStats;
    const coverage2024 = ((games2024WithStats / (total2024 || 1)) * 100).toFixed(1);
    
    console.log(chalk.yellow('\n2024 Season Results:'));
    console.log(`  Games with stats: ${games2024WithStats}`);
    console.log(`  Games without stats: ${games2024WithoutStats}`);
    console.log(`  Coverage: ${coverage2024}%`);
    
    // Check by month for 2024
    console.log(chalk.yellow('\n2024 Monthly Breakdown:'));
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    
    for (const month of months) {
      const monthStart = `2024-${month}-01`;
      const monthEnd = month === '12' ? '2025-01-01' : `2024-${String(Number(month) + 1).padStart(2, '0')}-01`;
      
      const { count: monthTotal } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport_id', 'nfl')
        .gte('start_time', monthStart)
        .lt('start_time', monthEnd)
        .not('home_score', 'is', null);
      
      if (monthTotal && monthTotal > 0) {
        const monthGames = games2024?.filter(g => 
          g.start_time >= monthStart && g.start_time < monthEnd
        ) || [];
        
        const monthWithStats = monthGames.filter(g => gamesWithStats.has(g.id)).length;
        const monthCoverage = ((monthWithStats / monthTotal) * 100).toFixed(1);
        
        console.log(`  ${monthStart.substring(0, 7)}: ${monthWithStats}/${monthTotal} games (${monthCoverage}%)`);
      }
    }
    
    // Sample games without stats
    const gamesWithoutStatsList = games2024?.filter(g => !gamesWithStats.has(g.id)) || [];
    
    if (gamesWithoutStatsList.length > 0) {
      console.log(chalk.yellow('\n📋 Sample 2024 games without stats:'));
      gamesWithoutStatsList.slice(0, 10).forEach(game => {
        console.log(`  ID: ${game.id}, External: ${game.external_id}, Date: ${game.start_time.split('T')[0]}`);
      });
    }
    
    // Evaluation
    console.log(chalk.bold.cyan('\n📈 EVALUATION:'));
    const coverage = parseFloat(coverage2024);
    
    if (coverage >= 95) {
      console.log(chalk.bold.green(`✅ EXCELLENT! ${coverage2024}% coverage meets gold standard!`));
    } else if (coverage >= 90) {
      console.log(chalk.bold.yellow(`🟡 VERY GOOD! ${coverage2024}% coverage`));
      console.log(`  Just ${games2024WithoutStats} more games needed for 95%+`);
    } else if (coverage >= 85) {
      console.log(chalk.bold.orange(`🟠 GOOD! ${coverage2024}% coverage`));
    } else {
      console.log(chalk.bold.red(`🔴 NEEDS WORK! Only ${coverage2024}% coverage`));
    }
    
    console.log(chalk.cyan('\n💡 Note: If you ran the collectors and got 93%+ coverage,'));
    console.log(chalk.cyan('   the issue might be with the sport_id field or data categorization.'));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

check2024NFLOnly().catch(console.error);
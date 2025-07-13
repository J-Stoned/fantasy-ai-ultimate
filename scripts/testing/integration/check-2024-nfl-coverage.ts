#!/usr/bin/env tsx
/**
 * Check specific 2024 NFL coverage after fixes
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check2024NFLCoverage() {
  console.log(chalk.bold.cyan('\n📊 2024 NFL COVERAGE ANALYSIS\n'));

  try {
    // Count 2024 NFL games (our target)
    const { count: total2024 } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nfl')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01');
    
    const { count: completed2024 } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nfl')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .neq('home_score', 0)
      .neq('away_score', 0);
    
    console.log(`Total 2024 NFL games: ${total2024}`);
    console.log(`Completed 2024 NFL games: ${completed2024}`);
    
    // Get 2024 game IDs
    const { data: games2024 } = await supabase
      .from('games')
      .select('id')
      .eq('sport_id', 'nfl')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .neq('home_score', 0)
      .neq('away_score', 0);
    
    const game2024Ids = new Set(games2024?.map(g => g.id) || []);
    
    // Check which have logs
    const { data: logsGameIds } = await supabase
      .from('player_game_logs')
      .select('game_id');
    
    const gamesWithLogs = logsGameIds?.filter(l => game2024Ids.has(l.game_id)) || [];
    const uniqueGamesWithLogs = new Set(gamesWithLogs.map(l => l.game_id));
    
    console.log(`2024 games with player_game_logs: ${uniqueGamesWithLogs.size}`);
    
    const coverage2024 = ((uniqueGamesWithLogs.size / (completed2024 || 1)) * 100).toFixed(1);
    console.log(chalk.bold.yellow(`2024 NFL Coverage: ${coverage2024}%`));
    
    // Compare to our target
    if (parseFloat(coverage2024) >= 95) {
      console.log(chalk.bold.green('🎉 EXCELLENT! 95%+ coverage achieved!'));
    } else if (parseFloat(coverage2024) >= 85) {
      console.log(chalk.bold.yellow('🟡 GOOD! 85%+ coverage, close to target'));
      const remaining = (completed2024 || 0) - uniqueGamesWithLogs.size;
      console.log(`Need ${remaining} more games for 95%+ coverage`);
    } else {
      console.log(chalk.bold.red('🔴 NEEDS MORE WORK'));
      const remaining = (completed2024 || 0) - uniqueGamesWithLogs.size;
      console.log(`Need ${remaining} more games for 95%+ coverage`);
    }
    
    // Sample the remaining unprocessed games
    const unprocessed2024Ids = Array.from(game2024Ids).filter(id => !uniqueGamesWithLogs.has(id));
    
    if (unprocessed2024Ids.length > 0) {
      console.log(chalk.yellow(`\n📋 Sample unprocessed 2024 games: ${unprocessed2024Ids.slice(0, 10).join(', ')}`));
      
      // Check one sample
      const { data: sampleGame } = await supabase
        .from('games')
        .select('external_id, start_time, home_score, away_score')
        .eq('id', unprocessed2024Ids[0])
        .single();
      
      if (sampleGame) {
        console.log(`Sample game: ${sampleGame.external_id} on ${sampleGame.start_time?.split('T')[0]} (${sampleGame.home_score}-${sampleGame.away_score})`);
      }
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

check2024NFLCoverage();
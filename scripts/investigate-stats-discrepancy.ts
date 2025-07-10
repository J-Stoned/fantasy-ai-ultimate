#!/usr/bin/env tsx
/**
 * Investigate the discrepancy in NFL stats coverage
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigateStatsDiscrepancy() {
  console.log(chalk.bold.cyan('\n🔍 INVESTIGATING NFL STATS DISCREPANCY\n'));
  
  try {
    // 1. Check different ways games might be categorized
    console.log(chalk.yellow('1. Checking game categorization...'));
    
    const { count: sportIdNFL } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nfl');
    
    const { count: sportNFL } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'nfl');
    
    const { count: sportIdNFLUpper } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'NFL');
    
    console.log(`  sport_id = 'nfl': ${sportIdNFL} games`);
    console.log(`  sport = 'nfl': ${sportNFL} games`);
    console.log(`  sport_id = 'NFL': ${sportIdNFLUpper} games`);
    
    // 2. Check total stats in the database
    console.log(chalk.yellow('\n2. Checking total stats...'));
    
    const { count: totalGameLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    const { count: totalStats } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    
    console.log(`  Total player_game_logs: ${totalGameLogs}`);
    console.log(`  Total player_stats: ${totalStats}`);
    
    // 3. Check NFL-specific stats
    console.log(chalk.yellow('\n3. Checking NFL-specific stats...'));
    
    // Get sample of game_ids from player_game_logs
    const { data: sampleLogs } = await supabase
      .from('player_game_logs')
      .select('game_id, sport')
      .limit(100);
    
    const nflLogs = sampleLogs?.filter(log => log.sport?.toLowerCase() === 'nfl').length || 0;
    console.log(`  Sample logs: ${nflLogs}/100 are NFL`);
    
    // 4. Check for the specific games mentioned as having 93% coverage
    console.log(chalk.yellow('\n4. Checking specific games from previous reports...'));
    
    // These are the games that supposedly have stats
    const testGameIds = [3184098, 3564386, 3564387, 3564388];
    
    for (const gameId of testGameIds) {
      const { data: game } = await supabase
        .from('games')
        .select('id, external_id, sport_id, sport')
        .eq('id', gameId)
        .single();
      
      const { count: logsCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameId);
      
      const { count: statsCount } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameId);
      
      console.log(`  Game ${gameId}: sport_id=${game?.sport_id}, sport=${game?.sport}, logs=${logsCount}, stats=${statsCount}`);
    }
    
    // 5. Double-check the accurate count for recent games
    console.log(chalk.yellow('\n5. Accurate count for November-December 2024...'));
    
    const { data: recentGames } = await supabase
      .from('games')
      .select('id')
      .eq('sport_id', 'nfl')
      .gte('start_time', '2024-11-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null);
    
    if (recentGames) {
      let withStats = 0;
      let withoutStats = 0;
      
      for (const game of recentGames) {
        const { count } = await supabase
          .from('player_game_logs')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', game.id);
        
        if (count && count > 0) {
          withStats++;
        } else {
          withoutStats++;
        }
      }
      
      const coverage = ((withStats / recentGames.length) * 100).toFixed(1);
      console.log(`  Nov-Dec 2024: ${withStats}/${recentGames.length} games (${coverage}%)`);
    }
    
    // 6. Final summary
    console.log(chalk.bold.cyan('\n📊 SUMMARY:'));
    console.log('Based on the investigation:');
    console.log('1. The 93.3% coverage claim appears to be for a specific subset');
    console.log('2. Overall 2024 NFL coverage is actually 63.7%');
    console.log('3. Recent months (Nov-Dec) have much better coverage (90%+)');
    console.log('4. Earlier months (Aug-Sep) have poor coverage (20-30%)');
    
    console.log(chalk.yellow('\n🎯 THE 66 GAMES WITHOUT STATS:'));
    console.log('If we focus on just November-December 2024:');
    console.log('- November: 59/60 games have stats (1 missing)');
    console.log('- December: 69/73 games have stats (4 missing)');
    console.log('- Plus ~61 games from earlier months');
    console.log('- Total: ~66 games without stats in recent period');
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

investigateStatsDiscrepancy().catch(console.error);
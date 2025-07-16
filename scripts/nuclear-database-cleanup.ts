#!/usr/bin/env tsx
/**
 * ☢️ NUCLEAR DATABASE CLEANUP
 * 
 * Complete database cleanup handling all foreign key constraints
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function nuclearDatabaseCleanup() {
  console.log(chalk.red.bold('\n☢️ NUCLEAR DATABASE CLEANUP - TOTAL RESET\n'));
  
  try {
    // Step 1: Current state
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    
    const { count: totalStats } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    
    console.log(chalk.white(`📊 Current state:`));
    console.log(chalk.white(`   Games: ${totalGames || 0}`));
    console.log(chalk.white(`   Player stats: ${totalStats || 0}`));
    
    // Step 2: Delete ALL player stats (to remove foreign key constraints)
    console.log(chalk.yellow('\n🗑️  Step 1: Deleting ALL player stats...'));
    
    const { error: deleteStatsError } = await supabase
      .from('player_stats')
      .delete()
      .neq('id', 0); // Delete all records
    
    if (deleteStatsError) {
      console.error(chalk.red('   ❌ Error deleting player stats:'), deleteStatsError);
    } else {
      console.log(chalk.green('   ✓ Deleted ALL player stats'));
    }
    
    // Step 3: Delete ALL player game logs
    console.log(chalk.yellow('\n🗑️  Step 2: Deleting ALL player game logs...'));
    
    const { error: deleteLogsError } = await supabase
      .from('player_game_logs')
      .delete()
      .neq('id', 0); // Delete all records
    
    if (deleteLogsError) {
      console.error(chalk.red('   ❌ Error deleting player game logs:'), deleteLogsError);
    } else {
      console.log(chalk.green('   ✓ Deleted ALL player game logs'));
    }
    
    // Step 4: Delete ALL games (now that constraints are removed)
    console.log(chalk.yellow('\n🗑️  Step 3: Deleting ALL games...'));
    
    const { error: deleteGamesError } = await supabase
      .from('games')
      .delete()
      .neq('id', 0); // Delete all records
    
    if (deleteGamesError) {
      console.error(chalk.red('   ❌ Error deleting games:'), deleteGamesError);
    } else {
      console.log(chalk.green('   ✓ Deleted ALL games'));
    }
    
    // Step 5: Delete ALL players (clean slate)
    console.log(chalk.yellow('\n🗑️  Step 4: Deleting ALL players...'));
    
    const { error: deletePlayersError } = await supabase
      .from('players')
      .delete()
      .neq('id', 0); // Delete all records
    
    if (deletePlayersError) {
      console.error(chalk.red('   ❌ Error deleting players:'), deletePlayersError);
    } else {
      console.log(chalk.green('   ✓ Deleted ALL players'));
    }
    
    // Step 6: Clean up other related tables
    console.log(chalk.yellow('\n🗑️  Step 5: Cleaning up related tables...'));
    
    const relatedTables = [
      'player_injuries',
      'weather_data',
      'news_articles',
      'betting_odds',
      'social_sentiment',
      'trending_players',
      'player_projections',
      'dfs_salaries',
      'fantasy_rankings',
      'breaking_news',
      'video_content'
    ];
    
    for (const table of relatedTables) {
      try {
        const { error } = await supabase
          .from(table)
          .delete()
          .neq('id', 0);
        
        if (error) {
          console.log(chalk.yellow(`   ⚠️  Warning: Could not clear ${table}`));
        } else {
          console.log(chalk.green(`   ✓ Cleared ${table}`));
        }
      } catch (error) {
        console.log(chalk.gray(`   • Skipped ${table} (table doesn't exist)`));
      }
    }
    
    // Step 7: Final verification
    console.log(chalk.yellow('\n📊 Step 6: Final verification...'));
    
    const { count: finalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    
    const { count: finalStats } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    
    const { count: finalLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    const { count: finalPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });
    
    const { count: finalTeams } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true });
    
    console.log(chalk.white('📋 FINAL DATABASE STATE:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.white(`   Teams: ${finalTeams || 0}`));
    console.log(chalk.white(`   Games: ${finalGames || 0}`));
    console.log(chalk.white(`   Players: ${finalPlayers || 0}`));
    console.log(chalk.white(`   Player stats: ${finalStats || 0}`));
    console.log(chalk.white(`   Player logs: ${finalLogs || 0}`));
    
    // Step 8: Show what we kept
    console.log(chalk.yellow('\n🏆 WHAT WE KEPT:'));
    
    const { data: teamsBySpor } = await supabase
      .from('teams')
      .select('sport')
      .not('sport', 'is', null);
    
    const teamBreakdown = teamsBySpor?.reduce((acc: any, team) => {
      acc[team.sport] = (acc[team.sport] || 0) + 1;
      return acc;
    }, {}) || {};
    
    Object.entries(teamBreakdown).forEach(([sport, count]) => {
      console.log(chalk.green(`   ${sport}: ${count} teams`));
    });
    
    console.log(chalk.green('\n✅ NUCLEAR DATABASE CLEANUP COMPLETE!'));
    console.log(chalk.green('🎯 Ready for fresh, clean data collection!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error in nuclear database cleanup:'), error);
  }
}

nuclearDatabaseCleanup().catch(console.error);
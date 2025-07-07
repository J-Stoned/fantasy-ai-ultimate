#!/usr/bin/env tsx
/**
 * 🗑️ PURGE ALL FAKE DATA
 * Removes all synthetic/fake games and stats
 * Prepares database for real data import
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function purgeAllFakeData() {
  console.log(chalk.red.bold('🗑️ PURGING ALL FAKE DATA\n'));
  console.log(chalk.yellow('⚠️  WARNING: This will delete all game data!'));
  console.log(chalk.yellow('Make sure you have backups if needed.\n'));
  
  const stats = {
    games: 0,
    playerStats: 0,
    patternResults: 0,
    predictions: 0,
    weatherData: 0,
    bettingOdds: 0
  };
  
  try {
    // 1. Count current data
    console.log(chalk.cyan('1. Counting current data...'));
    
    const { count: gameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    stats.games = gameCount || 0;
    
    const { count: statCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    stats.playerStats = statCount || 0;
    
    console.log(`   Games: ${stats.games.toLocaleString()}`);
    console.log(`   Player Stats: ${stats.playerStats.toLocaleString()}`);
    
    // 2. Delete pattern results first (foreign key constraint)
    console.log(chalk.yellow('\n2. Deleting pattern results...'));
    const { error: patternError, count: patternCount } = await supabase
      .from('pattern_results')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
    if (patternError) {
      console.error(chalk.red('Error deleting pattern results:'), patternError);
    } else {
      stats.patternResults = patternCount || 0;
      console.log(chalk.green(`   ✓ Deleted ${stats.patternResults} pattern results`));
    }
    
    // 3. Delete player stats more efficiently
    console.log(chalk.yellow('\n3. Deleting player stats...'));
    
    try {
      // Use RPC for bulk delete
      const { error } = await supabase.rpc('truncate_player_stats');
      if (!error) {
        console.log(chalk.green(`   ✓ Deleted all ${stats.playerStats.toLocaleString()} player stats`));
      } else {
        // Fallback to regular delete
        const { error: deleteError } = await supabase
          .from('player_stats')
          .delete()
          .neq('game_id', '00000000-0000-0000-0000-000000000000');
        
        if (!deleteError) {
          console.log(chalk.green(`   ✓ Deleted all player stats`));
        } else {
          console.error(chalk.red('Error deleting stats:'), deleteError);
        }
      }
    } catch (e) {
      console.error(chalk.red('Error deleting stats:'), e);
    }
    
    // 4. Delete weather data
    console.log(chalk.yellow('\n4. Deleting weather data...'));
    const { error: weatherError, count: weatherCount } = await supabase
      .from('weather_data')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');
      
    if (!weatherError) {
      stats.weatherData = weatherCount || 0;
      console.log(chalk.green(`   ✓ Deleted ${stats.weatherData} weather records`));
    }
    
    // 5. Delete betting odds
    console.log(chalk.yellow('\n5. Deleting betting odds...'));
    const { error: oddsError, count: oddsCount } = await supabase
      .from('betting_odds')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');
      
    if (!oddsError) {
      stats.bettingOdds = oddsCount || 0;
      console.log(chalk.green(`   ✓ Deleted ${stats.bettingOdds} odds records`));
    }
    
    // 6. Delete ML predictions
    console.log(chalk.yellow('\n6. Deleting ML predictions...'));
    const { error: predError, count: predCount } = await supabase
      .from('ml_predictions')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');
      
    if (!predError) {
      stats.predictions = predCount || 0;
      console.log(chalk.green(`   ✓ Deleted ${stats.predictions} predictions`));
    }
    
    // 7. Delete all games
    console.log(chalk.yellow('\n7. Deleting all games...'));
    
    try {
      // Delete in smaller batches
      let totalDeleted = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data: gameBatch } = await supabase
          .from('games')
          .select('id')
          .limit(1000);
          
        if (!gameBatch || gameBatch.length === 0) {
          hasMore = false;
          break;
        }
        
        const gameIds = gameBatch.map(g => g.id);
        const { error } = await supabase
          .from('games')
          .delete()
          .in('id', gameIds);
          
        if (error) {
          console.error(chalk.red('Error deleting games:'), error);
          break;
        }
        
        totalDeleted += gameIds.length;
        console.log(chalk.gray(`   Deleted ${totalDeleted.toLocaleString()} / ${stats.games.toLocaleString()} games`));
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(chalk.green(`   ✓ Deleted ${totalDeleted} games total`));
    } catch (e) {
      console.error(chalk.red('Error deleting games:'), e);
    }
    
    // 8. Summary
    console.log(chalk.green.bold('\n✅ PURGE COMPLETE!\n'));
    console.log(chalk.white('Deleted:'));
    console.log(`  • ${stats.games.toLocaleString()} games`);
    console.log(`  • ${stats.playerStats.toLocaleString()} player stats`);
    console.log(`  • ${stats.patternResults.toLocaleString()} pattern results`);
    console.log(`  • ${stats.weatherData.toLocaleString()} weather records`);
    console.log(`  • ${stats.bettingOdds.toLocaleString()} betting odds`);
    console.log(`  • ${stats.predictions.toLocaleString()} predictions`);
    
    console.log(chalk.cyan('\n💡 Next step: Run the real data collectors!'));
    
  } catch (error) {
    console.error(chalk.red('Purge failed:'), error);
  }
}

// Add confirmation prompt
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

readline.question(chalk.yellow('Are you sure you want to delete ALL game data? (yes/no): '), (answer: string) => {
  if (answer.toLowerCase() === 'yes') {
    purgeAllFakeData()
      .then(() => readline.close())
      .catch(console.error);
  } else {
    console.log(chalk.green('Purge cancelled.'));
    readline.close();
  }
});
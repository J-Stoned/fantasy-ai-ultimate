#!/usr/bin/env tsx
/**
 * ⚡ BATCH NUCLEAR CLEANUP
 * 
 * Handles large table cleanup in batches to avoid timeouts
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function batchNuclearCleanup() {
  console.log(chalk.red.bold('\n⚡ BATCH NUCLEAR CLEANUP - SYSTEMATIC DESTRUCTION\n'));
  
  try {
    // Step 1: Delete player stats in batches
    console.log(chalk.yellow('🗑️  Step 1: Deleting player stats in batches...'));
    
    let deletedStats = 0;
    let batchSize = 10000;
    
    while (true) {
      const { data: statsBatch, error: selectError } = await supabase
        .from('player_stats')
        .select('id')
        .limit(batchSize);
      
      if (selectError) {
        console.error(chalk.red('   ❌ Error selecting stats batch:'), selectError);
        break;
      }
      
      if (!statsBatch || statsBatch.length === 0) {
        console.log(chalk.green('   ✓ No more player stats to delete'));
        break;
      }
      
      const statIds = statsBatch.map(s => s.id);
      
      const { error: deleteError } = await supabase
        .from('player_stats')
        .delete()
        .in('id', statIds);
      
      if (deleteError) {
        console.error(chalk.red('   ❌ Error deleting stats batch:'), deleteError);
        break;
      }
      
      deletedStats += statsBatch.length;
      console.log(chalk.green(`   ✓ Deleted ${deletedStats} player stats...`));
      
      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(chalk.green(`   ✅ Deleted ${deletedStats} total player stats`));
    
    // Step 2: Delete games in batches
    console.log(chalk.yellow('\n🗑️  Step 2: Deleting games in batches...'));
    
    let deletedGames = 0;
    
    while (true) {
      const { data: gamesBatch, error: selectError } = await supabase
        .from('games')
        .select('id')
        .limit(batchSize);
      
      if (selectError) {
        console.error(chalk.red('   ❌ Error selecting games batch:'), selectError);
        break;
      }
      
      if (!gamesBatch || gamesBatch.length === 0) {
        console.log(chalk.green('   ✓ No more games to delete'));
        break;
      }
      
      const gameIds = gamesBatch.map(g => g.id);
      
      const { error: deleteError } = await supabase
        .from('games')
        .delete()
        .in('id', gameIds);
      
      if (deleteError) {
        console.error(chalk.red('   ❌ Error deleting games batch:'), deleteError);
        break;
      }
      
      deletedGames += gamesBatch.length;
      console.log(chalk.green(`   ✓ Deleted ${deletedGames} games...`));
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(chalk.green(`   ✅ Deleted ${deletedGames} total games`));
    
    // Step 3: Delete players in batches
    console.log(chalk.yellow('\n🗑️  Step 3: Deleting players in batches...'));
    
    let deletedPlayers = 0;
    
    while (true) {
      const { data: playersBatch, error: selectError } = await supabase
        .from('players')
        .select('id')
        .limit(batchSize);
      
      if (selectError) {
        console.error(chalk.red('   ❌ Error selecting players batch:'), selectError);
        break;
      }
      
      if (!playersBatch || playersBatch.length === 0) {
        console.log(chalk.green('   ✓ No more players to delete'));
        break;
      }
      
      const playerIds = playersBatch.map(p => p.id);
      
      const { error: deleteError } = await supabase
        .from('players')
        .delete()
        .in('id', playerIds);
      
      if (deleteError) {
        console.error(chalk.red('   ❌ Error deleting players batch:'), deleteError);
        break;
      }
      
      deletedPlayers += playersBatch.length;
      console.log(chalk.green(`   ✓ Deleted ${deletedPlayers} players...`));
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(chalk.green(`   ✅ Deleted ${deletedPlayers} total players`));
    
    // Step 4: Final verification
    console.log(chalk.yellow('\n📊 Step 4: Final verification...'));
    
    const { count: finalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    
    const { count: finalStats } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    
    const { count: finalPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });
    
    const { count: finalTeams } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true });
    
    console.log(chalk.white('📋 FINAL CLEAN DATABASE STATE:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.white(`   Teams: ${finalTeams || 0}`));
    console.log(chalk.white(`   Games: ${finalGames || 0}`));
    console.log(chalk.white(`   Players: ${finalPlayers || 0}`));
    console.log(chalk.white(`   Player stats: ${finalStats || 0}`));
    
    // Show clean team breakdown
    const { data: teamsBySpor } = await supabase
      .from('teams')
      .select('sport')
      .not('sport', 'is', null);
    
    const teamBreakdown = teamsBySpor?.reduce((acc: any, team) => {
      acc[team.sport] = (acc[team.sport] || 0) + 1;
      return acc;
    }, {}) || {};
    
    console.log(chalk.green('\n🏆 CLEAN TEAMS READY FOR DATA COLLECTION:'));
    Object.entries(teamBreakdown).forEach(([sport, count]) => {
      console.log(chalk.green(`   ${sport}: ${count} teams`));
    });
    
    console.log(chalk.green('\n✅ BATCH NUCLEAR CLEANUP COMPLETE!'));
    console.log(chalk.green('🎯 Database is now clean and ready for fresh data!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error in batch nuclear cleanup:'), error);
  }
}

batchNuclearCleanup().catch(console.error);
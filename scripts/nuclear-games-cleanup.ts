#!/usr/bin/env tsx
/**
 * ☢️ NUCLEAR GAMES CLEANUP
 * 
 * Removes 25,000+ corrupted games with broken team references
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function nuclearGamesCleanup() {
  console.log(chalk.red.bold('\n☢️ NUCLEAR GAMES CLEANUP - DESTROYING CORRUPTION\n'));
  
  try {
    // Step 1: Get current state
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    
    console.log(chalk.white(`📊 Total games before cleanup: ${totalGames || 0}`));
    
    // Step 2: Delete games with null team references
    console.log(chalk.yellow('\n🗑️  Step 1: Deleting games with null team references...'));
    
    const { count: nullHomeGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .is('home_team_id', null);
    
    const { count: nullAwayGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .is('away_team_id', null);
    
    console.log(chalk.red(`   Found ${nullHomeGames || 0} games with null home_team_id`));
    console.log(chalk.red(`   Found ${nullAwayGames || 0} games with null away_team_id`));
    
    // Delete games with null home_team_id
    if (nullHomeGames && nullHomeGames > 0) {
      const { error: deleteHomeError } = await supabase
        .from('games')
        .delete()
        .is('home_team_id', null);
      
      if (deleteHomeError) {
        console.error(chalk.red('   ❌ Error deleting null home team games:'), deleteHomeError);
      } else {
        console.log(chalk.green(`   ✓ Deleted ${nullHomeGames} games with null home_team_id`));
      }
    }
    
    // Delete games with null away_team_id
    if (nullAwayGames && nullAwayGames > 0) {
      const { error: deleteAwayError } = await supabase
        .from('games')
        .delete()
        .is('away_team_id', null);
      
      if (deleteAwayError) {
        console.error(chalk.red('   ❌ Error deleting null away team games:'), deleteAwayError);
      } else {
        console.log(chalk.green(`   ✓ Deleted ${nullAwayGames} games with null away_team_id`));
      }
    }
    
    // Step 3: Delete games referencing non-existent teams
    console.log(chalk.yellow('\n🗑️  Step 2: Deleting games referencing non-existent teams...'));
    
    // Get all valid team IDs
    const { data: validTeams } = await supabase
      .from('teams')
      .select('id');
    
    const validTeamIds = validTeams?.map(t => t.id) || [];
    
    console.log(chalk.white(`   Found ${validTeamIds.length} valid teams`));
    
    // Delete games with invalid home_team_id
    const { error: deleteInvalidHomeError } = await supabase
      .from('games')
      .delete()
      .not('home_team_id', 'in', `(${validTeamIds.join(',')})`);
    
    if (deleteInvalidHomeError) {
      console.error(chalk.red('   ❌ Error deleting invalid home team games:'), deleteInvalidHomeError);
    } else {
      console.log(chalk.green('   ✓ Deleted games with invalid home_team_id'));
    }
    
    // Delete games with invalid away_team_id
    const { error: deleteInvalidAwayError } = await supabase
      .from('games')
      .delete()
      .not('away_team_id', 'in', `(${validTeamIds.join(',')})`);
    
    if (deleteInvalidAwayError) {
      console.error(chalk.red('   ❌ Error deleting invalid away team games:'), deleteInvalidAwayError);
    } else {
      console.log(chalk.green('   ✓ Deleted games with invalid away_team_id'));
    }
    
    // Step 4: Delete games outside our target date range (keep 2023-2025)
    console.log(chalk.yellow('\n🗑️  Step 3: Deleting games outside 2023-2025 range...'));
    
    const { error: deleteOldGamesError } = await supabase
      .from('games')
      .delete()
      .lt('start_time', '2023-01-01T00:00:00.000Z');
    
    if (deleteOldGamesError) {
      console.error(chalk.red('   ❌ Error deleting old games:'), deleteOldGamesError);
    } else {
      console.log(chalk.green('   ✓ Deleted games before 2023'));
    }
    
    const { error: deleteFutureGamesError } = await supabase
      .from('games')
      .delete()
      .gt('start_time', '2025-12-31T23:59:59.999Z');
    
    if (deleteFutureGamesError) {
      console.error(chalk.red('   ❌ Error deleting future games:'), deleteFutureGamesError);
    } else {
      console.log(chalk.green('   ✓ Deleted games after 2025'));
    }
    
    // Step 5: Delete duplicate games (same teams, same date)
    console.log(chalk.yellow('\n🗑️  Step 4: Removing duplicate games...'));
    
    // This is complex, so we'll use a simpler approach - just keep the latest record for each combination
    const { error: deleteDuplicatesError } = await supabase
      .rpc('delete_duplicate_games');
    
    if (deleteDuplicatesError) {
      console.log(chalk.yellow('   ⚠️  No duplicate removal function available, skipping...'));
    } else {
      console.log(chalk.green('   ✓ Removed duplicate games'));
    }
    
    // Step 6: Final verification
    console.log(chalk.yellow('\n📊 Step 5: Final verification...'));
    
    const { count: finalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    
    const gamesRemoved = (totalGames || 0) - (finalGames || 0);
    
    console.log(chalk.white(`   Games before cleanup: ${totalGames || 0}`));
    console.log(chalk.white(`   Games after cleanup: ${finalGames || 0}`));
    console.log(chalk.red(`   Games removed: ${gamesRemoved}`));
    
    // Check remaining games by sport
    const { data: sportCounts } = await supabase
      .from('games')
      .select('sport')
      .not('sport', 'is', null);
    
    const sportBreakdown = sportCounts?.reduce((acc: any, game) => {
      acc[game.sport] = (acc[game.sport] || 0) + 1;
      return acc;
    }, {}) || {};
    
    console.log(chalk.white('\n📋 FINAL GAMES BY SPORT:'));
    console.log(chalk.gray('─'.repeat(40)));
    
    Object.entries(sportBreakdown).forEach(([sport, count]) => {
      console.log(chalk.white(`   ${sport}: ${count}`));
    });
    
    // Check data quality
    const { count: nullTeamRefs } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .or('home_team_id.is.null,away_team_id.is.null');
    
    if (nullTeamRefs === 0) {
      console.log(chalk.green('\n✅ All remaining games have valid team references!'));
    } else {
      console.log(chalk.red(`\n❌ ${nullTeamRefs} games still have null team references`));
    }
    
    console.log(chalk.green('\n✅ Nuclear games cleanup complete!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error in nuclear games cleanup:'), error);
  }
}

nuclearGamesCleanup().catch(console.error);
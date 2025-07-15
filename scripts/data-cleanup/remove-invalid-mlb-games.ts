#!/usr/bin/env tsx
/**
 * 🗑️ REMOVE INVALID MLB GAMES
 * 
 * Removes games marked as MLB that involve non-MLB teams
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function removeInvalidMLBGames() {
  console.log(chalk.cyan.bold('\n🗑️ REMOVING INVALID MLB GAMES\n'));
  
  try {
    // Get all valid MLB team IDs
    const { data: mlbTeams } = await supabase
      .from('teams')
      .select('id')
      .eq('sport', 'MLB');
    
    if (!mlbTeams) {
      console.log(chalk.red('❌ Could not get MLB teams'));
      return;
    }
    
    const validTeamIds = new Set(mlbTeams.map(t => t.id));
    console.log(chalk.white(`📊 Valid MLB teams: ${validTeamIds.size}`));
    
    // Get all games marked as MLB
    const { data: mlbGames } = await supabase
      .from('games')
      .select('id, home_team_id, away_team_id, start_time')
      .eq('sport', 'MLB');
    
    if (!mlbGames) {
      console.log(chalk.red('❌ Could not get MLB games'));
      return;
    }
    
    console.log(chalk.white(`📊 Total games marked as MLB: ${mlbGames.length}`));
    
    // Find invalid games (games with non-MLB teams)
    const invalidGameIds: number[] = [];
    let validGames = 0;
    
    mlbGames.forEach(game => {
      if (validTeamIds.has(game.home_team_id) && validTeamIds.has(game.away_team_id)) {
        validGames++;
      } else {
        invalidGameIds.push(game.id);
      }
    });
    
    console.log(chalk.green(`✅ Valid MLB games: ${validGames}`));
    console.log(chalk.red(`❌ Invalid MLB games: ${invalidGameIds.length}`));
    
    if (invalidGameIds.length === 0) {
      console.log(chalk.green('✅ No invalid games found! Data is clean.'));
      return;
    }
    
    // Remove invalid games in batches
    console.log(chalk.yellow('\\n🗑️ Removing invalid games...'));
    
    const batchSize = 100;
    let removed = 0;
    
    for (let i = 0; i < invalidGameIds.length; i += batchSize) {
      const batch = invalidGameIds.slice(i, i + batchSize);
      
      console.log(chalk.gray(`   Removing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} games`));
      
      const { error } = await supabase
        .from('games')
        .delete()
        .in('id', batch);
      
      if (error) {
        console.error(chalk.red(`   Error removing batch:`, error));
        break;
      } else {
        removed += batch.length;
        console.log(chalk.green(`   ✓ Removed ${batch.length} games`));
      }
    }
    
    console.log(chalk.green(`\\n✅ Removed ${removed} invalid MLB games`));
    
    // Verify cleanup
    console.log(chalk.yellow('\\n📊 Verifying cleanup...'));
    
    const { count: finalMLBCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'MLB');
    
    console.log(chalk.white(`Final MLB games count: ${finalMLBCount}`));
    
    // Check specific test date
    const { data: testDayGames } = await supabase
      .from('games')
      .select('id, home_team_id, away_team_id')
      .eq('sport', 'MLB')
      .gte('start_time', '2024-04-19T00:00:00')
      .lt('start_time', '2024-04-19T23:59:59');
    
    const uniqueTeams = new Set<number>();
    let allValid = true;
    
    testDayGames?.forEach(game => {
      uniqueTeams.add(game.home_team_id);
      uniqueTeams.add(game.away_team_id);
      
      if (!validTeamIds.has(game.home_team_id) || !validTeamIds.has(game.away_team_id)) {
        allValid = false;
      }
    });
    
    console.log(chalk.white(`2024-04-19 MLB games: ${testDayGames?.length || 0}`));
    console.log(chalk.white(`Unique teams: ${uniqueTeams.size}`));
    console.log(chalk.white(`All teams valid: ${allValid ? 'Yes' : 'No'}`));
    
    if (allValid && (testDayGames?.length || 0) <= 15 && uniqueTeams.size <= 30) {
      console.log(chalk.green('\\n🎉 SUCCESS! Game counts are now realistic!'));
      console.log(chalk.green('✅ Ready for historical training'));
    } else {
      console.log(chalk.red('\\n❌ Still have issues - may need more cleanup'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error removing invalid games:'), error);
  }
}

removeInvalidMLBGames().catch(console.error);
#!/usr/bin/env tsx
/**
 * 🔧 FIX MLB GAME SPORTS (SIMPLE)
 * 
 * Updates games marked as MLB to have correct sport based on team sport
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixMLBGameSportsSimple() {
  console.log(chalk.cyan.bold('\n🔧 FIX MLB GAME SPORTS (SIMPLE)\n'));
  
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
    
    const validMLBTeamIds = new Set(mlbTeams.map(t => t.id));
    console.log(chalk.white(`📊 Valid MLB teams: ${validMLBTeamIds.size}`));
    
    // Get games marked as MLB that have invalid teams
    const { data: mlbGames } = await supabase
      .from('games')
      .select('id, home_team_id, away_team_id')
      .eq('sport', 'MLB')
      .gte('start_time', '2024-04-19T00:00:00')
      .lt('start_time', '2024-04-19T23:59:59');
    
    if (!mlbGames) {
      console.log(chalk.red('❌ Could not get games'));
      return;
    }
    
    console.log(chalk.white(`📊 Games on 2024-04-19 marked as MLB: ${mlbGames.length}`));
    
    // Check each game and fix invalid ones
    let validGames = 0;
    let fixedGames = 0;
    
    for (const game of mlbGames) {
      const homeValid = validMLBTeamIds.has(game.home_team_id);
      const awayValid = validMLBTeamIds.has(game.away_team_id);
      
      if (homeValid && awayValid) {
        validGames++;
      } else {
        // This game has non-MLB teams, update it to NULL sport
        console.log(chalk.yellow(`   Fixing game ${game.id}: Home=${game.home_team_id}(${homeValid}), Away=${game.away_team_id}(${awayValid})`));
        
        const { error } = await supabase
          .from('games')
          .update({ sport: null })
          .eq('id', game.id);
        
        if (error) {
          console.error(chalk.red(`   Error fixing game ${game.id}:`, error));
        } else {
          fixedGames++;
          console.log(chalk.green(`   ✓ Fixed game ${game.id}`));
        }
      }
    }
    
    console.log(chalk.green(`\\n✅ Valid MLB games: ${validGames}`));
    console.log(chalk.green(`✅ Fixed invalid games: ${fixedGames}`));
    
    // Verify the fix
    console.log(chalk.yellow('\\n📊 Verifying fix...'));
    
    const { data: finalGames } = await supabase
      .from('games')
      .select('id, home_team_id, away_team_id')
      .eq('sport', 'MLB')
      .gte('start_time', '2024-04-19T00:00:00')
      .lt('start_time', '2024-04-19T23:59:59');
    
    const uniqueTeams = new Set<number>();
    let allValid = true;
    
    finalGames?.forEach(game => {
      uniqueTeams.add(game.home_team_id);
      uniqueTeams.add(game.away_team_id);
      
      if (!validMLBTeamIds.has(game.home_team_id) || !validMLBTeamIds.has(game.away_team_id)) {
        allValid = false;
      }
    });
    
    console.log(chalk.white(`Final 2024-04-19 MLB games: ${finalGames?.length || 0}`));
    console.log(chalk.white(`Unique teams: ${uniqueTeams.size}`));
    console.log(chalk.white(`All teams valid: ${allValid ? 'Yes' : 'No'}`));
    
    if (allValid && (finalGames?.length || 0) <= 15 && uniqueTeams.size <= 30) {
      console.log(chalk.green('\\n🎉 SUCCESS! Game counts are now realistic!'));
      console.log(chalk.green('✅ Ready for historical training'));
    } else {
      console.log(chalk.red('\\n❌ Still have issues'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error fixing game sports:'), error);
  }
}

fixMLBGameSportsSimple().catch(console.error);
#!/usr/bin/env tsx
/**
 * 🔧 FIX GAME SPORTS
 * 
 * Corrects sport values in games table based on team sports
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixGameSports() {
  console.log(chalk.cyan.bold('\n🔧 FIXING GAME SPORTS\n'));
  
  try {
    // Get all games marked as MLB
    const { data: mlbGames } = await supabase
      .from('games')
      .select('id, home_team_id, away_team_id, sport')
      .eq('sport', 'MLB');
    
    console.log(chalk.white(`📊 Total games marked as MLB: ${mlbGames?.length || 0}`));
    
    if (!mlbGames) return;
    
    // Get all teams with their sports
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, abbreviation, sport');
    
    if (!teams) return;
    
    // Create a map of team ID to sport
    const teamSports = new Map<number, string>();
    teams.forEach(team => {
      teamSports.set(team.id, team.sport);
    });
    
    console.log(chalk.white(`📋 Total teams in database: ${teams.length}`));
    
    // Check each MLB game
    let correctGames = 0;
    let incorrectGames = 0;
    const corrections: { gameId: number; correctSport: string }[] = [];
    
    mlbGames.forEach(game => {
      const homeTeamSport = teamSports.get(game.home_team_id);
      const awayTeamSport = teamSports.get(game.away_team_id);
      
      // Both teams should have the same sport
      if (homeTeamSport === awayTeamSport && homeTeamSport) {
        if (homeTeamSport === 'MLB') {
          correctGames++;
        } else {
          incorrectGames++;
          corrections.push({
            gameId: game.id,
            correctSport: homeTeamSport
          });
        }
      } else {
        // Teams have different sports or unknown sport
        incorrectGames++;
        console.log(chalk.red(`   Mixed sports game ${game.id}: Home team ${game.home_team_id} (${homeTeamSport}) vs Away team ${game.away_team_id} (${awayTeamSport})`));
      }
    });
    
    console.log(chalk.green(`✅ Correctly marked MLB games: ${correctGames}`));
    console.log(chalk.red(`❌ Incorrectly marked MLB games: ${incorrectGames}`));
    
    // Group corrections by sport
    const sportCorrections = new Map<string, number>();
    corrections.forEach(correction => {
      sportCorrections.set(correction.correctSport, (sportCorrections.get(correction.correctSport) || 0) + 1);
    });
    
    console.log(chalk.white('\n📊 Corrections needed by sport:'));
    sportCorrections.forEach((count, sport) => {
      console.log(chalk.white(`   ${sport}: ${count} games`));
    });
    
    // Apply corrections
    if (corrections.length > 0) {
      console.log(chalk.yellow('\n🔧 Applying corrections...'));
      
      // Group by sport for batch updates
      const updatesBySport = new Map<string, number[]>();
      corrections.forEach(correction => {
        if (!updatesBySport.has(correction.correctSport)) {
          updatesBySport.set(correction.correctSport, []);
        }
        updatesBySport.get(correction.correctSport)!.push(correction.gameId);
      });
      
      // Apply batch updates
      for (const [sport, gameIds] of updatesBySport) {
        console.log(chalk.yellow(`   Updating ${gameIds.length} games to sport: ${sport}`));
        
        const { error } = await supabase
          .from('games')
          .update({ sport })
          .in('id', gameIds);
        
        if (error) {
          console.error(chalk.red(`   Error updating games to ${sport}:`, error));
        } else {
          console.log(chalk.green(`   ✓ Updated ${gameIds.length} games to ${sport}`));
        }
      }
    }
    
    // Verify final counts
    console.log(chalk.yellow('\n📊 Final verification...'));
    
    const { count: finalMLBCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'MLB');
    
    console.log(chalk.white(`Final MLB games count: ${finalMLBCount}`));
    
    // Check a specific date
    const { data: finalDayGames } = await supabase
      .from('games')
      .select('id, home_team_id, away_team_id')
      .eq('sport', 'MLB')
      .gte('start_time', '2024-04-19T00:00:00')
      .lt('start_time', '2024-04-19T23:59:59');
    
    const uniqueTeams = new Set<number>();
    finalDayGames?.forEach(game => {
      uniqueTeams.add(game.home_team_id);
      uniqueTeams.add(game.away_team_id);
    });
    
    console.log(chalk.white(`2024-04-19 MLB games: ${finalDayGames?.length || 0} (${uniqueTeams.size} unique teams)`));
    
    if ((finalDayGames?.length || 0) <= 15 && uniqueTeams.size <= 30) {
      console.log(chalk.green('✅ Game counts now look realistic!'));
    } else {
      console.log(chalk.red('❌ Still have issues with game counts'));
    }
    
    console.log(chalk.green('\n✅ Game sport corrections complete!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error fixing game sports:'), error);
  }
}

fixGameSports().catch(console.error);
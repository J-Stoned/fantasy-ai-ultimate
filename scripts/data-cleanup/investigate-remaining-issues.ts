#!/usr/bin/env tsx
/**
 * 🔍 INVESTIGATE REMAINING ISSUES
 * 
 * Find why we still have too many games per day
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigateRemainingIssues() {
  console.log(chalk.cyan.bold('\n🔍 INVESTIGATING REMAINING ISSUES\n'));
  
  try {
    // Get all games on 2024-04-19
    const { data: games } = await supabase
      .from('games')
      .select('id, sport, home_team_id, away_team_id, status, start_time')
      .gte('start_time', '2024-04-19T00:00:00')
      .lt('start_time', '2024-04-19T23:59:59')
      .order('sport');
    
    console.log(chalk.white(`Total games on 2024-04-19: ${games?.length || 0}`));
    
    if (!games) return;
    
    // Sports breakdown
    const sportCounts: Record<string, number> = {};
    games.forEach(game => {
      const sport = game.sport || 'null';
      sportCounts[sport] = (sportCounts[sport] || 0) + 1;
    });
    
    console.log(chalk.white('\n📊 Sports breakdown:'));
    Object.entries(sportCounts).forEach(([sport, count]) => {
      console.log(chalk.white(`   ${sport}: ${count} games`));
    });
    
    // Focus on MLB games
    const mlbGames = games.filter(g => g.sport === 'MLB');
    console.log(chalk.yellow(`\n🏟️  MLB games: ${mlbGames.length}`));
    
    if (mlbGames.length > 15) {
      console.log(chalk.red('⚠️  Still more than 15 MLB games! Investigating...'));
      
      // Get valid team IDs
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name, abbreviation')
        .eq('sport', 'MLB');
      
      const validTeamIds = new Set(teams?.map(t => t.id) || []);
      console.log(chalk.white(`\n📋 Valid MLB team IDs: ${validTeamIds.size}`));
      
      // Check for invalid team IDs
      let invalidGames = 0;
      const invalidTeamIds = new Set<number>();
      
      mlbGames.forEach(game => {
        if (!validTeamIds.has(game.home_team_id) || !validTeamIds.has(game.away_team_id)) {
          invalidGames++;
          invalidTeamIds.add(game.home_team_id);
          invalidTeamIds.add(game.away_team_id);
          console.log(chalk.red(`   Invalid game: ${game.id} (Home: ${game.home_team_id}, Away: ${game.away_team_id})`));
        }
      });
      
      console.log(chalk.red(`\n❌ Games with invalid team IDs: ${invalidGames}`));
      console.log(chalk.red(`❌ Invalid team IDs found: ${invalidTeamIds.size}`));
      
      // Show which team IDs are invalid
      if (invalidTeamIds.size > 0) {
        console.log(chalk.red('\n🔍 Invalid team IDs:'));
        Array.from(invalidTeamIds).forEach(id => {
          console.log(chalk.red(`   ${id}`));
        });
        
        // Try to find these teams in other sports
        for (const id of invalidTeamIds) {
          const { data: team } = await supabase
            .from('teams')
            .select('id, name, abbreviation, sport')
            .eq('id', id)
            .single();
          
          if (team) {
            console.log(chalk.yellow(`   Team ID ${id}: ${team.name} (${team.abbreviation}) - Sport: ${team.sport}`));
          } else {
            console.log(chalk.red(`   Team ID ${id}: Not found in teams table`));
          }
        }
      }
      
      // Check for duplicate games
      const gameSignatures = new Map<string, number>();
      mlbGames.forEach(game => {
        const signature = `${Math.min(game.home_team_id, game.away_team_id)}-${Math.max(game.home_team_id, game.away_team_id)}`;
        gameSignatures.set(signature, (gameSignatures.get(signature) || 0) + 1);
      });
      
      const duplicateSignatures = Array.from(gameSignatures.entries()).filter(([_, count]) => count > 1);
      
      if (duplicateSignatures.length > 0) {
        console.log(chalk.red(`\n🔄 Duplicate game signatures: ${duplicateSignatures.length}`));
        duplicateSignatures.forEach(([signature, count]) => {
          console.log(chalk.red(`   ${signature}: ${count} games`));
        });
      }
    }
    
    // Check unique teams playing
    const uniqueTeams = new Set<number>();
    mlbGames.forEach(game => {
      uniqueTeams.add(game.home_team_id);
      uniqueTeams.add(game.away_team_id);
    });
    
    console.log(chalk.white(`\n👥 Unique teams playing MLB: ${uniqueTeams.size}`));
    
    if (uniqueTeams.size > 30) {
      console.log(chalk.red('⚠️  More than 30 unique teams playing!'));
      
      // Show the team IDs
      console.log(chalk.white('\n📋 All team IDs in MLB games:'));
      Array.from(uniqueTeams).sort((a, b) => a - b).forEach(id => {
        const isValid = validTeamIds.has(id);
        const color = isValid ? chalk.green : chalk.red;
        console.log(color(`   ${id}`));
      });
    }
    
    console.log(chalk.green('\n✅ Investigation complete!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error investigating:'), error);
  }
}

investigateRemainingIssues().catch(console.error);
#!/usr/bin/env tsx
/**
 * ☢️ NUCLEAR NFL CLEANUP
 * 
 * Reduces 81 NFL teams to exactly 32 standard teams
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Standard NFL teams (32 teams)
const STANDARD_NFL_TEAMS = [
  { name: 'Arizona Cardinals', abbreviation: 'ARI', city: 'Arizona' },
  { name: 'Atlanta Falcons', abbreviation: 'ATL', city: 'Atlanta' },
  { name: 'Baltimore Ravens', abbreviation: 'BAL', city: 'Baltimore' },
  { name: 'Buffalo Bills', abbreviation: 'BUF', city: 'Buffalo' },
  { name: 'Carolina Panthers', abbreviation: 'CAR', city: 'Carolina' },
  { name: 'Chicago Bears', abbreviation: 'CHI', city: 'Chicago' },
  { name: 'Cincinnati Bengals', abbreviation: 'CIN', city: 'Cincinnati' },
  { name: 'Cleveland Browns', abbreviation: 'CLE', city: 'Cleveland' },
  { name: 'Dallas Cowboys', abbreviation: 'DAL', city: 'Dallas' },
  { name: 'Denver Broncos', abbreviation: 'DEN', city: 'Denver' },
  { name: 'Detroit Lions', abbreviation: 'DET', city: 'Detroit' },
  { name: 'Green Bay Packers', abbreviation: 'GB', city: 'Green Bay' },
  { name: 'Houston Texans', abbreviation: 'HOU', city: 'Houston' },
  { name: 'Indianapolis Colts', abbreviation: 'IND', city: 'Indianapolis' },
  { name: 'Jacksonville Jaguars', abbreviation: 'JAX', city: 'Jacksonville' },
  { name: 'Kansas City Chiefs', abbreviation: 'KC', city: 'Kansas City' },
  { name: 'Las Vegas Raiders', abbreviation: 'LV', city: 'Las Vegas' },
  { name: 'Los Angeles Chargers', abbreviation: 'LAC', city: 'Los Angeles' },
  { name: 'Los Angeles Rams', abbreviation: 'LAR', city: 'Los Angeles' },
  { name: 'Miami Dolphins', abbreviation: 'MIA', city: 'Miami' },
  { name: 'Minnesota Vikings', abbreviation: 'MIN', city: 'Minnesota' },
  { name: 'New England Patriots', abbreviation: 'NE', city: 'New England' },
  { name: 'New Orleans Saints', abbreviation: 'NO', city: 'New Orleans' },
  { name: 'New York Giants', abbreviation: 'NYG', city: 'New York' },
  { name: 'New York Jets', abbreviation: 'NYJ', city: 'New York' },
  { name: 'Philadelphia Eagles', abbreviation: 'PHI', city: 'Philadelphia' },
  { name: 'Pittsburgh Steelers', abbreviation: 'PIT', city: 'Pittsburgh' },
  { name: 'San Francisco 49ers', abbreviation: 'SF', city: 'San Francisco' },
  { name: 'Seattle Seahawks', abbreviation: 'SEA', city: 'Seattle' },
  { name: 'Tampa Bay Buccaneers', abbreviation: 'TB', city: 'Tampa Bay' },
  { name: 'Tennessee Titans', abbreviation: 'TEN', city: 'Tennessee' },
  { name: 'Washington Commanders', abbreviation: 'WSH', city: 'Washington' }
];

async function nuclearNFLCleanup() {
  console.log(chalk.red.bold('\n☢️ NUCLEAR NFL CLEANUP - 81 → 32 TEAMS\n'));
  
  try {
    // Step 1: Delete ALL current NFL teams
    console.log(chalk.yellow('🗑️  Step 1: Deleting ALL current NFL teams...'));
    
    const { data: currentTeams } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
      .eq('sport', 'NFL');
    
    if (currentTeams) {
      for (const team of currentTeams) {
        // Update all foreign key references
        await supabase
          .from('games')
          .update({ home_team_id: null })
          .eq('home_team_id', team.id);
        
        await supabase
          .from('games')
          .update({ away_team_id: null })
          .eq('away_team_id', team.id);
        
        await supabase
          .from('players')
          .update({ team_id: null })
          .eq('team_id', team.id);
        
        await supabase
          .from('player_game_logs')
          .update({ team_id: null })
          .eq('team_id', team.id);
        
        await supabase
          .from('player_game_logs')
          .update({ opponent_id: null })
          .eq('opponent_id', team.id);
        
        // Delete the team
        await supabase
          .from('teams')
          .delete()
          .eq('id', team.id);
        
        console.log(chalk.gray(`     ✓ Deleted ${team.name || team.abbreviation} (${team.id})`));
      }
    }
    
    // Step 2: Insert all 32 standard NFL teams
    console.log(chalk.yellow('\n➕ Step 2: Inserting 32 standard NFL teams...'));
    
    for (const team of STANDARD_NFL_TEAMS) {
      const { error } = await supabase
        .from('teams')
        .insert({
          name: team.name,
          abbreviation: team.abbreviation,
          city: team.city,
          sport: 'NFL'
        });
      
      if (error) {
        console.error(chalk.red(`   ❌ Error adding ${team.abbreviation}:`, error.message));
      } else {
        console.log(chalk.green(`   ✓ Added ${team.name} (${team.abbreviation})`));
      }
    }
    
    // Step 3: Final verification
    console.log(chalk.yellow('\n📊 Step 3: Final verification...'));
    
    const { data: finalTeams } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
      .eq('sport', 'NFL')
      .order('abbreviation');
    
    console.log(chalk.white(`   Final NFL team count: ${finalTeams?.length || 0}`));
    
    if (finalTeams?.length === 32) {
      console.log(chalk.green('   ✅ Perfect! Exactly 32 NFL teams'));
    } else {
      console.log(chalk.red(`   ❌ Expected 32 teams, got ${finalTeams?.length || 0}`));
    }
    
    // Show final list
    console.log(chalk.white('\n📋 FINAL NFL TEAMS:'));
    console.log(chalk.gray('─'.repeat(60)));
    
    finalTeams?.forEach(team => {
      console.log(chalk.white(`${team.id.toString().padStart(6)} | ${team.abbreviation?.padEnd(4)} | ${team.name}`));
    });
    
    console.log(chalk.green('\n✅ Nuclear NFL cleanup complete!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error in nuclear NFL cleanup:'), error);
  }
}

nuclearNFLCleanup().catch(console.error);
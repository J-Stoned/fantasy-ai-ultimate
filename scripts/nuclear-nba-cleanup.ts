#!/usr/bin/env tsx
/**
 * ☢️ NUCLEAR NBA CLEANUP
 * 
 * Handles all foreign key relationships and forces exactly 30 NBA teams
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function nuclearNBACleanup() {
  console.log(chalk.red.bold('\n☢️ NUCLEAR NBA CLEANUP - HANDLING ALL CONSTRAINTS\n'));
  
  try {
    // Step 1: Get all current NBA teams
    const { data: currentTeams } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
      .eq('sport', 'NBA')
      .order('id');
    
    console.log(chalk.white(`📊 Current NBA teams: ${currentTeams?.length || 0}`));
    
    if (!currentTeams) return;
    
    // Step 2: Define teams to keep (based on game count analysis)
    const keepTeamIds = new Set([
      1, 2, 5, 8, 10, 11, 13, 14, 16, 20, 21, 22, 25, 30, 35, 76, 78, 80, 81, 88, 90, 95, 99, 101
    ]);
    
    const teamsToRemove = currentTeams.filter(team => !keepTeamIds.has(team.id));
    
    console.log(chalk.yellow(`\n🗑️  Removing ${teamsToRemove.length} teams...`));
    
    for (const team of teamsToRemove) {
      console.log(chalk.red(`   Processing: ${team.name} (${team.abbreviation}) - ID: ${team.id}`));
      
      // Step 2a: Check all tables that reference this team
      const tables = ['games', 'players', 'player_stats', 'player_game_logs', 'player_injuries'];
      
      for (const table of tables) {
        try {
          // Handle games table (home_team_id and away_team_id)
          if (table === 'games') {
            // Update games to null where this team is referenced
            await supabase
              .from('games')
              .update({ home_team_id: null })
              .eq('home_team_id', team.id);
            
            await supabase
              .from('games')
              .update({ away_team_id: null })
              .eq('away_team_id', team.id);
          }
          
          // Handle other tables with team_id
          else if (table !== 'player_stats') {
            await supabase
              .from(table)
              .update({ team_id: null })
              .eq('team_id', team.id);
          }
        } catch (error) {
          console.log(chalk.gray(`     Warning: Could not update ${table} for team ${team.id}`));
        }
      }
      
      // Step 2b: Delete the team
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', team.id);
      
      if (error) {
        console.error(chalk.red(`   ❌ Error removing team ${team.id}:`, error.message));
      } else {
        console.log(chalk.green(`   ✓ Removed ${team.name}`));
      }
    }
    
    // Step 3: Add missing standard teams
    console.log(chalk.yellow('\n➕ Adding missing standard NBA teams...'));
    
    const standardTeams = [
      { name: 'Charlotte Hornets', abbreviation: 'CHA', id: 30 },
      { name: 'New Orleans Pelicans', abbreviation: 'NOP' },
      { name: 'New York Knicks', abbreviation: 'NYK' },
      { name: 'San Antonio Spurs', abbreviation: 'SAS' },
      { name: 'Utah Jazz', abbreviation: 'UTA' },
      { name: 'Washington Wizards', abbreviation: 'WAS' }
    ];
    
    const { data: existingTeams } = await supabase
      .from('teams')
      .select('abbreviation')
      .eq('sport', 'NBA');
    
    const existingAbbrevs = new Set(existingTeams?.map(t => t.abbreviation) || []);
    
    for (const team of standardTeams) {
      if (!existingAbbrevs.has(team.abbreviation)) {
        console.log(chalk.white(`   Adding: ${team.name} (${team.abbreviation})`));
        
        const { error } = await supabase
          .from('teams')
          .insert({
            name: team.name,
            abbreviation: team.abbreviation,
            sport: 'NBA'
          });
        
        if (error) {
          console.error(chalk.red(`   Error adding ${team.abbreviation}:`, error.message));
        } else {
          console.log(chalk.green(`   ✓ Added ${team.name}`));
        }
      }
    }
    
    // Step 4: Final verification
    console.log(chalk.yellow('\n📊 Final verification...'));
    
    const { data: finalTeams } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
      .eq('sport', 'NBA')
      .order('abbreviation');
    
    console.log(chalk.white(`   Final NBA team count: ${finalTeams?.length || 0}`));
    
    if (finalTeams?.length === 30) {
      console.log(chalk.green('   ✅ Perfect! Exactly 30 NBA teams'));
    } else {
      console.log(chalk.red(`   ❌ Expected 30 teams, got ${finalTeams?.length || 0}`));
    }
    
    // Show final list
    console.log(chalk.white('\n📋 FINAL NBA TEAMS:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    finalTeams?.forEach(team => {
      console.log(chalk.white(`${team.id.toString().padStart(6)} | ${team.abbreviation?.padEnd(4)} | ${team.name}`));
    });
    
    console.log(chalk.green('\n✅ Nuclear NBA cleanup complete!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error in nuclear cleanup:'), error);
  }
}

nuclearNBACleanup().catch(console.error);
#!/usr/bin/env tsx
/**
 * 💥 FINAL NBA CLEANUP
 * 
 * Handles ALL foreign key constraints including opponent_id in player_game_logs
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function finalNBACleanup() {
  console.log(chalk.red.bold('\n💥 FINAL NBA CLEANUP - HANDLING ALL CONSTRAINTS\n'));
  
  try {
    // Step 1: Get all current NBA teams
    const { data: currentTeams } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
      .eq('sport', 'NBA')
      .order('id');
    
    console.log(chalk.white(`📊 Current NBA teams: ${currentTeams?.length || 0}`));
    
    if (!currentTeams) return;
    
    // Step 2: Identify teams to remove (duplicates and problems)
    const teamsToRemove = currentTeams.filter(team => {
      return team.abbreviation === 'NY' ||
             team.abbreviation === 'NO' ||
             team.abbreviation === 'SA' ||
             team.abbreviation === 'UTAH' ||
             team.abbreviation === 'WSH' ||
             team.name?.includes('Team ') ||
             (team.abbreviation === 'LAC' && team.name === 'Los Angeles Clippers') ||
             (team.abbreviation === 'LAC' && team.name === 'LA Clippers' && team.id === 801754);
    });
    
    console.log(chalk.yellow(`\n🗑️  Removing ${teamsToRemove.length} problematic teams...`));
    
    for (const team of teamsToRemove) {
      console.log(chalk.red(`   Processing: ${team.name} (${team.abbreviation}) - ID: ${team.id}`));
      
      // Step 2a: Update ALL foreign key references
      try {
        // Update games table
        await supabase
          .from('games')
          .update({ home_team_id: null })
          .eq('home_team_id', team.id);
        
        await supabase
          .from('games')
          .update({ away_team_id: null })
          .eq('away_team_id', team.id);
        
        // Update players table
        await supabase
          .from('players')
          .update({ team_id: null })
          .eq('team_id', team.id);
        
        // Update player_game_logs table (including opponent_id!)
        await supabase
          .from('player_game_logs')
          .update({ team_id: null })
          .eq('team_id', team.id);
        
        await supabase
          .from('player_game_logs')
          .update({ opponent_id: null })
          .eq('opponent_id', team.id);
        
        // Update player_injuries table
        await supabase
          .from('player_injuries')
          .update({ team_id: null })
          .eq('team_id', team.id);
        
        console.log(chalk.gray(`     ✓ Updated all foreign key references`));
        
      } catch (error) {
        console.log(chalk.yellow(`     Warning: Issue updating references for team ${team.id}`));
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
    
    // Step 3: Handle the LAC duplicate situation
    console.log(chalk.yellow('\n🔄 Fixing LAC duplicate situation...'));
    
    const { data: lacTeams } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
      .eq('sport', 'NBA')
      .eq('abbreviation', 'LAC');
    
    if (lacTeams && lacTeams.length > 1) {
      console.log(chalk.white(`   Found ${lacTeams.length} LAC teams, keeping one...`));
      
      const keepTeam = lacTeams[0];
      const removeTeams = lacTeams.slice(1);
      
      for (const team of removeTeams) {
        // Update all references to point to the kept team
        await supabase
          .from('games')
          .update({ home_team_id: keepTeam.id })
          .eq('home_team_id', team.id);
        
        await supabase
          .from('games')
          .update({ away_team_id: keepTeam.id })
          .eq('away_team_id', team.id);
        
        await supabase
          .from('players')
          .update({ team_id: keepTeam.id })
          .eq('team_id', team.id);
        
        await supabase
          .from('player_game_logs')
          .update({ team_id: keepTeam.id })
          .eq('team_id', team.id);
        
        await supabase
          .from('player_game_logs')
          .update({ opponent_id: keepTeam.id })
          .eq('opponent_id', team.id);
        
        // Delete the duplicate
        await supabase
          .from('teams')
          .delete()
          .eq('id', team.id);
        
        console.log(chalk.green(`   ✓ Merged ${team.name} into ${keepTeam.name}`));
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
    
    console.log(chalk.green('\n✅ Final NBA cleanup complete!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error in final cleanup:'), error);
  }
}

finalNBACleanup().catch(console.error);
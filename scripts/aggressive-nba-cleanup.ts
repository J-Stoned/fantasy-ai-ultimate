#!/usr/bin/env tsx
/**
 * 🔥 AGGRESSIVE NBA CLEANUP
 * 
 * Nuclear option to force NBA to exactly 30 teams
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function aggressiveNBACleanup() {
  console.log(chalk.red.bold('\n🔥 AGGRESSIVE NBA CLEANUP - NUCLEAR OPTION\n'));
  
  try {
    // Step 1: Get all current NBA teams
    const { data: currentTeams } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
      .eq('sport', 'NBA')
      .order('name');
    
    console.log(chalk.white(`📊 Current NBA teams: ${currentTeams?.length || 0}`));
    
    // Step 2: Identify duplicates and problematic teams
    const duplicateAbbrevs = new Set(['LAC', 'NOP', 'NYK', 'SAS', 'UTA', 'WAS']);
    const problemTeams = new Set(['T111836', 'GIA', 'LEB', 'NO', 'NY', 'SA', 'UTAH', 'WSH']);
    
    console.log(chalk.yellow('\n🗑️  Removing duplicates and problem teams...'));
    
    if (currentTeams) {
      for (const team of currentTeams) {
        const shouldRemove = 
          problemTeams.has(team.abbreviation) ||
          team.name?.includes('Team ') ||
          team.abbreviation === 'T111836' ||
          (team.abbreviation === 'LAC' && team.name === 'Los Angeles Clippers') ||
          (team.abbreviation === 'NOP' && team.id === 92) ||
          (team.abbreviation === 'NYK' && team.id === 18) ||
          (team.abbreviation === 'SAS' && team.id === 100) ||
          (team.abbreviation === 'UTA' && team.id === 102) ||
          (team.abbreviation === 'WAS' && team.id === 103);
        
        if (shouldRemove) {
          console.log(chalk.red(`   Removing: ${team.name} (${team.abbreviation}) - ID: ${team.id}`));
          
          // First update any games that reference this team
          await supabase
            .from('games')
            .update({ home_team_id: null })
            .eq('home_team_id', team.id);
          
          await supabase
            .from('games')
            .update({ away_team_id: null })
            .eq('away_team_id', team.id);
          
          // Then delete the team
          const { error } = await supabase
            .from('teams')
            .delete()
            .eq('id', team.id);
          
          if (error) {
            console.error(chalk.red(`   Error removing team ${team.id}:`, error));
          } else {
            console.log(chalk.green(`   ✓ Removed ${team.name}`));
          }
        }
      }
    }
    
    // Step 3: Fix remaining duplicates by abbreviation
    console.log(chalk.yellow('\n🔄 Fixing remaining duplicates...'));
    
    const { data: remainingTeams } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
      .eq('sport', 'NBA')
      .order('abbreviation');
    
    if (remainingTeams) {
      const teamsByAbbrev = new Map();
      remainingTeams.forEach(team => {
        if (!teamsByAbbrev.has(team.abbreviation)) {
          teamsByAbbrev.set(team.abbreviation, []);
        }
        teamsByAbbrev.get(team.abbreviation).push(team);
      });
      
      for (const [abbrev, teams] of teamsByAbbrev) {
        if (teams.length > 1) {
          console.log(chalk.white(`   Fixing duplicate ${abbrev}: ${teams.length} teams`));
          
          // Keep the first one, remove the rest
          const keepTeam = teams[0];
          const removeTeams = teams.slice(1);
          
          console.log(chalk.green(`   ✓ Keeping: ${keepTeam.name} (${keepTeam.id})`));
          
          for (const team of removeTeams) {
            console.log(chalk.red(`   Removing: ${team.name} (${team.id})`));
            
            // Update games first
            await supabase
              .from('games')
              .update({ home_team_id: keepTeam.id })
              .eq('home_team_id', team.id);
            
            await supabase
              .from('games')
              .update({ away_team_id: keepTeam.id })
              .eq('away_team_id', team.id);
            
            // Delete the duplicate
            await supabase
              .from('teams')
              .delete()
              .eq('id', team.id);
            
            console.log(chalk.green(`   ✓ Removed duplicate ${team.name}`));
          }
        }
      }
    }
    
    // Step 4: Final count and verification
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
    
    console.log(chalk.green('\n✅ Aggressive NBA cleanup complete!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error in aggressive cleanup:'), error);
  }
}

aggressiveNBACleanup().catch(console.error);
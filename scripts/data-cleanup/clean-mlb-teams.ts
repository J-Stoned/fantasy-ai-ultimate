#!/usr/bin/env tsx
/**
 * 🧹 CLEAN MLB TEAMS
 * 
 * Fixes duplicate teams and standardizes to exactly 30 MLB teams
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanMLBTeams() {
  console.log(chalk.cyan.bold('\n🧹 CLEANING MLB TEAMS\n'));
  
  try {
    // Get current state
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name, abbreviation, sport')
      .eq('sport', 'MLB')
      .order('abbreviation');
    
    if (error) throw error;
    
    console.log(chalk.white(`📊 Current MLB teams: ${teams?.length || 0}`));
    
    if (!teams) return;
    
    // Step 1: Remove unused ATH teams (they have 0 games)
    console.log(chalk.yellow('\n🗑️  Step 1: Removing unused ATH teams...'));
    
    const athTeams = teams.filter(t => t.abbreviation === 'ATH');
    console.log(chalk.white(`   Found ${athTeams.length} ATH teams`));
    
    for (const team of athTeams) {
      // Double-check they have no games
      const { count: homeGames } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('home_team_id', team.id);
      
      const { count: awayGames } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('away_team_id', team.id);
      
      const totalGames = (homeGames || 0) + (awayGames || 0);
      
      if (totalGames === 0) {
        console.log(chalk.gray(`   Removing ATH team ID ${team.id} (${totalGames} games)`));
        
        const { error: deleteError } = await supabase
          .from('teams')
          .delete()
          .eq('id', team.id);
        
        if (deleteError) {
          console.error(chalk.red(`   Error removing team ${team.id}:`, deleteError));
        } else {
          console.log(chalk.green(`   ✓ Removed ATH team ${team.id}`));
        }
      } else {
        console.log(chalk.red(`   Skipping ATH team ID ${team.id} (has ${totalGames} games)`));
      }
    }
    
    // Step 2: Standardize KC teams (keep high-range ID)
    console.log(chalk.yellow('\n🔄 Step 2: Standardizing KC teams...'));
    
    const kcTeams = teams.filter(t => t.abbreviation === 'KC');
    console.log(chalk.white(`   Found ${kcTeams.length} KC teams`));
    
    if (kcTeams.length === 2) {
      // Find the high-range ID team (>= 1000)
      const highRangeKC = kcTeams.find(t => t.id >= 1000);
      const lowRangeKC = kcTeams.find(t => t.id < 1000);
      
      if (highRangeKC && lowRangeKC) {
        console.log(chalk.white(`   Keeping high-range: ${highRangeKC.id} (${highRangeKC.name})`));
        console.log(chalk.white(`   Migrating from low-range: ${lowRangeKC.id} (${lowRangeKC.name})`));
        
        // Update games to use high-range ID
        const { error: updateHomeError } = await supabase
          .from('games')
          .update({ home_team_id: highRangeKC.id })
          .eq('home_team_id', lowRangeKC.id);
        
        const { error: updateAwayError } = await supabase
          .from('games')
          .update({ away_team_id: highRangeKC.id })
          .eq('away_team_id', lowRangeKC.id);
        
        if (updateHomeError || updateAwayError) {
          console.error(chalk.red('   Error updating games:'), updateHomeError || updateAwayError);
        } else {
          console.log(chalk.green('   ✓ Updated games to use high-range KC team'));
          
          // Remove low-range team
          const { error: deleteError } = await supabase
            .from('teams')
            .delete()
            .eq('id', lowRangeKC.id);
          
          if (deleteError) {
            console.error(chalk.red(`   Error removing low-range KC team:`, deleteError));
          } else {
            console.log(chalk.green(`   ✓ Removed low-range KC team ${lowRangeKC.id}`));
          }
        }
      }
    }
    
    // Step 3: Standardize LAA teams (keep high-range ID)
    console.log(chalk.yellow('\n🔄 Step 3: Standardizing LAA teams...'));
    
    const laaTeams = teams.filter(t => t.abbreviation === 'LAA');
    console.log(chalk.white(`   Found ${laaTeams.length} LAA teams`));
    
    if (laaTeams.length === 2) {
      // Find the high-range ID team (>= 1000)
      const highRangeLAA = laaTeams.find(t => t.id >= 1000);
      const lowRangeLAA = laaTeams.find(t => t.id < 1000);
      
      if (highRangeLAA && lowRangeLAA) {
        console.log(chalk.white(`   Keeping high-range: ${highRangeLAA.id} (${highRangeLAA.name})`));
        console.log(chalk.white(`   Migrating from low-range: ${lowRangeLAA.id} (${lowRangeLAA.name})`));
        
        // Update games to use high-range ID
        const { error: updateHomeError } = await supabase
          .from('games')
          .update({ home_team_id: highRangeLAA.id })
          .eq('home_team_id', lowRangeLAA.id);
        
        const { error: updateAwayError } = await supabase
          .from('games')
          .update({ away_team_id: highRangeLAA.id })
          .eq('away_team_id', lowRangeLAA.id);
        
        if (updateHomeError || updateAwayError) {
          console.error(chalk.red('   Error updating games:'), updateHomeError || updateAwayError);
        } else {
          console.log(chalk.green('   ✓ Updated games to use high-range LAA team'));
          
          // Remove low-range team
          const { error: deleteError } = await supabase
            .from('teams')
            .delete()
            .eq('id', lowRangeLAA.id);
          
          if (deleteError) {
            console.error(chalk.red(`   Error removing low-range LAA team:`, deleteError));
          } else {
            console.log(chalk.green(`   ✓ Removed low-range LAA team ${lowRangeLAA.id}`));
          }
        }
      }
    }
    
    // Step 4: Add missing OAK team
    console.log(chalk.yellow('\n➕ Step 4: Adding missing OAK team...'));
    
    const { data: oakTeam } = await supabase
      .from('teams')
      .select('id')
      .eq('sport', 'MLB')
      .eq('abbreviation', 'OAK')
      .single();
    
    if (!oakTeam) {
      console.log(chalk.white('   Adding Oakland Athletics (OAK) team...'));
      
      const { error: insertError } = await supabase
        .from('teams')
        .insert({
          name: 'Oakland Athletics',
          abbreviation: 'OAK',
          sport: 'MLB'
        });
      
      if (insertError) {
        console.error(chalk.red('   Error adding OAK team:'), insertError);
      } else {
        console.log(chalk.green('   ✓ Added Oakland Athletics (OAK) team'));
      }
    } else {
      console.log(chalk.green('   ✓ OAK team already exists'));
    }
    
    // Step 5: Verify final count
    console.log(chalk.yellow('\n📊 Step 5: Verifying final team count...'));
    
    const { data: finalTeams } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
      .eq('sport', 'MLB')
      .order('abbreviation');
    
    console.log(chalk.white(`   Final MLB team count: ${finalTeams?.length || 0}`));
    
    if (finalTeams?.length === 30) {
      console.log(chalk.green('   ✅ Perfect! Exactly 30 MLB teams'));
    } else {
      console.log(chalk.red(`   ❌ Expected 30 teams, got ${finalTeams?.length || 0}`));
    }
    
    // Show final list
    console.log(chalk.white('\n📋 FINAL MLB TEAMS:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    finalTeams?.forEach(team => {
      console.log(chalk.white(`${team.id.toString().padStart(6)} | ${team.abbreviation?.padEnd(4)} | ${team.name}`));
    });
    
    console.log(chalk.green('\n✅ MLB team cleanup complete!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error cleaning teams:'), error);
  }
}

cleanMLBTeams().catch(console.error);
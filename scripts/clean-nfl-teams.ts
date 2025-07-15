#!/usr/bin/env tsx
/**
 * 🏈 CLEAN NFL TEAMS
 * 
 * Standardize NFL teams to exactly 32 teams
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanNFLTeams() {
  console.log(chalk.blue.bold('\n🏈 CLEANING NFL TEAMS TO EXACTLY 32\n'));
  
  try {
    // Get current NFL teams
    const { data: currentTeams } = await supabase
      .from('teams')
      .select('id, name, abbreviation, city, sport')
      .eq('sport', 'NFL')
      .order('name');
    
    console.log(chalk.white(`📊 Current NFL teams: ${currentTeams?.length || 0}`));
    
    if (!currentTeams || currentTeams.length === 0) {
      console.log(chalk.yellow('No NFL teams found, skipping cleanup'));
      return;
    }
    
    // Show current teams
    console.log(chalk.white('\n📋 CURRENT NFL TEAMS:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    currentTeams.forEach(team => {
      console.log(chalk.white(`${team.id.toString().padStart(6)} | ${team.abbreviation?.padEnd(4)} | ${team.name}`));
    });
    
    // Check for duplicates
    const nameMap = new Map<string, any[]>();
    const abbrevMap = new Map<string, any[]>();
    
    currentTeams.forEach(team => {
      const name = team.name?.toLowerCase() || '';
      const abbrev = team.abbreviation?.toLowerCase() || '';
      
      if (!nameMap.has(name)) nameMap.set(name, []);
      if (!abbrevMap.has(abbrev)) abbrevMap.set(abbrev, []);
      
      nameMap.get(name)!.push(team);
      abbrevMap.get(abbrev)!.push(team);
    });
    
    const duplicatesByName = Array.from(nameMap.values()).filter(teams => teams.length > 1);
    const duplicatesByAbbrev = Array.from(abbrevMap.values()).filter(teams => teams.length > 1);
    
    console.log(chalk.yellow('\n🔍 DUPLICATE ANALYSIS:'));
    console.log(chalk.white(`   Duplicate names: ${duplicatesByName.length}`));
    console.log(chalk.white(`   Duplicate abbreviations: ${duplicatesByAbbrev.length}`));
    
    if (duplicatesByName.length > 0) {
      console.log(chalk.red('   📋 Duplicate Names:'));
      duplicatesByName.forEach(dups => {
        console.log(chalk.red(`     ${dups[0].name}: ${dups.map(d => d.id).join(', ')}`));
      });
    }
    
    if (duplicatesByAbbrev.length > 0) {
      console.log(chalk.red('   📋 Duplicate Abbreviations:'));
      duplicatesByAbbrev.forEach(dups => {
        console.log(chalk.red(`     ${dups[0].abbreviation}: ${dups.map(d => d.id).join(', ')}`));
      });
    }
    
    // Check for orphaned teams
    let orphanedCount = 0;
    
    console.log(chalk.yellow('\n👻 CHECKING FOR ORPHANED TEAMS:'));
    
    for (const team of currentTeams) {
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
        orphanedCount++;
        console.log(chalk.yellow(`   ${team.name} (${team.abbreviation}): ${totalGames} games`));
      }
    }
    
    console.log(chalk.white(`   Orphaned teams: ${orphanedCount}`));
    
    if (currentTeams.length === 32 && duplicatesByName.length === 0 && duplicatesByAbbrev.length === 0) {
      console.log(chalk.green('\n✅ NFL teams are already clean! Exactly 32 teams with no duplicates.'));
    } else {
      console.log(chalk.red(`\n❌ NFL teams need cleanup: ${currentTeams.length} teams found, expected 32`));
    }
    
    console.log(chalk.green('\n✅ NFL team analysis complete!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error analyzing NFL teams:'), error);
  }
}

cleanNFLTeams().catch(console.error);
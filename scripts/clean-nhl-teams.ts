#!/usr/bin/env tsx
/**
 * 🏒 CLEAN NHL TEAMS
 * 
 * Standardize NHL teams to exactly 32 teams
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Standard NHL teams (32 teams as of 2021-22 season)
const STANDARD_NHL_TEAMS = [
  { name: 'Anaheim Ducks', abbreviation: 'ANA', city: 'Anaheim' },
  { name: 'Arizona Coyotes', abbreviation: 'ARI', city: 'Arizona' },
  { name: 'Boston Bruins', abbreviation: 'BOS', city: 'Boston' },
  { name: 'Buffalo Sabres', abbreviation: 'BUF', city: 'Buffalo' },
  { name: 'Calgary Flames', abbreviation: 'CGY', city: 'Calgary' },
  { name: 'Carolina Hurricanes', abbreviation: 'CAR', city: 'Carolina' },
  { name: 'Chicago Blackhawks', abbreviation: 'CHI', city: 'Chicago' },
  { name: 'Colorado Avalanche', abbreviation: 'COL', city: 'Colorado' },
  { name: 'Columbus Blue Jackets', abbreviation: 'CBJ', city: 'Columbus' },
  { name: 'Dallas Stars', abbreviation: 'DAL', city: 'Dallas' },
  { name: 'Detroit Red Wings', abbreviation: 'DET', city: 'Detroit' },
  { name: 'Edmonton Oilers', abbreviation: 'EDM', city: 'Edmonton' },
  { name: 'Florida Panthers', abbreviation: 'FLA', city: 'Florida' },
  { name: 'Los Angeles Kings', abbreviation: 'LAK', city: 'Los Angeles' },
  { name: 'Minnesota Wild', abbreviation: 'MIN', city: 'Minnesota' },
  { name: 'Montreal Canadiens', abbreviation: 'MTL', city: 'Montreal' },
  { name: 'Nashville Predators', abbreviation: 'NSH', city: 'Nashville' },
  { name: 'New Jersey Devils', abbreviation: 'NJD', city: 'New Jersey' },
  { name: 'New York Islanders', abbreviation: 'NYI', city: 'New York' },
  { name: 'New York Rangers', abbreviation: 'NYR', city: 'New York' },
  { name: 'Ottawa Senators', abbreviation: 'OTT', city: 'Ottawa' },
  { name: 'Philadelphia Flyers', abbreviation: 'PHI', city: 'Philadelphia' },
  { name: 'Pittsburgh Penguins', abbreviation: 'PIT', city: 'Pittsburgh' },
  { name: 'San Jose Sharks', abbreviation: 'SJS', city: 'San Jose' },
  { name: 'Seattle Kraken', abbreviation: 'SEA', city: 'Seattle' },
  { name: 'St. Louis Blues', abbreviation: 'STL', city: 'St. Louis' },
  { name: 'Tampa Bay Lightning', abbreviation: 'TBL', city: 'Tampa Bay' },
  { name: 'Toronto Maple Leafs', abbreviation: 'TOR', city: 'Toronto' },
  { name: 'Vancouver Canucks', abbreviation: 'VAN', city: 'Vancouver' },
  { name: 'Vegas Golden Knights', abbreviation: 'VGK', city: 'Vegas' },
  { name: 'Washington Capitals', abbreviation: 'WSH', city: 'Washington' },
  { name: 'Winnipeg Jets', abbreviation: 'WPG', city: 'Winnipeg' }
];

async function cleanNHLTeams() {
  console.log(chalk.blue.bold('\n🏒 CLEANING NHL TEAMS TO EXACTLY 32\n'));
  
  try {
    // Step 1: Get current NHL teams
    const { data: currentTeams, error } = await supabase
      .from('teams')
      .select('id, name, abbreviation, city')
      .eq('sport', 'NHL')
      .order('name');
    
    if (error) throw error;
    
    console.log(chalk.white(`📊 Current NHL teams: ${currentTeams?.length || 0}`));
    
    if (!currentTeams) return;
    
    // Step 2: Show current teams
    console.log(chalk.yellow('\n📋 CURRENT NHL TEAMS:'));
    console.log(chalk.gray('─'.repeat(60)));
    
    currentTeams.forEach(team => {
      console.log(chalk.white(`${team.id.toString().padStart(6)} | ${team.abbreviation?.padEnd(4)} | ${team.name}`));
    });
    
    // Step 3: Delete ALL current NHL teams (clean slate approach)
    console.log(chalk.yellow('\n🗑️  Step 1: Removing ALL current NHL teams...'));
    
    for (const team of currentTeams) {
      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('id', team.id);
      
      if (deleteError) {
        console.error(chalk.red(`   ❌ Error removing team ${team.id}:`, deleteError.message));
      } else {
        console.log(chalk.green(`   ✓ Removed ${team.name}`));
      }
    }
    
    // Step 4: Insert all 32 standard NHL teams
    console.log(chalk.yellow('\n➕ Step 2: Adding 32 standard NHL teams...'));
    
    for (const team of STANDARD_NHL_TEAMS) {
      const { error: insertError } = await supabase
        .from('teams')
        .insert({
          name: team.name,
          abbreviation: team.abbreviation,
          city: team.city,
          sport: 'NHL'
        });
      
      if (insertError) {
        console.error(chalk.red(`   ❌ Error adding ${team.abbreviation}:`, insertError.message));
      } else {
        console.log(chalk.green(`   ✓ Added ${team.name} (${team.abbreviation})`));
      }
    }
    
    // Step 5: Final verification
    console.log(chalk.yellow('\n📊 Step 3: Final verification...'));
    
    const { data: finalTeams } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
      .eq('sport', 'NHL')
      .order('abbreviation');
    
    console.log(chalk.white(`   Final NHL team count: ${finalTeams?.length || 0}`));
    
    if (finalTeams?.length === 32) {
      console.log(chalk.green('   ✅ Perfect! Exactly 32 NHL teams'));
    } else {
      console.log(chalk.red(`   ❌ Expected 32 teams, got ${finalTeams?.length || 0}`));
    }
    
    // Show final list
    console.log(chalk.white('\n📋 FINAL NHL TEAMS:'));
    console.log(chalk.gray('─'.repeat(60)));
    
    finalTeams?.forEach(team => {
      console.log(chalk.white(`${team.id.toString().padStart(6)} | ${team.abbreviation?.padEnd(4)} | ${team.name}`));
    });
    
    console.log(chalk.green('\n✅ NHL team cleanup complete!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error cleaning NHL teams:'), error);
  }
}

cleanNHLTeams().catch(console.error);
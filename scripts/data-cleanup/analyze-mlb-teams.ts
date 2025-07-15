#!/usr/bin/env tsx
/**
 * 🔍 ANALYZE MLB TEAMS
 * 
 * Analyzes the 33 MLB teams to identify which ones are extra/invalid
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Standard 30 MLB teams (2024)
const STANDARD_MLB_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BOS', 'CHW', 'CHC', 'CIN', 'CLE', 'COL', 'DET',
  'HOU', 'KC', 'LAA', 'LAD', 'MIA', 'MIL', 'MIN', 'NYY', 'NYM', 'OAK',
  'PHI', 'PIT', 'SD', 'SF', 'SEA', 'STL', 'TB', 'TEX', 'TOR', 'WSH'
];

async function analyzeMLBTeams() {
  console.log(chalk.cyan.bold('\n🔍 ANALYZING MLB TEAMS\n'));
  
  try {
    // Get all MLB teams
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name, abbreviation, sport')
      .eq('sport', 'MLB')
      .order('abbreviation');
    
    if (error) throw error;
    
    console.log(chalk.white(`📊 Total MLB teams: ${teams?.length || 0}`));
    
    if (!teams) return;
    
    // Show all teams
    console.log(chalk.white('\n📋 ALL MLB TEAMS IN DATABASE:'));
    console.log(chalk.gray('─'.repeat(70)));
    
    teams.forEach(team => {
      const abbr = team.abbreviation || 'N/A';
      const isStandard = STANDARD_MLB_TEAMS.includes(abbr);
      const color = isStandard ? chalk.green : chalk.red;
      
      console.log(color(`${team.id.toString().padStart(6)} | ${abbr.padEnd(4)} | ${team.name || 'N/A'}`));
    });
    
    // Identify non-standard teams
    const teamAbbrs = teams.map(t => t.abbreviation).filter(Boolean);
    const nonStandardTeams = teams.filter(t => !STANDARD_MLB_TEAMS.includes(t.abbreviation));
    const missingTeams = STANDARD_MLB_TEAMS.filter(abbr => !teamAbbrs.includes(abbr));
    
    console.log(chalk.red(`\n❌ NON-STANDARD TEAMS (${nonStandardTeams.length}):`));
    console.log(chalk.gray('─'.repeat(70)));
    
    if (nonStandardTeams.length > 0) {
      nonStandardTeams.forEach(team => {
        console.log(chalk.red(`   ID: ${team.id}, Abbr: ${team.abbreviation}, Name: ${team.name}`));
      });
    } else {
      console.log(chalk.green('   None found'));
    }
    
    console.log(chalk.yellow(`\n⚠️  MISSING STANDARD TEAMS (${missingTeams.length}):`));
    console.log(chalk.gray('─'.repeat(70)));
    
    if (missingTeams.length > 0) {
      missingTeams.forEach(abbr => {
        console.log(chalk.yellow(`   ${abbr}`));
      });
    } else {
      console.log(chalk.green('   None missing'));
    }
    
    // Check for games using these teams
    console.log(chalk.white('\n🎯 GAMES USING NON-STANDARD TEAMS:'));
    console.log(chalk.gray('─'.repeat(70)));
    
    for (const team of nonStandardTeams) {
      const { count: homeGames } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport', 'MLB')
        .eq('home_team_id', team.id);
      
      const { count: awayGames } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport', 'MLB')
        .eq('away_team_id', team.id);
      
      const totalGames = (homeGames || 0) + (awayGames || 0);
      
      console.log(chalk.white(`   ${team.abbreviation} (ID: ${team.id}): ${totalGames} games`));
    }
    
    // Check for duplicate abbreviations
    const abbrCounts = new Map<string, number>();
    teamAbbrs.forEach(abbr => {
      abbrCounts.set(abbr, (abbrCounts.get(abbr) || 0) + 1);
    });
    
    const duplicateAbbrs = Array.from(abbrCounts.entries()).filter(([_, count]) => count > 1);
    
    if (duplicateAbbrs.length > 0) {
      console.log(chalk.red(`\n🔄 DUPLICATE ABBREVIATIONS (${duplicateAbbrs.length}):`));
      console.log(chalk.gray('─'.repeat(70)));
      
      duplicateAbbrs.forEach(([abbr, count]) => {
        console.log(chalk.red(`   ${abbr}: ${count} teams`));
        
        const dupeTeams = teams.filter(t => t.abbreviation === abbr);
        dupeTeams.forEach(team => {
          console.log(chalk.red(`     ID: ${team.id}, Name: ${team.name}`));
        });
      });
    }
    
    console.log(chalk.white('\n💡 RECOMMENDATIONS:'));
    console.log(chalk.gray('─'.repeat(70)));
    
    if (nonStandardTeams.length > 0) {
      console.log(chalk.yellow('1. Remove non-standard teams or verify they are legitimate'));
    }
    
    if (missingTeams.length > 0) {
      console.log(chalk.yellow('2. Add missing standard MLB teams'));
    }
    
    if (duplicateAbbrs.length > 0) {
      console.log(chalk.yellow('3. Resolve duplicate abbreviations'));
    }
    
    console.log(chalk.green('\n✅ MLB team analysis complete!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error analyzing teams:'), error);
  }
}

analyzeMLBTeams().catch(console.error);
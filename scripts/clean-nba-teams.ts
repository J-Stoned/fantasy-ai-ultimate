#!/usr/bin/env tsx
/**
 * 🧹 CLEAN NBA TEAMS
 * 
 * Fixes NBA teams to exactly 30 standardized teams, removes duplicates and orphaned data
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Standard NBA teams (30 teams)
const STANDARD_NBA_TEAMS = [
  { name: 'Atlanta Hawks', abbreviation: 'ATL', city: 'Atlanta' },
  { name: 'Boston Celtics', abbreviation: 'BOS', city: 'Boston' },
  { name: 'Brooklyn Nets', abbreviation: 'BKN', city: 'Brooklyn' },
  { name: 'Charlotte Hornets', abbreviation: 'CHA', city: 'Charlotte' },
  { name: 'Chicago Bulls', abbreviation: 'CHI', city: 'Chicago' },
  { name: 'Cleveland Cavaliers', abbreviation: 'CLE', city: 'Cleveland' },
  { name: 'Dallas Mavericks', abbreviation: 'DAL', city: 'Dallas' },
  { name: 'Denver Nuggets', abbreviation: 'DEN', city: 'Denver' },
  { name: 'Detroit Pistons', abbreviation: 'DET', city: 'Detroit' },
  { name: 'Golden State Warriors', abbreviation: 'GSW', city: 'Golden State' },
  { name: 'Houston Rockets', abbreviation: 'HOU', city: 'Houston' },
  { name: 'Indiana Pacers', abbreviation: 'IND', city: 'Indiana' },
  { name: 'LA Clippers', abbreviation: 'LAC', city: 'Los Angeles' },
  { name: 'Los Angeles Lakers', abbreviation: 'LAL', city: 'Los Angeles' },
  { name: 'Memphis Grizzlies', abbreviation: 'MEM', city: 'Memphis' },
  { name: 'Miami Heat', abbreviation: 'MIA', city: 'Miami' },
  { name: 'Milwaukee Bucks', abbreviation: 'MIL', city: 'Milwaukee' },
  { name: 'Minnesota Timberwolves', abbreviation: 'MIN', city: 'Minnesota' },
  { name: 'New Orleans Pelicans', abbreviation: 'NOP', city: 'New Orleans' },
  { name: 'New York Knicks', abbreviation: 'NYK', city: 'New York' },
  { name: 'Oklahoma City Thunder', abbreviation: 'OKC', city: 'Oklahoma City' },
  { name: 'Orlando Magic', abbreviation: 'ORL', city: 'Orlando' },
  { name: 'Philadelphia 76ers', abbreviation: 'PHI', city: 'Philadelphia' },
  { name: 'Phoenix Suns', abbreviation: 'PHX', city: 'Phoenix' },
  { name: 'Portland Trail Blazers', abbreviation: 'POR', city: 'Portland' },
  { name: 'Sacramento Kings', abbreviation: 'SAC', city: 'Sacramento' },
  { name: 'San Antonio Spurs', abbreviation: 'SAS', city: 'San Antonio' },
  { name: 'Toronto Raptors', abbreviation: 'TOR', city: 'Toronto' },
  { name: 'Utah Jazz', abbreviation: 'UTA', city: 'Utah' },
  { name: 'Washington Wizards', abbreviation: 'WAS', city: 'Washington' }
];

async function cleanNBATeams() {
  console.log(chalk.cyan.bold('\n🧹 CLEANING NBA TEAMS TO EXACTLY 30\n'));
  
  try {
    // Get current NBA teams
    const { data: currentTeams, error } = await supabase
      .from('teams')
      .select('id, name, abbreviation, city, sport')
      .eq('sport', 'NBA')
      .order('name');
    
    if (error) throw error;
    
    console.log(chalk.white(`📊 Current NBA teams: ${currentTeams?.length || 0}`));
    
    if (!currentTeams) return;
    
    // Step 1: Remove obvious foreign/invalid teams
    console.log(chalk.yellow('\n🗑️  Step 1: Removing invalid/foreign teams...'));
    
    const invalidTeams = currentTeams.filter(team => {
      const name = team.name?.toLowerCase() || '';
      const abbrev = team.abbreviation?.toLowerCase() || '';
      
      // Remove foreign teams and invalid entries
      return name.includes('cairns') || 
             name.includes('team ') || 
             name.includes('real madrid') || 
             name.includes('flamengo') || 
             name.includes('breakers') || 
             name.includes('ulm') || 
             name.includes('ra\'anana') || 
             abbrev?.includes('t111836') ||
             abbrev === 'cns' ||
             abbrev === 'chk' ||
             abbrev === 'ken' ||
             abbrev === 'can' ||
             abbrev === 'shq' ||
             abbrev === 'real' ||
             abbrev === 'flmg' ||
             abbrev === 'nzl' ||
             abbrev === 'mrc' ||
             !abbrev;
    });
    
    console.log(chalk.white(`   Found ${invalidTeams.length} invalid teams to remove`));
    
    for (const team of invalidTeams) {
      console.log(chalk.red(`   Removing: ${team.name} (${team.abbreviation}) - ID: ${team.id}`));
      
      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('id', team.id);
      
      if (deleteError) {
        console.error(chalk.red(`   Error removing team ${team.id}:`, deleteError));
      } else {
        console.log(chalk.green(`   ✓ Removed invalid team ${team.id}`));
      }
    }
    
    // Step 2: Handle duplicates - keep the one with more games
    console.log(chalk.yellow('\n🔄 Step 2: Handling duplicate teams...'));
    
    const validTeams = currentTeams.filter(team => !invalidTeams.includes(team));
    
    // Group by abbreviation to find duplicates
    const teamsByAbbrev = new Map<string, any[]>();
    validTeams.forEach(team => {
      const abbrev = team.abbreviation?.toUpperCase();
      if (abbrev) {
        if (!teamsByAbbrev.has(abbrev)) teamsByAbbrev.set(abbrev, []);
        teamsByAbbrev.get(abbrev)!.push(team);
      }
    });
    
    const duplicateGroups = Array.from(teamsByAbbrev.values()).filter(teams => teams.length > 1);
    
    for (const duplicates of duplicateGroups) {
      console.log(chalk.white(`   Processing duplicates for ${duplicates[0].abbreviation}:`));
      
      // Check game counts for each duplicate
      const teamGameCounts = [];
      
      for (const team of duplicates) {
        const { count: homeGames } = await supabase
          .from('games')
          .select('*', { count: 'exact', head: true })
          .eq('home_team_id', team.id);
        
        const { count: awayGames } = await supabase
          .from('games')
          .select('*', { count: 'exact', head: true })
          .eq('away_team_id', team.id);
        
        const totalGames = (homeGames || 0) + (awayGames || 0);
        teamGameCounts.push({ team, totalGames });
        
        console.log(chalk.gray(`     ${team.name} (${team.id}): ${totalGames} games`));
      }
      
      // Keep the team with most games, remove others
      teamGameCounts.sort((a, b) => b.totalGames - a.totalGames);
      const keepTeam = teamGameCounts[0];
      const removeTeams = teamGameCounts.slice(1);
      
      console.log(chalk.green(`   ✓ Keeping: ${keepTeam.team.name} (${keepTeam.team.id}) - ${keepTeam.totalGames} games`));
      
      for (const { team } of removeTeams) {
        console.log(chalk.red(`   Removing: ${team.name} (${team.id})`));
        
        const { error: deleteError } = await supabase
          .from('teams')
          .delete()
          .eq('id', team.id);
        
        if (deleteError) {
          console.error(chalk.red(`   Error removing duplicate team ${team.id}:`, deleteError));
        } else {
          console.log(chalk.green(`   ✓ Removed duplicate team ${team.id}`));
        }
      }
    }
    
    // Step 3: Remove orphaned teams (0 games)
    console.log(chalk.yellow('\n👻 Step 3: Removing orphaned teams...'));
    
    const { data: remainingTeams } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
      .eq('sport', 'NBA')
      .order('name');
    
    if (remainingTeams) {
      for (const team of remainingTeams) {
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
          console.log(chalk.red(`   Removing orphaned: ${team.name} (${team.abbreviation}) - ${team.id}`));
          
          const { error: deleteError } = await supabase
            .from('teams')
            .delete()
            .eq('id', team.id);
          
          if (deleteError) {
            console.error(chalk.red(`   Error removing orphaned team ${team.id}:`, deleteError));
          } else {
            console.log(chalk.green(`   ✓ Removed orphaned team ${team.id}`));
          }
        }
      }
    }
    
    // Step 4: Add missing standard NBA teams
    console.log(chalk.yellow('\n➕ Step 4: Adding missing standard NBA teams...'));
    
    const { data: finalTeams } = await supabase
      .from('teams')
      .select('name, abbreviation')
      .eq('sport', 'NBA');
    
    const existingAbbrevs = new Set(finalTeams?.map(t => t.abbreviation?.toUpperCase()) || []);
    
    for (const standardTeam of STANDARD_NBA_TEAMS) {
      if (!existingAbbrevs.has(standardTeam.abbreviation)) {
        console.log(chalk.white(`   Adding missing team: ${standardTeam.name} (${standardTeam.abbreviation})`));
        
        const { error: insertError } = await supabase
          .from('teams')
          .insert({
            name: standardTeam.name,
            abbreviation: standardTeam.abbreviation,
            city: standardTeam.city,
            sport: 'NBA'
          });
        
        if (insertError) {
          console.error(chalk.red(`   Error adding ${standardTeam.abbreviation}:`, insertError));
        } else {
          console.log(chalk.green(`   ✓ Added ${standardTeam.name}`));
        }
      }
    }
    
    // Step 5: Final verification
    console.log(chalk.yellow('\n📊 Step 5: Final verification...'));
    
    const { data: verificationTeams } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
      .eq('sport', 'NBA')
      .order('abbreviation');
    
    console.log(chalk.white(`   Final NBA team count: ${verificationTeams?.length || 0}`));
    
    if (verificationTeams?.length === 30) {
      console.log(chalk.green('   ✅ Perfect! Exactly 30 NBA teams'));
    } else {
      console.log(chalk.red(`   ❌ Expected 30 teams, got ${verificationTeams?.length || 0}`));
    }
    
    // Show final list
    console.log(chalk.white('\n📋 FINAL NBA TEAMS:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    verificationTeams?.forEach(team => {
      console.log(chalk.white(`${team.id.toString().padStart(6)} | ${team.abbreviation?.padEnd(4)} | ${team.name}`));
    });
    
    console.log(chalk.green('\n✅ NBA team cleanup complete!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error cleaning NBA teams:'), error);
  }
}

cleanNBATeams().catch(console.error);
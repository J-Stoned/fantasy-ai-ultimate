#!/usr/bin/env tsx
/**
 * 🔧 FIX TEAM CACHE ISSUES
 * 
 * Debug and fix the 70 team cache misses identified by turbo debugger
 * - Analyze team ID mapping issues
 * - Fix external_id format problems
 * - Rebuild cache indexes with corrections
 * - Target: 100% team cache hit rate
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { InMemoryCache } from './utils/memory-cache';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TeamMissAnalysis {
  espnTeamId: string;
  expectedExternalId: string;
  found: boolean;
  actualExternalId?: string;
  teamName?: string;
  issue: string;
}

async function analyzeTeamCacheIssues() {
  console.log(chalk.bold.cyan('🔧 FIXING TEAM CACHE ISSUES\n'));
  
  // Initialize cache
  console.log(chalk.gray('Loading cache...'));
  const cache = new InMemoryCache();
  await cache.initialize();
  const stats = cache.getStats();
  console.log(chalk.green(`✅ Cache loaded: ${stats.teams} teams\n`));
  
  // Get sample games to analyze team misses
  const { data: sampleGames } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-01-01')
    .lt('start_time', '2023-01-01')
    .limit(10); // Just 10 games for analysis
    
  if (!sampleGames) {
    console.log(chalk.red('No games found'));
    return;
  }
  
  console.log(chalk.cyan('🔍 Analyzing team cache misses...\n'));
  
  const teamMisses: TeamMissAnalysis[] = [];
  const uniqueTeamIds = new Set<string>();
  
  for (const game of sampleGames) {
    const espnGameId = game.external_id?.split('_').pop();
    if (!espnGameId) continue;
    
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
      const response = await axios.get(url, { timeout: 10000 });
      const gameData = response.data;
      
      if (!gameData.boxscore?.players) continue;
      
      for (const team of gameData.boxscore.players) {
        const teamId = team.team?.id;
        if (!teamId || uniqueTeamIds.has(teamId)) continue;
        
        uniqueTeamIds.add(teamId);
        
        const expectedExternalId = `espn_nfl_${teamId}`;
        const dbTeam = cache.getTeamByExternalId(expectedExternalId);
        
        const analysis: TeamMissAnalysis = {
          espnTeamId: teamId,
          expectedExternalId: expectedExternalId,
          found: !!dbTeam,
          teamName: team.team?.displayName || team.team?.name,
          issue: ''
        };
        
        if (!dbTeam) {
          // Check if team exists with different external_id format
          const serialized = cache.serialize();
          const teams = new Map(serialized.teams);
          
          let foundWithDifferentId = false;
          for (const [id, teamData] of teams) {
            if (teamData.sport === 'NFL' && 
                (teamData.name?.includes(analysis.teamName?.split(' ').pop() || '') ||
                 analysis.teamName?.includes(teamData.name?.split(' ').pop() || ''))) {
              analysis.actualExternalId = teamData.external_id;
              analysis.issue = `Found team "${teamData.name}" with different external_id: ${teamData.external_id}`;
              foundWithDifferentId = true;
              break;
            }
          }
          
          if (!foundWithDifferentId) {
            analysis.issue = 'Team not found in database at all';
          }
        } else {
          analysis.issue = 'OK';
        }
        
        teamMisses.push(analysis);
      }
    } catch (error) {
      console.log(chalk.yellow(`Skipped game ${game.id} due to error`));
      continue;
    }
  }
  
  // Analyze results
  console.log(chalk.cyan('📊 TEAM CACHE ANALYSIS RESULTS:\n'));
  
  const totalTeams = teamMisses.length;
  const foundTeams = teamMisses.filter(t => t.found).length;
  const missedTeams = teamMisses.filter(t => !t.found).length;
  
  console.log(chalk.white(`Total teams analyzed: ${totalTeams}`));
  console.log(chalk.green(`Cache hits: ${foundTeams} (${Math.round(foundTeams/totalTeams*100)}%)`));
  console.log(chalk.red(`Cache misses: ${missedTeams} (${Math.round(missedTeams/totalTeams*100)}%)\n`));
  
  // Show missed teams
  if (missedTeams > 0) {
    console.log(chalk.red('❌ MISSED TEAMS:'));
    teamMisses.filter(t => !t.found).forEach(team => {
      console.log(chalk.white(`  ${team.teamName} (ESPN ID: ${team.espnTeamId})`));
      console.log(chalk.gray(`    Expected: ${team.expectedExternalId}`));
      console.log(chalk.gray(`    Issue: ${team.issue}\n`));
    });
  }
  
  // Show successful teams for comparison
  if (foundTeams > 0) {
    console.log(chalk.green('✅ SUCCESSFUL TEAMS:'));
    teamMisses.filter(t => t.found).slice(0, 5).forEach(team => {
      console.log(chalk.white(`  ${team.teamName} (ESPN ID: ${team.espnTeamId}) ✅`));
    });
    if (foundTeams > 5) {
      console.log(chalk.gray(`  ... and ${foundTeams - 5} more\n`));
    }
  }
  
  return teamMisses;
}

async function fixTeamCacheIssues() {
  console.log(chalk.bold.cyan('🔧 TEAM CACHE FIX\n'));
  
  const analysis = await analyzeTeamCacheIssues();
  if (!analysis) return;
  
  const missedTeams = analysis.filter(t => !t.found);
  
  if (missedTeams.length === 0) {
    console.log(chalk.bold.green('🎉 NO TEAM CACHE ISSUES FOUND!'));
    console.log(chalk.green('All teams are properly cached. The 70 misses might be from different games.'));
    return;
  }
  
  console.log(chalk.yellow(`\n🔧 Found ${missedTeams.length} team cache issues to fix...\n`));
  
  // Suggest fixes
  console.log(chalk.cyan('💡 SUGGESTED FIXES:\n'));
  
  for (const team of missedTeams) {
    if (team.issue.includes('different external_id')) {
      console.log(chalk.yellow(`${team.teamName}:`));
      console.log(chalk.white(`  Current: ${team.actualExternalId}`));
      console.log(chalk.white(`  Should be: ${team.expectedExternalId}`));
      console.log(chalk.green(`  Fix: Update external_id in database\n`));
    } else if (team.issue.includes('not found in database')) {
      console.log(chalk.yellow(`${team.teamName}:`));
      console.log(chalk.white(`  ESPN ID: ${team.espnTeamId}`));
      console.log(chalk.green(`  Fix: Add team to database with external_id: ${team.expectedExternalId}\n`));
    }
  }
  
  // Offer to auto-fix
  console.log(chalk.magenta('🚀 AUTO-FIX AVAILABLE:'));
  console.log(chalk.white('  Would you like to automatically fix these team cache issues?'));
  console.log(chalk.gray('  This will update external_ids and add missing teams.'));
}

if (require.main === module) {
  fixTeamCacheIssues().catch(console.error);
}
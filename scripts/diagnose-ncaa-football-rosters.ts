#!/usr/bin/env tsx
/**
 * 🔍 NCAA FOOTBALL ROSTER DIAGNOSTIC
 * Tests all 500 teams to see which ones have actual roster data
 * 10x developer approach: Find the problem, fix it fast
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.bold.yellow('🔍 NCAA FOOTBALL ROSTER DIAGNOSTIC - 10X APPROACH\n'));

// AGGRESSIVE TESTING CONFIGURATION
const CONFIG = {
  CONCURRENT_REQUESTS: 50,  // Max out for fastest testing
  TIMEOUT: 5000,            // 5 second timeout per request
  RETRY_ATTEMPTS: 1,        // Single retry for failed requests
  ESPN_API: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football'
};

interface TeamRosterResult {
  teamId: number;
  teamName: string;
  externalId: string;
  espnId: string;
  hasRoster: boolean;
  playerCount: number;
  positionGroups: number;
  error?: string;
  responseTime: number;
}

// Progress tracking
let totalTeams = 0;
let teamsWithRosters = 0;
let teamsWithoutRosters = 0;
let errorCount = 0;
const startTime = Date.now();
const limit = pLimit(CONFIG.CONCURRENT_REQUESTS);

// Progress bar
const progressBar = new cliProgress.SingleBar({
  format: 'Testing Rosters |{bar}| {percentage}% | {value}/{total} teams | {withRoster} with rosters | {duration_formatted}',
  barCompleteChar: '\\u2588',
  barIncompleteChar: '\\u2591',
});

/**
 * Test a single team's roster endpoint
 */
async function testTeamRoster(team: any): Promise<TeamRosterResult> {
  const result: TeamRosterResult = {
    teamId: team.id,
    teamName: team.name,
    externalId: team.external_id,
    espnId: team.external_id.replace('espn_ncaaf_', ''),
    hasRoster: false,
    playerCount: 0,
    positionGroups: 0,
    responseTime: 0
  };
  
  const requestStart = Date.now();
  
  try {
    const url = `${CONFIG.ESPN_API}/teams/${result.espnId}/roster`;
    const response = await axios.get(url, { timeout: CONFIG.TIMEOUT });
    
    result.responseTime = Date.now() - requestStart;
    
    if (response.data?.athletes && Array.isArray(response.data.athletes)) {
      result.hasRoster = true;
      result.positionGroups = response.data.athletes.length;
      
      // Count total players
      for (const positionGroup of response.data.athletes) {
        if (positionGroup.items && Array.isArray(positionGroup.items)) {
          result.playerCount += positionGroup.items.length;
        }
      }
    }
    
  } catch (error: any) {
    result.responseTime = Date.now() - requestStart;
    result.error = error.message;
    
    // Common error patterns
    if (error.response?.status === 404) {
      result.error = 'Team not found (404)';
    } else if (error.response?.status === 500) {
      result.error = 'ESPN server error (500)';
    } else if (error.code === 'ECONNABORTED') {
      result.error = 'Request timeout';
    }
  }
  
  return result;
}

/**
 * Get all teams from database
 */
async function getAllTeams(): Promise<any[]> {
  console.log('📊 Loading all NCAA Football teams...');
  
  const teams = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('teams')
      .select('id, name, external_id, metadata')
      .eq('sport', 'NCAA_FB')
      .order('name')
      .range(from, from + batchSize - 1);
    
    if (error) {
      console.error('Error fetching teams:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    teams.push(...data);
    from += batchSize;
    if (data.length < batchSize) break;
  }
  
  console.log(`Found ${teams.length} teams to test`);
  return teams;
}

/**
 * Main diagnostic function
 */
async function diagnoseRosters() {
  console.log(chalk.cyan('Starting comprehensive roster diagnostic...\\n'));
  
  // Get all teams
  const teams = await getAllTeams();
  totalTeams = teams.length;
  
  if (totalTeams === 0) {
    console.log(chalk.red('❌ No teams found!'));
    return;
  }
  
  // Initialize progress bar
  progressBar.start(totalTeams, 0, { withRoster: 0 });
  
  // Test all teams in parallel
  const results: TeamRosterResult[] = [];
  
  const testPromises = teams.map(team =>
    limit(async () => {
      const result = await testTeamRoster(team);
      results.push(result);
      
      if (result.hasRoster) {
        teamsWithRosters++;
      } else {
        teamsWithoutRosters++;
      }
      
      if (result.error) {
        errorCount++;
      }
      
      progressBar.update(results.length, { withRoster: teamsWithRosters });
      return result;
    })
  );
  
  // Wait for all tests to complete
  await Promise.all(testPromises);
  
  progressBar.stop();
  
  // Sort results by success first, then by player count
  results.sort((a, b) => {
    if (a.hasRoster && !b.hasRoster) return -1;
    if (!a.hasRoster && b.hasRoster) return 1;
    return b.playerCount - a.playerCount;
  });
  
  // Display results
  const duration = (Date.now() - startTime) / 1000;
  
  console.log('\\n' + chalk.green('═'.repeat(80)));
  console.log(chalk.bold.green('✅ NCAA FOOTBALL ROSTER DIAGNOSTIC COMPLETE!'));
  console.log(chalk.green('═'.repeat(80)));
  
  console.log(`Total Teams Tested: ${chalk.bold(totalTeams)}`);
  console.log(`Teams WITH Rosters: ${chalk.bold.green(teamsWithRosters)} (${((teamsWithRosters / totalTeams) * 100).toFixed(1)}%)`);
  console.log(`Teams WITHOUT Rosters: ${chalk.bold.red(teamsWithoutRosters)} (${((teamsWithoutRosters / totalTeams) * 100).toFixed(1)}%)`);
  console.log(`Errors: ${chalk.bold.red(errorCount)}`);
  console.log(`Duration: ${chalk.bold(duration.toFixed(1))}s`);
  console.log(`Rate: ${chalk.bold((totalTeams / duration).toFixed(1))} teams/second`);
  
  // Show top teams with rosters
  console.log('\\n' + chalk.bold.cyan('🏆 TOP TEAMS WITH ROSTERS:'));
  const topTeams = results.filter(r => r.hasRoster).slice(0, 20);
  
  topTeams.forEach((team, i) => {
    console.log(`${i + 1}. ${chalk.bold(team.teamName)} (${team.espnId})`);
    console.log(`   Players: ${chalk.green(team.playerCount)} | Groups: ${team.positionGroups} | Response: ${team.responseTime}ms`);
  });
  
  // Show sample teams without rosters
  console.log('\\n' + chalk.bold.red('❌ SAMPLE TEAMS WITHOUT ROSTERS:'));
  const failedTeams = results.filter(r => !r.hasRoster).slice(0, 10);
  
  failedTeams.forEach((team, i) => {
    console.log(`${i + 1}. ${chalk.dim(team.teamName)} (${team.espnId})`);
    console.log(`   Error: ${chalk.red(team.error || 'No roster data')} | Response: ${team.responseTime}ms`);
  });
  
  // Summary stats
  const totalPlayers = results.reduce((sum, r) => sum + r.playerCount, 0);
  const avgPlayersPerTeam = totalPlayers / Math.max(teamsWithRosters, 1);
  
  console.log('\\n' + chalk.bold.yellow('📊 ROSTER STATISTICS:'));
  console.log(`Total Players Found: ${chalk.bold.green(totalPlayers)}`);
  console.log(`Average Players per Team: ${chalk.bold(avgPlayersPerTeam.toFixed(1))}`);
  console.log(`Estimated Full Collection: ${chalk.bold.green((teamsWithRosters * avgPlayersPerTeam).toFixed(0))} players`);
  
  // Save results for next phase
  const goodTeams = results.filter(r => r.hasRoster);
  console.log('\\n' + chalk.bold.green(`🎯 RECOMMENDATION: Focus on ${goodTeams.length} teams with actual roster data`));
  console.log(chalk.yellow('Next step: Clean up database and re-run collection with validated teams only'));
  
  console.log(chalk.green('═'.repeat(80)));
}

// Run the diagnostic
diagnoseRosters()
  .then(() => {
    console.log('\\n👋 Diagnostic complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
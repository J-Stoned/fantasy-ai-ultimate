#!/usr/bin/env tsx
/**
 * 🚀 TURBO NFL STATS DEBUG
 * 
 * Uses Ryzen 5 7600X (12 threads) + 32GB RAM to debug stat collection
 * - 12 worker threads for parallel ESPN API analysis
 * - In-memory cache (150MB) preloaded
 * - Process 50+ games simultaneously
 * - Enhanced logging for stat structure analysis
 */

import { createClient } from '@supabase/supabase-js';
import { Worker } from 'worker_threads';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import { InMemoryCache } from './utils/memory-cache';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DebugResult {
  gameId: string;
  gameDate: string;
  teamsProcessed: number;
  statGroupsFound: number;
  athletesFound: number;
  statsProcessed: number;
  emptyStats: number;
  issues: string[];
  sampleStatGroups: any[];
}

class TurboNFLStatsDebugger {
  private workers: Worker[] = [];
  private cache!: InMemoryCache;
  private results: DebugResult[] = [];
  
  async initialize() {
    console.log(chalk.bold.cyan('🚀 TURBO NFL STATS DEBUGGER\n'));
    console.log(chalk.yellow('Initializing 32GB RAM cache...'));
    
    // Load entire database into RAM
    this.cache = new InMemoryCache();
    await this.cache.initialize();
    
    const stats = this.cache.getStats();
    console.log(chalk.green(`✅ Cache loaded: ${stats.teams} teams, ${stats.players} players, ${stats.games} games\n`));
  }
  
  async debugNFLStats() {
    // Get representative NFL games from different time periods
    const { data: allGames } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'NFL')
      .gte('start_time', '2021-01-01')
      .lt('start_time', '2023-01-01')
      .order('start_time');
      
    if (!allGames || allGames.length === 0) {
      console.log(chalk.red('No NFL games found'));
      return;
    }
    
    // Sample games from different periods
    const sampleGames = this.selectRepresentativeGames(allGames, 50);
    
    console.log(chalk.yellow(`Debugging ${sampleGames.length} representative games with 12 workers...\n`));
    
    // Progress bar
    const progressBar = new cliProgress.SingleBar({
      format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} games | Issues: {issues}',
      barCompleteChar: '█',
      barIncompleteChar: '░'
    }, cliProgress.Presets.shades_classic);
    
    progressBar.start(sampleGames.length, 0, { issues: 0 });
    
    // Process games with 12 workers (Ryzen 5 7600X optimization)
    const limit = pLimit(12);
    let totalIssues = 0;
    let processedGames = 0;
    
    const gamePromises = sampleGames.map(game => 
      limit(async () => {
        try {
          const result = await this.debugSingleGame(game);
          this.results.push(result);
          
          totalIssues += result.issues.length;
          processedGames++;
          progressBar.update(processedGames, { issues: totalIssues });
          
        } catch (error: any) {
          console.error(chalk.red(`\nError debugging game ${game.id}: ${error.message}`));
        }
      })
    );
    
    await Promise.all(gamePromises);
    progressBar.stop();
    
    // Analyze results
    this.analyzeResults();
  }
  
  private selectRepresentativeGames(allGames: any[], count: number): any[] {
    // Select games from different time periods for comprehensive analysis
    const games2021 = allGames.filter(g => new Date(g.start_time).getFullYear() === 2021);
    const games2022 = allGames.filter(g => new Date(g.start_time).getFullYear() === 2022);
    
    const sample: any[] = [];
    
    // Take samples from different months
    const sampleSize = Math.floor(count / 4);
    
    // Early season (Sep-Oct)
    sample.push(...games2021.filter(g => {
      const month = new Date(g.start_time).getMonth();
      return month >= 8 && month <= 9; // Sep-Oct
    }).slice(0, sampleSize));
    
    // Mid season (Nov-Dec)
    sample.push(...games2021.filter(g => {
      const month = new Date(g.start_time).getMonth();
      return month >= 10 && month <= 11; // Nov-Dec
    }).slice(0, sampleSize));
    
    // Late season (Jan)
    sample.push(...games2022.filter(g => {
      const month = new Date(g.start_time).getMonth();
      return month === 0; // Jan
    }).slice(0, sampleSize));
    
    // Playoffs (Feb)
    sample.push(...games2022.filter(g => {
      const month = new Date(g.start_time).getMonth();
      return month === 1; // Feb
    }).slice(0, sampleSize));
    
    // Fill remaining with random games
    const remaining = count - sample.length;
    if (remaining > 0) {
      const shuffled = [...allGames].sort(() => 0.5 - Math.random());
      sample.push(...shuffled.slice(0, remaining));
    }
    
    return sample.slice(0, count);
  }
  
  private async debugSingleGame(game: any): Promise<DebugResult> {
    const espnGameId = game.external_id?.split('_').pop();
    if (!espnGameId) {
      return {
        gameId: game.id,
        gameDate: game.start_time,
        teamsProcessed: 0,
        statGroupsFound: 0,
        athletesFound: 0,
        statsProcessed: 0,
        emptyStats: 0,
        issues: ['No ESPN game ID'],
        sampleStatGroups: []
      };
    }
    
    try {
      const axios = require('axios');
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
      const response = await axios.get(url, { timeout: 10000 });
      const gameData = response.data;
      
      const result: DebugResult = {
        gameId: game.id,
        gameDate: game.start_time,
        teamsProcessed: 0,
        statGroupsFound: 0,
        athletesFound: 0,
        statsProcessed: 0,
        emptyStats: 0,
        issues: [],
        sampleStatGroups: []
      };
      
      if (!gameData.boxscore?.players) {
        result.issues.push('No boxscore.players found');
        return result;
      }
      
      result.teamsProcessed = gameData.boxscore.players.length;
      
      for (const team of gameData.boxscore.players) {
        const teamId = team.team?.id;
        if (!teamId) {
          result.issues.push('Team missing ID');
          continue;
        }
        
        const dbTeam = this.cache.getTeamByExternalId(`espn_nfl_${teamId}`);
        if (!dbTeam) {
          result.issues.push(`Team not found in cache: espn_nfl_${teamId}`);
          continue;
        }
        
        for (const statGroup of team.statistics || []) {
          result.statGroupsFound++;
          
          // Sample first few stat groups for analysis
          if (result.sampleStatGroups.length < 3) {
            result.sampleStatGroups.push({
              name: statGroup.name,
              hasLabels: !!statGroup.labels,
              hasNames: !!statGroup.names,
              labels: statGroup.labels || [],
              names: statGroup.names || [],
              athleteCount: (statGroup.athletes || []).length,
              firstAthlete: statGroup.athletes?.[0] ? {
                name: statGroup.athletes[0].athlete?.displayName,
                stats: statGroup.athletes[0].stats || []
              } : null
            });
          }
          
          for (const athlete of statGroup.athletes || []) {
            result.athletesFound++;
            
            const playerId = athlete.athlete?.id;
            if (!playerId) {
              result.issues.push('Athlete missing ID');
              continue;
            }
            
            const player = this.cache.getPlayerByExternalId(`espn_nfl_${playerId}`);
            if (!player) {
              // Only log first few missing players to avoid spam
              if (result.issues.filter(i => i.startsWith('Missing player')).length < 3) {
                result.issues.push(`Missing player: ${athlete.athlete.displayName} (espn_nfl_${playerId})`);
              }
              continue;
            }
            
            // Analyze stat structure
            const stats: any = {};
            const statLabels = statGroup.labels || statGroup.names || [];
            const statValues = athlete.stats || [];
            
            if (statLabels.length === 0) {
              result.issues.push(`No stat labels in group: ${statGroup.name}`);
              continue;
            }
            
            if (statValues.length === 0) {
              result.emptyStats++;
              continue;
            }
            
            // Try to map some stats
            statLabels.forEach((label: string, index: number) => {
              const value = statValues[index];
              if (value !== undefined && value !== null && value !== '') {
                stats[label] = value;
              }
            });
            
            if (Object.keys(stats).length > 0) {
              result.statsProcessed++;
            } else {
              result.emptyStats++;
            }
          }
        }
      }
      
      return result;
      
    } catch (error: any) {
      return {
        gameId: game.id,
        gameDate: game.start_time,
        teamsProcessed: 0,
        statGroupsFound: 0,
        athletesFound: 0,
        statsProcessed: 0,
        emptyStats: 0,
        issues: [`API Error: ${error.message}`],
        sampleStatGroups: []
      };
    }
  }
  
  private analyzeResults() {
    console.log(chalk.bold.green('\n🔍 TURBO DEBUG ANALYSIS RESULTS\n'));
    
    const totalGames = this.results.length;
    const totalTeams = this.results.reduce((sum, r) => sum + r.teamsProcessed, 0);
    const totalStatGroups = this.results.reduce((sum, r) => sum + r.statGroupsFound, 0);
    const totalAthletes = this.results.reduce((sum, r) => sum + r.athletesFound, 0);
    const totalStatsProcessed = this.results.reduce((sum, r) => sum + r.statsProcessed, 0);
    const totalEmptyStats = this.results.reduce((sum, r) => sum + r.emptyStats, 0);
    
    console.log(chalk.cyan('📊 PROCESSING SUMMARY:'));
    console.log(chalk.white(`  Games debugged: ${totalGames}`));
    console.log(chalk.white(`  Teams processed: ${totalTeams} (${Math.round(totalTeams/totalGames)} per game)`));
    console.log(chalk.white(`  Stat groups found: ${totalStatGroups} (${Math.round(totalStatGroups/totalGames)} per game)`));
    console.log(chalk.white(`  Athletes found: ${totalAthletes} (${Math.round(totalAthletes/totalGames)} per game)`));
    console.log(chalk.white(`  Stats processed: ${totalStatsProcessed} (${Math.round(totalStatsProcessed/totalGames)} per game)`));
    console.log(chalk.white(`  Empty stats: ${totalEmptyStats} (${Math.round(totalEmptyStats/totalGames)} per game)\n`));
    
    // Analyze stat groups
    console.log(chalk.cyan('📋 STAT GROUP ANALYSIS:'));
    const allSampleGroups = this.results.flatMap(r => r.sampleStatGroups);
    const uniqueGroups = [...new Set(allSampleGroups.map(g => g.name))];
    
    uniqueGroups.forEach(groupName => {
      const samples = allSampleGroups.filter(g => g.name === groupName);
      const hasLabels = samples.filter(g => g.hasLabels).length;
      const hasNames = samples.filter(g => g.hasNames).length;
      
      console.log(chalk.white(`  ${groupName}:`));
      console.log(chalk.gray(`    Labels: ${hasLabels}/${samples.length} | Names: ${hasNames}/${samples.length}`));
      
      if (samples[0]) {
        console.log(chalk.gray(`    Sample labels: [${(samples[0].labels || []).slice(0, 5).join(', ')}]`));
      }
    });
    
    // Analyze common issues
    console.log(chalk.cyan('\n⚠️  COMMON ISSUES:'));
    const allIssues = this.results.flatMap(r => r.issues);
    const issueCount: Record<string, number> = {};
    
    allIssues.forEach(issue => {
      const key = issue.split(':')[0]; // Group similar issues
      issueCount[key] = (issueCount[key] || 0) + 1;
    });
    
    Object.entries(issueCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([issue, count]) => {
        console.log(chalk.yellow(`  ${issue}: ${count} occurrences`));
      });
    
    // Performance metrics
    console.log(chalk.cyan('\n🚀 PERFORMANCE METRICS:'));
    console.log(chalk.white(`  Expected stats per game: 80-120`));
    console.log(chalk.white(`  Current stats per game: ${Math.round(totalStatsProcessed/totalGames)}`));
    console.log(chalk.white(`  Efficiency: ${Math.round((totalStatsProcessed/totalGames) / 100 * 100)}%`));
    
    if (totalStatsProcessed/totalGames < 20) {
      console.log(chalk.red('\n🔥 CRITICAL ISSUE: Very low stats per game!'));
      console.log(chalk.red('   Root cause likely in stat mapping logic'));
    }
  }
}

async function main() {
  const debug = new TurboNFLStatsDebugger();
  await debug.initialize();
  await debug.debugNFLStats();
}

if (require.main === module) {
  main().catch(console.error);
}
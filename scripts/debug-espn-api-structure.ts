#!/usr/bin/env tsx
/**
 * ESPN API Structure Debugger - Test All Sports
 * 
 * This script tests the current ESPN API structure for NBA, NFL, MLB, NHL
 * to diagnose why the universal collector finds "No stats available"
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import axios from 'axios';
import chalk from 'chalk';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Test configurations for each sport
const SPORT_TEST_CONFIGS = {
  NBA: {
    endpoint: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary',
    testGameIds: ['401766128', '401675635', '401468297'] // Mix of recent and older games
  },
  NFL: {
    endpoint: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary',
    testGameIds: ['401671719', '401547428', '401326315']
  },
  MLB: {
    endpoint: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary',
    testGameIds: ['401581582', '401472105', '401354973']
  },
  NHL: {
    endpoint: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary',
    testGameIds: ['401559534', '401349271', '401247152']
  }
};

// Extract ESPN ID from various formats
function extractEspnId(externalId: string): string | null {
  const patterns = [
    /espn_\w+_(\d+)$/,  // espn_nba_401267399
    /\w+_(\d+)$/,       // nba_401267399
    /^(\d+)$/           // 401267399
  ];
  
  for (const pattern of patterns) {
    const match = externalId.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

// Test ESPN API for a specific game
async function testEspnGame(sport: string, gameId: string): Promise<any> {
  const config = SPORT_TEST_CONFIGS[sport as keyof typeof SPORT_TEST_CONFIGS];
  const url = `${config.endpoint}?event=${gameId}`;
  
  try {
    console.log(chalk.blue(`  🎯 Testing ${sport} game ${gameId}...`));
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000
    });

    const data = response.data;
    
    const analysis = {
      gameId,
      status: response.status,
      hasBoxscore: !!data.boxscore,
      teamsCount: data.boxscore?.teams?.length || 0,
      playersCount: 0,
      statisticsStructure: 'unknown',
      samplePlayerData: null,
      errors: []
    };

    if (data.boxscore?.teams) {
      // Analyze structure based on sport
      let totalPlayers = 0;
      let structureFound = false;
      
      for (const team of data.boxscore.teams) {
        if (team.statistics) {
          for (const statGroup of team.statistics) {
            if (statGroup.athletes) {
              totalPlayers += statGroup.athletes.length;
              if (!structureFound && statGroup.athletes.length > 0) {
                const athlete = statGroup.athletes[0];
                analysis.samplePlayerData = {
                  name: athlete.athlete?.displayName || 'Unknown',
                  hasStats: !!athlete.stats,
                  statsLength: athlete.stats?.length || 0,
                  statsType: statGroup.type || 'unknown',
                  statsFormat: Array.isArray(athlete.stats) ? 'array' : typeof athlete.stats
                };
                structureFound = true;
              }
            }
          }
        }
      }
      
      analysis.playersCount = totalPlayers;
      analysis.statisticsStructure = structureFound ? 'found' : 'missing';
    }

    console.log(chalk.green(`    ✅ Status: ${analysis.status}, Teams: ${analysis.teamsCount}, Players: ${analysis.playersCount}`));
    if (analysis.samplePlayerData) {
      console.log(chalk.gray(`    📊 Sample: ${analysis.samplePlayerData.name} (${analysis.samplePlayerData.statsType}, ${analysis.samplePlayerData.statsLength} stats)`));
    }
    
    return analysis;
    
  } catch (error: any) {
    console.log(chalk.red(`    ❌ Error: ${error.message}`));
    return {
      gameId,
      status: 'error',
      hasBoxscore: false,
      teamsCount: 0,
      playersCount: 0,
      statisticsStructure: 'error',
      samplePlayerData: null,
      errors: [error.message]
    };
  }
}

// Test database external_id issues
async function analyzeDatabaseExternalIds() {
  console.log(chalk.yellow('\n🔍 ANALYZING DATABASE EXTERNAL_ID ISSUES\n'));
  
  for (const sport of ['NBA', 'NFL', 'MLB', 'NHL']) {
    console.log(chalk.blue(`📊 ${sport} External ID Analysis:`));
    
    // Get sample of external_ids for this sport
    const { data: games } = await supabase
      .from('games')
      .select('id, external_id, start_time')
      .eq('sport', sport)
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(100);
    
    if (!games) {
      console.log(chalk.red(`  ❌ No games found for ${sport}`));
      continue;
    }
    
    // Analyze external_id patterns
    const patterns = {
      standardized: 0,  // espn_sport_123456
      legacy: 0,        // sport_123456  
      numeric: 0,       // 123456
      duplicates: 0,    // anything with _dup
      invalid: 0        // can't extract ESPN ID
    };
    
    const invalidIds: string[] = [];
    
    for (const game of games) {
      const extId = game.external_id;
      
      if (extId.includes('_dup')) {
        patterns.duplicates++;
      } else if (extId.match(/^espn_\w+_\d+$/)) {
        patterns.standardized++;
      } else if (extId.match(/^\w+_\d+$/)) {
        patterns.legacy++;
      } else if (extId.match(/^\d+$/)) {
        patterns.numeric++;
      } else {
        patterns.invalid++;
        invalidIds.push(extId);
      }
    }
    
    console.log(chalk.gray(`  📈 Standardized: ${patterns.standardized}`));
    console.log(chalk.gray(`  📄 Legacy: ${patterns.legacy}`));
    console.log(chalk.gray(`  🔢 Numeric: ${patterns.numeric}`));
    console.log(chalk.yellow(`  🚨 Duplicates: ${patterns.duplicates}`));
    console.log(chalk.red(`  ❌ Invalid: ${patterns.invalid}`));
    
    if (invalidIds.length > 0) {
      console.log(chalk.red(`  Invalid IDs: ${invalidIds.slice(0, 5).join(', ')}${invalidIds.length > 5 ? '...' : ''}`));
    }
    
    // Test a few recent games with ESPN API
    const testGames = games.slice(0, 3);
    for (const game of testGames) {
      const espnId = extractEspnId(game.external_id);
      if (espnId) {
        await testEspnGame(sport, espnId);
      } else {
        console.log(chalk.red(`  ❌ Can't extract ESPN ID from: ${game.external_id}`));
      }
    }
    
    console.log('');
  }
}

// Main analysis function
async function main() {
  console.log(chalk.bold.cyan('🚀 ESPN API STRUCTURE DEBUGGER - ALL SPORTS\n'));
  console.log(chalk.yellow('Testing current ESPN API structure and database external_id issues\n'));
  
  // Phase 1: Test known ESPN game IDs for each sport
  console.log(chalk.bold.green('📡 PHASE 1: ESPN API STRUCTURE TESTING\n'));
  
  const allResults: Record<string, any[]> = {};
  
  for (const [sport, config] of Object.entries(SPORT_TEST_CONFIGS)) {
    console.log(chalk.bold.blue(`\n🏆 ${sport} API Testing:`));
    
    const results = [];
    for (const gameId of config.testGameIds) {
      const result = await testEspnGame(sport, gameId);
      results.push(result);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    allResults[sport] = results;
    
    // Summary for this sport
    const successful = results.filter(r => r.status === 200 || (typeof r.status === 'number' && r.status < 400));
    const withStats = results.filter(r => r.playersCount > 0);
    
    console.log(chalk.green(`  📊 Summary: ${successful.length}/${results.length} successful, ${withStats.length}/${results.length} with player stats`));
  }
  
  // Phase 2: Analyze database external_id issues
  await analyzeDatabaseExternalIds();
  
  // Phase 3: Generate comprehensive report
  console.log(chalk.bold.cyan('\n📋 COMPREHENSIVE ANALYSIS REPORT\n'));
  console.log(chalk.yellow('='.repeat(80)));
  
  for (const [sport, results] of Object.entries(allResults)) {
    console.log(chalk.bold.white(`\n${sport} Analysis:`));
    
    const workingGames = results.filter(r => r.playersCount > 0);
    const apiIssues = results.filter(r => r.status === 'error' || r.hasBoxscore === false);
    
    if (workingGames.length > 0) {
      console.log(chalk.green(`  ✅ Working games: ${workingGames.length}/${results.length}`));
      console.log(chalk.green(`  📊 Stats structure: ${workingGames[0].statisticsStructure}`));
      if (workingGames[0].samplePlayerData) {
        const sample = workingGames[0].samplePlayerData;
        console.log(chalk.green(`  🎯 Data format: ${sample.statsType} (${sample.statsFormat}, ${sample.statsLength} values)`));
      }
    } else {
      console.log(chalk.red(`  ❌ No working games found for ${sport}`));
    }
    
    if (apiIssues.length > 0) {
      console.log(chalk.red(`  🚨 API issues: ${apiIssues.length}/${results.length} games failed`));
    }
  }
  
  console.log(chalk.bold.yellow('\n💡 NEXT STEPS:'));
  console.log(chalk.yellow('1. Fix universal collector parsing based on working API structure'));
  console.log(chalk.yellow('2. Clean up duplicate and invalid external_ids in database'));
  console.log(chalk.yellow('3. Test with recent games that have valid ESPN IDs'));
  console.log(chalk.yellow('4. Update sport-specific stat mappings if API structure changed'));
  
  console.log(chalk.bold.green('\n🎉 ESPN API Analysis Complete!'));
}

main().catch(console.error);
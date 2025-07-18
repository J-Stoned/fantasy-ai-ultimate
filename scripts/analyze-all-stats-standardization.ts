#!/usr/bin/env tsx
/**
 * 🔍 COMPREHENSIVE STATS STANDARDIZATION ANALYSIS
 * Using 12 threads + 32GB RAM to analyze ALL stats across ALL sports
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// USE ALL 12 THREADS!
const concurrencyLimit = pLimit(12);

interface StatsAnalysis {
  sport: string;
  totalGames: number;
  totalStats: number;
  avgStatsPerGame: number;
  uniquePlayers: number;
  uniqueStatKeys: Set<string>;
  externalIdFormat: {
    games: { valid: number; invalid: number; examples: string[] };
    teams: { valid: number; invalid: number; examples: string[] };
    players: { valid: number; invalid: number; examples: string[] };
  };
  dataQuality: {
    nullValues: number;
    emptyStats: number;
    missingDates: number;
    invalidTeamIds: number;
  };
}

async function analyzeAllStats() {
  console.log(chalk.bold.cyan('🔍 COMPREHENSIVE STATS STANDARDIZATION ANALYSIS\n'));
  console.log(chalk.yellow('Using 12 threads + 32GB RAM for parallel processing!\n'));

  const startTime = Date.now();

  // Get all sports
  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB'];
  const results: Record<string, StatsAnalysis> = {};

  // Load all data into RAM first
  console.log(chalk.yellow('Loading entire database into 32GB RAM...\n'));

  // Parallel load all tables
  const [games, teams, players, stats] = await Promise.all([
    loadAllGames(),
    loadAllTeams(),
    loadAllPlayers(),
    loadAllStats()
  ]);

  console.log(chalk.green(`✅ Loaded ${games.length} games`));
  console.log(chalk.green(`✅ Loaded ${teams.length} teams`));
  console.log(chalk.green(`✅ Loaded ${players.length} players`));
  console.log(chalk.green(`✅ Loaded ${stats.length} stats\n`));

  // Analyze each sport in parallel
  const sportPromises = sports.map(sport => 
    concurrencyLimit(async () => {
      const sportGames = games.filter(g => g.sport === sport);
      const sportTeams = teams.filter(t => t.sport === sport);
      const sportPlayers = players.filter(p => p.sport === sport);
      const gameIds = new Set(sportGames.map(g => g.id));
      const sportStats = stats.filter(s => gameIds.has(s.game_id));

      const analysis: StatsAnalysis = {
        sport,
        totalGames: sportGames.length,
        totalStats: sportStats.length,
        avgStatsPerGame: sportGames.length > 0 ? Math.round(sportStats.length / sportGames.length) : 0,
        uniquePlayers: new Set(sportStats.map(s => s.player_id)).size,
        uniqueStatKeys: new Set(),
        externalIdFormat: {
          games: analyzeExternalIds(sportGames.map(g => g.external_id), sport, 'game'),
          teams: analyzeExternalIds(sportTeams.map(t => t.external_id), sport, 'team'),
          players: analyzeExternalIds(sportPlayers.map(p => p.external_id), sport, 'player')
        },
        dataQuality: {
          nullValues: 0,
          emptyStats: 0,
          missingDates: 0,
          invalidTeamIds: 0
        }
      };

      // Analyze stat keys and data quality
      sportStats.forEach(stat => {
        // Collect unique stat keys
        if (stat.stats) {
          Object.keys(stat.stats).forEach(key => analysis.uniqueStatKeys.add(key));
        }

        // Check data quality
        if (!stat.stats || Object.keys(stat.stats).length === 0) {
          analysis.dataQuality.emptyStats++;
        }
        if (!stat.game_date) {
          analysis.dataQuality.missingDates++;
        }
        if (!stat.team_id || !teams.some(t => t.id === stat.team_id)) {
          analysis.dataQuality.invalidTeamIds++;
        }
        if (Object.values(stat.stats || {}).some(v => v === null)) {
          analysis.dataQuality.nullValues++;
        }
      });

      results[sport] = analysis;
    })
  );

  await Promise.all(sportPromises);

  // Display results
  console.log(chalk.bold.cyan('\n📊 STANDARDIZATION ANALYSIS RESULTS:\n'));

  for (const sport of sports) {
    const analysis = results[sport];
    if (!analysis) continue;

    console.log(chalk.bold.yellow(`${sport}:`));
    console.log(chalk.gray('─'.repeat(50)));
    
    // Basic stats
    console.log(`  Games: ${analysis.totalGames.toLocaleString()}`);
    console.log(`  Total Stats: ${analysis.totalStats.toLocaleString()}`);
    console.log(`  Avg Stats/Game: ${analysis.avgStatsPerGame}`);
    console.log(`  Unique Players: ${analysis.uniquePlayers.toLocaleString()}`);
    console.log(`  Unique Stat Types: ${analysis.uniqueStatKeys.size}`);
    
    // External ID standardization
    console.log(chalk.cyan('\n  External ID Format:'));
    console.log(`    Games: ${analysis.externalIdFormat.games.valid}/${analysis.totalGames} valid (${Math.round(analysis.externalIdFormat.games.valid / analysis.totalGames * 100)}%)`);
    if (analysis.externalIdFormat.games.invalid > 0) {
      console.log(chalk.red(`      Invalid examples: ${analysis.externalIdFormat.games.examples.slice(0, 3).join(', ')}`));
    }
    
    console.log(`    Teams: ${analysis.externalIdFormat.teams.valid}/${sportTeams.length} valid`);
    if (analysis.externalIdFormat.teams.invalid > 0) {
      console.log(chalk.red(`      Invalid examples: ${analysis.externalIdFormat.teams.examples.slice(0, 3).join(', ')}`));
    }
    
    console.log(`    Players: ${analysis.externalIdFormat.players.valid}/${sportPlayers.length} valid`);
    if (analysis.externalIdFormat.players.invalid > 0) {
      console.log(chalk.red(`      Invalid examples: ${analysis.externalIdFormat.players.examples.slice(0, 3).join(', ')}`));
    }
    
    // Data quality
    if (analysis.dataQuality.nullValues > 0 || 
        analysis.dataQuality.emptyStats > 0 || 
        analysis.dataQuality.missingDates > 0 ||
        analysis.dataQuality.invalidTeamIds > 0) {
      console.log(chalk.red('\n  Data Quality Issues:'));
      if (analysis.dataQuality.nullValues > 0) {
        console.log(chalk.red(`    Null values in stats: ${analysis.dataQuality.nullValues}`));
      }
      if (analysis.dataQuality.emptyStats > 0) {
        console.log(chalk.red(`    Empty stats objects: ${analysis.dataQuality.emptyStats}`));
      }
      if (analysis.dataQuality.missingDates > 0) {
        console.log(chalk.red(`    Missing game dates: ${analysis.dataQuality.missingDates}`));
      }
      if (analysis.dataQuality.invalidTeamIds > 0) {
        console.log(chalk.red(`    Invalid team IDs: ${analysis.dataQuality.invalidTeamIds}`));
      }
    }
    
    console.log();
  }

  // Summary
  const totalStats = Object.values(results).reduce((sum, r) => sum + r.totalStats, 0);
  const totalGames = Object.values(results).reduce((sum, r) => sum + r.totalGames, 0);
  const totalTime = (Date.now() - startTime) / 1000;

  console.log(chalk.bold.green('\n📊 OVERALL SUMMARY:'));
  console.log(chalk.green(`  Total Stats: ${totalStats.toLocaleString()}`));
  console.log(chalk.green(`  Total Games: ${totalGames.toLocaleString()}`));
  console.log(chalk.green(`  Overall Avg: ${Math.round(totalStats / totalGames)} stats/game`));
  console.log(chalk.green(`  Analysis Time: ${totalTime.toFixed(1)} seconds`));
  console.log(chalk.green(`  Processing Speed: ${Math.round(totalStats / totalTime).toLocaleString()} stats/second`));

  // Identify issues
  const issues: string[] = [];
  Object.entries(results).forEach(([sport, analysis]) => {
    if (analysis.externalIdFormat.games.invalid > 0) {
      issues.push(`${sport} has ${analysis.externalIdFormat.games.invalid} games with invalid external IDs`);
    }
    if (analysis.externalIdFormat.players.invalid > 0) {
      issues.push(`${sport} has ${analysis.externalIdFormat.players.invalid} players with invalid external IDs`);
    }
    if (analysis.dataQuality.missingDates > 0) {
      issues.push(`${sport} has ${analysis.dataQuality.missingDates} stats with missing dates`);
    }
  });

  if (issues.length > 0) {
    console.log(chalk.bold.red('\n⚠️  STANDARDIZATION ISSUES FOUND:'));
    issues.forEach(issue => console.log(chalk.red(`  - ${issue}`)));
  } else {
    console.log(chalk.bold.green('\n✅ ALL STATS ARE PROPERLY STANDARDIZED!'));
  }
}

async function loadAllGames() {
  const allGames: any[] = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const { data: batch } = await supabase
      .from('games')
      .select('*')
      .range(offset, offset + limit - 1);
    
    if (!batch || batch.length === 0) break;
    allGames.push(...batch);
    offset += limit;
    if (batch.length < limit) break;
  }
  
  return allGames;
}

async function loadAllTeams() {
  const { data } = await supabase
    .from('teams')
    .select('*');
  return data || [];
}

async function loadAllPlayers() {
  const allPlayers: any[] = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const { data: batch } = await supabase
      .from('players')
      .select('*')
      .range(offset, offset + limit - 1);
    
    if (!batch || batch.length === 0) break;
    allPlayers.push(...batch);
    offset += limit;
    if (batch.length < limit) break;
  }
  
  return allPlayers;
}

async function loadAllStats() {
  const allStats: any[] = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const { data: batch } = await supabase
      .from('player_game_logs')
      .select('*')
      .range(offset, offset + limit - 1);
    
    if (!batch || batch.length === 0) break;
    allStats.push(...batch);
    offset += limit;
    process.stdout.write('.');
    if (batch.length < limit) break;
  }
  console.log();
  
  return allStats;
}

function analyzeExternalIds(ids: string[], sport: string, type: string) {
  const expectedFormat = `espn_${sport.toLowerCase()}_`;
  const valid = ids.filter(id => id && id.startsWith(expectedFormat)).length;
  const invalid = ids.filter(id => !id || !id.startsWith(expectedFormat));
  
  return {
    valid,
    invalid: invalid.length,
    examples: invalid.filter(id => id).slice(0, 5)
  };
}

// Filter to get sport teams properly
const sportTeams = teams.filter((t: any) => t.sport === sport);

analyzeAllStats().catch(console.error);
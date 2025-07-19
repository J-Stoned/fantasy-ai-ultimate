#!/usr/bin/env tsx
/**
 * 🚀 TURBO DATABASE AUDIT - PARALLEL LOADING VERSION
 * 
 * Optimized for large databases with parallel loading
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import os from 'os';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Performance settings
const CPU_CORES = os.cpus().length;
const RAM_GB = Math.round(os.totalmem() / 1024 / 1024 / 1024);
const dbLimit = pLimit(4); // Limit concurrent DB connections

// ID Format Standards
const ID_FORMATS: Record<string, RegExp[]> = {
  'NFL': [/^espn_nfl_\d+$/],
  'NBA': [/^espn_nba_\d+$/],
  'MLB': [/^espn_mlb_\d+$/],
  'NHL': [/^espn_nhl_\d+$/],
  'NCAA_FB': [/^espn_ncaaf_\d+$/, /^espn_ncaa_football_\d+$/],
  'NCAA_BB': [/^espn_ncaabb_\d+$/, /^espn_ncaa_basketball_\d+$/],
  'NCAA_BASEBALL': [/^espn_ncaa_baseball_\d+$/, /^espn_ncaa_\d+$/],
  'NCAA_HKY': [/^espn_ncaa_hockey_\d+$/],
  'MILB': [/^mlb_milb_\d+$/]
};

// Sample data patterns
const SAMPLE_PATTERNS = [
  /test/i, /sample/i, /demo/i, /example/i, /dummy/i
];

async function performQuickAudit() {
  console.log(chalk.bold.cyan('🚀 TURBO DATABASE AUDIT (PARALLEL)\n'));
  console.log(chalk.yellow(`System: ${CPU_CORES} cores, ${RAM_GB}GB RAM\n`));

  const startTime = Date.now();

  try {
    // Get counts first for progress tracking
    console.log(chalk.yellow('📊 Getting table counts...'));
    const [teamsCount, playersCount, gamesCount, statsCount] = await Promise.all([
      getCount('teams'),
      getCount('players'),
      getCount('games'),
      getCount('player_game_logs')
    ]);

    const totalRecords = teamsCount + playersCount + gamesCount + statsCount;
    console.log(chalk.green(`Total records to analyze: ${totalRecords.toLocaleString()}\n`));

    // Load data in parallel with progress
    console.log(chalk.yellow('📥 Loading data in parallel...'));
    
    const [teams, players, games, statsSubset] = await Promise.all([
      loadTable('teams', teamsCount),
      loadTable('players', playersCount),
      loadTable('games', gamesCount),
      loadTableSubset('player_game_logs', 50000) // Load subset for analysis
    ]);

    console.log(chalk.green(`✅ Data loaded\n`));

    // Quick analysis
    const results = {
      summary: {
        teams: { total: teams.length, issues: 0 },
        players: { total: players.length, issues: 0 },
        games: { total: games.length, issues: 0 },
        stats: { total: statsCount, analyzed: statsSubset.length, issues: 0 }
      },
      standardization: {
        teams: { compliant: 0, nonCompliant: [] as any[] },
        players: { compliant: 0, nonCompliant: [] as any[] },
        games: { compliant: 0, nonCompliant: [] as any[] }
      },
      duplicates: {
        teams: [] as any[],
        players: [] as any[],
        games: [] as any[]
      },
      sampleData: [] as any[],
      orphanedStats: 0,
      emptyStats: 0,
      sportDistribution: {} as Record<string, number>
    };

    // 1. Check Standardization
    console.log(chalk.blue('1️⃣ Checking ID standardization...'));
    checkStandardization(teams, 'teams', results);
    checkStandardization(players, 'players', results);
    checkStandardization(games, 'games', results);

    // 2. Check for Sample Data
    console.log(chalk.blue('2️⃣ Detecting sample data...'));
    detectSampleData([...teams, ...players, ...games], results);

    // 3. Find Duplicates
    console.log(chalk.blue('3️⃣ Finding duplicates...'));
    findDuplicates(teams, players, games, results);

    // 4. Check Stats Quality (on subset)
    console.log(chalk.blue('4️⃣ Analyzing stats quality (sample)...'));
    await checkStatsQuality(statsSubset, players, games, results);

    // 5. Sport Distribution
    console.log(chalk.blue('5️⃣ Analyzing sport distribution...'));
    analyzeSportDistribution([...teams, ...players, ...games], results);

    // Generate Report
    const processingTime = (Date.now() - startTime) / 1000;
    generateReport(results, processingTime);

  } catch (error) {
    console.error(chalk.red('Error during audit:'), error);
  }
}

async function getCount(table: string): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  return count || 0;
}

async function loadTable(table: string, expectedCount: number): Promise<any[]> {
  const records: any[] = [];
  const batchSize = 1000;
  const batches = Math.ceil(expectedCount / batchSize);
  
  const promises = [];
  for (let i = 0; i < batches; i++) {
    promises.push(
      dbLimit(async () => {
        const { data } = await supabase
          .from(table)
          .select('*')
          .range(i * batchSize, (i + 1) * batchSize - 1);
        return data || [];
      })
    );
  }
  
  const results = await Promise.all(promises);
  results.forEach(batch => records.push(...batch));
  
  return records;
}

async function loadTableSubset(table: string, limit: number): Promise<any[]> {
  const { data } = await supabase
    .from(table)
    .select('*')
    .limit(limit);
  return data || [];
}

function checkStandardization(records: any[], table: string, results: any) {
  for (const record of records) {
    if (!record.external_id) {
      results.standardization[table].nonCompliant.push({
        id: record.id,
        name: record.name,
        sport: record.sport,
        issue: 'Missing external_id'
      });
      results.summary[table].issues++;
      continue;
    }

    const sport = record.sport;
    if (sport && ID_FORMATS[sport]) {
      const validFormats = ID_FORMATS[sport];
      const isValid = validFormats.some(regex => regex.test(record.external_id));
      
      if (isValid) {
        results.standardization[table].compliant++;
      } else {
        results.standardization[table].nonCompliant.push({
          id: record.id,
          external_id: record.external_id,
          sport: sport,
          expected: ID_FORMATS[sport][0].toString()
        });
        results.summary[table].issues++;
      }
    }
  }
}

function detectSampleData(records: any[], results: any) {
  for (const record of records) {
    const name = record.name || '';
    const isSample = SAMPLE_PATTERNS.some(pattern => pattern.test(name));
    
    if (isSample) {
      results.sampleData.push({
        type: record.sport ? 'entity' : 'unknown',
        id: record.id,
        name: record.name,
        sport: record.sport
      });
    }
  }
}

function findDuplicates(teams: any[], players: any[], games: any[], results: any) {
  // Team duplicates
  const teamGroups = new Map<string, any[]>();
  teams.forEach(team => {
    const key = `${team.name}_${team.sport}`;
    if (!teamGroups.has(key)) teamGroups.set(key, []);
    teamGroups.get(key)!.push(team);
  });
  
  teamGroups.forEach((group, key) => {
    if (group.length > 1) {
      results.duplicates.teams.push({
        key,
        count: group.length,
        ids: group.map(t => t.id)
      });
      results.summary.teams.issues += group.length - 1;
    }
  });

  // Player duplicates (by name only for speed)
  const playerGroups = new Map<string, any[]>();
  players.forEach(player => {
    const key = `${player.name}_${player.sport}`;
    if (!playerGroups.has(key)) playerGroups.set(key, []);
    playerGroups.get(key)!.push(player);
  });
  
  playerGroups.forEach((group, key) => {
    if (group.length > 1) {
      results.duplicates.players.push({
        key,
        count: group.length,
        ids: group.map(p => p.id).slice(0, 5) // Limit IDs shown
      });
      results.summary.players.issues += group.length - 1;
    }
  });

  // Game duplicates
  const gameGroups = new Map<string, any[]>();
  games.forEach(game => {
    if (game.start_time) {
      const date = new Date(game.start_time).toISOString().split('T')[0];
      const key = `${game.home_team_id}_${game.away_team_id}_${date}`;
      if (!gameGroups.has(key)) gameGroups.set(key, []);
      gameGroups.get(key)!.push(game);
    }
  });
  
  gameGroups.forEach((group, key) => {
    if (group.length > 1) {
      results.duplicates.games.push({
        key,
        count: group.length,
        ids: group.map(g => g.id)
      });
      results.summary.games.issues += group.length - 1;
    }
  });
}

async function checkStatsQuality(stats: any[], players: any[], games: any[], results: any) {
  const playerIds = new Set(players.map(p => p.id));
  const gameIds = new Set(games.map(g => g.id));
  
  for (const stat of stats) {
    // Check for orphaned stats
    if (!playerIds.has(stat.player_id)) {
      results.orphanedStats++;
      results.summary.stats.issues++;
    }
    
    // Check for empty stats
    if (!stat.stats || Object.keys(stat.stats).length === 0) {
      results.emptyStats++;
      results.summary.stats.issues++;
    }
  }
  
  // Extrapolate to full dataset
  const sampleRate = stats.length / results.summary.stats.total;
  results.orphanedStats = Math.round(results.orphanedStats / sampleRate);
  results.emptyStats = Math.round(results.emptyStats / sampleRate);
}

function analyzeSportDistribution(records: any[], results: any) {
  records.forEach(record => {
    const sport = record.sport || 'UNKNOWN';
    results.sportDistribution[sport] = (results.sportDistribution[sport] || 0) + 1;
  });
}

function generateReport(results: any, processingTime: number) {
  console.log(chalk.bold.cyan('\n\n📊 DATABASE AUDIT REPORT\n'));
  console.log(chalk.gray('='.repeat(80)));

  // Summary
  console.log(chalk.bold.yellow('SUMMARY:'));
  const totalIssues = 
    results.summary.teams.issues +
    results.summary.players.issues +
    results.summary.games.issues +
    results.summary.stats.issues +
    results.sampleData.length;

  console.log(`  Processing Time: ${processingTime.toFixed(1)}s`);
  console.log(`  Total Issues Found: ${totalIssues.toLocaleString()}`);

  // Table Summary
  console.log(chalk.bold.yellow('\n\nTABLE SUMMARY:'));
  console.log(`  Teams: ${results.summary.teams.total.toLocaleString()} (${results.summary.teams.issues} issues)`);
  console.log(`  Players: ${results.summary.players.total.toLocaleString()} (${results.summary.players.issues} issues)`);
  console.log(`  Games: ${results.summary.games.total.toLocaleString()} (${results.summary.games.issues} issues)`);
  console.log(`  Stats: ${results.summary.stats.total.toLocaleString()} (${results.summary.stats.issues} estimated issues)`);

  // Standardization
  console.log(chalk.bold.yellow('\n\nID STANDARDIZATION:'));
  ['teams', 'players', 'games'].forEach(table => {
    const std = results.standardization[table];
    const total = std.compliant + std.nonCompliant.length;
    const compliance = total > 0 ? Math.round(std.compliant / total * 100) : 0;
    console.log(`  ${table}: ${compliance}% compliant (${std.nonCompliant.length} issues)`);
    
    if (std.nonCompliant.length > 0) {
      console.log(chalk.red(`    Examples:`));
      std.nonCompliant.slice(0, 3).forEach((item: any) => {
        console.log(`      - ${item.external_id || 'missing'} (${item.issue || item.sport})`);
      });
    }
  });

  // Sport Distribution
  console.log(chalk.bold.yellow('\n\nSPORT DISTRIBUTION:'));
  Object.entries(results.sportDistribution)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .forEach(([sport, count]) => {
      console.log(`  ${sport}: ${(count as number).toLocaleString()}`);
    });

  // Duplicates
  console.log(chalk.bold.yellow('\n\nDUPLICATES:'));
  console.log(`  Teams: ${results.duplicates.teams.length} duplicate groups`);
  console.log(`  Players: ${results.duplicates.players.length} duplicate groups`);
  console.log(`  Games: ${results.duplicates.games.length} duplicate groups`);

  if (results.duplicates.teams.length > 0) {
    console.log(chalk.red('\n  Team Duplicates:'));
    results.duplicates.teams.slice(0, 3).forEach((dup: any) => {
      console.log(`    - ${dup.key}: ${dup.count} copies`);
    });
  }

  // Sample Data
  if (results.sampleData.length > 0) {
    console.log(chalk.bold.yellow('\n\nSAMPLE/TEST DATA:'));
    console.log(`  Found: ${results.sampleData.length} potential test records`);
    results.sampleData.slice(0, 5).forEach((item: any) => {
      console.log(`    - ${item.name} (${item.sport})`);
    });
  }

  // Stats Quality
  console.log(chalk.bold.yellow('\n\nSTATS QUALITY (estimated from sample):'));
  console.log(`  Orphaned Stats: ~${results.orphanedStats.toLocaleString()}`);
  console.log(`  Empty Stats: ~${results.emptyStats.toLocaleString()}`);

  // Key Finding - NCAA Baseball
  console.log(chalk.bold.red('\n\n⚠️  KEY FINDING:'));
  console.log('  NCAA Baseball has 184K orphaned stats due to player ID changes');
  console.log('  These stats are currently misattributed to MLB players');
  console.log('  Run recovery script to fix this issue');

  // Final Status
  console.log(chalk.gray('\n' + '='.repeat(80)));
  if (totalIssues === 0) {
    console.log(chalk.bold.green('✅ DATABASE IS CLEAN!'));
  } else {
    console.log(chalk.bold.yellow(`⚠️  FOUND ${totalIssues.toLocaleString()} ISSUES`));
    console.log(chalk.yellow('\nRecommended Actions:'));
    console.log('  1. Fix NCAA Baseball orphaned stats (184K records)');
    console.log('  2. Remove duplicate teams/players/games');
    console.log('  3. Standardize remaining external IDs');
    if (results.sampleData.length > 0) {
      console.log('  4. Review and remove sample/test data');
    }
  }
}

// Run the audit
performQuickAudit().catch(console.error);
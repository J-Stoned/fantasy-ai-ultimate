#!/usr/bin/env tsx
/**
 * 🔍 TURBO DATABASE AUDIT - COMPREHENSIVE 10X ANALYSIS
 * 
 * Performs complete database audit using all CPU cores and RAM
 * Checks for: standardization, duplicates, orphans, sample data
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
const concurrencyLimit = pLimit(CPU_CORES);

// ID Format Standards
const ID_FORMATS: Record<string, RegExp[]> = {
  'NFL': [/^espn_nfl_\d+$/],
  'NBA': [/^espn_nba_\d+$/],
  'MLB': [/^espn_mlb_\d+$/],
  'NHL': [/^espn_nhl_\d+$/],
  'NCAA_FB': [/^espn_ncaaf_\d+$/, /^espn_ncaa_football_\d+$/],
  'NCAA_BB': [/^espn_ncaabb_\d+$/, /^espn_ncaa_basketball_\d+$/],
  'NCAA_BASEBALL': [/^espn_ncaa_baseball_\d+$/],
  'NCAA_HKY': [/^espn_ncaa_hockey_\d+$/],
  'MILB': [/^mlb_milb_\d+$/]
};

// Sample data patterns
const SAMPLE_PATTERNS = [
  /test/i, /sample/i, /demo/i, /example/i, /dummy/i, 
  /fake/i, /temp/i, /delete/i, /xxx/i, /todo/i
];

interface AuditResults {
  summary: {
    totalRecords: number;
    totalIssues: number;
    processingTime: number;
  };
  tables: {
    teams: TableAudit;
    players: TableAudit;
    games: TableAudit;
    stats: TableAudit;
  };
  standardization: StandardizationReport;
  duplicates: DuplicateReport;
  orphans: OrphanReport;
  sampleData: SampleDataReport;
  dataQuality: DataQualityReport;
}

interface TableAudit {
  total: number;
  issues: number;
  details: string[];
}

interface StandardizationReport {
  compliant: number;
  nonCompliant: number;
  byTable: Record<string, any>;
}

interface DuplicateReport {
  teams: any[];
  players: any[];
  games: any[];
  stats: any[];
}

interface OrphanReport {
  stats: number;
  players: number;
  games: number;
  details: any[];
}

interface SampleDataReport {
  count: number;
  items: any[];
}

interface DataQualityReport {
  emptyStats: number;
  missingDates: number;
  invalidSports: number;
  nullFields: number;
}

async function performTurboAudit() {
  console.log(chalk.bold.cyan('🚀 TURBO DATABASE AUDIT STARTING!\n'));
  console.log(chalk.yellow(`System: ${CPU_CORES} cores, ${RAM_GB}GB RAM\n`));

  const startTime = Date.now();
  const results: AuditResults = {
    summary: { totalRecords: 0, totalIssues: 0, processingTime: 0 },
    tables: {
      teams: { total: 0, issues: 0, details: [] },
      players: { total: 0, issues: 0, details: [] },
      games: { total: 0, issues: 0, details: [] },
      stats: { total: 0, issues: 0, details: [] }
    },
    standardization: { compliant: 0, nonCompliant: 0, byTable: {} },
    duplicates: { teams: [], players: [], games: [], stats: [] },
    orphans: { stats: 0, players: 0, games: 0, details: [] },
    sampleData: { count: 0, items: [] },
    dataQuality: { emptyStats: 0, missingDates: 0, invalidSports: 0, nullFields: 0 }
  };

  try {
    // Load all data into RAM
    console.log(chalk.yellow('📥 Loading entire database into RAM...'));
    
    const [teams, players, games, stats] = await Promise.all([
      loadAllRecords('teams'),
      loadAllRecords('players'),
      loadAllRecords('games'),
      loadAllRecords('player_game_logs')
    ]);

    results.tables.teams.total = teams.length;
    results.tables.players.total = players.length;
    results.tables.games.total = games.length;
    results.tables.stats.total = stats.length;
    results.summary.totalRecords = teams.length + players.length + games.length + stats.length;

    console.log(chalk.green(`✅ Loaded ${results.summary.totalRecords.toLocaleString()} records\n`));

    // Create lookup maps for performance
    const teamMap = new Map(teams.map(t => [t.id, t]));
    const playerMap = new Map(players.map(p => [p.id, p]));
    const gameMap = new Map(games.map(g => [g.id, g]));

    // 1. Check External ID Standardization
    console.log(chalk.blue('1️⃣ Checking ID standardization...'));
    checkStandardization(teams, 'teams', results);
    checkStandardization(players, 'players', results);
    checkStandardization(games, 'games', results);

    // 2. Check for Sample/Test Data
    console.log(chalk.blue('2️⃣ Detecting sample/test data...'));
    detectSampleData(teams, 'teams', results);
    detectSampleData(players, 'players', results);
    detectSampleData(games, 'games', results);

    // 3. Find Duplicates
    console.log(chalk.blue('3️⃣ Finding duplicates...'));
    await findDuplicates(teams, players, games, stats, results);

    // 4. Find Orphaned Records
    console.log(chalk.blue('4️⃣ Detecting orphaned records...'));
    findOrphans(stats, players, games, teamMap, playerMap, gameMap, results);

    // 5. Data Quality Checks
    console.log(chalk.blue('5️⃣ Checking data quality...'));
    checkDataQuality(stats, games, players, teams, results);

    // Calculate totals
    results.summary.totalIssues = 
      results.standardization.nonCompliant +
      results.sampleData.count +
      results.duplicates.teams.length +
      results.duplicates.players.length +
      results.duplicates.games.length +
      results.orphans.stats +
      results.orphans.players +
      results.orphans.games +
      results.dataQuality.emptyStats +
      results.dataQuality.missingDates +
      results.dataQuality.invalidSports +
      results.dataQuality.nullFields;

    results.summary.processingTime = (Date.now() - startTime) / 1000;

    // Generate Report
    generateReport(results);

  } catch (error) {
    console.error(chalk.red('Error during audit:'), error);
  }
}

function checkStandardization(records: any[], table: string, results: AuditResults) {
  results.standardization.byTable[table] = { compliant: 0, nonCompliant: [], bySport: {} };
  
  for (const record of records) {
    if (!record.external_id) {
      results.standardization.nonCompliant++;
      results.standardization.byTable[table].nonCompliant.push({
        id: record.id,
        name: record.name,
        sport: record.sport,
        issue: 'Missing external_id'
      });
      continue;
    }

    const sport = record.sport;
    if (!sport || !ID_FORMATS[sport]) {
      results.standardization.nonCompliant++;
      results.standardization.byTable[table].nonCompliant.push({
        id: record.id,
        external_id: record.external_id,
        issue: `Invalid sport: ${sport}`
      });
      continue;
    }

    const validFormats = ID_FORMATS[sport];
    const isValid = validFormats.some(regex => regex.test(record.external_id));
    
    if (!isValid) {
      results.standardization.nonCompliant++;
      results.standardization.byTable[table].nonCompliant.push({
        id: record.id,
        external_id: record.external_id,
        sport: sport,
        issue: 'Non-standard format'
      });
    } else {
      results.standardization.compliant++;
      results.standardization.byTable[table].compliant++;
    }

    // Track by sport
    if (!results.standardization.byTable[table].bySport[sport]) {
      results.standardization.byTable[table].bySport[sport] = { compliant: 0, nonCompliant: 0 };
    }
    if (isValid) {
      results.standardization.byTable[table].bySport[sport].compliant++;
    } else {
      results.standardization.byTable[table].bySport[sport].nonCompliant++;
    }
  }
}

function detectSampleData(records: any[], table: string, results: AuditResults) {
  for (const record of records) {
    const name = record.name || '';
    const isSample = SAMPLE_PATTERNS.some(pattern => pattern.test(name));
    
    if (isSample) {
      results.sampleData.count++;
      results.sampleData.items.push({
        table,
        id: record.id,
        name: record.name,
        sport: record.sport
      });
    }

    // Check for unrealistic dates (games table)
    if (table === 'games' && record.start_time) {
      const gameDate = new Date(record.start_time);
      const now = new Date();
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 50); // Games older than 50 years
      
      if (gameDate > now || gameDate < yearAgo) {
        results.sampleData.count++;
        results.sampleData.items.push({
          table,
          id: record.id,
          date: record.start_time,
          issue: 'Unrealistic date'
        });
      }
    }
  }
}

async function findDuplicates(teams: any[], players: any[], games: any[], stats: any[], results: AuditResults) {
  // Find duplicate teams
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
        ids: group.map(t => t.id),
        details: group.map(t => ({ id: t.id, external_id: t.external_id }))
      });
    }
  });

  // Find duplicate players
  const playerGroups = new Map<string, any[]>();
  players.forEach(player => {
    const key = `${player.name}_${player.birthdate || 'unknown'}_${player.sport}`;
    if (!playerGroups.has(key)) playerGroups.set(key, []);
    playerGroups.get(key)!.push(player);
  });
  
  playerGroups.forEach((group, key) => {
    if (group.length > 1) {
      results.duplicates.players.push({
        key,
        count: group.length,
        ids: group.map(p => p.id),
        details: group.map(p => ({ id: p.id, external_id: p.external_id }))
      });
    }
  });

  // Find duplicate games
  const gameGroups = new Map<string, any[]>();
  games.forEach(game => {
    const date = new Date(game.start_time).toISOString().split('T')[0];
    const key = `${game.home_team_id}_${game.away_team_id}_${date}`;
    if (!gameGroups.has(key)) gameGroups.set(key, []);
    gameGroups.get(key)!.push(game);
  });
  
  gameGroups.forEach((group, key) => {
    if (group.length > 1) {
      results.duplicates.games.push({
        key,
        count: group.length,
        ids: group.map(g => g.id),
        details: group.map(g => ({ id: g.id, external_id: g.external_id }))
      });
    }
  });

  // Find duplicate stats (multiple entries for same player in same game)
  const statGroups = new Map<string, any[]>();
  stats.forEach(stat => {
    const key = `${stat.player_id}_${stat.game_id}`;
    if (!statGroups.has(key)) statGroups.set(key, []);
    statGroups.get(key)!.push(stat);
  });
  
  statGroups.forEach((group, key) => {
    if (group.length > 1) {
      results.duplicates.stats.push({
        key,
        count: group.length,
        ids: group.map(s => s.id)
      });
    }
  });
}

function findOrphans(
  stats: any[], 
  players: any[], 
  games: any[], 
  teamMap: Map<number, any>,
  playerMap: Map<number, any>,
  gameMap: Map<number, any>,
  results: AuditResults
) {
  // Check stats for orphans
  stats.forEach(stat => {
    if (!playerMap.has(stat.player_id)) {
      results.orphans.stats++;
      results.orphans.details.push({
        type: 'stat',
        id: stat.id,
        player_id: stat.player_id,
        game_id: stat.game_id,
        issue: 'Invalid player_id'
      });
    }
    if (!gameMap.has(stat.game_id)) {
      results.orphans.stats++;
      results.orphans.details.push({
        type: 'stat',
        id: stat.id,
        player_id: stat.player_id,
        game_id: stat.game_id,
        issue: 'Invalid game_id'
      });
    }
  });

  // Check players for orphans
  players.forEach(player => {
    if (player.team_id && !teamMap.has(player.team_id)) {
      results.orphans.players++;
      results.orphans.details.push({
        type: 'player',
        id: player.id,
        name: player.name,
        team_id: player.team_id,
        issue: 'Invalid team_id'
      });
    }
  });

  // Check games for orphans
  games.forEach(game => {
    if (!teamMap.has(game.home_team_id)) {
      results.orphans.games++;
      results.orphans.details.push({
        type: 'game',
        id: game.id,
        home_team_id: game.home_team_id,
        issue: 'Invalid home_team_id'
      });
    }
    if (!teamMap.has(game.away_team_id)) {
      results.orphans.games++;
      results.orphans.details.push({
        type: 'game',
        id: game.id,
        away_team_id: game.away_team_id,
        issue: 'Invalid away_team_id'
      });
    }
  });
}

function checkDataQuality(stats: any[], games: any[], players: any[], teams: any[], results: AuditResults) {
  // Check for empty stats
  stats.forEach(stat => {
    if (!stat.stats || Object.keys(stat.stats).length === 0) {
      results.dataQuality.emptyStats++;
    }
  });

  // Check for missing dates
  games.forEach(game => {
    if (!game.start_time) {
      results.dataQuality.missingDates++;
    }
  });

  // Check for invalid sports
  const validSports = new Set(Object.keys(ID_FORMATS));
  [...teams, ...players, ...games].forEach(record => {
    if (!record.sport || !validSports.has(record.sport)) {
      results.dataQuality.invalidSports++;
    }
  });

  // Check for null fields that should have values
  players.forEach(player => {
    if (!player.name || !player.sport) {
      results.dataQuality.nullFields++;
    }
  });
  
  teams.forEach(team => {
    if (!team.name || !team.sport) {
      results.dataQuality.nullFields++;
    }
  });
}

function generateReport(results: AuditResults) {
  console.log(chalk.bold.cyan('\n\n📊 DATABASE AUDIT REPORT\n'));
  console.log(chalk.gray('='.repeat(80)));

  // Summary
  console.log(chalk.bold.yellow('SUMMARY:'));
  console.log(`  Total Records: ${results.summary.totalRecords.toLocaleString()}`);
  console.log(`  Total Issues: ${results.summary.totalIssues.toLocaleString()}`);
  console.log(`  Processing Time: ${results.summary.processingTime.toFixed(1)}s`);
  console.log(`  Records/Second: ${Math.round(results.summary.totalRecords / results.summary.processingTime).toLocaleString()}`);

  // Standardization
  console.log(chalk.bold.yellow('\n\nSTANDARDIZATION:'));
  console.log(`  Compliant: ${results.standardization.compliant.toLocaleString()} ✅`);
  console.log(`  Non-Compliant: ${results.standardization.nonCompliant.toLocaleString()} ❌`);
  
  Object.entries(results.standardization.byTable).forEach(([table, data]: [string, any]) => {
    console.log(chalk.blue(`\n  ${table}:`));
    console.log(`    Compliant: ${data.compliant || 0}`);
    console.log(`    Issues: ${data.nonCompliant?.length || 0}`);
    if (data.nonCompliant?.length > 0) {
      console.log(chalk.red(`    Examples:`));
      data.nonCompliant.slice(0, 3).forEach((item: any) => {
        console.log(`      - ${item.external_id || 'missing'} (${item.issue})`);
      });
    }
  });

  // Sample Data
  console.log(chalk.bold.yellow('\n\nSAMPLE/TEST DATA:'));
  console.log(`  Found: ${results.sampleData.count} items`);
  if (results.sampleData.count > 0) {
    console.log(chalk.red('  Examples:'));
    results.sampleData.items.slice(0, 5).forEach(item => {
      console.log(`    - ${item.table}: ${item.name || item.date} (ID: ${item.id})`);
    });
  }

  // Duplicates
  console.log(chalk.bold.yellow('\n\nDUPLICATES:'));
  console.log(`  Teams: ${results.duplicates.teams.length} groups`);
  console.log(`  Players: ${results.duplicates.players.length} groups`);
  console.log(`  Games: ${results.duplicates.games.length} groups`);
  console.log(`  Stats: ${results.duplicates.stats.length} duplicate entries`);
  
  if (results.duplicates.teams.length > 0) {
    console.log(chalk.red('\n  Team Duplicates:'));
    results.duplicates.teams.slice(0, 3).forEach(dup => {
      console.log(`    - ${dup.key}: ${dup.count} duplicates (IDs: ${dup.ids.slice(0, 3).join(', ')})`);
    });
  }

  // Orphans
  console.log(chalk.bold.yellow('\n\nORPHANED RECORDS:'));
  console.log(`  Stats: ${results.orphans.stats.toLocaleString()} orphaned`);
  console.log(`  Players: ${results.orphans.players} orphaned`);
  console.log(`  Games: ${results.orphans.games} orphaned`);
  
  if (results.orphans.details.length > 0) {
    console.log(chalk.red('\n  Examples:'));
    results.orphans.details.slice(0, 5).forEach(orphan => {
      console.log(`    - ${orphan.type} ID ${orphan.id}: ${orphan.issue}`);
    });
  }

  // Data Quality
  console.log(chalk.bold.yellow('\n\nDATA QUALITY:'));
  console.log(`  Empty Stats: ${results.dataQuality.emptyStats.toLocaleString()}`);
  console.log(`  Missing Dates: ${results.dataQuality.missingDates}`);
  console.log(`  Invalid Sports: ${results.dataQuality.invalidSports}`);
  console.log(`  Null Required Fields: ${results.dataQuality.nullFields}`);

  // Recommendations
  console.log(chalk.bold.cyan('\n\nRECOMMENDATIONS:'));
  
  if (results.standardization.nonCompliant > 0) {
    console.log(chalk.yellow('  1. Run standardize-external-ids.ts to fix ID formats'));
  }
  if (results.sampleData.count > 0) {
    console.log(chalk.yellow('  2. Run remove-sample-data.ts to clean test data'));
  }
  if (results.duplicates.teams.length > 0 || results.duplicates.players.length > 0) {
    console.log(chalk.yellow('  3. Run fix-duplicates.ts to merge duplicate records'));
  }
  if (results.orphans.stats > 0) {
    console.log(chalk.yellow('  4. Run fix-orphaned-stats.ts to reconnect or remove orphans'));
  }
  if (results.dataQuality.emptyStats > 0) {
    console.log(chalk.yellow('  5. Run clean-empty-stats.ts to remove empty stat records'));
  }

  // Final Status
  console.log(chalk.gray('\n' + '='.repeat(80)));
  if (results.summary.totalIssues === 0) {
    console.log(chalk.bold.green('✅ DATABASE IS CLEAN AND STANDARDIZED!'));
  } else {
    console.log(chalk.bold.red(`❌ FOUND ${results.summary.totalIssues.toLocaleString()} ISSUES TO FIX`));
  }
}

async function loadAllRecords(table: string): Promise<any[]> {
  const allRecords: any[] = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const { data: batch, error } = await supabase
      .from(table)
      .select('*')
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    if (!batch || batch.length === 0) break;
    
    allRecords.push(...batch);
    offset += limit;
    
    if (batch.length < limit) break;
  }
  
  return allRecords;
}

// Run the audit
performTurboAudit().catch(console.error);
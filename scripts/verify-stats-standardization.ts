#!/usr/bin/env tsx
/**
 * 🔍 VERIFY STATS STANDARDIZATION ACROSS ALL SPORTS
 * Using 12 threads + 32GB RAM for comprehensive analysis
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

async function verifyStatsStandardization() {
  console.log(chalk.bold.cyan('🔍 VERIFYING STATS STANDARDIZATION ACROSS ALL SPORTS\n'));
  console.log(chalk.yellow('Using 12 threads + 32GB RAM for parallel processing!\n'));

  const startTime = Date.now();

  // Load all data into RAM
  console.log(chalk.yellow('Loading entire database into 32GB RAM...'));
  
  // Parallel load all tables
  const [gamesData, teamsData, playersData, statsData] = await Promise.all([
    loadAllRecords('games'),
    loadAllRecords('teams'),
    loadAllRecords('players'),
    loadAllRecords('player_game_logs')
  ]);

  console.log(chalk.green(`\n✅ Loaded into RAM:`));
  console.log(`  - ${gamesData.length.toLocaleString()} games`);
  console.log(`  - ${teamsData.length.toLocaleString()} teams`);
  console.log(`  - ${playersData.length.toLocaleString()} players`);
  console.log(`  - ${statsData.length.toLocaleString()} stats\n`);

  // Define sports to analyze
  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB'];
  const results: any = {};

  // Analyze each sport
  for (const sport of sports) {
    console.log(chalk.yellow(`Analyzing ${sport}...`));
    
    const sportGames = gamesData.filter(g => g.sport === sport);
    const sportTeams = teamsData.filter(t => t.sport === sport);
    const sportPlayers = playersData.filter(p => p.sport === sport);
    const gameIds = new Set(sportGames.map(g => g.id));
    const sportStats = statsData.filter(s => gameIds.has(s.game_id));

    results[sport] = {
      games: {
        total: sportGames.length,
        withExternalId: sportGames.filter(g => g.external_id).length,
        standardFormat: sportGames.filter(g => g.external_id?.startsWith(`espn_${sport.toLowerCase()}_`)).length,
        invalidFormat: [] as string[]
      },
      teams: {
        total: sportTeams.length,
        withExternalId: sportTeams.filter(t => t.external_id).length,
        standardFormat: sportTeams.filter(t => t.external_id?.startsWith(`espn_${sport.toLowerCase()}_`)).length,
        invalidFormat: [] as string[]
      },
      players: {
        total: sportPlayers.length,
        withExternalId: sportPlayers.filter(p => p.external_id).length,
        standardFormat: sportPlayers.filter(p => p.external_id?.startsWith(`espn_${sport.toLowerCase()}_`)).length,
        invalidFormat: [] as string[]
      },
      stats: {
        total: sportStats.length,
        avgPerGame: sportGames.length > 0 ? Math.round(sportStats.length / sportGames.length) : 0,
        uniquePlayers: new Set(sportStats.map(s => s.player_id)).size,
        withValidDates: sportStats.filter(s => s.game_date).length,
        withValidTeams: sportStats.filter(s => s.team_id && s.opponent_id).length,
        emptyStats: sportStats.filter(s => !s.stats || Object.keys(s.stats).length === 0).length,
        uniqueStatKeys: new Set<string>()
      }
    };

    // Collect invalid external IDs
    sportGames.forEach(g => {
      if (g.external_id && !g.external_id.startsWith(`espn_${sport.toLowerCase()}_`)) {
        results[sport].games.invalidFormat.push(g.external_id);
      }
    });

    sportTeams.forEach(t => {
      if (t.external_id && !t.external_id.startsWith(`espn_${sport.toLowerCase()}_`)) {
        results[sport].teams.invalidFormat.push(t.external_id);
      }
    });

    sportPlayers.forEach(p => {
      if (p.external_id && !p.external_id.startsWith(`espn_${sport.toLowerCase()}_`)) {
        results[sport].players.invalidFormat.push(p.external_id);
      }
    });

    // Analyze stat keys
    sportStats.forEach(s => {
      if (s.stats) {
        Object.keys(s.stats).forEach(key => {
          results[sport].stats.uniqueStatKeys.add(key);
        });
      }
    });

    results[sport].stats.uniqueStatKeys = results[sport].stats.uniqueStatKeys.size;
  }

  // Display results
  console.log(chalk.bold.cyan('\n📊 STANDARDIZATION ANALYSIS RESULTS:\n'));

  let totalIssues = 0;

  for (const sport of sports) {
    const r = results[sport];
    console.log(chalk.bold.yellow(`${sport}:`));
    console.log(chalk.gray('─'.repeat(60)));
    
    // Games
    const gamesValid = r.games.standardFormat === r.games.total;
    console.log(`  Games: ${r.games.total.toLocaleString()} total`);
    console.log(`    External IDs: ${r.games.standardFormat}/${r.games.total} (${Math.round(r.games.standardFormat / r.games.total * 100)}%) ${gamesValid ? '✅' : '❌'}`);
    if (r.games.invalidFormat.length > 0) {
      console.log(chalk.red(`    Invalid: ${r.games.invalidFormat.slice(0, 3).join(', ')}${r.games.invalidFormat.length > 3 ? '...' : ''}`));
      totalIssues += r.games.invalidFormat.length;
    }

    // Teams
    const teamsValid = r.teams.standardFormat === r.teams.total;
    console.log(`  Teams: ${r.teams.total} total`);
    console.log(`    External IDs: ${r.teams.standardFormat}/${r.teams.total} (${Math.round(r.teams.standardFormat / r.teams.total * 100)}%) ${teamsValid ? '✅' : '❌'}`);
    if (r.teams.invalidFormat.length > 0) {
      console.log(chalk.red(`    Invalid: ${r.teams.invalidFormat.slice(0, 3).join(', ')}${r.teams.invalidFormat.length > 3 ? '...' : ''}`));
      totalIssues += r.teams.invalidFormat.length;
    }

    // Players
    const playersValid = r.players.standardFormat === r.players.total;
    console.log(`  Players: ${r.players.total.toLocaleString()} total`);
    console.log(`    External IDs: ${r.players.standardFormat}/${r.players.total} (${Math.round(r.players.standardFormat / r.players.total * 100)}%) ${playersValid ? '✅' : '❌'}`);
    if (r.players.invalidFormat.length > 0) {
      console.log(chalk.red(`    Invalid: ${r.players.invalidFormat.slice(0, 3).join(', ')}${r.players.invalidFormat.length > 3 ? '...' : ''}`));
      totalIssues += r.players.invalidFormat.length;
    }

    // Stats
    console.log(`  Stats: ${r.stats.total.toLocaleString()} total`);
    console.log(`    Avg per game: ${r.stats.avgPerGame}`);
    console.log(`    Unique players: ${r.stats.uniquePlayers.toLocaleString()}`);
    console.log(`    Unique stat types: ${r.stats.uniqueStatKeys}`);
    
    const statsIssues = r.stats.total - r.stats.withValidDates + r.stats.emptyStats + (r.stats.total - r.stats.withValidTeams);
    if (statsIssues > 0) {
      console.log(chalk.red(`    Data quality issues:`));
      if (r.stats.total - r.stats.withValidDates > 0) {
        console.log(chalk.red(`      - Missing dates: ${r.stats.total - r.stats.withValidDates}`));
      }
      if (r.stats.emptyStats > 0) {
        console.log(chalk.red(`      - Empty stats: ${r.stats.emptyStats}`));
      }
      if (r.stats.total - r.stats.withValidTeams > 0) {
        console.log(chalk.red(`      - Invalid team IDs: ${r.stats.total - r.stats.withValidTeams}`));
      }
      totalIssues += statsIssues;
    }

    console.log();
  }

  // Overall summary
  const totalTime = (Date.now() - startTime) / 1000;
  console.log(chalk.bold.green('📊 OVERALL SUMMARY:'));
  console.log(chalk.green(`  Analysis completed in ${totalTime.toFixed(1)} seconds`));
  console.log(chalk.green(`  Processing speed: ${Math.round(statsData.length / totalTime).toLocaleString()} stats/second`));
  
  if (totalIssues === 0) {
    console.log(chalk.bold.green('\n✅ ALL STATS ARE PROPERLY STANDARDIZED!'));
  } else {
    console.log(chalk.bold.red(`\n❌ Found ${totalIssues.toLocaleString()} standardization issues that need fixing`));
  }

  // ESPN ID format compliance
  console.log(chalk.bold.cyan('\n📋 ESPN ID FORMAT COMPLIANCE:'));
  let allCompliant = true;
  for (const sport of sports) {
    const r = results[sport];
    const compliance = Math.round(
      ((r.games.standardFormat + r.teams.standardFormat + r.players.standardFormat) / 
       (r.games.total + r.teams.total + r.players.total)) * 100
    );
    console.log(`  ${sport}: ${compliance}% ${compliance === 100 ? '✅' : '❌'}`);
    if (compliance < 100) allCompliant = false;
  }

  if (allCompliant) {
    console.log(chalk.bold.green('\n🎉 ALL SPORTS 100% ESPN ID COMPLIANT!'));
  }
}

async function loadAllRecords(table: string) {
  const allRecords: any[] = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const { data: batch } = await supabase
      .from(table)
      .select('*')
      .range(offset, offset + limit - 1);
    
    if (!batch || batch.length === 0) break;
    allRecords.push(...batch);
    offset += limit;
    if (batch.length < limit) break;
  }
  
  return allRecords;
}

verifyStatsStandardization().catch(console.error);
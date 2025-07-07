#!/usr/bin/env tsx
/**
 * Database Health Check
 * Comprehensive report on database status
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function runHealthCheck() {
  console.log(chalk.blue.bold('🏥 DATABASE HEALTH CHECK\n'));
  
  const issues = [];
  const warnings = [];
  const successes = [];
  
  // 1. Check table existence
  console.log(chalk.yellow('1. Checking Tables...'));
  
  const requiredTables = [
    'games', 'teams', 'players', 'player_stats',
    'sports', 'leagues', 'teams_master'
  ];
  
  for (const table of requiredTables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      issues.push(`Table '${table}' is inaccessible: ${error.message}`);
      console.log(chalk.red(`  ✗ ${table}: ERROR`));
    } else {
      successes.push(`Table '${table}' exists with ${count} records`);
      console.log(chalk.green(`  ✓ ${table}: ${count} records`));
    }
  }
  
  // 2. Check data integrity
  console.log(chalk.yellow('\n2. Checking Data Integrity...'));
  
  // Games with null teams
  const { count: nullTeamGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .or('home_team_id.is.null,away_team_id.is.null');
  
  if (nullTeamGames && nullTeamGames > 0) {
    warnings.push(`${nullTeamGames} games have null team IDs`);
    console.log(chalk.yellow(`  ⚠ ${nullTeamGames} games with null teams`));
  } else {
    successes.push('All games have valid team IDs');
    console.log(chalk.green('  ✓ No games with null teams'));
  }
  
  // Check foreign key validity
  const { data: sampleGame } = await supabase
    .from('games')
    .select(`
      id,
      home_team:teams!games_home_team_id_fkey(id, name),
      away_team:teams!games_away_team_id_fkey(id, name)
    `)
    .not('home_team_id', 'is', null)
    .limit(1)
    .single();
  
  if (sampleGame && sampleGame.home_team && sampleGame.away_team) {
    successes.push('Foreign key relationships are working');
    console.log(chalk.green('  ✓ Foreign keys properly linked'));
  } else {
    issues.push('Foreign key relationships may be broken');
    console.log(chalk.red('  ✗ Foreign key issues detected'));
  }
  
  // 3. Check ID consistency
  console.log(chalk.yellow('\n3. Checking ID Types...'));
  
  const { data: gamesSample } = await supabase
    .from('games')
    .select('id')
    .limit(1);
  
  const { data: teamsSample } = await supabase
    .from('teams')
    .select('id')
    .limit(1);
  
  if (gamesSample && teamsSample) {
    const gamesIdType = typeof gamesSample[0].id;
    const teamsIdType = typeof teamsSample[0].id;
    
    if (gamesIdType === teamsIdType) {
      successes.push(`ID types are consistent (${gamesIdType})`);
      console.log(chalk.green(`  ✓ Consistent ID types: ${gamesIdType}`));
    } else {
      issues.push(`Mixed ID types: games use ${gamesIdType}, teams use ${teamsIdType}`);
      console.log(chalk.red(`  ✗ Mixed types: games=${gamesIdType}, teams=${teamsIdType}`));
    }
  }
  
  // 4. Check duplicates
  console.log(chalk.yellow('\n4. Checking for Duplicates...'));
  
  const { data: duplicateCheck } = await supabase
    .from('games')
    .select('external_id')
    .not('external_id', 'is', null);
  
  if (duplicateCheck) {
    const externalIds = duplicateCheck.map(g => g.external_id);
    const uniqueIds = new Set(externalIds);
    const duplicates = externalIds.length - uniqueIds.size;
    
    if (duplicates > 0) {
      warnings.push(`${duplicates} duplicate external_ids found`);
      console.log(chalk.yellow(`  ⚠ ${duplicates} duplicate external_ids`));
    } else {
      successes.push('No duplicate external_ids');
      console.log(chalk.green('  ✓ No duplicates found'));
    }
  }
  
  // 5. Performance check
  console.log(chalk.yellow('\n5. Checking Performance...'));
  
  const start = Date.now();
  const { count: gameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
  
  const queryTime = Date.now() - start;
  
  if (queryTime < 1000) {
    successes.push(`Query performance good (${queryTime}ms)`);
    console.log(chalk.green(`  ✓ Query time: ${queryTime}ms`));
  } else {
    warnings.push(`Slow query performance (${queryTime}ms)`);
    console.log(chalk.yellow(`  ⚠ Query time: ${queryTime}ms (consider adding indexes)`));
  }
  
  // Summary
  console.log(chalk.blue.bold('\n📋 HEALTH CHECK SUMMARY\n'));
  
  if (successes.length > 0) {
    console.log(chalk.green(`✅ ${successes.length} Checks Passed:`));
    successes.forEach(s => console.log(`  - ${s}`));
  }
  
  if (warnings.length > 0) {
    console.log(chalk.yellow(`\n⚠️  ${warnings.length} Warnings:`));
    warnings.forEach(w => console.log(`  - ${w}`));
  }
  
  if (issues.length > 0) {
    console.log(chalk.red(`\n❌ ${issues.length} Issues Found:`));
    issues.forEach(i => console.log(`  - ${i}`));
  }
  
  // Overall status
  const totalChecks = successes.length + warnings.length + issues.length;
  const healthScore = (successes.length / totalChecks) * 100;
  
  console.log(chalk.blue.bold(`\n🏆 OVERALL HEALTH SCORE: ${healthScore.toFixed(0)}%\n`));
  
  if (healthScore >= 80) {
    console.log(chalk.green('Database is healthy and ready for production use! 🎉'));
  } else if (healthScore >= 60) {
    console.log(chalk.yellow('Database has some issues but is functional. Consider fixes.'));
  } else {
    console.log(chalk.red('Database has critical issues that need immediate attention!'));
  }
  
  // Recommendations
  console.log(chalk.cyan('\n💡 Recommendations:'));
  console.log('1. Run the SQL fix script in Supabase to add constraints');
  console.log('2. Use safe-data-collector.ts for all future data imports');
  console.log('3. Monitor foreign key violations in production');
  console.log('4. Add database monitoring and alerting');
}

runHealthCheck().catch(console.error);
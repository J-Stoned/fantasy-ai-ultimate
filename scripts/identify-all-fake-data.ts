#!/usr/bin/env tsx
/**
 * 🔍 COMPREHENSIVE FAKE DATA IDENTIFICATION AND CLEANUP STRATEGY
 * This script identifies ALL fake/test data patterns and provides a cleanup plan
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface FakeDataPattern {
  table: string;
  pattern: string;
  count: number;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

async function identifyAllFakeData() {
  console.log(chalk.bold.red('🔍 COMPREHENSIVE FAKE DATA ANALYSIS\n'));
  
  const fakePatterns: FakeDataPattern[] = [];
  
  // 1. PLAYERS TABLE ANALYSIS
  console.log(chalk.yellow('1. ANALYZING PLAYERS TABLE...'));
  
  // Pattern 1: The infamous 175133 pattern
  const { count: pattern175133 } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .like('name', '%_175133%_%');
  
  if (pattern175133 && pattern175133 > 0) {
    fakePatterns.push({
      table: 'players',
      pattern: '%_175133%_%',
      count: pattern175133,
      description: 'Test players with 175133 pattern (likely from mass generation script)',
      priority: 'critical'
    });
  }
  
  // Pattern 2: Generic test patterns
  const testPatterns = [
    { pattern: '%test%', desc: 'Contains "test"' },
    { pattern: '%fake%', desc: 'Contains "fake"' },
    { pattern: '%demo%', desc: 'Contains "demo"' },
    { pattern: '%sample%', desc: 'Contains "sample"' },
    { pattern: '%dummy%', desc: 'Contains "dummy"' },
    { pattern: 'Test Player%', desc: 'Starts with "Test Player"' },
    { pattern: 'Player %', desc: 'Generic "Player X" names' }
  ];
  
  for (const tp of testPatterns) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .ilike('name', tp.pattern);
    
    if (count && count > 0) {
      fakePatterns.push({
        table: 'players',
        pattern: tp.pattern,
        count: count,
        description: `Players ${tp.desc}`,
        priority: count > 1000 ? 'critical' : 'high'
      });
    }
  }
  
  // Pattern 3: Players without proper names
  const { count: noNames } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .or('name.is.null,firstname.is.null,lastname.is.null');
  
  if (noNames && noNames > 0) {
    fakePatterns.push({
      table: 'players',
      pattern: 'NULL names',
      count: noNames,
      description: 'Players without proper names',
      priority: 'high'
    });
  }
  
  // Pattern 4: Suspicious external_ids
  const { count: suspiciousExtIds } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .or('external_id.like.test_%,external_id.like.fake_%,external_id.like.temp_%');
  
  if (suspiciousExtIds && suspiciousExtIds > 0) {
    fakePatterns.push({
      table: 'players',
      pattern: 'test/fake external_ids',
      count: suspiciousExtIds,
      description: 'Players with test/fake external IDs',
      priority: 'critical'
    });
  }
  
  // 2. GAMES TABLE ANALYSIS
  console.log(chalk.yellow('\n2. ANALYZING GAMES TABLE...'));
  
  // Pattern 1: Games with NULL external_id
  const { count: nullExtGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null);
  
  if (nullExtGames && nullExtGames > 0) {
    fakePatterns.push({
      table: 'games',
      pattern: 'NULL external_id',
      count: nullExtGames,
      description: 'Games without external IDs (likely generated)',
      priority: 'critical'
    });
  }
  
  // Pattern 2: Games with impossible scores
  const { count: impossibleScores } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .or('home_score.gt.200,away_score.gt.200');
  
  if (impossibleScores && impossibleScores > 0) {
    fakePatterns.push({
      table: 'games',
      pattern: 'score > 200',
      count: impossibleScores,
      description: 'Games with impossible scores',
      priority: 'high'
    });
  }
  
  // Pattern 3: Future games (check if excessive)
  const { count: futureGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .gt('start_time', '2025-12-31');
  
  if (futureGames && futureGames > 100) {
    fakePatterns.push({
      table: 'games',
      pattern: 'far future games',
      count: futureGames,
      description: 'Games scheduled too far in future',
      priority: 'medium'
    });
  }
  
  // 3. PLAYER_STATS TABLE ANALYSIS
  console.log(chalk.yellow('\n3. ANALYZING PLAYER_STATS TABLE...'));
  
  // Get total stats count
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
  
  console.log(`  Total player_stats: ${totalStats?.toLocaleString()}`);
  
  // Check stats for fake players
  const { data: fakePlayerSample } = await supabase
    .from('players')
    .select('id')
    .like('name', '%_175133%_%')
    .limit(100);
  
  if (fakePlayerSample && fakePlayerSample.length > 0) {
    const fakeIds = fakePlayerSample.map(p => p.id);
    const { count: fakePlayerStats } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .in('player_id', fakeIds);
    
    // Extrapolate based on sample
    const estimatedFakeStats = Math.floor((fakePlayerStats || 0) * (pattern175133 || 0) / 100);
    
    if (estimatedFakeStats > 0) {
      fakePatterns.push({
        table: 'player_stats',
        pattern: 'stats for fake players',
        count: estimatedFakeStats,
        description: 'Stats for fake players (estimated)',
        priority: 'critical'
      });
    }
  }
  
  // 4. CHECK FOR BULK-GENERATED DATA PATTERNS
  console.log(chalk.yellow('\n4. CHECKING FOR BULK-GENERATED PATTERNS...'));
  
  // Check for sequential IDs in large ranges
  const { data: idRanges } = await supabase
    .from('players')
    .select('id')
    .gte('id', 50000)
    .order('id')
    .limit(1000);
  
  if (idRanges && idRanges.length > 900) {
    console.log(chalk.red('  ⚠️  Found large sequential ID ranges (likely bulk generated)'));
  }
  
  // 5. SUMMARY AND RECOMMENDATIONS
  console.log(chalk.bold.cyan('\n📊 FAKE DATA SUMMARY:'));
  console.log(chalk.cyan('═'.repeat(60)));
  
  // Sort by priority and count
  fakePatterns.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.count - a.count;
  });
  
  let totalFakeRecords = 0;
  fakePatterns.forEach(fp => {
    const color = fp.priority === 'critical' ? chalk.red :
                  fp.priority === 'high' ? chalk.yellow :
                  fp.priority === 'medium' ? chalk.blue :
                  chalk.gray;
    
    console.log(color(`
  ${fp.table.toUpperCase()} - ${fp.description}
  Pattern: ${fp.pattern}
  Count: ${fp.count.toLocaleString()}
  Priority: ${fp.priority.toUpperCase()}`));
    
    totalFakeRecords += fp.count;
  });
  
  console.log(chalk.bold.red(`\n⚠️  TOTAL FAKE RECORDS: ${totalFakeRecords.toLocaleString()}`));
  
  // 6. CLEANUP STRATEGY
  console.log(chalk.bold.green('\n🧹 RECOMMENDED CLEANUP STRATEGY:'));
  console.log(chalk.green('═'.repeat(60)));
  
  console.log(`
${chalk.bold('PHASE 1: CRITICAL DATA REMOVAL')}
1. Delete all players matching %_175133%_% pattern
2. Delete all games with NULL external_id
3. Delete player_stats for fake players

${chalk.bold('PHASE 2: TEST DATA CLEANUP')}
4. Delete players with test/fake/demo in names
5. Delete players without proper names
6. Delete games with impossible scores

${chalk.bold('PHASE 3: PREVENTION')}
7. Add database constraints to prevent fake data
8. Create validation rules for data insertion
9. Implement data quality monitoring

${chalk.bold('PHASE 4: VERIFICATION')}
10. Verify remaining data is legitimate
11. Rebuild indexes and statistics
12. Update pattern detection with clean data
`);
  
  // 7. SCRIPTS THAT LIKELY CREATED FAKE DATA
  console.log(chalk.bold.yellow('\n🔧 SCRIPTS THAT LIKELY CREATED FAKE DATA:'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  const suspiciousScripts = [
    'turbo-loader.ts - Generates 100K+ players with generic names',
    'fill-50k-games.ts - Creates games with synthetic stats',
    'fill-player-stats-*.ts - Multiple scripts generating fake stats',
    'generate-*.ts scripts - Various data generation scripts',
    'Scripts with "175133" timestamp - Mass player generation'
  ];
  
  suspiciousScripts.forEach(script => {
    console.log(chalk.yellow(`  • ${script}`));
  });
  
  // 8. PREVENTION RECOMMENDATIONS
  console.log(chalk.bold.blue('\n🛡️  PREVENTION RECOMMENDATIONS:'));
  console.log(chalk.blue('═'.repeat(60)));
  
  console.log(`
1. ${chalk.bold('Database Constraints:')}
   - Add CHECK constraints on player names
   - Require external_id for games
   - Add validation triggers

2. ${chalk.bold('Code Standards:')}
   - Never generate fake data in production
   - Use separate test database for testing
   - Add data validation in API endpoints

3. ${chalk.bold('Monitoring:')}
   - Set up alerts for bulk inserts
   - Monitor for suspicious patterns
   - Regular data quality checks

4. ${chalk.bold('Documentation:')}
   - Document all data sources
   - Track data lineage
   - Maintain data dictionary
`);
  
  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    totalFakeRecords,
    patterns: fakePatterns,
    recommendations: {
      immediate: [
        'Delete all 175133 pattern players',
        'Delete games with NULL external_id',
        'Clean up related stats'
      ],
      longTerm: [
        'Implement data validation',
        'Set up monitoring',
        'Use separate test database'
      ]
    }
  };
  
  console.log(chalk.green('\n✅ Analysis complete!'));
  console.log(chalk.gray('Report saved to: fake-data-report.json'));
  
  return report;
}

// Run the analysis
identifyAllFakeData().catch(console.error);
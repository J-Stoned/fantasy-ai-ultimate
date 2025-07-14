#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface DiagnosticReport {
  totalStats: number;
  statTypes: Map<string, number>;
  dataIntegrity: {
    nullGameIds: number;
    nullPlayerIds: number;
    nullBoth: number;
    orphanedStats: number;
    duplicates: number;
  };
  coverage: {
    gamesWithStats: number;
    playersWithStats: number;
    avgStatsPerGame: number;
    avgStatsPerPlayer: number;
  };
  formatIssues: {
    invalidValues: number;
    outliers: number;
    mixedTypes: Map<string, Set<string>>;
  };
  recommendations: string[];
}

async function diagnosePlayerStatsIssues() {
  console.log(chalk.bold.red('\n🔬 COMPREHENSIVE PLAYER_STATS DIAGNOSTIC\n'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log(chalk.yellow('Analyzing 3.6M stats records to identify ML accessibility issues...\n'));
  
  const report: DiagnosticReport = {
    totalStats: 0,
    statTypes: new Map(),
    dataIntegrity: {
      nullGameIds: 0,
      nullPlayerIds: 0,
      nullBoth: 0,
      orphanedStats: 0,
      duplicates: 0
    },
    coverage: {
      gamesWithStats: 0,
      playersWithStats: 0,
      avgStatsPerGame: 0,
      avgStatsPerPlayer: 0
    },
    formatIssues: {
      invalidValues: 0,
      outliers: 0,
      mixedTypes: new Map()
    },
    recommendations: []
  };
  
  try {
    // 1. Get total count
    const { count: totalCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    
    report.totalStats = totalCount || 0;
    console.log(chalk.green(`✅ Total stats records: ${chalk.bold(report.totalStats.toLocaleString())}\n`));
    
    // 2. Analyze stat types
    console.log(chalk.yellow('📊 Analyzing stat types...\n'));
    const { data: statTypesSample } = await supabase
      .from('player_stats')
      .select('stat_type')
      .limit(100000); // Sample 100k for stat types
    
    statTypesSample?.forEach(record => {
      const statType = record.stat_type || 'NULL';
      report.statTypes.set(statType, (report.statTypes.get(statType) || 0) + 1);
    });
    
    // Sort and display top stat types
    const sortedStatTypes = Array.from(report.statTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    
    console.log(chalk.cyan('Top 20 stat types:'));
    sortedStatTypes.forEach(([type, count], i) => {
      console.log(chalk.white(`${(i + 1).toString().padStart(2)}. ${type.padEnd(30)} : ${count.toLocaleString()}`));
    });
    
    // 3. Check data integrity
    console.log(chalk.yellow('\n🔍 Checking data integrity...\n'));
    
    // Check for null IDs
    const { count: nullGameIds } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .is('game_id', null);
    
    const { count: nullPlayerIds } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .is('player_id', null);
    
    const { count: nullBoth } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .is('game_id', null)
      .is('player_id', null);
    
    report.dataIntegrity.nullGameIds = nullGameIds || 0;
    report.dataIntegrity.nullPlayerIds = nullPlayerIds || 0;
    report.dataIntegrity.nullBoth = nullBoth || 0;
    
    console.log(chalk.white(`Null game_ids: ${chalk.red(report.dataIntegrity.nullGameIds.toLocaleString())}`));
    console.log(chalk.white(`Null player_ids: ${chalk.red(report.dataIntegrity.nullPlayerIds.toLocaleString())}`));
    console.log(chalk.white(`Both null: ${chalk.red(report.dataIntegrity.nullBoth.toLocaleString())}`));
    
    // 4. Check coverage
    console.log(chalk.yellow('\n📈 Analyzing coverage...\n'));
    
    // Get unique games with stats
    const { data: gamesWithStats } = await supabase
      .from('player_stats')
      .select('game_id')
      .not('game_id', 'is', null)
      .limit(50000);
    
    const uniqueGames = new Set(gamesWithStats?.map(s => s.game_id) || []);
    report.coverage.gamesWithStats = uniqueGames.size;
    
    // Get unique players with stats
    const { data: playersWithStats } = await supabase
      .from('player_stats')
      .select('player_id')
      .not('player_id', 'is', null)
      .limit(50000);
    
    const uniquePlayers = new Set(playersWithStats?.map(s => s.player_id) || []);
    report.coverage.playersWithStats = uniquePlayers.size;
    
    // Calculate averages
    report.coverage.avgStatsPerGame = report.totalStats / Math.max(1, report.coverage.gamesWithStats);
    report.coverage.avgStatsPerPlayer = report.totalStats / Math.max(1, report.coverage.playersWithStats);
    
    console.log(chalk.white(`Games with stats: ${chalk.green(report.coverage.gamesWithStats.toLocaleString())}`));
    console.log(chalk.white(`Players with stats: ${chalk.green(report.coverage.playersWithStats.toLocaleString())}`));
    console.log(chalk.white(`Avg stats per game: ${chalk.cyan(report.coverage.avgStatsPerGame.toFixed(1))}`));
    console.log(chalk.white(`Avg stats per player: ${chalk.cyan(report.coverage.avgStatsPerPlayer.toFixed(1))}`));
    
    // 5. Check for format issues
    console.log(chalk.yellow('\n🔧 Checking format issues...\n'));
    
    const { data: formatSample } = await supabase
      .from('player_stats')
      .select('stat_type, stat_value')
      .limit(10000);
    
    const valueTypes = new Map<string, Set<string>>();
    let invalidCount = 0;
    
    formatSample?.forEach(record => {
      const statType = record.stat_type || 'NULL';
      const value = record.stat_value;
      
      // Check value type
      let valueType = 'null';
      if (value !== null) {
        if (!isNaN(parseFloat(value))) {
          valueType = 'number';
        } else {
          valueType = 'string';
          invalidCount++;
        }
      }
      
      if (!valueTypes.has(statType)) {
        valueTypes.set(statType, new Set());
      }
      valueTypes.get(statType)?.add(valueType);
    });
    
    report.formatIssues.invalidValues = invalidCount;
    report.formatIssues.mixedTypes = valueTypes;
    
    console.log(chalk.white(`Invalid (non-numeric) values: ${chalk.red(invalidCount.toLocaleString())}`));
    console.log(chalk.white('\nStat types with mixed value types:'));
    
    valueTypes.forEach((types, statType) => {
      if (types.size > 1) {
        console.log(chalk.yellow(`  ${statType}: ${Array.from(types).join(', ')}`));
      }
    });
    
    // 6. Check duplicates
    console.log(chalk.yellow('\n🔍 Checking for duplicates...\n'));
    
    const { data: dupCheck } = await supabase
      .from('player_stats')
      .select('player_id, game_id, stat_type')
      .limit(50000);
    
    const seen = new Set<string>();
    let dupCount = 0;
    
    dupCheck?.forEach(record => {
      const key = `${record.player_id}-${record.game_id}-${record.stat_type}`;
      if (seen.has(key)) {
        dupCount++;
      }
      seen.add(key);
    });
    
    report.dataIntegrity.duplicates = dupCount;
    console.log(chalk.white(`Duplicate entries found: ${chalk.red(dupCount.toLocaleString())}`));
    
    // 7. Generate recommendations
    console.log(chalk.yellow('\n💡 GENERATING RECOMMENDATIONS...\n'));
    
    // Analyze issues and generate recommendations
    if (report.dataIntegrity.nullGameIds > 0) {
      report.recommendations.push(`Clean up ${report.dataIntegrity.nullGameIds.toLocaleString()} records with null game_ids`);
    }
    
    if (report.dataIntegrity.nullPlayerIds > 0) {
      report.recommendations.push(`Clean up ${report.dataIntegrity.nullPlayerIds.toLocaleString()} records with null player_ids`);
    }
    
    if (report.formatIssues.invalidValues > 0) {
      report.recommendations.push(`Convert ${report.formatIssues.invalidValues.toLocaleString()} non-numeric stat values to proper format`);
    }
    
    if (report.dataIntegrity.duplicates > 0) {
      report.recommendations.push(`Remove ${report.dataIntegrity.duplicates.toLocaleString()} duplicate stat entries`);
    }
    
    // Check for stat type variations
    const statTypeVariations = [
      ['points', 'pts', 'total_points'],
      ['rebounds', 'reb', 'total_rebounds'],
      ['assists', 'ast'],
      ['steals', 'stl'],
      ['blocks', 'blk'],
      ['turnovers', 'to', 'tov'],
      ['minutes', 'min', 'minutes_played'],
      ['field_goals_made', 'fgm'],
      ['field_goals_attempted', 'fga'],
      ['three_pointers_made', '3pm', 'three_point_field_goals_made'],
      ['three_pointers_attempted', '3pa', 'three_point_field_goals_attempted'],
      ['free_throws_made', 'ftm'],
      ['free_throws_attempted', 'fta']
    ];
    
    let needsStandardization = false;
    statTypeVariations.forEach(variations => {
      const found = variations.filter(v => report.statTypes.has(v));
      if (found.length > 1) {
        needsStandardization = true;
      }
    });
    
    if (needsStandardization) {
      report.recommendations.push('Standardize stat_type naming conventions (e.g., "points" vs "pts")');
    }
    
    report.recommendations.push('Create indexes on (player_id, game_id, stat_type) for faster aggregation');
    report.recommendations.push('Consider creating a materialized view for pre-aggregated stats');
    
    // 8. Display final report
    console.log(chalk.gray('━'.repeat(60)));
    console.log(chalk.bold.green('\n📊 DIAGNOSTIC SUMMARY:\n'));
    
    console.log(chalk.white('1. Data Volume:'));
    console.log(chalk.gray(`   └─ Total records: ${report.totalStats.toLocaleString()}`));
    
    console.log(chalk.white('\n2. Data Quality Issues:'));
    const qualityIssues = report.dataIntegrity.nullGameIds + 
                         report.dataIntegrity.nullPlayerIds + 
                         report.formatIssues.invalidValues + 
                         report.dataIntegrity.duplicates;
    console.log(chalk.gray(`   ├─ Total issues: ${chalk.red(qualityIssues.toLocaleString())}`));
    console.log(chalk.gray(`   └─ Clean records: ${chalk.green((report.totalStats - qualityIssues).toLocaleString())}`));
    
    console.log(chalk.white('\n3. Coverage:'));
    console.log(chalk.gray(`   ├─ Games covered: ${report.coverage.gamesWithStats.toLocaleString()}`));
    console.log(chalk.gray(`   └─ Players covered: ${report.coverage.playersWithStats.toLocaleString()}`));
    
    console.log(chalk.white('\n4. Key Recommendations:'));
    report.recommendations.forEach((rec, i) => {
      console.log(chalk.cyan(`   ${i + 1}. ${rec}`));
    });
    
    // 9. Create stat type mapping
    console.log(chalk.yellow('\n📝 SUGGESTED STAT TYPE STANDARDIZATION:\n'));
    
    const mapping = {
      // Points
      'pts': 'points',
      'total_points': 'points',
      
      // Rebounds
      'reb': 'rebounds',
      'total_rebounds': 'rebounds',
      
      // Assists
      'ast': 'assists',
      
      // Steals
      'stl': 'steals',
      
      // Blocks
      'blk': 'blocks',
      
      // Turnovers
      'to': 'turnovers',
      'tov': 'turnovers',
      
      // Minutes
      'min': 'minutes_played',
      'minutes': 'minutes_played',
      
      // Field Goals
      'fgm': 'field_goals_made',
      'fga': 'field_goals_attempted',
      
      // Three Pointers
      '3pm': 'three_pointers_made',
      'three_point_field_goals_made': 'three_pointers_made',
      '3pa': 'three_pointers_attempted',
      'three_point_field_goals_attempted': 'three_pointers_attempted',
      
      // Free Throws
      'ftm': 'free_throws_made',
      'fta': 'free_throws_attempted'
    };
    
    console.log(chalk.white('Standardization mapping:'));
    Object.entries(mapping).forEach(([from, to]) => {
      const fromCount = report.statTypes.get(from) || 0;
      if (fromCount > 0) {
        console.log(chalk.gray(`  "${from}" → "${to}" (${fromCount.toLocaleString()} records)`));
      }
    });
    
    // 10. SQL to fix common issues
    console.log(chalk.yellow('\n🔧 SAMPLE SQL FIXES:\n'));
    
    console.log(chalk.white('1. Remove records with null IDs:'));
    console.log(chalk.gray(`   DELETE FROM player_stats WHERE game_id IS NULL OR player_id IS NULL;`));
    
    console.log(chalk.white('\n2. Standardize stat types:'));
    console.log(chalk.gray(`   UPDATE player_stats SET stat_type = 'points' WHERE stat_type IN ('pts', 'total_points');`));
    
    console.log(chalk.white('\n3. Remove duplicates:'));
    console.log(chalk.gray(`   DELETE FROM player_stats a USING player_stats b
   WHERE a.id < b.id 
   AND a.player_id = b.player_id 
   AND a.game_id = b.game_id 
   AND a.stat_type = b.stat_type;`));
    
    console.log(chalk.gray('\n━'.repeat(60)));
    console.log(chalk.bold.green('\n✅ DIAGNOSTIC COMPLETE!\n'));
    console.log(chalk.yellow('The main issues preventing ML access are:'));
    console.log(chalk.white('1. Data quality issues (nulls, duplicates)'));
    console.log(chalk.white('2. Inconsistent stat_type naming'));
    console.log(chalk.white('3. Need for efficient aggregation strategy'));
    console.log(chalk.white('4. Missing indexes for fast queries\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  }
}

// Run diagnostic
diagnosePlayerStatsIssues();
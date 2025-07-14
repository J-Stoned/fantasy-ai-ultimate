#!/usr/bin/env tsx
/**
 * DATA QUALITY AUDIT - Figure out why our data is trash
 * 
 * This will analyze all 4M records and find out what's actually usable
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import chalk from 'chalk';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.bold.red('🔍 DATA QUALITY AUDIT - TIME FOR TRUTH'));

interface AuditResult {
  table: string;
  totalRecords: number;
  emptyRecords: number;
  completeRecords: number;
  percentComplete: number;
  issues: string[];
  sample: any;
}

async function auditTable(tableName: string, requiredFields: string[]): Promise<AuditResult> {
  console.log(chalk.blue(`\n📊 Auditing ${tableName}...`));
  
  try {
    // Get total count
    const { count: totalRecords } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    // Sample records to check quality
    const { data: sample } = await supabase
      .from(tableName)
      .select('*')
      .limit(1000);
    
    if (!sample || sample.length === 0) {
      return {
        table: tableName,
        totalRecords: totalRecords || 0,
        emptyRecords: totalRecords || 0,
        completeRecords: 0,
        percentComplete: 0,
        issues: ['No data found'],
        sample: null
      };
    }
    
    // Check how many records have all required fields
    let completeRecords = 0;
    let emptyRecords = 0;
    const issues = new Set<string>();
    
    sample.forEach(record => {
      const missingFields = requiredFields.filter(field => {
        const value = field.includes('.') ? 
          field.split('.').reduce((obj, key) => obj?.[key], record) :
          record[field];
        return value === null || value === undefined || value === '';
      });
      
      if (missingFields.length === 0) {
        completeRecords++;
      } else if (missingFields.length === requiredFields.length) {
        emptyRecords++;
      }
      
      missingFields.forEach(field => issues.add(`Missing ${field}`));
    });
    
    const percentComplete = (completeRecords / sample.length) * 100;
    
    // Extrapolate to full dataset
    const estimatedComplete = Math.round((percentComplete / 100) * (totalRecords || 0));
    const estimatedEmpty = Math.round((emptyRecords / sample.length) * (totalRecords || 0));
    
    return {
      table: tableName,
      totalRecords: totalRecords || 0,
      emptyRecords: estimatedEmpty,
      completeRecords: estimatedComplete,
      percentComplete,
      issues: Array.from(issues),
      sample: sample[0]
    };
    
  } catch (error: any) {
    return {
      table: tableName,
      totalRecords: 0,
      emptyRecords: 0,
      completeRecords: 0,
      percentComplete: 0,
      issues: [`Error: ${error.message}`],
      sample: null
    };
  }
}

async function runComprehensiveAudit() {
  const audits: AuditResult[] = [];
  
  // Define what fields we actually need for each table
  const tableRequirements = [
    {
      table: 'player_game_logs',
      fields: ['player_id', 'game_id', 'team_id', 'stats', 'minutes_played']
    },
    {
      table: 'player_stats',
      fields: ['player_id', 'game_id', 'stats.points', 'stats.rebounds', 'stats.assists']
    },
    {
      table: 'games',
      fields: ['external_id', 'home_team_id', 'away_team_id', 'home_score', 'away_score', 'sport']
    },
    {
      table: 'ml_predictions',
      fields: ['game_id', 'prediction_type', 'predicted_value', 'confidence']
    },
    {
      table: 'pattern_results',
      fields: ['pattern_type', 'game_id', 'confidence', 'result']
    }
  ];
  
  // Run audits
  for (const { table, fields } of tableRequirements) {
    const result = await auditTable(table, fields);
    audits.push(result);
  }
  
  // Display results
  console.clear();
  console.log(chalk.bold.red('\n🔍 DATA QUALITY AUDIT RESULTS\n'));
  console.log(chalk.gray('═'.repeat(80)));
  
  let totalRecords = 0;
  let totalUsable = 0;
  
  audits.forEach(audit => {
    totalRecords += audit.totalRecords;
    totalUsable += audit.completeRecords;
    
    const color = audit.percentComplete > 50 ? chalk.green :
                  audit.percentComplete > 20 ? chalk.yellow :
                  chalk.red;
    
    console.log(chalk.bold.white(`\n📊 ${audit.table.toUpperCase()}`));
    console.log(chalk.gray(`Total Records: ${audit.totalRecords.toLocaleString()}`));
    console.log(color(`Complete: ${audit.completeRecords.toLocaleString()} (${audit.percentComplete.toFixed(1)}%))`));
    console.log(chalk.red(`Empty: ${audit.emptyRecords.toLocaleString()}`));
    
    if (audit.issues.length > 0) {
      console.log(chalk.yellow('Issues:'));
      audit.issues.slice(0, 3).forEach(issue => {
        console.log(chalk.gray(`  - ${issue}`));
      });
    }
  });
  
  console.log(chalk.gray('\n═'.repeat(80)));
  console.log(chalk.bold.white('\n📈 OVERALL DATA HEALTH'));
  console.log(chalk.gray(`Total Records: ${totalRecords.toLocaleString()}`));
  console.log(chalk.green(`Usable Records: ${totalUsable.toLocaleString()} (${((totalUsable/totalRecords)*100).toFixed(1)}%)`));
  console.log(chalk.red(`Unusable Records: ${(totalRecords - totalUsable).toLocaleString()}`));
  
  // Recommendations
  console.log(chalk.bold.yellow('\n💡 RECOMMENDATIONS:'));
  
  const playerGameLogs = audits.find(a => a.table === 'player_game_logs');
  if (playerGameLogs && playerGameLogs.percentComplete < 10) {
    console.log(chalk.cyan('1. Re-run data collection with proper field mapping'));
    console.log(chalk.cyan('2. Focus on getting team_id, opponent_id, and stats populated'));
  }
  
  const patterns = audits.find(a => a.table === 'pattern_results');
  if (patterns && patterns.totalRecords === 0) {
    console.log(chalk.cyan('3. No patterns detected yet - need to run pattern detection on good data'));
  }
  
  const predictions = audits.find(a => a.table === 'ml_predictions');
  if (predictions && predictions.totalRecords === 0) {
    console.log(chalk.cyan('4. No ML predictions found - ML system never ran'));
  }
  
  console.log(chalk.bold.green('\n✅ NEXT STEPS:'));
  console.log(chalk.white('1. Fix data collection to populate required fields'));
  console.log(chalk.white('2. Run pattern detection only on complete records'));
  console.log(chalk.white('3. Start with basic patterns before complex ML'));
  
  return audits;
}

// Check specific data quality issues
async function deepDiveAnalysis() {
  console.log(chalk.bold.blue('\n🔬 DEEP DIVE ANALYSIS\n'));
  
  // Check why stats are empty
  console.log(chalk.yellow('Checking player_game_logs stats field...'));
  const { data: logsWithStats } = await supabase
    .from('player_game_logs')
    .select('id, stats')
    .not('stats', 'is', null)
    .limit(10);
  
  if (logsWithStats && logsWithStats.length > 0) {
    console.log(chalk.green(`Found ${logsWithStats.length} records with stats:`));
    console.log(JSON.stringify(logsWithStats[0].stats, null, 2));
  } else {
    console.log(chalk.red('No player_game_logs have stats field populated!'));
  }
  
  // Check player_stats quality
  console.log(chalk.yellow('\nChecking player_stats quality...'));
  const { data: playerStats } = await supabase
    .from('player_stats')
    .select('*')
    .not('stats', 'is', null)
    .limit(5);
  
  if (playerStats && playerStats.length > 0) {
    const sample = playerStats[0];
    console.log(chalk.green('Sample player_stats record:'));
    console.log(chalk.gray(`Game ID: ${sample.game_id}`));
    console.log(chalk.gray(`Team ID: ${sample.team_id}`));
    console.log(chalk.gray(`Stats: ${JSON.stringify(sample.stats)}`));
  }
  
  // Check for recent successful data
  console.log(chalk.yellow('\nChecking for recent successful data collection...'));
  const { data: recentData } = await supabase
    .from('player_stats')
    .select('created_at, sport, stats')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (recentData && recentData.length > 0) {
    console.log(chalk.green('Recent data collection attempts:'));
    recentData.forEach(record => {
      const hasStats = record.stats && Object.keys(record.stats).length > 0;
      console.log(chalk.gray(`${record.created_at} - ${record.sport || 'Unknown'} - ${hasStats ? '✅ Has stats' : '❌ Empty'}`));
    });
  }
}

async function main() {
  try {
    await runComprehensiveAudit();
    await deepDiveAnalysis();
    
    console.log(chalk.bold.cyan('\n🎯 AUDIT COMPLETE\n'));
    
  } catch (error: any) {
    console.error(chalk.red(`\n❌ Audit failed: ${error.message}`));
  }
}

main();
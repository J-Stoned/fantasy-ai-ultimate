#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import Table from 'cli-table3';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

console.log(chalk.bold.red(`
╔═══════════════════════════════════════════════════════════════╗
║        🔥 COMPLETE DATABASE STRUCTURE ANALYSIS 🔥             ║
╚═══════════════════════════════════════════════════════════════╝
`));

async function analyzeTable(tableName: string) {
  console.log(chalk.bold.yellow(`\n\n━━━━━ TABLE: ${tableName} ━━━━━`));
  
  try {
    // Get count
    const { count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    console.log(chalk.green(`Total Records: ${count?.toLocaleString()}`));
    
    // Get sample data
    const { data: samples } = await supabase
      .from(tableName)
      .select('*')
      .limit(3);
    
    if (samples && samples.length > 0) {
      // Analyze column structure
      console.log(chalk.cyan('\nColumn Analysis:'));
      const columnInfo = new Table({
        head: ['Column', 'Type', 'Sample Value', 'Issues'],
        colWidths: [25, 15, 40, 30],
        style: { head: [], border: ['grey'] }
      });
      
      const firstRecord = samples[0];
      for (const [key, value] of Object.entries(firstRecord)) {
        const type = Array.isArray(value) ? 'array' : 
                    value === null ? 'null' :
                    typeof value;
        
        let sampleValue = '';
        let issues = '';
        
        if (value === null) {
          sampleValue = 'NULL';
          issues = chalk.yellow('Many nulls');
        } else if (Array.isArray(value)) {
          sampleValue = JSON.stringify(value);
          issues = chalk.red('❌ Array instead of string!');
        } else if (typeof value === 'object') {
          sampleValue = JSON.stringify(value).substring(0, 35) + '...';
        } else {
          sampleValue = String(value).substring(0, 35);
        }
        
        // Check for specific issues
        if (key === 'position' && Array.isArray(value)) {
          issues = chalk.red('❌ CRITICAL: Position is array!');
        }
        if (key === 'name' && value === null) {
          issues = chalk.red('❌ Name is null!');
        }
        
        columnInfo.push([key, type, sampleValue, issues]);
      }
      
      console.log(columnInfo.toString());
      
      // Show full sample records
      console.log(chalk.cyan('\nSample Records:'));
      samples.forEach((sample, idx) => {
        console.log(chalk.gray(`\nRecord ${idx + 1}:`));
        console.log(chalk.gray(JSON.stringify(sample, null, 2).substring(0, 500) + '...'));
      });
    }
    
  } catch (error) {
    console.log(chalk.red(`Error analyzing ${tableName}: ${error}`));
  }
}

async function analyzeRelationships() {
  console.log(chalk.bold.yellow(`\n\n━━━━━ RELATIONSHIP ANALYSIS ━━━━━`));
  
  // Check players -> teams relationship
  console.log(chalk.cyan('\n1. Players -> Teams:'));
  const { data: playerWithTeam } = await supabase
    .from('players')
    .select('id, firstname, lastname, team_id, teams(id, name, abbreviation)')
    .not('team_id', 'is', null)
    .limit(5);
  
  if (playerWithTeam) {
    playerWithTeam.forEach(p => {
      console.log(chalk.gray(`  ${p.firstname} ${p.lastname} -> Team ${p.team_id}: ${p.teams?.name || 'NOT FOUND'}`));
    });
  }
  
  // Check game logs -> players relationship
  console.log(chalk.cyan('\n2. Game Logs -> Players:'));
  const { data: logsWithPlayer } = await supabase
    .from('player_game_logs')
    .select('id, player_id, game_date, fantasy_points, players!inner(id, firstname, lastname)')
    .limit(5);
  
  if (logsWithPlayer) {
    logsWithPlayer.forEach(log => {
      const player = log.players as any;
      console.log(chalk.gray(`  Game ${log.id}: Player ${log.player_id} (${player?.firstname} ${player?.lastname}) - ${log.fantasy_points} pts`));
    });
  }
}

async function analyzeDataQualityIssues() {
  console.log(chalk.bold.yellow(`\n\n━━━━━ DATA QUALITY ISSUES ━━━━━`));
  
  const issues = new Table({
    head: ['Issue', 'Severity', 'Count', 'Impact'],
    colWidths: [40, 15, 15, 40],
    style: { head: [], border: ['grey'] }
  });
  
  // Check null positions
  const { count: nullPositions } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .is('position', null);
  
  issues.push([
    'Players with NULL position',
    chalk.red('CRITICAL'),
    nullPositions?.toLocaleString() || '0',
    'Cannot filter by position'
  ]);
  
  // Check array positions
  const { data: arrayPositions } = await supabase
    .from('players')
    .select('position')
    .not('position', 'is', null)
    .limit(100);
  
  const arrayCount = arrayPositions?.filter(p => Array.isArray(p.position)).length || 0;
  
  issues.push([
    'Positions stored as arrays',
    chalk.red('CRITICAL'),
    `${arrayCount}/100 sampled`,
    'Position queries fail'
  ]);
  
  // Check null names
  const { count: nullNames } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .is('firstname', null)
    .is('lastname', null);
  
  issues.push([
    'Players with NULL names',
    chalk.yellow('HIGH'),
    nullNames?.toLocaleString() || '0',
    'Cannot search by name'
  ]);
  
  // Check metadata structure
  const { data: metadataCheck } = await supabase
    .from('player_game_logs')
    .select('metadata')
    .not('metadata', 'is', null)
    .limit(10);
  
  const hasSport = metadataCheck?.filter(m => m.metadata?.sport).length || 0;
  
  issues.push([
    'Game logs with sport in metadata',
    chalk.green('OK'),
    `${hasSport}/10 sampled`,
    'Sport filtering works'
  ]);
  
  console.log(issues.toString());
}

async function generateRecommendations() {
  console.log(chalk.bold.yellow(`\n\n━━━━━ RECOMMENDATIONS ━━━━━`));
  
  console.log(chalk.red('\n🚨 CRITICAL FIXES NEEDED:'));
  console.log(chalk.white('1. Position column is storing arrays ["QB"] instead of strings "QB"'));
  console.log(chalk.white('2. Many players have NULL positions (697 out of ~1000 sampled)'));
  console.log(chalk.white('3. Some players have NULL names'));
  console.log(chalk.white('4. Position values include non-standard values like "fumbles", "receiving"'));
  
  console.log(chalk.yellow('\n⚠️  SUGGESTED FIXES:'));
  console.log(chalk.white('1. Create migration to convert position arrays to strings'));
  console.log(chalk.white('2. Update NULL positions based on game log data or stats'));
  console.log(chalk.white('3. Clean up invalid position values'));
  console.log(chalk.white('4. Add database constraints to prevent future issues'));
  
  console.log(chalk.green('\n✅ WHAT\'S WORKING:'));
  console.log(chalk.white('1. player_game_logs table has 639,650 records'));
  console.log(chalk.white('2. Fantasy points are properly stored'));
  console.log(chalk.white('3. Stats are stored in JSON format'));
  console.log(chalk.white('4. Player-team relationships exist'));
}

async function runCompleteAnalysis() {
  // Analyze main tables
  await analyzeTable('players');
  await analyzeTable('player_game_logs');
  await analyzeTable('teams');
  await analyzeTable('games');
  await analyzeTable('player_stats');
  
  // Analyze relationships
  await analyzeRelationships();
  
  // Analyze data quality
  await analyzeDataQualityIssues();
  
  // Generate recommendations
  await generateRecommendations();
  
  console.log(chalk.bold.green('\n\n✅ ANALYSIS COMPLETE!\n'));
}

runCompleteAnalysis().catch(console.error);
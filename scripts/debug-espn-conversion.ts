#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function debugESPNConversion() {
  console.log(chalk.bold.red('\n🔍 DEBUGGING ESPN CONVERSION ISSUE\n'));
  console.log(chalk.gray('━'.repeat(60)));
  
  try {
    // 1. Analyze player_stats structure
    console.log(chalk.yellow('📊 Analyzing player_stats table structure...\n'));
    
    const { data: samples } = await supabase
      .from('player_stats')
      .select('*')
      .limit(20);
    
    // Count different stat_type values
    const statTypes = new Map<string, number>();
    const statValueTypes = new Map<string, Set<string>>();
    
    samples?.forEach(sample => {
      const type = sample.stat_type || 'NULL';
      statTypes.set(type, (statTypes.get(type) || 0) + 1);
      
      // Check value type
      if (!statValueTypes.has(type)) {
        statValueTypes.set(type, new Set());
      }
      
      const valueType = typeof sample.stat_value;
      statValueTypes.get(type)?.add(valueType);
      
      // Show examples
      if (statTypes.get(type) === 1) {
        console.log(chalk.cyan(`\nExample of stat_type "${type}":`));
        console.log(chalk.white('ID:'), sample.id);
        console.log(chalk.white('Player ID:'), sample.player_id);
        console.log(chalk.white('Game ID:'), sample.game_id);
        console.log(chalk.white('Stat Type:'), sample.stat_type);
        console.log(chalk.white('Stat Value:'), sample.stat_value);
        console.log(chalk.white('Value Type:'), typeof sample.stat_value);
        
        // Try to parse if it's a string
        if (typeof sample.stat_value === 'string' && sample.stat_value.startsWith('{')) {
          try {
            const parsed = JSON.parse(sample.stat_value);
            console.log(chalk.green('Parsed Value:'), parsed);
          } catch (e) {
            console.log(chalk.red('Parse Error:'), e.message);
          }
        }
        console.log(chalk.gray('─'.repeat(40)));
      }
    });
    
    // 2. Show stat type distribution
    console.log(chalk.yellow('\n📈 Stat Type Distribution:\n'));
    Array.from(statTypes.entries()).forEach(([type, count]) => {
      const valueTypes = Array.from(statValueTypes.get(type) || []).join(', ');
      console.log(chalk.white(`${type.padEnd(20)}: ${count} (value types: ${valueTypes})`));
    });
    
    // 3. Check for ESPN format data
    console.log(chalk.yellow('\n🏀 Checking for ESPN format data...\n'));
    
    const espnStatTypes = ['fieldGoals', 'threePointers', 'freeThrows', 'offensiveRebounds', 
                          'defensiveRebounds', 'plusMinus', 'minutes', 'points', 'rebounds', 
                          'assists', 'steals', 'blocks', 'turnovers', 'fouls'];
    
    for (const espnType of espnStatTypes) {
      const { count } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('stat_type', espnType);
      
      if (count && count > 0) {
        console.log(chalk.green(`✓ Found ${count} records with ESPN stat_type: ${espnType}`));
      }
    }
    
    // 4. Look for the actual ESPN data
    const { data: espnData } = await supabase
      .from('player_stats')
      .select('*')
      .in('stat_type', espnStatTypes)
      .limit(10);
    
    if (espnData && espnData.length > 0) {
      console.log(chalk.yellow('\n🎯 Found ESPN format data! Examples:\n'));
      espnData.forEach(d => {
        console.log(chalk.white(`Player ${d.player_id}, Game ${d.game_id}: ${d.stat_type} = ${d.stat_value}`));
      });
    }
    
    // 5. Check what needs conversion
    console.log(chalk.yellow('\n🔄 Identifying data that needs conversion...\n'));
    
    const needsConversion = ['game_totals', 'complete', 'stats'];
    
    for (const type of needsConversion) {
      const { count, data: sample } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact' })
        .eq('stat_type', type)
        .limit(1);
      
      if (count && count > 0) {
        console.log(chalk.cyan(`\n"${type}" format: ${count} records need conversion`));
        
        if (sample && sample[0]) {
          console.log(chalk.white('Sample value:'), sample[0].stat_value);
          
          // Try to parse and show structure
          try {
            const parsed = JSON.parse(sample[0].stat_value);
            console.log(chalk.green('Contains:'), Object.keys(parsed).join(', '));
          } catch {}
        }
      }
    }
    
    // 6. Final diagnosis
    console.log(chalk.gray('\n━'.repeat(60)));
    console.log(chalk.bold.green('\n🎯 DIAGNOSIS:\n'));
    
    console.log(chalk.yellow('The issue is:'));
    console.log(chalk.white('1. Most data is in "game_totals" format with JSON strings'));
    console.log(chalk.white('2. These need to be parsed and split into individual ESPN-style records'));
    console.log(chalk.white('3. The conversion script needs to handle JSON parsing correctly'));
    console.log(chalk.white('\nI\'ll create a fixed conversion script that properly handles this format.'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  }
}

// Run debug
debugESPNConversion();
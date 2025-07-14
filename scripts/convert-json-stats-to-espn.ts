#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Standard to ESPN stat mapping
const TO_ESPN_MAPPING: Record<string, string> = {
  'points': 'points',
  'rebounds': 'rebounds',
  'assists': 'assists',
  'steals': 'steals',
  'blocks': 'blocks',
  'turnovers': 'turnovers',
  'minutes': 'minutes',
  'field_goals_made': 'fieldGoals',
  'field_goals_attempted': 'fieldGoals',
  'three_pointers_made': 'threePointers',
  'three_pointers_attempted': 'threePointers',
  'free_throws_made': 'freeThrows',
  'free_throws_attempted': 'freeThrows',
  'offensive_rebounds': 'offensiveRebounds',
  'defensive_rebounds': 'defensiveRebounds',
  'personal_fouls': 'fouls',
  'plus_minus': 'plusMinus'
};

async function convertJSONStatsToESPN() {
  console.log(chalk.bold.cyan('\n🔄 CONVERTING JSON STATS TO ESPN FORMAT\n'));
  console.log(chalk.gray('━'.repeat(60)));
  
  try {
    // Get existing ESPN data count
    const { count: existingESPN } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .in('stat_type', ['points', 'rebounds', 'assists', 'fieldGoals', 'threePointers']);
    
    console.log(chalk.green(`✅ Already have ${existingESPN?.toLocaleString()} ESPN format records\n`));
    
    // Process game_totals format
    console.log(chalk.yellow('📊 Converting "game_totals" format...\n'));
    
    const { data: gameTotals } = await supabase
      .from('player_stats')
      .select('*')
      .eq('stat_type', 'game_totals')
      .limit(1000);
    
    let convertedCount = 0;
    const newStats: any[] = [];
    
    for (const record of gameTotals || []) {
      try {
        const stats = JSON.parse(record.stat_value);
        
        // Convert each stat to ESPN format
        for (const [key, value] of Object.entries(stats)) {
          const espnType = TO_ESPN_MAPPING[key] || key;
          
          newStats.push({
            player_id: record.player_id,
            game_id: record.game_id,
            stat_type: espnType,
            stat_value: String(value),
            fantasy_points: record.fantasy_points,
            created_at: record.created_at
          });
        }
        
        convertedCount++;
      } catch (e) {
        console.error(chalk.red(`Error parsing game_totals for record ${record.id}`));
      }
    }
    
    // Insert new ESPN format stats
    if (newStats.length > 0) {
      const CHUNK_SIZE = 100;
      for (let i = 0; i < newStats.length; i += CHUNK_SIZE) {
        const chunk = newStats.slice(i, i + CHUNK_SIZE);
        
        const { error } = await supabase
          .from('player_stats')
          .insert(chunk);
        
        if (error) {
          console.error(chalk.red('Insert error:'), error);
        }
      }
    }
    
    console.log(chalk.green(`✅ Converted ${convertedCount} game_totals records to ${newStats.length} ESPN format records\n`));
    
    // Process "complete" format
    console.log(chalk.yellow('📊 Converting "complete" format...\n'));
    
    const { data: completeStats } = await supabase
      .from('player_stats')
      .select('*')
      .eq('stat_type', 'complete')
      .limit(1000);
    
    const completeNewStats: any[] = [];
    let completeConverted = 0;
    
    for (const record of completeStats || []) {
      try {
        const stats = JSON.parse(record.stat_value);
        
        // Convert each stat
        for (const [key, value] of Object.entries(stats)) {
          const espnType = TO_ESPN_MAPPING[key] || key;
          
          // Handle special cases
          if (key === 'field_goals_made' || key === 'three_pointers_made' || key === 'free_throws_made') {
            // Skip these, we'll handle them with the attempted values
            continue;
          }
          
          if (key === 'field_goals_attempted') {
            const made = stats.field_goals_made || 0;
            completeNewStats.push({
              player_id: record.player_id,
              game_id: record.game_id,
              stat_type: 'fieldGoals',
              stat_value: `${made}-${value}`,
              created_at: record.created_at
            });
          } else if (key === 'three_pointers_attempted') {
            const made = stats.three_pointers_made || 0;
            completeNewStats.push({
              player_id: record.player_id,
              game_id: record.game_id,
              stat_type: 'threePointers',
              stat_value: `${made}-${value}`,
              created_at: record.created_at
            });
          } else if (key === 'free_throws_attempted') {
            const made = stats.free_throws_made || 0;
            completeNewStats.push({
              player_id: record.player_id,
              game_id: record.game_id,
              stat_type: 'freeThrows',
              stat_value: `${made}-${value}`,
              created_at: record.created_at
            });
          } else {
            completeNewStats.push({
              player_id: record.player_id,
              game_id: record.game_id,
              stat_type: espnType,
              stat_value: String(value),
              created_at: record.created_at
            });
          }
        }
        
        completeConverted++;
      } catch (e) {
        console.error(chalk.red(`Error parsing complete for record ${record.id}`));
      }
    }
    
    // Insert complete format conversions
    if (completeNewStats.length > 0) {
      const CHUNK_SIZE = 100;
      for (let i = 0; i < completeNewStats.length; i += CHUNK_SIZE) {
        const chunk = completeNewStats.slice(i, i + CHUNK_SIZE);
        
        const { error } = await supabase
          .from('player_stats')
          .insert(chunk);
        
        if (error) {
          console.error(chalk.red('Insert error:'), error);
        }
      }
    }
    
    console.log(chalk.green(`✅ Converted ${completeConverted} complete records to ${completeNewStats.length} ESPN format records\n`));
    
    // Delete original JSON records after successful conversion
    console.log(chalk.yellow('🗑️  Cleaning up original JSON records...\n'));
    
    const { error: deleteError } = await supabase
      .from('player_stats')
      .delete()
      .in('stat_type', ['game_totals', 'complete'])
      .in('id', [...(gameTotals?.map(g => g.id) || []), ...(completeStats?.map(c => c.id) || [])]);
    
    if (deleteError) {
      console.error(chalk.red('Delete error:'), deleteError);
    } else {
      console.log(chalk.green('✅ Cleaned up original JSON records\n'));
    }
    
    // Final count
    const { count: finalESPN } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .in('stat_type', ['points', 'rebounds', 'assists', 'fieldGoals', 'threePointers']);
    
    console.log(chalk.gray('━'.repeat(60)));
    console.log(chalk.bold.green('\n🎉 CONVERSION COMPLETE!\n'));
    
    console.log(chalk.white('📊 Results:'));
    console.log(chalk.gray(`├─ Starting ESPN records: ${existingESPN?.toLocaleString()}`));
    console.log(chalk.gray(`├─ Final ESPN records: ${finalESPN?.toLocaleString()}`));
    console.log(chalk.gray(`├─ New records created: ${((finalESPN || 0) - (existingESPN || 0)).toLocaleString()}`));
    console.log(chalk.gray(`└─ All data now in ESPN format!\n`));
    
    // Show how to query the data
    console.log(chalk.white('🚀 Query Examples:'));
    console.log(chalk.cyan(`
// Get all stats for a player
const { data } = await supabase
  .from('player_stats')
  .select('*')
  .eq('player_id', 121463699)
  .order('created_at', { ascending: false });

// Get specific stat types
const { data: shootingStats } = await supabase
  .from('player_stats')
  .select('*')
  .in('stat_type', ['fieldGoals', 'threePointers', 'freeThrows']);

// Aggregate for ML
const { data: mlData } = await supabase
  .from('player_stats')
  .select('player_id, game_id, stat_type, stat_value')
  .eq('stat_type', 'points')
  .order('stat_value', { ascending: false });
    `));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  }
}

// Run conversion
convertJSONStatsToESPN();
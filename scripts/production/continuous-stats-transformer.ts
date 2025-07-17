#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

let isRunning = true;
let totalCreatedSession = 0;
let totalUpdatedSession = 0;

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n🛑 Shutting down gracefully...'));
  isRunning = false;
});

async function continuousStatsTransformer() {
  console.log(chalk.bold.cyan('\n♻️  CONTINUOUS STATS TRANSFORMER - RUNNING UNTIL STOPPED\n'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log(chalk.yellow('Press Ctrl+C to stop at any time\n'));
  
  const BATCH_SIZE = 100;
  const CYCLE_DELAY = 30000; // 30 seconds between cycles
  const QUERY_DELAY = 300; // 300ms between queries
  let cycleCount = 0;
  
  while (isRunning) {
    cycleCount++;
    console.log(chalk.bold.green(`\n🔄 CYCLE ${cycleCount} STARTING...\n`));
    
    try {
      // Phase 1: Update existing empty logs
      const updatedCount = await updateEmptyLogs(BATCH_SIZE, QUERY_DELAY);
      
      // Phase 2: Create new logs from orphaned stats
      const createdCount = await createNewLogs(BATCH_SIZE, QUERY_DELAY);
      
      // Update session totals
      totalUpdatedSession += updatedCount;
      totalCreatedSession += createdCount;
      
      // Show cycle results
      console.log(chalk.gray('\n' + '─'.repeat(40)));
      console.log(chalk.green(`✅ Cycle ${cycleCount} Complete:`));
      console.log(chalk.white(`   Updated: ${updatedCount}, Created: ${createdCount}`));
      console.log(chalk.white(`   Session totals - Updated: ${totalUpdatedSession}, Created: ${totalCreatedSession}\n`));
      
      // Check coverage
      const coverage = await checkCoverage();
      
      // Wait before next cycle
      if (isRunning) {
        console.log(chalk.gray(`💤 Waiting ${CYCLE_DELAY/1000}s before next cycle...\n`));
        await new Promise(resolve => setTimeout(resolve, CYCLE_DELAY));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Cycle error:'), error);
      console.log(chalk.yellow('Continuing in 60 seconds...'));
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
  }
  
  // Final report
  console.log(chalk.gray('\n' + '━'.repeat(60)));
  console.log(chalk.bold.green('\n📊 SESSION SUMMARY:'));
  console.log(chalk.white(`├─ Total cycles: ${cycleCount}`));
  console.log(chalk.white(`├─ Logs updated: ${chalk.green.bold(totalUpdatedSession)}`));
  console.log(chalk.white(`├─ Logs created: ${chalk.blue.bold(totalCreatedSession)}`));
  console.log(chalk.white(`└─ Total improvements: ${chalk.bold((totalUpdatedSession + totalCreatedSession).toLocaleString())}\n`));
}

async function updateEmptyLogs(batchSize: number, queryDelay: number): Promise<number> {
  let updated = 0;
  
  try {
    // Find logs with empty stats
    const { data: emptyLogs } = await supabase
      .from('player_game_logs')
      .select('id, player_id, game_id, stats')
      .or('stats.is.null,stats.eq.{}')
      .limit(batchSize);
    
    if (!emptyLogs || emptyLogs.length === 0) return 0;
    
    console.log(chalk.yellow(`📝 Updating ${emptyLogs.length} empty logs...`));
    
    for (const log of emptyLogs) {
      // Skip if already has stats
      if (log.stats && Object.keys(log.stats).length > 5) continue;
      
      // Get stats
      const { data: stats } = await supabase
        .from('player_stats')
        .select('*')
        .eq('player_id', log.player_id)
        .eq('game_id', log.game_id);
      
      if (!stats || stats.length === 0) continue;
      
      const aggregated = aggregateStats(stats);
      
      // Update log
      const { error } = await supabase
        .from('player_game_logs')
        .update({
          stats: aggregated,
          fantasy_points: aggregated.fantasy_points,
          minutes_played: aggregated.minutes_played,
          updated_at: new Date().toISOString()
        })
        .eq('id', log.id);
      
      if (!error) updated++;
      
      await new Promise(resolve => setTimeout(resolve, queryDelay));
    }
    
  } catch (error) {
    console.error(chalk.red('Update error:'), error);
  }
  
  return updated;
}

async function createNewLogs(batchSize: number, queryDelay: number): Promise<number> {
  let created = 0;
  
  try {
    // Find stats without logs
    const { data: orphanedStats } = await supabase
      .from('player_stats')
      .select('player_id, game_id')
      .limit(batchSize * 2);
    
    if (!orphanedStats || orphanedStats.length === 0) return 0;
    
    // Deduplicate
    const unique = new Map<string, any>();
    orphanedStats.forEach(s => {
      const key = `${s.player_id}-${s.game_id}`;
      if (!unique.has(key)) unique.set(key, s);
    });
    
    const toCheck = Array.from(unique.values()).slice(0, batchSize);
    console.log(chalk.yellow(`🔍 Checking ${toCheck.length} potential new logs...`));
    
    for (const combo of toCheck) {
      // Check if log exists
      const { data: existing } = await supabase
        .from('player_game_logs')
        .select('id')
        .eq('player_id', combo.player_id)
        .eq('game_id', combo.game_id)
        .maybeSingle();
      
      if (existing) continue;
      
      // Get stats
      const { data: stats } = await supabase
        .from('player_stats')
        .select('*')
        .eq('player_id', combo.player_id)
        .eq('game_id', combo.game_id);
      
      if (!stats || stats.length === 0) continue;
      
      const aggregated = aggregateStats(stats);
      
      // Get game info
      const { data: game } = await supabase
        .from('games')
        .select('start_time, home_team_id, away_team_id')
        .eq('id', combo.game_id)
        .maybeSingle();
      
      if (!game) continue;
      
      // Create log
      const { error } = await supabase
        .from('player_game_logs')
        .insert({
          player_id: combo.player_id,
          game_id: combo.game_id,
          team_id: game.home_team_id,
          game_date: game.start_time,
          opponent_id: game.away_team_id,
          is_home: true,
          minutes_played: aggregated.minutes_played,
          stats: aggregated,
          fantasy_points: aggregated.fantasy_points,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (!error) created++;
      
      await new Promise(resolve => setTimeout(resolve, queryDelay));
    }
    
  } catch (error) {
    console.error(chalk.red('Create error:'), error);
  }
  
  return created;
}

function aggregateStats(stats: any[]): any {
  const result: any = {
    points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0,
    turnovers: 0, field_goals_made: 0, field_goals_attempted: 0,
    three_pointers_made: 0, three_pointers_attempted: 0,
    free_throws_made: 0, free_throws_attempted: 0,
    minutes_played: 0, personal_fouls: 0, plus_minus: 0,
    fantasy_points: 0
  };
  
  const map: Record<string, string> = {
    'points': 'points', 'pts': 'points',
    'rebounds': 'rebounds', 'reb': 'rebounds',
    'assists': 'assists', 'ast': 'assists',
    'steals': 'steals', 'stl': 'steals',
    'blocks': 'blocks', 'blk': 'blocks',
    'turnovers': 'turnovers', 'to': 'turnovers',
    'field_goals_made': 'field_goals_made', 'fgm': 'field_goals_made',
    'field_goals_attempted': 'field_goals_attempted', 'fga': 'field_goals_attempted',
    'three_pointers_made': 'three_pointers_made', '3pm': 'three_pointers_made',
    'three_pointers_attempted': 'three_pointers_attempted', '3pa': 'three_pointers_attempted',
    'free_throws_made': 'free_throws_made', 'ftm': 'free_throws_made',
    'free_throws_attempted': 'free_throws_attempted', 'fta': 'free_throws_attempted',
    'minutes': 'minutes_played', 'min': 'minutes_played',
    'personal_fouls': 'personal_fouls', 'pf': 'personal_fouls',
    'plus_minus': 'plus_minus', '+/-': 'plus_minus'
  };
  
  stats.forEach(stat => {
    const key = map[stat.stat_type?.toLowerCase()];
    if (key) result[key] = parseFloat(stat.stat_value) || 0;
    if (stat.fantasy_points) result.fantasy_points = Math.max(result.fantasy_points, stat.fantasy_points);
  });
  
  if (result.fantasy_points === 0) {
    result.fantasy_points = result.points + (result.rebounds * 1.2) + 
      (result.assists * 1.5) + (result.steals * 3) + (result.blocks * 3) - result.turnovers;
  }
  
  return result;
}

async function checkCoverage(): Promise<number> {
  const { count: total } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  const { data: sample } = await supabase
    .from('player_game_logs')
    .select('stats')
    .limit(1000);
  
  let usable = 0;
  sample?.forEach(log => {
    if (log.stats && Object.keys(log.stats).length > 5) usable++;
  });
  
  const estimated = Math.round((usable / 1000) * (total || 0));
  const coverage = (estimated / (total || 1) * 100).toFixed(1);
  
  console.log(chalk.cyan(`📊 Coverage: ${chalk.bold(coverage + '%')} (${estimated.toLocaleString()}/${total?.toLocaleString()} usable)`));
  
  return parseFloat(coverage);
}

// Start the continuous transformer
continuousStatsTransformer();
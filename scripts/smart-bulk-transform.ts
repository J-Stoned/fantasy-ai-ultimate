#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function smartBulkTransform() {
  console.log(chalk.bold.cyan('\n🧠 SMART BULK TRANSFORMATION - RESPECTING QUERY LIMITS\n'));
  console.log(chalk.gray('━'.repeat(60)));
  
  const SAFE_BATCH_SIZE = 100; // Small batches to avoid limits
  const QUERY_DELAY = 500; // 500ms between queries
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  
  try {
    // First, get player_game_logs that need stats
    console.log(chalk.yellow('🔍 Finding game logs that need stats...\n'));
    
    // Get a sample of empty logs
    const { data: emptyLogs, error: logsError } = await supabase
      .from('player_game_logs')
      .select('id, player_id, game_id, stats')
      .or('stats.is.null,stats.eq.{}')
      .limit(1000);
    
    if (logsError) throw logsError;
    
    const logsNeedingStats = emptyLogs?.filter(log => 
      !log.stats || Object.keys(log.stats).length === 0
    ) || [];
    
    console.log(chalk.green(`✅ Found ${chalk.bold(logsNeedingStats.length)} game logs needing stats\n`));
    
    // Process in small batches with delays
    console.log(chalk.yellow('📊 Processing in small batches to respect query limits...\n'));
    
    const startTime = Date.now();
    
    for (let i = 0; i < logsNeedingStats.length; i += SAFE_BATCH_SIZE) {
      const batch = logsNeedingStats.slice(i, i + SAFE_BATCH_SIZE);
      
      // Process each item in the batch
      for (const log of batch) {
        try {
          // Get stats for this player-game combination
          const { data: stats, error: statsError } = await supabase
            .from('player_stats')
            .select('stat_type, stat_value, fantasy_points')
            .eq('player_id', log.player_id)
            .eq('game_id', log.game_id)
            .limit(50); // Limit stats per query
          
          if (statsError || !stats || stats.length === 0) {
            totalSkipped++;
            totalProcessed++;
            continue;
          }
          
          // Aggregate stats
          const aggregated = aggregateStatsEfficiently(stats);
          
          // Update the game log
          const { error: updateError } = await supabase
            .from('player_game_logs')
            .update({
              stats: aggregated,
              fantasy_points: aggregated.fantasy_points,
              minutes_played: aggregated.minutes_played,
              updated_at: new Date().toISOString()
            })
            .eq('id', log.id);
          
          if (!updateError) {
            totalUpdated++;
          } else {
            totalSkipped++;
          }
          
          totalProcessed++;
          
          // Add delay between queries
          await new Promise(resolve => setTimeout(resolve, QUERY_DELAY));
          
        } catch (error) {
          console.error(chalk.red(`Error processing log ${log.id}:`), error);
          totalSkipped++;
          totalProcessed++;
        }
      }
      
      // Progress update
      const progress = (totalProcessed / logsNeedingStats.length * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (totalProcessed / parseFloat(elapsed)).toFixed(2);
      
      console.log(chalk.green(`✅ Progress: ${totalProcessed}/${logsNeedingStats.length} (${progress}%)`));
      console.log(chalk.gray(`   Updated: ${totalUpdated}, Skipped: ${totalSkipped}`));
      console.log(chalk.gray(`   Speed: ${rate}/sec, Elapsed: ${elapsed}s\n`));
      
      // Longer pause between batches
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Now process some new combinations that don't have logs yet
    console.log(chalk.yellow('\n🆕 Creating new game logs for unprocessed stats...\n'));
    
    // Get a sample of stats without corresponding game logs
    const { data: statsWithoutLogs, error: statsError } = await supabase
      .from('player_stats')
      .select('player_id, game_id')
      .limit(500);
    
    if (!statsError && statsWithoutLogs) {
      const newCombos: Array<{player_id: number, game_id: number}> = [];
      
      // Check which ones don't have game logs
      for (const stat of statsWithoutLogs) {
        const { data: existingLog } = await supabase
          .from('player_game_logs')
          .select('id')
          .eq('player_id', stat.player_id)
          .eq('game_id', stat.game_id)
          .single();
        
        if (!existingLog) {
          newCombos.push({ player_id: stat.player_id, game_id: stat.game_id });
        }
        
        // Limit to 100 new records per run
        if (newCombos.length >= 100) break;
        
        // Delay between checks
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      console.log(chalk.green(`✅ Found ${newCombos.length} new combinations to create\n`));
      
      // Create new game logs
      for (const combo of newCombos) {
        try {
          // Get stats
          const { data: stats } = await supabase
            .from('player_stats')
            .select('*')
            .eq('player_id', combo.player_id)
            .eq('game_id', combo.game_id);
          
          if (!stats || stats.length === 0) continue;
          
          const aggregated = aggregateStatsEfficiently(stats);
          
          // Get game info
          const { data: gameInfo } = await supabase
            .from('games')
            .select('start_time, home_team_id, away_team_id')
            .eq('id', combo.game_id)
            .single();
          
          if (gameInfo) {
            const { error: insertError } = await supabase
              .from('player_game_logs')
              .insert({
                player_id: combo.player_id,
                game_id: combo.game_id,
                team_id: gameInfo.home_team_id,
                game_date: gameInfo.start_time,
                opponent_id: gameInfo.away_team_id,
                is_home: true,
                minutes_played: aggregated.minutes_played,
                stats: aggregated,
                fantasy_points: aggregated.fantasy_points,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            
            if (!insertError) {
              totalCreated++;
            } else {
              totalSkipped++;
            }
          }
          
          totalProcessed++;
          
          // Delay between operations
          await new Promise(resolve => setTimeout(resolve, QUERY_DELAY));
          
        } catch (error) {
          totalSkipped++;
          totalProcessed++;
        }
      }
    }
    
    // Final results
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.gray('━'.repeat(60)));
    console.log(chalk.bold.green(`\n🎯 SMART TRANSFORMATION COMPLETE!`));
    console.log(chalk.white(`├─ Total processed: ${chalk.bold(totalProcessed.toLocaleString())}`));
    console.log(chalk.white(`├─ Records updated: ${chalk.green.bold(totalUpdated.toLocaleString())}`));
    console.log(chalk.white(`├─ Records created: ${chalk.blue.bold(totalCreated.toLocaleString())}`));
    console.log(chalk.white(`├─ Records skipped: ${chalk.gray(totalSkipped.toLocaleString())}`));
    console.log(chalk.white(`├─ Success rate: ${chalk.green.bold(((totalUpdated + totalCreated) / totalProcessed * 100).toFixed(1) + '%')}`));
    console.log(chalk.white(`└─ Total time: ${chalk.cyan.bold(totalTime + ' seconds')}\n`));
    
    // Check new coverage
    await checkCoverage();
    
    // Recommendations
    console.log(chalk.yellow('💡 RECOMMENDATIONS:\n'));
    console.log(chalk.white('1. Run this script multiple times to process more data'));
    console.log(chalk.white('2. Each run processes ~1000 records safely within query limits'));
    console.log(chalk.white('3. Schedule hourly runs to gradually transform all data'));
    console.log(chalk.white('4. Monitor progress with stats-usage-dashboard.ts\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  }
}

function aggregateStatsEfficiently(stats: any[]): any {
  const result: any = {
    points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0,
    turnovers: 0, field_goals_made: 0, field_goals_attempted: 0,
    three_pointers_made: 0, three_pointers_attempted: 0,
    free_throws_made: 0, free_throws_attempted: 0,
    minutes_played: 0, personal_fouls: 0, plus_minus: 0,
    fantasy_points: 0
  };
  
  // Simple mapping
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
    if (key && key in result) {
      result[key] = parseFloat(stat.stat_value) || 0;
    }
    if (stat.fantasy_points) {
      result.fantasy_points = Math.max(result.fantasy_points, stat.fantasy_points);
    }
  });
  
  // Calculate fantasy points if missing
  if (result.fantasy_points === 0 && result.points > 0) {
    result.fantasy_points = 
      result.points + 
      (result.rebounds * 1.2) + 
      (result.assists * 1.5) + 
      (result.steals * 3) + 
      (result.blocks * 3) - 
      result.turnovers;
  }
  
  return result;
}

async function checkCoverage() {
  console.log(chalk.yellow('📈 CHECKING STATS COVERAGE...\n'));
  
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  const { data: sample } = await supabase
    .from('player_game_logs')
    .select('stats')
    .limit(1000);
  
  let usableCount = 0;
  sample?.forEach(log => {
    if (log.stats && Object.keys(log.stats).length > 5) {
      usableCount++;
    }
  });
  
  const estimatedUsable = Math.round((usableCount / 1000) * (totalLogs || 0));
  const coverage = (estimatedUsable / (totalLogs || 1) * 100).toFixed(1);
  
  console.log(chalk.bold.green(`✨ CURRENT STATS COVERAGE:`));
  console.log(chalk.white(`├─ Total player_game_logs: ${chalk.bold(totalLogs?.toLocaleString())}`));
  console.log(chalk.white(`├─ Estimated usable stats: ${chalk.bold(estimatedUsable.toLocaleString())}`));
  console.log(chalk.white(`└─ Coverage rate: ${chalk.bold.green(coverage + '%')}\n`));
  
  return parseFloat(coverage);
}

// Run the smart transformation
smartBulkTransform();
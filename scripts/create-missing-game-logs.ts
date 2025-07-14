#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createMissingGameLogs() {
  console.log(chalk.bold.magenta('\n🆕 CREATING MISSING GAME LOGS FROM STATS DATA\n'));
  console.log(chalk.gray('━'.repeat(60)));
  
  const BATCH_SIZE = 50; // Small batches
  const QUERY_DELAY = 300; // 300ms between queries
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalProcessed = 0;
  
  try {
    // Step 1: Find player_stats records without corresponding game_logs
    console.log(chalk.yellow('🔍 Finding stats without game logs...\n'));
    
    // Get a sample of player_stats
    const { data: statsRecords, error: statsError } = await supabase
      .from('player_stats')
      .select('player_id, game_id')
      .not('game_id', 'is', null)
      .not('player_id', 'is', null)
      .order('game_id', { ascending: false })
      .limit(5000);
    
    if (statsError) throw statsError;
    
    // Deduplicate
    const uniqueCombos = new Map<string, {player_id: number, game_id: number}>();
    statsRecords?.forEach(record => {
      const key = `${record.player_id}-${record.game_id}`;
      if (!uniqueCombos.has(key)) {
        uniqueCombos.set(key, record);
      }
    });
    
    const combosToCheck = Array.from(uniqueCombos.values());
    console.log(chalk.green(`✅ Found ${combosToCheck.length} unique player-game combinations to check\n`));
    
    // Step 2: Check which ones are missing game logs
    console.log(chalk.yellow('🔍 Checking for missing game logs...\n'));
    
    const missingLogs: Array<{player_id: number, game_id: number}> = [];
    const startTime = Date.now();
    
    // Check in batches
    for (let i = 0; i < Math.min(combosToCheck.length, 1000); i += BATCH_SIZE) {
      const batch = combosToCheck.slice(i, i + BATCH_SIZE);
      
      // Check each combination
      for (const combo of batch) {
        const { data: existingLog } = await supabase
          .from('player_game_logs')
          .select('id')
          .eq('player_id', combo.player_id)
          .eq('game_id', combo.game_id)
          .maybeSingle();
        
        if (!existingLog) {
          missingLogs.push(combo);
        }
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Progress
      if (i > 0 && i % 200 === 0) {
        console.log(chalk.gray(`Checked ${i}/${Math.min(combosToCheck.length, 1000)} combinations...`));
      }
    }
    
    console.log(chalk.green(`\n✅ Found ${chalk.bold(missingLogs.length)} missing game logs to create\n`));
    
    // Step 3: Create missing game logs
    console.log(chalk.yellow('📝 Creating missing game logs with aggregated stats...\n'));
    
    for (const combo of missingLogs.slice(0, 500)) { // Limit to 500 per run
      try {
        // Get all stats for this player-game
        const { data: stats, error: statsErr } = await supabase
          .from('player_stats')
          .select('*')
          .eq('player_id', combo.player_id)
          .eq('game_id', combo.game_id);
        
        if (statsErr || !stats || stats.length === 0) {
          totalSkipped++;
          totalProcessed++;
          continue;
        }
        
        // Aggregate stats
        const aggregated = aggregatePlayerStats(stats);
        
        // Get game info
        const { data: gameInfo, error: gameErr } = await supabase
          .from('games')
          .select('start_time, home_team_id, away_team_id, sport_id')
          .eq('id', combo.game_id)
          .maybeSingle();
        
        if (gameErr || !gameInfo) {
          totalSkipped++;
          totalProcessed++;
          continue;
        }
        
        // Determine team (try to get from stats or default to home)
        let teamId = gameInfo.home_team_id;
        const teamStat = stats.find(s => s.team_id);
        if (teamStat?.team_id) {
          teamId = teamStat.team_id;
        }
        
        const isHome = teamId === gameInfo.home_team_id;
        const opponentId = isHome ? gameInfo.away_team_id : gameInfo.home_team_id;
        
        // Create game log
        const newLog = {
          player_id: combo.player_id,
          game_id: combo.game_id,
          team_id: teamId,
          game_date: gameInfo.start_time,
          opponent_id: opponentId,
          is_home: isHome,
          minutes_played: aggregated.minutes_played || 0,
          stats: aggregated,
          fantasy_points: aggregated.fantasy_points || 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { error: insertErr } = await supabase
          .from('player_game_logs')
          .insert(newLog);
        
        if (!insertErr) {
          totalCreated++;
          if (totalCreated % 10 === 0) {
            console.log(chalk.green(`✅ Created ${totalCreated} game logs...`));
          }
        } else {
          totalSkipped++;
          if (insertErr.code !== '23505') { // Not a duplicate key error
            console.error(chalk.red(`Insert error: ${insertErr.message}`));
          }
        }
        
        totalProcessed++;
        
        // Delay between inserts
        await new Promise(resolve => setTimeout(resolve, QUERY_DELAY));
        
      } catch (error) {
        console.error(chalk.red('Processing error:'), error);
        totalSkipped++;
        totalProcessed++;
      }
    }
    
    // Final results
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.gray('\n' + '━'.repeat(60)));
    console.log(chalk.bold.green(`\n🎯 GAME LOG CREATION COMPLETE!`));
    console.log(chalk.white(`├─ Total processed: ${chalk.bold(totalProcessed)}`));
    console.log(chalk.white(`├─ Game logs created: ${chalk.green.bold(totalCreated)}`));
    console.log(chalk.white(`├─ Skipped/errors: ${chalk.gray(totalSkipped)}`));
    console.log(chalk.white(`├─ Success rate: ${chalk.green.bold(((totalCreated / totalProcessed) * 100).toFixed(1) + '%')}`));
    console.log(chalk.white(`└─ Total time: ${chalk.cyan.bold(totalTime + ' seconds')}\n`));
    
    // Check new coverage
    await checkNewCoverage();
    
    // Next steps
    if (totalCreated > 0) {
      console.log(chalk.yellow('🚀 GREAT PROGRESS!\n'));
      console.log(chalk.white('Run this script again to create more missing game logs.'));
      console.log(chalk.white('Each run safely creates up to 500 new records.\n'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  }
}

function aggregatePlayerStats(stats: any[]): any {
  const result: any = {
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    field_goals_made: 0,
    field_goals_attempted: 0,
    three_pointers_made: 0,
    three_pointers_attempted: 0,
    free_throws_made: 0,
    free_throws_attempted: 0,
    minutes_played: 0,
    personal_fouls: 0,
    plus_minus: 0,
    offensive_rebounds: 0,
    defensive_rebounds: 0,
    fantasy_points: 0
  };
  
  const statTypeMap: Record<string, string> = {
    'points': 'points', 'pts': 'points',
    'rebounds': 'rebounds', 'reb': 'rebounds', 'total_rebounds': 'rebounds',
    'offensive_rebounds': 'offensive_rebounds', 'oreb': 'offensive_rebounds',
    'defensive_rebounds': 'defensive_rebounds', 'dreb': 'defensive_rebounds',
    'assists': 'assists', 'ast': 'assists',
    'steals': 'steals', 'stl': 'steals',
    'blocks': 'blocks', 'blk': 'blocks',
    'turnovers': 'turnovers', 'to': 'turnovers', 'tov': 'turnovers',
    'field_goals_made': 'field_goals_made', 'fgm': 'field_goals_made',
    'field_goals_attempted': 'field_goals_attempted', 'fga': 'field_goals_attempted',
    'three_pointers_made': 'three_pointers_made', '3pm': 'three_pointers_made',
    'three_point_field_goals_made': 'three_pointers_made',
    'three_pointers_attempted': 'three_pointers_attempted', '3pa': 'three_pointers_attempted',
    'three_point_field_goals_attempted': 'three_pointers_attempted',
    'free_throws_made': 'free_throws_made', 'ftm': 'free_throws_made',
    'free_throws_attempted': 'free_throws_attempted', 'fta': 'free_throws_attempted',
    'minutes': 'minutes_played', 'min': 'minutes_played', 'minutes_played': 'minutes_played',
    'personal_fouls': 'personal_fouls', 'pf': 'personal_fouls', 'fouls': 'personal_fouls',
    'plus_minus': 'plus_minus', '+/-': 'plus_minus', 'plus/minus': 'plus_minus'
  };
  
  // Aggregate all stats
  stats.forEach(stat => {
    const statType = stat.stat_type?.toLowerCase().replace(/[\s-]+/g, '_');
    const mappedKey = statTypeMap[statType];
    
    if (mappedKey && mappedKey in result) {
      result[mappedKey] = parseFloat(stat.stat_value) || 0;
    }
    
    // Capture fantasy points
    if (stat.fantasy_points && stat.fantasy_points > result.fantasy_points) {
      result.fantasy_points = stat.fantasy_points;
    }
  });
  
  // Calculate fantasy points if not present
  if (result.fantasy_points === 0 && (result.points > 0 || result.rebounds > 0)) {
    result.fantasy_points = 
      result.points +
      (result.rebounds * 1.2) +
      (result.assists * 1.5) +
      (result.steals * 3) +
      (result.blocks * 3) -
      (result.turnovers * 1);
  }
  
  // Calculate shooting percentages
  if (result.field_goals_attempted > 0) {
    result.field_goal_percentage = result.field_goals_made / result.field_goals_attempted;
  }
  if (result.three_pointers_attempted > 0) {
    result.three_point_percentage = result.three_pointers_made / result.three_pointers_attempted;
  }
  if (result.free_throws_attempted > 0) {
    result.free_throw_percentage = result.free_throws_made / result.free_throws_attempted;
  }
  
  return result;
}

async function checkNewCoverage() {
  console.log(chalk.yellow('📈 CHECKING NEW COVERAGE...\n'));
  
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
  
  const { data: sample } = await supabase
    .from('player_game_logs')
    .select('stats')
    .limit(1000);
  
  let populatedCount = 0;
  sample?.forEach(log => {
    if (log.stats && Object.keys(log.stats).length > 5) {
      populatedCount++;
    }
  });
  
  const estimatedUsable = Math.round((populatedCount / 1000) * (totalLogs || 0));
  const coverage = (estimatedUsable / (totalLogs || 1) * 100).toFixed(1);
  
  console.log(chalk.bold.cyan(`📊 STATS COVERAGE REPORT:`));
  console.log(chalk.white(`├─ Total player_stats records: ${chalk.bold(totalStats?.toLocaleString())}`));
  console.log(chalk.white(`├─ Total player_game_logs: ${chalk.bold(totalLogs?.toLocaleString())}`));
  console.log(chalk.white(`├─ Logs with usable stats: ${chalk.bold(estimatedUsable.toLocaleString())}`));
  console.log(chalk.white(`└─ Coverage percentage: ${chalk.bold.green(coverage + '%')}\n`));
}

// Run the script
createMissingGameLogs();
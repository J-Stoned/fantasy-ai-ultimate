#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Comprehensive stat type mapping
const STAT_MAPPING: Record<string, string> = {
  // Points
  'points': 'points',
  'pts': 'points',
  'total_points': 'points',
  
  // Rebounds
  'rebounds': 'rebounds',
  'reb': 'rebounds',
  'total_rebounds': 'rebounds',
  'offensive_rebounds': 'offensive_rebounds',
  'defensive_rebounds': 'defensive_rebounds',
  
  // Assists
  'assists': 'assists',
  'ast': 'assists',
  
  // Steals & Blocks
  'steals': 'steals',
  'stl': 'steals',
  'blocks': 'blocks',
  'blk': 'blocks',
  
  // Turnovers
  'turnovers': 'turnovers',
  'to': 'turnovers',
  'tov': 'turnovers',
  
  // Field Goals
  'field_goals_made': 'field_goals_made',
  'fgm': 'field_goals_made',
  'field_goals_attempted': 'field_goals_attempted',
  'fga': 'field_goals_attempted',
  'field_goal_percentage': 'field_goal_percentage',
  'fg_pct': 'field_goal_percentage',
  
  // Three Pointers
  'three_pointers_made': 'three_pointers_made',
  'three_point_field_goals_made': 'three_pointers_made',
  '3pm': 'three_pointers_made',
  'three_pointers_attempted': 'three_pointers_attempted',
  'three_point_field_goals_attempted': 'three_pointers_attempted',
  '3pa': 'three_pointers_attempted',
  'three_point_percentage': 'three_point_percentage',
  '3p_pct': 'three_point_percentage',
  
  // Free Throws
  'free_throws_made': 'free_throws_made',
  'ftm': 'free_throws_made',
  'free_throws_attempted': 'free_throws_attempted',
  'fta': 'free_throws_attempted',
  'free_throw_percentage': 'free_throw_percentage',
  'ft_pct': 'free_throw_percentage',
  
  // Minutes & Fouls
  'minutes': 'minutes_played',
  'min': 'minutes_played',
  'minutes_played': 'minutes_played',
  'personal_fouls': 'personal_fouls',
  'pf': 'personal_fouls',
  'fouls': 'personal_fouls',
  
  // Plus/Minus
  'plus_minus': 'plus_minus',
  '+/-': 'plus_minus',
  'plus/minus': 'plus_minus',
  
  // Fantasy
  'fantasy_total': 'fantasy_points',
  'fantasy_points': 'fantasy_points',
  'fantasy_points_total': 'fantasy_points',
  'fantasy_score': 'fantasy_points'
};

async function bulkTransformStats() {
  console.log('🚀 BULK STATS TRANSFORMATION - MAKING 3.6M STATS USABLE!\n');
  console.log('━'.repeat(60));
  
  const BATCH_SIZE = 5000; // Process 5K player-game combos at a time
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  
  try {
    // First, get summary of what we're dealing with
    const { count: totalPlayerStats } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 STATS INVENTORY:`);
    console.log(`├─ Total player_stats records: ${totalPlayerStats?.toLocaleString()}`);
    
    // Get all unique player-game combinations
    console.log(`└─ Fetching unique player-game combinations...\n`);
    
    const { data: uniqueCombos, error: comboError } = await supabase
      .from('player_stats')
      .select('player_id, game_id')
      .limit(100000); // Start with first 100K for testing
    
    if (comboError) throw comboError;
    
    // Deduplicate
    const uniqueMap = new Map<string, { player_id: number, game_id: number }>();
    uniqueCombos?.forEach(combo => {
      const key = `${combo.player_id}-${combo.game_id}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, combo);
      }
    });
    
    const combosToProcess = Array.from(uniqueMap.values());
    console.log(`📋 Found ${combosToProcess.length} unique player-game combinations to process\n`);
    
    // Process in batches
    for (let i = 0; i < combosToProcess.length; i += BATCH_SIZE) {
      const batch = combosToProcess.slice(i, i + BATCH_SIZE);
      const batchResults = await processBatch(batch);
      
      totalProcessed += batch.length;
      totalUpdated += batchResults.updated;
      totalCreated += batchResults.created;
      totalSkipped += batchResults.skipped;
      
      // Progress update
      const progress = (totalProcessed / combosToProcess.length * 100).toFixed(1);
      console.log(`✅ Progress: ${totalProcessed}/${combosToProcess.length} (${progress}%)`);
      console.log(`   Updated: ${totalUpdated}, Created: ${totalCreated}, Skipped: ${totalSkipped}\n`);
      
      // Small delay to avoid overwhelming the database
      if (i > 0 && i % 20000 === 0) {
        console.log('⏸️  Pausing for 2 seconds to avoid rate limits...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Final report
    console.log('━'.repeat(60));
    console.log(`\n🎯 TRANSFORMATION COMPLETE!`);
    console.log(`├─ Total processed: ${totalProcessed.toLocaleString()}`);
    console.log(`├─ Records updated: ${totalUpdated.toLocaleString()}`);
    console.log(`├─ Records created: ${totalCreated.toLocaleString()}`);
    console.log(`├─ Records skipped: ${totalSkipped.toLocaleString()}`);
    console.log(`└─ Success rate: ${((totalUpdated + totalCreated) / totalProcessed * 100).toFixed(1)}%\n`);
    
    // Verify new coverage
    await verifyNewCoverage();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function processBatch(batch: Array<{ player_id: number, game_id: number }>) {
  let updated = 0;
  let created = 0;
  let skipped = 0;
  
  // Fetch all stats for this batch
  const batchQueries = batch.map(combo => 
    supabase
      .from('player_stats')
      .select('*')
      .eq('player_id', combo.player_id)
      .eq('game_id', combo.game_id)
  );
  
  const results = await Promise.all(batchQueries);
  
  // Process each player-game combo
  for (let idx = 0; idx < batch.length; idx++) {
    const combo = batch[idx];
    const { data: stats, error } = results[idx];
    
    if (error || !stats || stats.length === 0) {
      skipped++;
      continue;
    }
    
    // Aggregate stats
    const aggregated = aggregateStats(stats);
    
    // Check if player_game_log exists
    const { data: existingLog, error: logError } = await supabase
      .from('player_game_logs')
      .select('id, stats')
      .eq('player_id', combo.player_id)
      .eq('game_id', combo.game_id)
      .single();
    
    if (logError && logError.code !== 'PGRST116') {
      skipped++;
      continue;
    }
    
    if (existingLog) {
      // Update if stats are empty or null
      if (!existingLog.stats || Object.keys(existingLog.stats).length === 0) {
        const { error: updateError } = await supabase
          .from('player_game_logs')
          .update({
            stats: aggregated,
            fantasy_points: aggregated.fantasy_points,
            minutes_played: aggregated.minutes_played,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingLog.id);
        
        if (!updateError) updated++;
      } else {
        skipped++;
      }
    } else {
      // Create new record - need game info
      const { data: gameInfo } = await supabase
        .from('games')
        .select('start_time, home_team_id, away_team_id')
        .eq('id', combo.game_id)
        .single();
      
      if (gameInfo) {
        // Try to determine team from stats
        const teamStat = stats.find(s => s.team_id);
        const teamId = teamStat?.team_id || gameInfo.home_team_id;
        const isHome = teamId === gameInfo.home_team_id;
        
        const { error: insertError } = await supabase
          .from('player_game_logs')
          .insert({
            player_id: combo.player_id,
            game_id: combo.game_id,
            team_id: teamId,
            game_date: gameInfo.start_time,
            opponent_id: isHome ? gameInfo.away_team_id : gameInfo.home_team_id,
            is_home: isHome,
            minutes_played: aggregated.minutes_played,
            stats: aggregated,
            fantasy_points: aggregated.fantasy_points,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (!insertError) created++;
      } else {
        skipped++;
      }
    }
  }
  
  return { updated, created, skipped };
}

function aggregateStats(stats: any[]): any {
  const aggregated: any = {
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
  
  // Aggregate all stats
  stats.forEach(stat => {
    const statType = stat.stat_type?.toLowerCase().replace(/[_\s-]+/g, '_');
    const mappedKey = STAT_MAPPING[statType] || STAT_MAPPING[stat.stat_type?.toLowerCase()];
    
    if (mappedKey && mappedKey in aggregated) {
      aggregated[mappedKey] = parseFloat(stat.stat_value) || 0;
    }
    
    // Handle fantasy points from the field
    if (stat.fantasy_points && stat.fantasy_points > aggregated.fantasy_points) {
      aggregated.fantasy_points = stat.fantasy_points;
    }
  });
  
  // Calculate fantasy points if not present
  if (aggregated.fantasy_points === 0 && aggregated.points > 0) {
    aggregated.fantasy_points = 
      aggregated.points +
      (aggregated.rebounds * 1.2) +
      (aggregated.assists * 1.5) +
      (aggregated.steals * 3) +
      (aggregated.blocks * 3) -
      (aggregated.turnovers * 1);
  }
  
  // Calculate percentages
  if (aggregated.field_goals_attempted > 0) {
    aggregated.field_goal_percentage = aggregated.field_goals_made / aggregated.field_goals_attempted;
  }
  if (aggregated.three_pointers_attempted > 0) {
    aggregated.three_point_percentage = aggregated.three_pointers_made / aggregated.three_pointers_attempted;
  }
  if (aggregated.free_throws_attempted > 0) {
    aggregated.free_throw_percentage = aggregated.free_throws_made / aggregated.free_throws_attempted;
  }
  
  return aggregated;
}

async function verifyNewCoverage() {
  console.log('📈 VERIFYING NEW STATS COVERAGE...\n');
  
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  const { count: logsWithStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .not('stats', 'is', null);
  
  // Sample check for non-empty stats
  const { data: sample } = await supabase
    .from('player_game_logs')
    .select('stats')
    .not('stats', 'is', null)
    .limit(1000);
  
  let nonEmptyCount = 0;
  sample?.forEach(log => {
    if (log.stats && Object.keys(log.stats).length > 5) {
      nonEmptyCount++;
    }
  });
  
  const estimatedUsable = Math.round((nonEmptyCount / 1000) * (logsWithStats || 0));
  
  console.log(`✨ NEW STATS COVERAGE:`);
  console.log(`├─ Total player_game_logs: ${totalLogs?.toLocaleString()}`);
  console.log(`├─ Logs with stats field: ${logsWithStats?.toLocaleString()}`);
  console.log(`├─ Estimated usable stats: ${estimatedUsable.toLocaleString()}`);
  console.log(`└─ New coverage rate: ${(estimatedUsable / (totalLogs || 1) * 100).toFixed(1)}%`);
}

// Run the transformation
bulkTransformStats();
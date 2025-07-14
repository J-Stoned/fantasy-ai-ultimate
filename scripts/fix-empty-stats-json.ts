#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixEmptyStatsJson() {
  console.log('🔧 FIXING EMPTY STATS JSON IN PLAYER_GAME_LOGS\n');
  console.log('━'.repeat(60));
  
  const BATCH_SIZE = 1000;
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let hasMore = true;
  let offset = 0;
  
  try {
    // First get count of records with empty stats
    const { data: emptyStatsLogs, count: emptyCount, error: countError } = await supabase
      .from('player_game_logs')
      .select('id', { count: 'exact', head: false })
      .or('stats.is.null,stats.eq.{}')
      .limit(1);
    
    if (countError) throw countError;
    
    console.log(`📊 FOUND ${emptyCount?.toLocaleString()} RECORDS WITH EMPTY STATS\n`);
    
    while (hasMore && totalProcessed < (emptyCount || 0)) {
      // Get batch of logs with empty stats
      const { data: logsToFix, error: logsError } = await supabase
        .from('player_game_logs')
        .select('id, player_id, game_id, team_id')
        .or('stats.is.null,stats.eq.{}')
        .range(offset, offset + BATCH_SIZE - 1);
      
      if (logsError) throw logsError;
      
      if (!logsToFix || logsToFix.length === 0) {
        hasMore = false;
        break;
      }
      
      // Get all player stats for these game logs
      const playerGamePairs = logsToFix.map(log => ({
        player_id: log.player_id,
        game_id: log.game_id
      }));
      
      // Fetch stats in chunks to avoid query size limits
      const statsMap: Record<string, any> = {};
      
      for (const log of logsToFix) {
        const { data: playerStats, error: statsError } = await supabase
          .from('player_stats')
          .select('*')
          .eq('player_id', log.player_id)
          .eq('game_id', log.game_id);
        
        if (statsError) {
          console.error(`Error fetching stats for player ${log.player_id}, game ${log.game_id}:`, statsError);
          continue;
        }
        
        if (!playerStats || playerStats.length === 0) {
          totalSkipped++;
          continue;
        }
        
        // Aggregate stats into JSON format
        const aggregatedStats: any = {
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
          fantasy_points: 0
        };
        
        // Enhanced stat mapping
        const statMapping: Record<string, string> = {
          'points': 'points',
          'pts': 'points',
          'rebounds': 'rebounds',
          'reb': 'rebounds',
          'assists': 'assists',
          'ast': 'assists',
          'steals': 'steals',
          'stl': 'steals',
          'blocks': 'blocks',
          'blk': 'blocks',
          'turnovers': 'turnovers',
          'to': 'turnovers',
          'tov': 'turnovers',
          'field_goals_made': 'field_goals_made',
          'fgm': 'field_goals_made',
          'field_goals_attempted': 'field_goals_attempted',
          'fga': 'field_goals_attempted',
          'three_pointers_made': 'three_pointers_made',
          'three_point_field_goals_made': 'three_pointers_made',
          '3pm': 'three_pointers_made',
          'three_pointers_attempted': 'three_pointers_attempted',
          'three_point_field_goals_attempted': 'three_pointers_attempted',
          '3pa': 'three_pointers_attempted',
          'free_throws_made': 'free_throws_made',
          'ftm': 'free_throws_made',
          'free_throws_attempted': 'free_throws_attempted',
          'fta': 'free_throws_attempted',
          'minutes': 'minutes_played',
          'min': 'minutes_played',
          'minutes_played': 'minutes_played',
          'personal_fouls': 'personal_fouls',
          'pf': 'personal_fouls',
          'fouls': 'personal_fouls',
          'plus_minus': 'plus_minus',
          '+/-': 'plus_minus',
          'fantasy_total': 'fantasy_points',
          'fantasy_points': 'fantasy_points',
          'fantasy_points_total': 'fantasy_points'
        };
        
        // Aggregate all stats for this player/game
        playerStats.forEach(stat => {
          const statType = stat.stat_type?.toLowerCase().replace(/_/g, ' ').replace(/ /g, '_');
          const mappedStat = statMapping[statType] || statMapping[stat.stat_type?.toLowerCase()];
          
          if (mappedStat) {
            aggregatedStats[mappedStat] = parseFloat(stat.stat_value) || 0;
          }
          
          // Also check for fantasy points in the record
          if (stat.fantasy_points) {
            aggregatedStats.fantasy_points = Math.max(
              aggregatedStats.fantasy_points,
              stat.fantasy_points
            );
          }
        });
        
        // Calculate fantasy points if not present
        if (aggregatedStats.fantasy_points === 0) {
          aggregatedStats.fantasy_points = 
            aggregatedStats.points +
            (aggregatedStats.rebounds * 1.2) +
            (aggregatedStats.assists * 1.5) +
            (aggregatedStats.steals * 3) +
            (aggregatedStats.blocks * 3) -
            (aggregatedStats.turnovers * 1);
        }
        
        statsMap[log.id] = aggregatedStats;
      }
      
      // Update records with aggregated stats
      for (const [logId, stats] of Object.entries(statsMap)) {
        const { error: updateError } = await supabase
          .from('player_game_logs')
          .update({
            stats: stats,
            fantasy_points: stats.fantasy_points,
            minutes_played: stats.minutes_played,
            updated_at: new Date().toISOString()
          })
          .eq('id', parseInt(logId));
        
        if (updateError) {
          console.error(`Error updating log ${logId}:`, updateError);
        } else {
          totalUpdated++;
        }
      }
      
      totalProcessed += logsToFix.length;
      offset += BATCH_SIZE;
      
      console.log(`✅ Progress: ${totalProcessed}/${emptyCount} (${(totalProcessed/(emptyCount||1)*100).toFixed(1)}%) - Updated: ${totalUpdated}, Skipped: ${totalSkipped}`);
    }
    
    // Final verification
    console.log(`\n🎯 FIX COMPLETE:`);
    console.log(`├─ Total records processed: ${totalProcessed}`);
    console.log(`├─ Records updated with stats: ${totalUpdated}`);
    console.log(`├─ Records skipped (no stats found): ${totalSkipped}`);
    console.log(`└─ Success rate: ${(totalUpdated/totalProcessed*100).toFixed(1)}%\n`);
    
    // Check new coverage
    const { count: newEmptyCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .or('stats.is.null,stats.eq.{}');
    
    const { count: totalCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    const { count: withStatsCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .not('stats', 'is', null)
      .not('stats', 'eq', {});
    
    console.log(`📈 NEW STATS COVERAGE:`);
    console.log(`├─ Total player_game_logs: ${totalCount?.toLocaleString()}`);
    console.log(`├─ Logs with populated stats: ${withStatsCount?.toLocaleString()}`);
    console.log(`├─ Logs with empty stats: ${newEmptyCount?.toLocaleString()}`);
    console.log(`└─ Coverage: ${((withStatsCount || 0) / (totalCount || 1) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the fix
fixEmptyStatsJson();
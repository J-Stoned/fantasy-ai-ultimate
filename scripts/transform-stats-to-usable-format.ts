#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function transformStatsToUsableFormat() {
  console.log('🚀 TRANSFORMING PLAYER STATS TO USABLE FORMAT\n');
  console.log('━'.repeat(60));
  
  const BATCH_SIZE = 500; // Process more games at once
  let processedCount = 0;
  let updateCount = 0;
  let insertCount = 0;
  let skipCount = 0;
  
  try {
    // First, check current coverage
    const { count: totalGameLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    const { count: logsWithStats } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .not('stats', 'is', null);
    
    console.log(`📊 CURRENT COVERAGE:`);
    console.log(`├─ Total player_game_logs: ${totalGameLogs?.toLocaleString()}`);
    console.log(`├─ Logs with stats JSON: ${logsWithStats?.toLocaleString()}`);
    console.log(`├─ Coverage: ${((logsWithStats || 0) / (totalGameLogs || 1) * 100).toFixed(1)}%`);
    console.log(`└─ Missing stats: ${((totalGameLogs || 0) - (logsWithStats || 0)).toLocaleString()}\n`);
    
    // Get all unique game IDs that have stats in player_stats
    const { data: gameIdsWithStats, error: gameIdsError } = await supabase
      .from('player_stats')
      .select('game_id')
      .not('game_id', 'is', null)
      .limit(10000); // Get more games
    
    if (gameIdsError) throw gameIdsError;
    
    const uniqueGameIds = [...new Set(gameIdsWithStats?.map(g => g.game_id) || [])];
    console.log(`📋 Found ${uniqueGameIds.length} unique games with stats in player_stats table\n`);
    
    // Process in batches
    for (let i = 0; i < uniqueGameIds.length; i += BATCH_SIZE) {
      const batchGameIds = uniqueGameIds.slice(i, i + BATCH_SIZE);
      
      // Get all stats for this batch of games
      const { data: batchStats, error: statsError } = await supabase
        .from('player_stats')
        .select('*')
        .in('game_id', batchGameIds);
      
      if (statsError) throw statsError;
      
      // Group stats by game_id and player_id
      const statsMap: Record<number, Record<number, any>> = {};
      
      batchStats?.forEach(stat => {
        const gameId = stat.game_id;
        const playerId = stat.player_id;
        
        if (!statsMap[gameId]) {
          statsMap[gameId] = {};
        }
        
        if (!statsMap[gameId][playerId]) {
          statsMap[gameId][playerId] = {
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
        }
        
        // Enhanced stat mapping for various stat types
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
          'field_goals_made': 'field_goals_made',
          'fgm': 'field_goals_made',
          'field_goals_attempted': 'field_goals_attempted',
          'fga': 'field_goals_attempted',
          'three_pointers_made': 'three_pointers_made',
          '3pm': 'three_pointers_made',
          'three_pointers_attempted': 'three_pointers_attempted',
          '3pa': 'three_pointers_attempted',
          'free_throws_made': 'free_throws_made',
          'ftm': 'free_throws_made',
          'free_throws_attempted': 'free_throws_attempted',
          'fta': 'free_throws_attempted',
          'minutes': 'minutes_played',
          'min': 'minutes_played',
          'personal_fouls': 'personal_fouls',
          'pf': 'personal_fouls',
          'plus_minus': 'plus_minus',
          '+/-': 'plus_minus',
          'fantasy_total': 'fantasy_points',
          'fantasy_points': 'fantasy_points'
        };
        
        const mappedStat = statMapping[stat.stat_type?.toLowerCase()];
        if (mappedStat) {
          statsMap[gameId][playerId][mappedStat] = parseFloat(stat.stat_value) || 0;
        }
        
        // Also capture fantasy points from the field
        if (stat.fantasy_points) {
          statsMap[gameId][playerId].fantasy_points = stat.fantasy_points;
        }
      });
      
      // Now update player_game_logs for each game/player combination
      for (const [gameId, playerStats] of Object.entries(statsMap)) {
        for (const [playerId, stats] of Object.entries(playerStats)) {
          // Check if record exists
          const { data: existingLog, error: checkError } = await supabase
            .from('player_game_logs')
            .select('id, stats')
            .eq('player_id', parseInt(playerId))
            .eq('game_id', parseInt(gameId))
            .single();
          
          if (checkError && checkError.code !== 'PGRST116') {
            console.error(`Error checking log for player ${playerId}, game ${gameId}:`, checkError);
            continue;
          }
          
          if (existingLog) {
            // Update existing record if it doesn't have stats or has empty stats
            if (!existingLog.stats || Object.keys(existingLog.stats).length === 0) {
              const { error: updateError } = await supabase
                .from('player_game_logs')
                .update({
                  stats: stats,
                  fantasy_points: stats.fantasy_points || 0,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingLog.id);
              
              if (updateError) {
                console.error(`Error updating log ${existingLog.id}:`, updateError);
              } else {
                updateCount++;
              }
            } else {
              skipCount++;
            }
          } else {
            // Need to create new record - but we need game info first
            const { data: gameInfo, error: gameError } = await supabase
              .from('games')
              .select('start_time, home_team_id, away_team_id')
              .eq('id', parseInt(gameId))
              .single();
            
            if (!gameError && gameInfo) {
              // Try to determine team from player_stats
              const { data: playerTeam, error: teamError } = await supabase
                .from('player_stats')
                .select('team_id')
                .eq('player_id', parseInt(playerId))
                .eq('game_id', parseInt(gameId))
                .not('team_id', 'is', null)
                .limit(1)
                .single();
              
              const teamId = playerTeam?.team_id || gameInfo.home_team_id;
              const isHome = teamId === gameInfo.home_team_id;
              
              const { error: insertError } = await supabase
                .from('player_game_logs')
                .insert({
                  player_id: parseInt(playerId),
                  game_id: parseInt(gameId),
                  team_id: teamId,
                  game_date: gameInfo.start_time,
                  opponent_id: isHome ? gameInfo.away_team_id : gameInfo.home_team_id,
                  is_home: isHome,
                  minutes_played: stats.minutes_played,
                  stats: stats,
                  fantasy_points: stats.fantasy_points || 0,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
              
              if (insertError) {
                console.error(`Error inserting log for player ${playerId}, game ${gameId}:`, insertError);
              } else {
                insertCount++;
              }
            }
          }
        }
      }
      
      processedCount += batchGameIds.length;
      console.log(`✅ Processed ${processedCount}/${uniqueGameIds.length} games (${(processedCount/uniqueGameIds.length*100).toFixed(1)}%)`);
    }
    
    // Final report
    console.log(`\n🎯 TRANSFORMATION COMPLETE:`);
    console.log(`├─ Games processed: ${processedCount}`);
    console.log(`├─ Records updated: ${updateCount}`);
    console.log(`├─ Records inserted: ${insertCount}`);
    console.log(`├─ Records skipped (already had stats): ${skipCount}`);
    console.log(`└─ Total modifications: ${updateCount + insertCount}\n`);
    
    // Check new coverage
    const { count: newLogsWithStats } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .not('stats', 'is', null);
    
    const improvement = ((newLogsWithStats || 0) - (logsWithStats || 0));
    
    console.log(`📈 NEW COVERAGE:`);
    console.log(`├─ Logs with stats JSON: ${newLogsWithStats?.toLocaleString()}`);
    console.log(`├─ Coverage: ${((newLogsWithStats || 0) / (totalGameLogs || 1) * 100).toFixed(1)}%`);
    console.log(`├─ Improvement: +${improvement.toLocaleString()} records`);
    console.log(`└─ New coverage rate: ${((newLogsWithStats || 0) / (totalGameLogs || 1) * 100).toFixed(1)}% (was ${((logsWithStats || 0) / (totalGameLogs || 1) * 100).toFixed(1)}%)`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run transformation
transformStatsToUsableFormat();
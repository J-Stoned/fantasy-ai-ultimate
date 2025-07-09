#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZWt2cWlxcnJwdWdmbXBnYXVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTA0NTA1MiwiZXhwIjoyMDY2NjIxMDUyfQ.EzHZ-WJkjbCXEAVP750VEp38ge35nsjVQ_ajzXadbPE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function transformPlayerStatsToGameLogs() {
  console.log('🔄 TRANSFORMING PLAYER STATS TO GAME LOGS\n');
  console.log('━'.repeat(50));
  
  const BATCH_SIZE = 100;
  let processedCount = 0;
  let successCount = 0;
  
  try {
    // First, get distinct game_ids that actually exist in both tables
    const { data: validGameIds, error: validError } = await supabase
      .from('player_stats')
      .select('game_id')
      .limit(1000);
    
    if (validError) throw validError;
    
    const uniqueGameIds = [...new Set(validGameIds?.map(v => v.game_id) || [])];
    
    // Check which of these exist in games table
    const { data: existingGames, error: gamesError } = await supabase
      .from('games')
      .select('id')
      .in('id', uniqueGameIds);
    
    if (gamesError) throw gamesError;
    
    const validGameIdSet = new Set(existingGames?.map(g => g.id) || []);
    
    console.log(`📊 TRANSFORMATION PLAN:`);
    console.log(`├─ Unique game IDs in player_stats: ${uniqueGameIds.length}`);
    console.log(`├─ Valid game IDs in games table: ${validGameIdSet.size}`);
    console.log(`└─ Starting transformation...\n`);
    
    // Process each valid game
    for (const gameId of Array.from(validGameIdSet).slice(0, 10)) { // Process first 10 games as test
      try {
        // Get all player stats for this game
        const { data: gameStats, error: statsError } = await supabase
          .from('player_stats')
          .select('*')
          .eq('game_id', gameId);
        
        if (statsError) throw statsError;
        
        // Group by player_id
        const playerStatsMap: Record<number, any> = {};
        
        gameStats?.forEach(stat => {
          if (!playerStatsMap[stat.player_id]) {
            playerStatsMap[stat.player_id] = {
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
              fantasy_points: 0
            };
          }
          
          // Map stat_type to appropriate field
          const statMapping: Record<string, string> = {
            'points': 'points',
            'rebounds': 'rebounds',
            'assists': 'assists',
            'steals': 'steals',
            'blocks': 'blocks',
            'turnovers': 'turnovers',
            'field_goals_made': 'field_goals_made',
            'field_goals_attempted': 'field_goals_attempted',
            'three_pointers_made': 'three_pointers_made',
            'three_pointers_attempted': 'three_pointers_attempted',
            'free_throws_made': 'free_throws_made',
            'free_throws_attempted': 'free_throws_attempted',
            'minutes': 'minutes_played',
            'fantasy_total': 'fantasy_points'
          };
          
          const mappedStat = statMapping[stat.stat_type];
          if (mappedStat) {
            playerStatsMap[stat.player_id][mappedStat] = stat.stat_value;
          }
          
          if (stat.fantasy_points) {
            playerStatsMap[stat.player_id].fantasy_points = stat.fantasy_points;
          }
        });
        
        // Get game info
        const { data: gameInfo, error: gameInfoError } = await supabase
          .from('games')
          .select('*, home_team:teams!games_home_team_id_fkey(id), away_team:teams!games_away_team_id_fkey(id)')
          .eq('id', gameId)
          .single();
        
        if (gameInfoError) throw gameInfoError;
        
        // Insert player_game_logs for each player
        const gameLogsToInsert = Object.entries(playerStatsMap).map(([playerId, stats]) => ({
          player_id: parseInt(playerId),
          game_id: gameId,
          team_id: gameInfo.home_team.id, // This needs to be determined properly
          game_date: gameInfo.start_time,
          opponent_id: gameInfo.away_team.id,
          is_home: true, // This needs to be determined properly
          minutes_played: stats.minutes_played,
          stats: stats,
          fantasy_points: stats.fantasy_points || 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        
        // Insert in batches
        if (gameLogsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('player_game_logs')
            .insert(gameLogsToInsert);
          
          if (insertError) {
            console.error(`Error inserting logs for game ${gameId}:`, insertError);
          } else {
            successCount += gameLogsToInsert.length;
            console.log(`✅ Processed game ${gameId}: ${gameLogsToInsert.length} player logs`);
          }
        }
        
        processedCount++;
        
      } catch (error) {
        console.error(`Error processing game ${gameId}:`, error);
      }
    }
    
    console.log(`\n🎯 TRANSFORMATION COMPLETE:`);
    console.log(`├─ Games processed: ${processedCount}`);
    console.log(`├─ Player logs created: ${successCount}`);
    console.log(`└─ Success rate: ${(successCount > 0 ? (processedCount / validGameIdSet.size * 100) : 0).toFixed(1)}%`);
    
    // Check new coverage
    const { count: newGameLogsCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\n📈 NEW COVERAGE:`);
    console.log(`└─ Total player_game_logs: ${newGameLogsCount?.toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run transformation
transformPlayerStatsToGameLogs();
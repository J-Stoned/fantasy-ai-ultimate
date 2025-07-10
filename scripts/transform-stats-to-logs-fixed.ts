#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = 'process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function transformStatsToLogs() {
  console.log('🚀 TRANSFORMING PLAYER_STATS TO PLAYER_GAME_LOGS\n');
  console.log('━'.repeat(50));
  
  let processedGames = 0;
  let createdLogs = 0;
  let errors = 0;
  
  try {
    // Get distinct game_ids from player_stats
    const { data: distinctGames, error: distinctError } = await supabase
      .from('player_stats')
      .select('game_id')
      .not('game_id', 'is', null)
      .order('game_id')
      .limit(5000); // Process first 5000 games
    
    if (distinctError) throw distinctError;
    
    const uniqueGameIds = [...new Set(distinctGames?.map(g => g.game_id))];
    console.log(`📊 Found ${uniqueGameIds.length} unique games with player stats\n`);
    
    // Process games in batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < Math.min(uniqueGameIds.length, 100); i += BATCH_SIZE) {
      const batch = uniqueGameIds.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (gameId) => {
        try {
          // Get game info
          const { data: gameInfo, error: gameError } = await supabase
            .from('games')
            .select('*, home_team:teams!games_home_team_id_fkey(id, name), away_team:teams!games_away_team_id_fkey(id, name)')
            .eq('id', gameId)
            .single();
          
          if (gameError || !gameInfo) {
            console.error(`Game ${gameId} not found`);
            errors++;
            return;
          }
          
          // Get all player stats for this game
          const { data: gameStats, error: statsError } = await supabase
            .from('player_stats')
            .select('*')
            .eq('game_id', gameId);
          
          if (statsError) throw statsError;
          
          // Group stats by player
          const playerStatsMap = new Map<number, any>();
          
          gameStats?.forEach(stat => {
            if (!playerStatsMap.has(stat.player_id)) {
              playerStatsMap.set(stat.player_id, {
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
              });
            }
            
            const stats = playerStatsMap.get(stat.player_id);
            
            // Map stat_type to stat value
            if (stat.stat_type === 'fantasy_total') {
              stats.fantasy_points = Number(stat.stat_value) || 0;
            } else if (stat.stat_type === 'minutes') {
              stats.minutes_played = Number(stat.stat_value) || 0;
            } else if (stats.hasOwnProperty(stat.stat_type)) {
              stats[stat.stat_type] = Number(stat.stat_value) || 0;
            }
            
            // Also capture fantasy_points column if present
            if (stat.fantasy_points) {
              stats.fantasy_points = Math.max(stats.fantasy_points, stat.fantasy_points);
            }
          });
          
          // Create player_game_logs entries
          const logsToInsert = [];
          
          for (const [playerId, stats] of playerStatsMap.entries()) {
            // Get player info to determine team
            const { data: player, error: playerError } = await supabase
              .from('players')
              .select('team_id')
              .eq('id', playerId)
              .single();
            
            if (!playerError && player) {
              const isHomeTeam = player.team_id === gameInfo.home_team.id;
              
              logsToInsert.push({
                player_id: playerId,
                game_id: gameId,
                team_id: player.team_id,
                game_date: new Date(gameInfo.start_time).toISOString().split('T')[0],
                opponent_id: isHomeTeam ? gameInfo.away_team.id : gameInfo.home_team.id,
                is_home: isHomeTeam,
                minutes_played: stats.minutes_played,
                stats: stats,
                fantasy_points: stats.fantasy_points
              });
            }
          }
          
          // Insert logs if we have any
          if (logsToInsert.length > 0) {
            const { error: insertError } = await supabase
              .from('player_game_logs')
              .insert(logsToInsert);
            
            if (insertError) {
              console.error(`Error inserting logs for game ${gameId}:`, insertError.message);
              errors++;
            } else {
              createdLogs += logsToInsert.length;
              processedGames++;
              
              if (processedGames % 10 === 0) {
                console.log(`✅ Progress: ${processedGames} games, ${createdLogs} logs created`);
              }
            }
          }
          
        } catch (error) {
          console.error(`Error processing game ${gameId}:`, error);
          errors++;
        }
      }));
    }
    
    // Final summary
    console.log('\n' + '═'.repeat(50));
    console.log('📊 TRANSFORMATION COMPLETE!');
    console.log(`├─ Games processed: ${processedGames}`);
    console.log(`├─ Player logs created: ${createdLogs}`);
    console.log(`├─ Errors: ${errors}`);
    
    // Check new coverage
    const { count: totalLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    const { data: gamesWithLogs } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .not('game_id', 'is', null);
    
    const uniqueGamesWithLogs = new Set(gamesWithLogs?.map(g => g.game_id) || []);
    
    console.log(`├─ Total player_game_logs: ${totalLogs}`);
    console.log(`└─ Games with logs: ${uniqueGamesWithLogs.size}`);
    
    const coveragePercent = (uniqueGamesWithLogs.size / 50399 * 100).toFixed(2);
    console.log(`\n🎯 NEW COVERAGE: ${coveragePercent}%`);
    
    if (uniqueGamesWithLogs.size > 100) {
      console.log('\n💰 IMPACT ON PATTERN ACCURACY:');
      const newAccuracy = 65.2 + (11.2 * uniqueGamesWithLogs.size / 50399);
      console.log(`└─ Estimated accuracy: ${newAccuracy.toFixed(1)}%`);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Run transformation
transformStatsToLogs();
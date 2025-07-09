#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZWt2cWlxcnJwdWdmbXBnYXVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTA0NTA1MiwiZXhwIjoyMDY2NjIxMDUyfQ.EzHZ-WJkjbCXEAVP750VEp38ge35nsjVQ_ajzXadbPE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixPlayerStatsLinkage() {
  console.log('🔧 FIXING PLAYER STATS LINKAGE\n');
  console.log('━'.repeat(50));
  
  let totalProcessed = 0;
  let successfulLinks = 0;
  let failedLinks = 0;
  
  try {
    // Step 1: Check if player_stats.game_id are external IDs
    console.log('📊 Step 1: Analyzing player_stats game_id format...');
    
    const { data: sampleStats, error: statsError } = await supabase
      .from('player_stats')
      .select('game_id, stat_type, stat_value')
      .limit(20);
    
    if (statsError) throw statsError;
    
    console.log('Sample game_ids from player_stats:');
    const uniqueGameIds = [...new Set(sampleStats?.map(s => s.game_id))];
    console.log(uniqueGameIds.slice(0, 5).join(', '));
    
    // Step 2: Check if these are external_ids in games table
    console.log('\n📊 Step 2: Checking if these match games.external_id...');
    
    const { data: matchingGames, error: matchError } = await supabase
      .from('games')
      .select('id, external_id')
      .in('external_id', uniqueGameIds)
      .limit(10);
    
    if (!matchError && matchingGames && matchingGames.length > 0) {
      console.log(`✅ Found ${matchingGames.length} games matching by external_id!`);
      console.log('This means player_stats.game_id contains external_ids, not internal ids.');
      
      // Step 3: Create a mapping of external_id to internal id
      console.log('\n📊 Step 3: Building external_id to internal id mapping...');
      
      const { data: allGames, error: allGamesError } = await supabase
        .from('games')
        .select('id, external_id')
        .not('external_id', 'is', null)
        .limit(10000); // Get a batch to process
      
      if (allGamesError) throw allGamesError;
      
      const externalToInternal = new Map<string, number>();
      allGames?.forEach(game => {
        if (game.external_id) {
          externalToInternal.set(game.external_id, game.id);
        }
      });
      
      console.log(`Built mapping for ${externalToInternal.size} games`);
      
      // Step 4: Process player_stats in batches
      console.log('\n📊 Step 4: Processing player_stats to create player_game_logs...');
      
      // Get distinct game_ids from player_stats that we can map
      const { data: distinctGameIds, error: distinctError } = await supabase
        .from('player_stats')
        .select('game_id')
        .limit(1000);
      
      if (distinctError) throw distinctError;
      
      const gameIdsToProcess = [...new Set(distinctGameIds?.map(d => d.game_id))];
      const mappableGameIds = gameIdsToProcess.filter(gid => externalToInternal.has(String(gid)));
      
      console.log(`Found ${mappableGameIds.length} game_ids that can be mapped`);
      
      // Process first 10 games as a test
      for (const externalGameId of mappableGameIds.slice(0, 10)) {
        const internalGameId = externalToInternal.get(String(externalGameId));
        if (!internalGameId) continue;
        
        try {
          // Get all player stats for this game
          const { data: gameStats, error: gameStatsError } = await supabase
            .from('player_stats')
            .select('*')
            .eq('game_id', externalGameId);
          
          if (gameStatsError) throw gameStatsError;
          
          // Group by player_id
          const playerStatsMap = new Map<number, any>();
          
          gameStats?.forEach(stat => {
            if (!playerStatsMap.has(stat.player_id)) {
              playerStatsMap.set(stat.player_id, {});
            }
            
            const playerStats = playerStatsMap.get(stat.player_id);
            
            // Handle stat_value which is JSONB
            if (typeof stat.stat_value === 'object' && stat.stat_value !== null) {
              Object.assign(playerStats, stat.stat_value);
            } else {
              playerStats[stat.stat_type] = stat.stat_value;
            }
            
            if (stat.fantasy_points) {
              playerStats.fantasy_points = stat.fantasy_points;
            }
          });
          
          // Get game info
          const { data: gameInfo, error: gameInfoError } = await supabase
            .from('games')
            .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
            .eq('id', internalGameId)
            .single();
          
          if (gameInfoError) throw gameInfoError;
          
          // Create player_game_logs
          const gameLogsToInsert = Array.from(playerStatsMap.entries()).map(([playerId, stats]) => ({
            player_id: playerId,
            game_id: internalGameId,
            team_id: gameInfo.home_team.id, // This needs player-team mapping
            game_date: new Date(gameInfo.start_time).toISOString().split('T')[0],
            opponent_id: gameInfo.away_team.id,
            is_home: true, // This needs to be determined
            minutes_played: stats.minutes || 0,
            stats: stats,
            fantasy_points: stats.fantasy_points || 0
          }));
          
          if (gameLogsToInsert.length > 0) {
            const { error: insertError } = await supabase
              .from('player_game_logs')
              .insert(gameLogsToInsert);
            
            if (insertError) {
              console.error(`❌ Error inserting game ${internalGameId}:`, insertError.message);
              failedLinks++;
            } else {
              console.log(`✅ Game ${internalGameId}: Created ${gameLogsToInsert.length} player logs`);
              successfulLinks += gameLogsToInsert.length;
            }
          }
          
          totalProcessed++;
          
        } catch (error) {
          console.error(`Error processing game ${externalGameId}:`, error);
          failedLinks++;
        }
      }
      
    } else {
      console.log('❌ No matches found. The game_ids might be in a different format.');
      
      // Alternative: Check if they're numeric and might be internal IDs
      const numericIds = uniqueGameIds.filter(id => !isNaN(Number(id)));
      if (numericIds.length > 0) {
        const { data: directMatches, error: directError } = await supabase
          .from('games')
          .select('id')
          .in('id', numericIds.map(Number));
        
        if (!directError && directMatches && directMatches.length > 0) {
          console.log(`Found ${directMatches.length} direct ID matches`);
        }
      }
    }
    
    // Final summary
    console.log('\n📊 LINKAGE SUMMARY:');
    console.log(`├─ Games processed: ${totalProcessed}`);
    console.log(`├─ Player logs created: ${successfulLinks}`);
    console.log(`├─ Failed operations: ${failedLinks}`);
    
    // Check final coverage
    const { count: finalCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    console.log(`└─ Total player_game_logs now: ${finalCount}`);
    
    console.log('\n💡 NEXT STEPS:');
    console.log('1. Run this script with larger batch sizes');
    console.log('2. Create player-team mapping to correctly assign team_id');
    console.log('3. Determine is_home based on player team vs game teams');
    console.log('4. Integrate with pattern detection system');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the fix
fixPlayerStatsLinkage();
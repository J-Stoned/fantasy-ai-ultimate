import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkStatsJsonStructure() {
  console.log('🔍 CHECKING STATS JSON STRUCTURE\n');
  console.log('='.repeat(80));

  try {
    // Get a sample of player_game_logs with the stats field
    const { data: gameLogs, error } = await supabase
      .from('player_game_logs')
      .select('id, player_id, game_id, stats, raw_stats, fantasy_points')
      .not('stats', 'is', null)
      .limit(10);

    if (error) {
      console.error('Error fetching game logs:', error);
      return;
    }

    console.log(`Found ${gameLogs?.length || 0} game logs with stats data\n`);

    if (gameLogs && gameLogs.length > 0) {
      // Analyze the structure of the first few records
      gameLogs.slice(0, 3).forEach((log, index) => {
        console.log(`\n📊 Record ${index + 1} (ID: ${log.id}):`);
        console.log(`Player ID: ${log.player_id}, Game ID: ${log.game_id}`);
        
        if (log.stats) {
          console.log('\nStats field content:');
          console.log(JSON.stringify(log.stats, null, 2));
        }
        
        if (log.raw_stats) {
          console.log('\nRaw stats field content:');
          console.log(JSON.stringify(log.raw_stats, null, 2));
        }
        
        console.log(`\nFantasy points: ${log.fantasy_points}`);
        console.log('-'.repeat(60));
      });
    } else {
      // Try without the NOT NULL filter
      const { data: allLogs } = await supabase
        .from('player_game_logs')
        .select('id, stats, raw_stats')
        .limit(100);
      
      if (allLogs) {
        const withStats = allLogs.filter(log => log.stats !== null).length;
        const withRawStats = allLogs.filter(log => log.raw_stats !== null).length;
        
        console.log('\n📊 Stats field analysis (100 records sample):');
        console.log(`  - Records with stats field populated: ${withStats}/100 (${withStats}%)`);
        console.log(`  - Records with raw_stats field populated: ${withRawStats}/100 (${withRawStats}%)`);
        
        // Check if stats is an empty object
        const nonEmptyStats = allLogs.filter(log => {
          if (!log.stats) return false;
          return Object.keys(log.stats).length > 0;
        }).length;
        
        console.log(`  - Records with non-empty stats object: ${nonEmptyStats}/100 (${nonEmptyStats}%)`);
      }
    }

    // Check the player_stats table format
    console.log('\n\n📊 PLAYER_STATS TABLE FORMAT:');
    
    const { data: playerStats } = await supabase
      .from('player_stats')
      .select('*')
      .limit(10);
    
    if (playerStats && playerStats.length > 0) {
      console.log('\nSample player_stats records:');
      playerStats.slice(0, 5).forEach(stat => {
        console.log(`  Game ${stat.game_id}, Player ${stat.player_id}: ${stat.stat_type} = ${stat.stat_value}`);
      });
    }

    // Try to reconstruct complete stats for a single player in a game
    console.log('\n\n🔄 RECONSTRUCTING COMPLETE STATS FOR A PLAYER:');
    
    if (playerStats && playerStats.length > 0) {
      const sampleGameId = playerStats[0].game_id;
      const samplePlayerId = playerStats[0].player_id;
      
      const { data: allStatsForPlayer } = await supabase
        .from('player_stats')
        .select('stat_type, stat_value')
        .eq('game_id', sampleGameId)
        .eq('player_id', samplePlayerId);
      
      if (allStatsForPlayer && allStatsForPlayer.length > 0) {
        console.log(`\nGame ${sampleGameId}, Player ${samplePlayerId}:`);
        const statsObject: Record<string, number> = {};
        allStatsForPlayer.forEach(stat => {
          statsObject[stat.stat_type] = stat.stat_value;
        });
        console.log(JSON.stringify(statsObject, null, 2));
        
        console.log(`\nThis player has ${allStatsForPlayer.length} different stat types recorded`);
      }
    }

    // Final analysis
    console.log('\n\n' + '='.repeat(80));
    console.log('💡 KEY FINDINGS:\n');
    console.log('1. player_game_logs table has JSON fields (stats, raw_stats) but they appear mostly empty');
    console.log('2. player_stats table uses a key-value structure (one row per stat type)');
    console.log('3. To get complete stats for a player, you need to aggregate multiple rows from player_stats');
    console.log('4. The "3% usable" likely means only 3% of player_game_logs have populated stats JSON');
    console.log('5. Most actual stats are in the player_stats table but in a normalized format');
    
  } catch (error) {
    console.error('Error during analysis:', error);
  }
}

checkStatsJsonStructure().catch(console.error);
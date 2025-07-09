#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZWt2cWlxcnJwdWdmbXBnYXVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTA0NTA1MiwiZXhwIjoyMDY2NjIxMDUyfQ.EzHZ-WJkjbCXEAVP750VEp38ge35nsjVQ_ajzXadbPE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function linkPlayerStatsToGames() {
  console.log('🔗 LINKING PLAYER STATS TO GAMES\n');
  console.log('━'.repeat(50));
  
  try {
    // First, check what's in player_stats
    const { data: sampleStats, error: statsError } = await supabase
      .from('player_stats')
      .select('*')
      .limit(10);
    
    if (statsError) throw statsError;
    
    console.log('📊 SAMPLE PLAYER_STATS RECORDS:');
    if (sampleStats && sampleStats.length > 0) {
      console.log('Columns:', Object.keys(sampleStats[0]).join(', '));
      console.log('\nFirst few records:');
      sampleStats.slice(0, 3).forEach((stat, i) => {
        console.log(`\nRecord ${i + 1}:`);
        console.log(`├─ Player ID: ${stat.player_id}`);
        console.log(`├─ Game ID: ${stat.game_id}`);
        console.log(`├─ Stat Type: ${stat.stat_type}`);
        console.log(`└─ Stat Value: ${stat.stat_value}`);
      });
    }
    
    // Check if game_ids in player_stats match games table
    const { data: matchingGames, error: matchError } = await supabase
      .from('player_stats')
      .select('game_id')
      .not('game_id', 'is', null)
      .limit(100);
    
    if (!matchError && matchingGames) {
      const gameIds = matchingGames.map(m => m.game_id);
      
      // Check if these game_ids exist in games table
      const { data: existingGames, error: gamesError } = await supabase
        .from('games')
        .select('id')
        .in('id', gameIds);
      
      if (!gamesError) {
        console.log(`\n🔍 GAME ID MATCHING:`);
        console.log(`├─ Player stats with game_id: ${gameIds.length}`);
        console.log(`├─ Matching games found: ${existingGames?.length || 0}`);
        console.log(`└─ Match rate: ${((existingGames?.length || 0) / gameIds.length * 100).toFixed(1)}%`);
      }
    }
    
    // Check player_game_logs structure
    const { data: sampleGameLogs, error: logsError } = await supabase
      .from('player_game_logs')
      .select('*')
      .limit(5);
    
    if (!logsError && sampleGameLogs) {
      console.log('\n🏀 PLAYER_GAME_LOGS STRUCTURE:');
      if (sampleGameLogs.length > 0) {
        console.log('Columns:', Object.keys(sampleGameLogs[0]).join(', '));
        console.log('\nStats field example:', JSON.stringify(sampleGameLogs[0].stats, null, 2));
      }
    }
    
    // Try to create a proper player_game_log from player_stats
    console.log('\n💡 SOLUTION APPROACH:');
    console.log('1. Group player_stats by (player_id, game_id)');
    console.log('2. Aggregate stats into JSON format for player_game_logs');
    console.log('3. Insert into player_game_logs table');
    console.log('4. Link to pattern detection system');
    
    // Get a sample of how stats are structured for one game
    const { data: gameStats, error: gameStatsError } = await supabase
      .from('player_stats')
      .select('*')
      .eq('game_id', sampleStats?.[0]?.game_id)
      .limit(20);
    
    if (!gameStatsError && gameStats && gameStats.length > 0) {
      console.log(`\n📈 STATS FOR GAME ${gameStats[0].game_id}:`);
      const playerStats: Record<number, any> = {};
      
      gameStats.forEach(stat => {
        if (!playerStats[stat.player_id]) {
          playerStats[stat.player_id] = {};
        }
        playerStats[stat.player_id][stat.stat_type] = stat.stat_value;
      });
      
      console.log(`Found stats for ${Object.keys(playerStats).length} players`);
      console.log('\nExample player stats:', JSON.stringify(playerStats[Object.keys(playerStats)[0]], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the linking process
linkPlayerStatsToGames();
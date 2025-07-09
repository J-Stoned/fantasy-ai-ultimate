#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZWt2cWlxcnJwdWdmbXBnYXVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTA0NTA1MiwiZXhwIjoyMDY2NjIxMDUyfQ.EzHZ-WJkjbCXEAVP750VEp38ge35nsjVQ_ajzXadbPE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function analyzeStatsPerGame() {
  console.log('🔬 ANALYZING STATS PER GAME\n');
  console.log('━'.repeat(50));
  
  try {
    // Get the 23 unique game IDs
    const { data: uniqueGames } = await supabase
      .from('player_stats')
      .select('game_id')
      .limit(1000);
    
    const gameIds = [...new Set(uniqueGames?.map(g => g.game_id))];
    console.log(`📊 Analyzing ${gameIds.length} unique games...\n`);
    
    // Analyze first few games
    for (let i = 0; i < Math.min(3, gameIds.length); i++) {
      const gameId = gameIds[i];
      
      // Count records for this game
      const { count: recordCount } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameId);
      
      // Get unique players
      const { data: players } = await supabase
        .from('player_stats')
        .select('player_id')
        .eq('game_id', gameId)
        .limit(1000);
      
      const uniquePlayers = new Set(players?.map(p => p.player_id));
      
      // Get stat types
      const { data: statTypes } = await supabase
        .from('player_stats')
        .select('stat_type')
        .eq('game_id', gameId)
        .limit(100);
      
      const uniqueStatTypes = new Set(statTypes?.map(s => s.stat_type));
      
      console.log(`🎮 Game ID: ${gameId}`);
      console.log(`├─ Total records: ${recordCount?.toLocaleString()}`);
      console.log(`├─ Unique players: ${uniquePlayers.size}`);
      console.log(`├─ Records per player: ${Math.floor((recordCount || 0) / uniquePlayers.size)}`);
      console.log(`├─ Stat types: ${Array.from(uniqueStatTypes).slice(0, 5).join(', ')}...`);
      
      // Get game info
      const { data: gameInfo } = await supabase
        .from('games')
        .select('*, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name)')
        .eq('id', gameId)
        .single();
      
      if (gameInfo) {
        console.log(`├─ Date: ${new Date(gameInfo.start_time).toLocaleDateString()}`);
        console.log(`├─ Teams: ${gameInfo.away_team?.name || 'Unknown'} @ ${gameInfo.home_team?.name || 'Unknown'}`);
        console.log(`└─ Sport: ${gameInfo.sport_id || 'Unknown'}`);
      }
      console.log('');
    }
    
    // Theory check
    console.log('💡 HYPOTHESIS:');
    console.log('Each stat (points, rebounds, assists, etc.) is stored as a separate row!');
    console.log('This explains why we have 200K+ records per game.');
    console.log('');
    
    // Verify hypothesis
    const { data: samplePlayer } = await supabase
      .from('player_stats')
      .select('*')
      .eq('game_id', gameIds[0])
      .eq('player_id', 5486845)
      .limit(20);
    
    if (samplePlayer && samplePlayer.length > 0) {
      console.log(`📋 Sample: Player 5486845 in Game ${gameIds[0]}:`);
      samplePlayer.forEach(stat => {
        console.log(`├─ ${stat.stat_type}: ${stat.stat_value}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

analyzeStatsPerGame();
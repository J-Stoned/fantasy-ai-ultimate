#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

async function checkMLBStats() {
  console.log('🎉 MLB STATS SUCCESS CHECK\n');
  
  // Count players
  const { count: playerCount } = await supabase
    .from('mlb_players')
    .select('*', { count: 'exact', head: true });
    
  console.log(`✅ MLB Players: ${playerCount}`);
  
  // Count stats
  const { count: statsCount } = await supabase
    .from('mlb_stats')
    .select('*', { count: 'exact', head: true });
    
  console.log(`✅ MLB Stats: ${statsCount}`);
  
  // Get some sample players
  console.log('\n🏆 Top Fantasy Scorers:');
  const { data: topScorers } = await supabase
    .from('mlb_player_game_stats')
    .select('player_name, position, current_team, stat_type, fantasy_points')
    .eq('stat_type', 'batting_fantasy_total')
    .order('fantasy_points', { ascending: false })
    .limit(5);
    
  if (topScorers) {
    topScorers.forEach((player, i) => {
      console.log(`${i + 1}. ${player.player_name} (${player.position}, ${player.current_team}): ${player.fantasy_points} pts`);
    });
  }
  
  // Get pitching leaders
  console.log('\n⚾ Top Pitching Performances:');
  const { data: topPitchers } = await supabase
    .from('mlb_stats')
    .select('mlb_player_id, stat_value, fantasy_points')
    .eq('stat_type', 'strikeouts')
    .order('stat_value', { ascending: false })
    .limit(5);
    
  if (topPitchers) {
    for (const pitcher of topPitchers) {
      const { data: player } = await supabase
        .from('mlb_players')
        .select('player_name, position')
        .eq('mlb_player_id', pitcher.mlb_player_id)
        .single();
        
      if (player) {
        console.log(`- ${player.player_name}: ${pitcher.stat_value} strikeouts`);
      }
    }
  }
  
  // Show available stat types
  console.log('\n📊 Available Stat Types:');
  const { data: statTypes } = await supabase
    .from('mlb_stats')
    .select('stat_type')
    .limit(1000);
    
  const uniqueTypes = [...new Set(statTypes?.map(s => s.stat_type) || [])];
  console.log(uniqueTypes.join(', '));
  
  // Sample queries
  console.log('\n💡 Sample Queries You Can Run:\n');
  
  console.log('-- Get batting leaders:');
  console.log(`SELECT player_name, SUM(stat_value) as total_hits
FROM mlb_player_game_stats 
WHERE stat_type = 'hits'
GROUP BY player_name
ORDER BY total_hits DESC
LIMIT 10;\n`);
  
  console.log('-- Get fantasy team performance:');
  console.log(`SELECT player_name, position, AVG(fantasy_points) as avg_points
FROM mlb_player_game_stats
WHERE fantasy_points > 0
GROUP BY player_name, position
ORDER BY avg_points DESC
LIMIT 20;`);
  
  console.log('\n🎯 Your MLB stats are now ready for:');
  console.log('- Player performance analysis');
  console.log('- Fantasy point optimization');
  console.log('- Betting pattern detection');
  console.log('- Statistical modeling');
}

checkMLBStats().catch(console.error);
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRecentInsertionsDetail() {
  console.log('🔍 Checking recent insertions in detail...\n');

  // 1. Get insertions from the last 3 hours
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  
  const { data: recentStats, count: totalRecent } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact' })
    .gte('created_at', threeHoursAgo)
    .order('created_at', { ascending: false })
    .limit(100);

  console.log(`Total insertions in last 3 hours: ${totalRecent?.toLocaleString() || 0}`);

  if (recentStats && recentStats.length > 0) {
    // Group by player_id
    const playerGroups: Record<number, any[]> = {};
    recentStats.forEach(stat => {
      if (!playerGroups[stat.player_id]) {
        playerGroups[stat.player_id] = [];
      }
      playerGroups[stat.player_id].push(stat);
    });

    console.log(`\nUnique players in recent insertions: ${Object.keys(playerGroups).length}`);
    console.log('Player IDs:', Object.keys(playerGroups).slice(0, 20).join(', '));

    // Show details for first player
    const firstPlayerId = Object.keys(playerGroups)[0];
    console.log(`\n\nDetails for player ${firstPlayerId}:`);
    const firstPlayerStats = playerGroups[parseInt(firstPlayerId)];
    
    console.log(`Number of stats: ${firstPlayerStats.length}`);
    console.log('Sample stats:');
    firstPlayerStats.slice(0, 5).forEach(stat => {
      console.log(`  - ${stat.stat_type}: ${stat.stat_value} (game: ${stat.game_id})`);
    });

    // Check if this player exists
    const { data: player } = await supabase
      .from('players')
      .select('*')
      .eq('id', parseInt(firstPlayerId))
      .single();

    if (player) {
      console.log(`\nPlayer info: ${player.firstname} ${player.lastname} (${player.sport_id})`);
    } else {
      console.log(`\n⚠️  Player ${firstPlayerId} NOT FOUND in players table!`);
    }
  }

  // 2. Check games referenced in recent stats
  if (recentStats && recentStats.length > 0) {
    const gameIds = [...new Set(recentStats.map(s => s.game_id))];
    console.log(`\n\nGames referenced in recent stats: ${gameIds.length}`);
    console.log('Game IDs:', gameIds.slice(0, 10).join(', '));

    // Check first game
    const { data: game } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameIds[0])
      .single();

    if (game) {
      console.log(`\nFirst game details:`);
      console.log(`  - ID: ${game.id}`);
      console.log(`  - Sport: ${game.sport}`);
      console.log(`  - Teams: ${game.home_team_id} vs ${game.away_team_id}`);
      console.log(`  - Score: ${game.home_score} - ${game.away_score}`);
      console.log(`  - Date: ${game.start_time}`);
    }
  }

  // 3. Check oldest stats
  console.log('\n\nChecking oldest stats in the table...');
  const { data: oldestStats } = await supabase
    .from('player_stats')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(10);

  if (oldestStats && oldestStats.length > 0) {
    console.log('Oldest stats:');
    oldestStats.forEach(stat => {
      console.log(`  - Player ${stat.player_id}, Game ${stat.game_id}, Created: ${stat.created_at}`);
    });
  }

  // 4. Raw count by player_id
  console.log('\n\nDoing a manual count of unique players...');
  
  const { data: allPlayerIds } = await supabase
    .from('player_stats')
    .select('player_id')
    .not('player_id', 'is', null);

  if (allPlayerIds) {
    const uniqueSet = new Set(allPlayerIds.map(p => p.player_id));
    console.log(`Total unique players (manual count): ${uniqueSet.size}`);
    
    // Count occurrences
    const counts: Record<number, number> = {};
    allPlayerIds.forEach(p => {
      counts[p.player_id] = (counts[p.player_id] || 0) + 1;
    });
    
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    console.log('\nTop 10 players by stat count:');
    sorted.slice(0, 10).forEach(([playerId, count]) => {
      console.log(`  - Player ${playerId}: ${count} stats`);
    });
  }
}

checkRecentInsertionsDetail().catch(console.error);
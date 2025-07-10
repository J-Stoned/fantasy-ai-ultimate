import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigatePlayerStatsMystery() {
  console.log('🔍 Investigating the 4 players mystery...\n');

  // 1. Get the actual unique player IDs
  console.log('Checking unique player IDs in player_stats...');
  
  // First, let's get a sample to see what's in there
  const { data: sampleStats } = await supabase
    .from('player_stats')
    .select('player_id, game_id, stat_type, stat_value')
    .limit(50);

  if (sampleStats) {
    console.log('\nSample of player_stats records:');
    const playerIdSet = new Set<number>();
    sampleStats.forEach((stat, i) => {
      if (i < 10) {
        console.log(`  - Player ID: ${stat.player_id}, Game: ${stat.game_id}, ${stat.stat_type}: ${stat.stat_value}`);
      }
      if (stat.player_id) playerIdSet.add(stat.player_id);
    });
    console.log(`\nUnique player IDs in this sample: ${Array.from(playerIdSet).join(', ')}`);
  }

  // 2. Use raw SQL to get distinct count
  console.log('\n\nUsing different approaches to count unique players...');
  
  // Approach 1: Get distinct player_ids with limit
  const { data: distinctPlayers, error: err1 } = await supabase
    .from('player_stats')
    .select('player_id')
    .order('player_id')
    .limit(1000);

  if (distinctPlayers && !err1) {
    const uniqueIds = [...new Set(distinctPlayers.map(p => p.player_id).filter(id => id !== null))];
    console.log(`Approach 1 (first 1000 records): ${uniqueIds.length} unique players`);
    console.log(`First 20 IDs: ${uniqueIds.slice(0, 20).join(', ')}`);
  }

  // 3. Check if there are really only 4 distinct values
  const { data: groupedStats } = await supabase
    .rpc('count_unique_players', {}).catch(() => ({ data: null }));

  if (!groupedStats) {
    // Try a different approach - count by grouping
    console.log('\nChecking player distribution...');
    
    // Get counts for top player IDs
    const playerCounts: Record<number, number> = {};
    const { data: allStats } = await supabase
      .from('player_stats')
      .select('player_id')
      .limit(10000);
    
    if (allStats) {
      allStats.forEach(stat => {
        if (stat.player_id) {
          playerCounts[stat.player_id] = (playerCounts[stat.player_id] || 0) + 1;
        }
      });
      
      const sortedPlayers = Object.entries(playerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);
      
      console.log('\nTop 20 player IDs by stat count:');
      sortedPlayers.forEach(([playerId, count]) => {
        console.log(`  - Player ${playerId}: ${count} stats`);
      });
      
      console.log(`\nTotal unique players in 10K sample: ${Object.keys(playerCounts).length}`);
    }
  }

  // 4. Check if these 4 players actually exist
  const knownPlayerIds = [121466571, 121464384]; // From earlier output
  const { data: playerInfo } = await supabase
    .from('players')
    .select('id, firstname, lastname, sport_id')
    .in('id', knownPlayerIds);

  if (playerInfo) {
    console.log('\n\nChecking known player IDs:');
    playerInfo.forEach(player => {
      console.log(`  - ${player.id}: ${player.firstname} ${player.lastname} (${player.sport_id})`);
    });
  }

  // 5. Check recent insertions
  const oneHourAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: recentStats, count: recentCount } = await supabase
    .from('player_stats')
    .select('player_id', { count: 'exact' })
    .gte('created_at', oneHourAgo)
    .limit(100);

  if (recentStats) {
    const recentUnique = [...new Set(recentStats.map(s => s.player_id))];
    console.log(`\n\nRecent stats (last 2 hours):`);
    console.log(`  - Total: ${recentCount}`);
    console.log(`  - Unique players: ${recentUnique.length}`);
    console.log(`  - Player IDs: ${recentUnique.slice(0, 10).join(', ')}...`);
  }

  // 6. Final check - are there actually more players?
  console.log('\n\nFinal verification...');
  
  // Get pages of distinct player_ids
  let allUniqueIds = new Set<number>();
  let offset = 0;
  const pageSize = 10000;
  
  for (let i = 0; i < 5; i++) { // Check first 50K records
    const { data: page } = await supabase
      .from('player_stats')
      .select('player_id')
      .range(offset, offset + pageSize - 1);
    
    if (page) {
      page.forEach(p => {
        if (p.player_id) allUniqueIds.add(p.player_id);
      });
    }
    
    offset += pageSize;
  }
  
  console.log(`\nActual unique players found (first 50K records): ${allUniqueIds.size}`);
  if (allUniqueIds.size > 4) {
    console.log('First 20 player IDs:', Array.from(allUniqueIds).slice(0, 20).join(', '));
  }
}

investigatePlayerStatsMystery().catch(console.error);
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateRecentStats() {
  console.log('🔍 Investigating recent stats insertion...\n');

  try {
    // Get stats from the last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    
    // 1. Check unique game_ids in recent stats
    const { data: recentStats, error: recentError } = await supabase
      .from('player_stats')
      .select('game_id, created_at')
      .gte('created_at', fifteenMinutesAgo)
      .order('created_at', { ascending: false });

    if (recentError) throw recentError;

    console.log(`📊 Total recent stats (last 15 min): ${recentStats?.length.toLocaleString()}`);

    // Group by game_id
    const gameGroups = new Map<string, number>();
    const nullGameIds = recentStats?.filter(s => !s.game_id).length || 0;
    
    recentStats?.forEach(stat => {
      if (stat.game_id) {
        gameGroups.set(stat.game_id, (gameGroups.get(stat.game_id) || 0) + 1);
      }
    });

    console.log(`🎮 Unique games in recent stats: ${gameGroups.size}`);
    console.log(`❌ Stats with NULL game_id: ${nullGameIds.toLocaleString()}`);

    // 2. Show top games with most stats
    console.log('\n📈 Top games with most recent stats:');
    const sortedGames = Array.from(gameGroups.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    for (const [gameId, count] of sortedGames) {
      // Get game info
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('sport, home_team, away_team, game_date')
        .eq('id', gameId)
        .single();

      if (!gameError && game) {
        console.log(`  ${game.sport} - ${game.away_team} @ ${game.home_team} (${new Date(game.game_date).toLocaleDateString()}): ${count} stats`);
      } else {
        console.log(`  Game ${gameId}: ${count} stats`);
      }
    }

    // 3. Check if these are duplicate stats
    console.log('\n🔍 Checking for duplicates...');
    
    // Get all stats for the most populated game
    if (sortedGames.length > 0) {
      const [topGameId, topGameCount] = sortedGames[0];
      
      const { data: gameStats, error: gameStatsError } = await supabase
        .from('player_stats')
        .select('player_id, created_at')
        .eq('game_id', topGameId)
        .order('created_at', { ascending: true });

      if (!gameStatsError && gameStats) {
        // Check for duplicate player_ids
        const playerCounts = new Map<string, number>();
        gameStats.forEach(stat => {
          playerCounts.set(stat.player_id, (playerCounts.get(stat.player_id) || 0) + 1);
        });

        const duplicates = Array.from(playerCounts.entries()).filter(([_, count]) => count > 1);
        console.log(`  Found ${duplicates.length} players with duplicate stats in game ${topGameId}`);
        
        if (duplicates.length > 0) {
          console.log('  Sample duplicates:');
          duplicates.slice(0, 5).forEach(([playerId, count]) => {
            console.log(`    Player ${playerId}: ${count} entries`);
          });
        }
      }
    }

    // 4. Check total unique game_ids across all player_stats
    console.log('\n📊 Overall stats coverage:');
    const { data: allGameIds, error: allGamesError } = await supabase
      .from('player_stats')
      .select('game_id')
      .not('game_id', 'is', null);

    if (!allGamesError) {
      const uniqueAllGameIds = new Set(allGameIds.map(s => s.game_id));
      console.log(`  Total unique games with any stats: ${uniqueAllGameIds.size}`);
      
      // Get info about these games
      const { data: coveredGames, error: coveredError } = await supabase
        .from('games')
        .select('sport')
        .in('id', Array.from(uniqueAllGameIds));

      if (!coveredError && coveredGames) {
        const sportCounts = new Map<string, number>();
        coveredGames.forEach(game => {
          sportCounts.set(game.sport, (sportCounts.get(game.sport) || 0) + 1);
        });

        console.log('  Games with stats by sport:');
        sportCounts.forEach((count, sport) => {
          console.log(`    ${sport}: ${count}`);
        });
      }
    }

    // 5. Sample some stats to see their structure
    console.log('\n📋 Sample stat structure:');
    const { data: sampleStats, error: sampleError } = await supabase
      .from('player_stats')
      .select('*')
      .gte('created_at', fifteenMinutesAgo)
      .limit(3);

    if (!sampleError && sampleStats) {
      sampleStats.forEach((stat, i) => {
        console.log(`\n  Sample ${i + 1}:`);
        console.log(`    ID: ${stat.id}`);
        console.log(`    Player ID: ${stat.player_id}`);
        console.log(`    Game ID: ${stat.game_id}`);
        console.log(`    Created: ${new Date(stat.created_at).toLocaleString()}`);
        console.log(`    Stats: ${JSON.stringify(stat.stats, null, 2).split('\n').slice(0, 5).join('\n')}`);
      });
    }

  } catch (error) {
    console.error('❌ Error investigating stats:', error);
  }
}

// Run the investigation
investigateRecentStats();
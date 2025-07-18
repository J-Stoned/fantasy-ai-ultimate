import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyNCAABaseballCollection() {
  console.log('🔍 Verifying NCAA Baseball Collection Across All Seasons...\n');

  try {
    // First, let's get all NCAA Baseball games
    const { data: ncaaGames, count: gameCount, error: gameError } = await supabase
      .from('games')
      .select('id, home_team, away_team, date, season', { count: 'exact' })
      .eq('sport', 'NCAA_BASEBALL')
      .order('date', { ascending: false });

    if (gameError) throw gameError;

    console.log(`🏟️ Total NCAA Baseball Games: ${gameCount || 0}`);

    if (!ncaaGames || ncaaGames.length === 0) {
      console.log('No NCAA Baseball games found!');
      return;
    }

    // Get game IDs
    const gameIds = ncaaGames.map(g => g.id);

    // Count total player stats for these games
    const { data: totalStats, count: totalCount, error: statsError } = await supabase
      .from('player_game_logs')
      .select('id, game_id, player_id, stats', { count: 'exact' })
      .in('game_id', gameIds);

    if (statsError) throw statsError;

    console.log(`📊 Total NCAA Baseball Player Stats: ${totalCount || 0}`);

    // Analyze stats by type (batting vs pitching)
    let battingCount = 0;
    let pitchingCount = 0;
    let otherCount = 0;

    if (totalStats) {
      totalStats.forEach(stat => {
        if (stat.stats) {
          if (stat.stats.at_bats !== undefined || stat.stats.hits !== undefined || 
              stat.stats.runs !== undefined || stat.stats.rbis !== undefined) {
            battingCount++;
          } else if (stat.stats.innings_pitched !== undefined || stat.stats.strikeouts !== undefined || 
                     stat.stats.earned_runs !== undefined || stat.stats.walks !== undefined) {
            pitchingCount++;
          } else {
            otherCount++;
          }
        }
      });
    }

    console.log('\n📊 Stats Breakdown by Type:');
    console.log(`  - Batting Stats: ${battingCount}`);
    console.log(`  - Pitching Stats: ${pitchingCount}`);
    console.log(`  - Other/Unknown: ${otherCount}`);

    // Group games by season
    const gamesBySeason = ncaaGames.reduce((acc, game) => {
      const year = new Date(game.date).getFullYear();
      acc[year] = (acc[year] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    console.log('\n📅 Games by Season:');
    Object.entries(gamesBySeason)
      .sort(([a], [b]) => Number(a) - Number(b))
      .forEach(([year, count]) => {
        console.log(`  - ${year}: ${count} games`);
      });

    // Count stats by year
    console.log('\n📊 Player Stats by Season:');
    
    for (const year of [2021, 2022, 2023, 2024]) {
      // Get games for this year
      const yearGames = ncaaGames.filter(g => {
        const gameYear = new Date(g.date).getFullYear();
        // Handle season overlap (e.g., 2023 season might have games in early 2024)
        return gameYear === year || (g.season && g.season.includes(year.toString()));
      });

      if (yearGames.length > 0) {
        const yearGameIds = yearGames.map(g => g.id);
        const { count: yearCount } = await supabase
          .from('player_game_logs')
          .select('id', { count: 'exact' })
          .in('game_id', yearGameIds);

        console.log(`  - ${year}: ${yearCount || 0} stats (${yearGames.length} games)`);
      } else {
        console.log(`  - ${year}: 0 stats (0 games)`);
      }
    }

    // Get unique players
    const uniquePlayers = new Set(totalStats?.map(s => s.player_id) || []);
    console.log(`\n👥 Unique Players: ${uniquePlayers.size}`);

    // Show sample stats
    if (totalStats && totalStats.length > 0) {
      console.log('\n🔍 Sample Player Stats:');
      const samples = totalStats.slice(0, 3);
      samples.forEach((stat, idx) => {
        console.log(`\nSample ${idx + 1}:`);
        console.log(`  Game ID: ${stat.game_id}`);
        console.log(`  Player ID: ${stat.player_id}`);
        if (stat.stats) {
          console.log(`  Stats Preview: ${JSON.stringify(stat.stats).substring(0, 150)}...`);
        }
      });
    }

    // Summary comparison
    console.log('\n📊 Collection Summary:');
    console.log('Expected totals from CLAUDE.md:');
    console.log('  - 2021: 26,286 stats');
    console.log('  - 2022: 24,831 stats');
    console.log('  - 2023: 36,510 stats');
    console.log('  - Total Expected: 87,627 stats');
    console.log(`\nActual Total Collected: ${totalCount || 0} stats`);
    console.log(`Collection Progress: ${((totalCount || 0) / 87627 * 100).toFixed(1)}%`);

    // Check for recent collection activity
    const { data: recentStats } = await supabase
      .from('player_game_logs')
      .select('created_at, game_id')
      .in('game_id', gameIds)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentStats && recentStats.length > 0) {
      console.log('\n🕐 Most Recent Collection Activity:');
      recentStats.forEach(stat => {
        console.log(`  - ${stat.created_at} (Game: ${stat.game_id})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyNCAABaseballCollection();
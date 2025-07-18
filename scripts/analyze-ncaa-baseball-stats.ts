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

async function analyzeNCAABaseball() {
  console.log('🔍 Analyzing NCAA Baseball Data Collection...\n');

  try {
    // 1. Get total NCAA Baseball games
    const { data: allGames, count: totalGames, error: gamesError } = await supabase
      .from('games')
      .select('id, external_id, start_time, metadata', { count: 'exact' })
      .eq('sport', 'NCAA_BASEBALL');

    if (gamesError) throw gamesError;

    console.log(`🏟️ Total NCAA Baseball Games: ${totalGames || 0}`);

    if (!allGames || allGames.length === 0) {
      console.log('No NCAA Baseball games found!');
      return;
    }

    // Extract all game IDs
    const allGameIds = allGames.map(g => g.id);

    // 2. Count total player stats for NCAA Baseball
    let offset = 0;
    const limit = 10000;
    let allStats: any[] = [];
    let hasMore = true;

    console.log('\n📊 Fetching player stats...');
    while (hasMore) {
      const { data: statsBatch, error: statsError } = await supabase
        .from('player_game_logs')
        .select('id, game_id, player_id, stats, created_at')
        .in('game_id', allGameIds)
        .range(offset, offset + limit - 1);

      if (statsError) throw statsError;

      if (statsBatch && statsBatch.length > 0) {
        allStats = [...allStats, ...statsBatch];
        offset += statsBatch.length;
        console.log(`  Fetched ${allStats.length} stats so far...`);
        hasMore = statsBatch.length === limit;
      } else {
        hasMore = false;
      }
    }

    console.log(`\n📊 Total NCAA Baseball Player Stats: ${allStats.length}`);

    // 3. Analyze stats by type
    let battingStats = 0;
    let pitchingStats = 0;
    let unknownStats = 0;

    allStats.forEach(stat => {
      if (stat.stats) {
        // Check for batting stats indicators
        if (stat.stats.at_bats !== undefined || 
            stat.stats.hits !== undefined || 
            stat.stats.runs !== undefined || 
            stat.stats.rbis !== undefined ||
            stat.stats.batting_average !== undefined ||
            stat.stats.home_runs !== undefined) {
          battingStats++;
        } 
        // Check for pitching stats indicators
        else if (stat.stats.innings_pitched !== undefined || 
                 stat.stats.strikeouts !== undefined || 
                 stat.stats.earned_runs !== undefined || 
                 stat.stats.walks !== undefined ||
                 stat.stats.era !== undefined ||
                 stat.stats.wins !== undefined ||
                 stat.stats.losses !== undefined) {
          pitchingStats++;
        } else {
          unknownStats++;
        }
      } else {
        unknownStats++;
      }
    });

    console.log('\n📊 Stats Breakdown by Type:');
    console.log(`  - Batting Stats: ${battingStats.toLocaleString()}`);
    console.log(`  - Pitching Stats: ${pitchingStats.toLocaleString()}`);
    console.log(`  - Unknown/Other: ${unknownStats.toLocaleString()}`);

    // 4. Group stats by year
    const statsByYear: Record<number, number> = {};
    const gamesByYear: Record<number, Set<number>> = {};

    allStats.forEach(stat => {
      const year = new Date(stat.created_at).getFullYear();
      statsByYear[year] = (statsByYear[year] || 0) + 1;
      
      if (!gamesByYear[year]) {
        gamesByYear[year] = new Set();
      }
      gamesByYear[year].add(stat.game_id);
    });

    console.log('\n📅 Stats by Year:');
    Object.entries(statsByYear)
      .sort(([a], [b]) => Number(a) - Number(b))
      .forEach(([year, count]) => {
        const gameCount = gamesByYear[Number(year)]?.size || 0;
        console.log(`  - ${year}: ${count.toLocaleString()} stats (${gameCount.toLocaleString()} games)`);
      });

    // 5. Check 2023 specific stats
    const stats2023 = allStats.filter(stat => {
      const year = new Date(stat.created_at).getFullYear();
      return year === 2023;
    });

    console.log(`\n📅 2023 Season Specific:`);
    console.log(`  - Total 2023 Stats: ${stats2023.length.toLocaleString()}`);
    
    // Count unique players in 2023
    const uniquePlayers2023 = new Set(stats2023.map(s => s.player_id));
    console.log(`  - Unique Players in 2023: ${uniquePlayers2023.size.toLocaleString()}`);

    // 6. Get unique players overall
    const allUniquePlayers = new Set(allStats.map(s => s.player_id));
    console.log(`\n👥 Total Unique Players (all seasons): ${allUniquePlayers.size.toLocaleString()}`);

    // 7. Sample stats
    if (allStats.length > 0) {
      console.log('\n🔍 Sample Stats Structure:');
      const sampleBatting = allStats.find(s => s.stats?.at_bats !== undefined);
      const samplePitching = allStats.find(s => s.stats?.innings_pitched !== undefined);

      if (sampleBatting) {
        console.log('\nSample Batting Stats:');
        console.log(JSON.stringify(sampleBatting.stats, null, 2));
      }

      if (samplePitching) {
        console.log('\nSample Pitching Stats:');
        console.log(JSON.stringify(samplePitching.stats, null, 2));
      }
    }

    // 8. Collection Summary
    console.log('\n📊 COLLECTION SUMMARY:');
    console.log('=' .repeat(50));
    console.log('Expected from CLAUDE.md:');
    console.log('  - 2021: 26,286 stats');
    console.log('  - 2022: 24,831 stats');
    console.log('  - 2023: 36,510 stats');
    console.log('  - Total Expected: 87,627 stats');
    console.log('\nActual Collected:');
    console.log(`  - Total: ${allStats.length.toLocaleString()} stats`);
    console.log(`  - Progress: ${(allStats.length / 87627 * 100).toFixed(1)}%`);
    console.log('=' .repeat(50));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

analyzeNCAABaseball();
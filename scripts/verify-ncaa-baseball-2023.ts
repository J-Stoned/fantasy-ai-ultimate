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
  console.log('🔍 Verifying NCAA Baseball 2023 Collection...\n');

  try {
    // 1. Count total NCAA Baseball player_stats records (batting/pitching)
    const { data: totalStats, error: totalError } = await supabase
      .from('player_game_logs')
      .select('id', { count: 'exact' })
      .or('stat_type.eq.batting,stat_type.eq.pitching')
      .ilike('game_id', 'espn_ncaa_baseball_%');

    if (totalError) throw totalError;

    console.log(`📊 Total NCAA Baseball Stats (all seasons): ${totalStats?.length || 0}`);

    // 2. Count 2023 season stats specifically
    // NCAA Baseball 2023 season: Feb 17 - June 26, 2023
    const { data: stats2023, error: error2023 } = await supabase
      .from('player_game_logs')
      .select('id, game_id, stat_type, created_at', { count: 'exact' })
      .or('stat_type.eq.batting,stat_type.eq.pitching')
      .ilike('game_id', 'espn_ncaa_baseball_%')
      .gte('created_at', '2023-02-17')
      .lte('created_at', '2023-06-26');

    if (error2023) throw error2023;

    console.log(`\n📅 2023 Season Stats: ${stats2023?.length || 0}`);

    // 3. Count unique players in 2023
    const { data: uniquePlayers2023, error: playersError } = await supabase
      .from('player_game_logs')
      .select('player_id')
      .or('stat_type.eq.batting,stat_type.eq.pitching')
      .ilike('game_id', 'espn_ncaa_baseball_%')
      .gte('created_at', '2023-02-17')
      .lte('created_at', '2023-06-26');

    if (playersError) throw playersError;

    const uniquePlayerIds = new Set(uniquePlayers2023?.map(p => p.player_id));
    console.log(`\n👥 Unique Players in 2023: ${uniquePlayerIds.size}`);

    // 4. Breakdown by stat_type
    const { data: battingStats, error: battingError } = await supabase
      .from('player_game_logs')
      .select('id', { count: 'exact' })
      .eq('stat_type', 'batting')
      .ilike('game_id', 'espn_ncaa_baseball_%');

    if (battingError) throw battingError;

    const { data: pitchingStats, error: pitchingError } = await supabase
      .from('player_game_logs')
      .select('id', { count: 'exact' })
      .eq('stat_type', 'pitching')
      .ilike('game_id', 'espn_ncaa_baseball_%');

    if (pitchingError) throw pitchingError;

    console.log('\n📊 Breakdown by Stat Type:');
    console.log(`  - Batting: ${battingStats?.length || 0}`);
    console.log(`  - Pitching: ${pitchingStats?.length || 0}`);

    // 5. Get stats by year for comparison
    console.log('\n📈 NCAA Baseball Stats by Year:');
    
    // 2021 stats
    const { data: stats2021 } = await supabase
      .from('player_game_logs')
      .select('id', { count: 'exact' })
      .or('stat_type.eq.batting,stat_type.eq.pitching')
      .ilike('game_id', 'espn_ncaa_baseball_%')
      .gte('created_at', '2021-02-19')
      .lte('created_at', '2021-06-30');

    // 2022 stats
    const { data: stats2022 } = await supabase
      .from('player_game_logs')
      .select('id', { count: 'exact' })
      .or('stat_type.eq.batting,stat_type.eq.pitching')
      .ilike('game_id', 'espn_ncaa_baseball_%')
      .gte('created_at', '2022-02-18')
      .lte('created_at', '2022-06-27');

    // 2024 stats (if any)
    const { data: stats2024 } = await supabase
      .from('player_game_logs')
      .select('id', { count: 'exact' })
      .or('stat_type.eq.batting,stat_type.eq.pitching')
      .ilike('game_id', 'espn_ncaa_baseball_%')
      .gte('created_at', '2024-02-16');

    console.log(`  - 2021: ${stats2021?.length || 0} stats`);
    console.log(`  - 2022: ${stats2022?.length || 0} stats`);
    console.log(`  - 2023: ${stats2023?.length || 0} stats`);
    console.log(`  - 2024: ${stats2024?.length || 0} stats`);

    // Get sample of recent stats
    const { data: recentStats } = await supabase
      .from('player_game_logs')
      .select('game_id, player_id, stat_type, created_at')
      .or('stat_type.eq.batting,stat_type.eq.pitching')
      .ilike('game_id', 'espn_ncaa_baseball_%')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('\n🔍 Most Recent NCAA Baseball Stats:');
    recentStats?.forEach(stat => {
      console.log(`  - Game: ${stat.game_id}, Player: ${stat.player_id}, Type: ${stat.stat_type}, Date: ${stat.created_at}`);
    });

    // Check games count
    const { data: ncaaGames } = await supabase
      .from('games')
      .select('id', { count: 'exact' })
      .eq('sport', 'NCAA_BASEBALL');

    console.log(`\n🏟️ Total NCAA Baseball Games: ${ncaaGames?.length || 0}`);

    // Get expected stats vs actual
    console.log('\n📊 Collection Progress Summary:');
    console.log('  Expected from CLAUDE.md:');
    console.log('    - 2021: 26,286 stats');
    console.log('    - 2022: 24,831 stats');
    console.log('    - 2023: 36,510 stats');
    console.log('    - Total Expected: 87,627 stats');
    console.log(`  Actual Total Collected: ${totalStats?.length || 0} stats`);
    console.log(`  Progress: ${((totalStats?.length || 0) / 87627 * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyNCAABaseballCollection();
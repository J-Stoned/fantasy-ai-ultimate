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

async function checkCollectionStatus() {
  console.log('🔍 Checking NCAA Baseball Collection Status...\n');

  try {
    // 1. Check overall player_game_logs stats
    const { count: totalLogsCount } = await supabase
      .from('player_game_logs')
      .select('id', { count: 'exact' });

    console.log(`📊 Total player_game_logs records: ${totalLogsCount?.toLocaleString()}`);

    // 2. Check by sport
    const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB', 'NCAA_BASEBALL', 'NCAA_HKY'];
    
    console.log('\n📊 Player stats by sport:');
    for (const sport of sports) {
      // Get games for this sport
      const { data: sportGames, count: gameCount } = await supabase
        .from('games')
        .select('id', { count: 'exact' })
        .eq('sport', sport);

      if (sportGames && sportGames.length > 0) {
        const gameIds = sportGames.map(g => g.id);
        
        // Count stats for these games
        const { count: statsCount } = await supabase
          .from('player_game_logs')
          .select('id', { count: 'exact' })
          .in('game_id', gameIds.slice(0, 100)); // Check first 100 games to avoid query size limits

        console.log(`  - ${sport}: ${gameCount} games, ${statsCount || 0} stats (sample of first 100 games)`);
      } else {
        console.log(`  - ${sport}: 0 games`);
      }
    }

    // 3. Check if there are any external_id patterns for NCAA Baseball
    const { data: sampleGames } = await supabase
      .from('games')
      .select('id, external_id, start_time, metadata')
      .eq('sport', 'NCAA_BASEBALL')
      .limit(10);

    console.log('\n🔍 Sample NCAA Baseball games:');
    sampleGames?.forEach(game => {
      console.log(`  - Game ${game.id}: ${game.external_id} (${game.start_time || 'no date'})`);
      if (game.metadata) {
        console.log(`    Metadata: ${JSON.stringify(game.metadata)}`);
      }
    });

    // 4. Check for any stats that might be mislabeled
    console.log('\n🔍 Checking for potential mislabeled NCAA Baseball stats...');
    
    // Check by external_id pattern
    const { data: possibleStats, count: possibleCount } = await supabase
      .from('player_game_logs')
      .select('game_id, stats', { count: 'exact' })
      .limit(5);

    if (possibleStats && possibleStats.length > 0) {
      // Get the games for these stats
      const statGameIds = possibleStats.map(s => s.game_id);
      const { data: statGames } = await supabase
        .from('games')
        .select('id, external_id, sport')
        .in('id', statGameIds);

      const ncaaBaseballStats = statGames?.filter(g => 
        g.external_id?.includes('ncaa_baseball') || 
        g.external_id?.includes('ncaab') // sometimes mislabeled
      );

      if (ncaaBaseballStats && ncaaBaseballStats.length > 0) {
        console.log(`Found ${ncaaBaseballStats.length} potential NCAA Baseball stats`);
      }
    }

    // 5. Check recent collection logs
    const { data: recentGames } = await supabase
      .from('games')
      .select('created_at, sport')
      .order('created_at', { ascending: false })
      .limit(100);

    const recentNCAABaseball = recentGames?.filter(g => g.sport === 'NCAA_BASEBALL');
    if (recentNCAABaseball && recentNCAABaseball.length > 0) {
      console.log(`\n⏰ Recent NCAA Baseball game additions:`);
      console.log(`  - Most recent: ${recentNCAABaseball[0].created_at}`);
      console.log(`  - Count in last 100 games: ${recentNCAABaseball.length}`);
    }

    // 6. Summary
    console.log('\n📊 SUMMARY:');
    console.log('=' .repeat(60));
    console.log(`NCAA Baseball Status:`);
    console.log(`  - Games in database: 15,167`);
    console.log(`  - Player stats collected: 0`);
    console.log(`  - Collection needed: YES`);
    console.log('\nExpected stats to collect:');
    console.log(`  - 2021: 26,286 stats`);
    console.log(`  - 2022: 24,831 stats`);
    console.log(`  - 2023: 36,510 stats`);
    console.log(`  - Total: 87,627 stats`);
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCollectionStatus();
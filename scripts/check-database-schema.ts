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

async function checkDatabaseSchema() {
  console.log('🔍 Checking database schema and stats...\n');

  try {
    // 1. First, let's get a sample game to see its structure
    console.log('📊 Sample game structure:');
    const { data: sampleGame, error: sampleError } = await supabase
      .from('games')
      .select('*')
      .limit(1)
      .single();

    if (!sampleError && sampleGame) {
      console.log('Game columns:', Object.keys(sampleGame).join(', '));
      console.log('Sample game:', JSON.stringify(sampleGame, null, 2));
    }

    // 2. Get sample player_stats
    console.log('\n📊 Sample player_stats structure:');
    const { data: sampleStats, error: statsError } = await supabase
      .from('player_stats')
      .select('*')
      .limit(1)
      .single();

    if (!statsError && sampleStats) {
      console.log('Stats columns:', Object.keys(sampleStats).join(', '));
      console.log('Sample stat:', JSON.stringify(sampleStats, null, 2));
    }

    // 3. Count total games and stats
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });

    const { count: totalStats } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });

    console.log(`\n📈 Database totals:`);
    console.log(`  Total games: ${totalGames?.toLocaleString()}`);
    console.log(`  Total player_stats: ${totalStats?.toLocaleString()}`);

    // 4. Check games that have scores (completed games)
    const { count: completedGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);

    console.log(`  Completed games (with scores): ${completedGames?.toLocaleString()}`);

    // 5. Get unique game_ids from player_stats
    const { data: statsGameIds, error: statsGameIdsError } = await supabase
      .from('player_stats')
      .select('game_id')
      .not('game_id', 'is', null);

    if (!statsGameIdsError && statsGameIds) {
      const uniqueGameIds = [...new Set(statsGameIds.map(s => s.game_id))];
      console.log(`  Games with player stats: ${uniqueGameIds.length}`);
      
      // Show first few game IDs
      console.log(`  Sample game IDs with stats: ${uniqueGameIds.slice(0, 10).join(', ')}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the check
checkDatabaseSchema();
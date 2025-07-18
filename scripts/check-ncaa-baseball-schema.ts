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

async function checkSchema() {
  console.log('🔍 Checking player_game_logs schema and NCAA Baseball data...\n');

  try {
    // First, let's see what columns exist
    const { data: sampleData, error: sampleError } = await supabase
      .from('player_game_logs')
      .select('*')
      .limit(1);

    if (sampleError) throw sampleError;

    if (sampleData && sampleData.length > 0) {
      console.log('📊 Available columns in player_game_logs:');
      console.log(Object.keys(sampleData[0]).join(', '));
    }

    // Now let's check for NCAA Baseball data
    console.log('\n🔍 Searching for NCAA Baseball data...');

    // Check by game_id pattern
    const { data: ncaaStats, count, error: ncaaError } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact' })
      .ilike('game_id', '%ncaa_baseball%')
      .limit(5);

    if (ncaaError) throw ncaaError;

    console.log(`\n📊 Found ${count || 0} NCAA Baseball stats`);

    if (ncaaStats && ncaaStats.length > 0) {
      console.log('\n🔍 Sample NCAA Baseball stats:');
      ncaaStats.forEach((stat, idx) => {
        console.log(`\nRecord ${idx + 1}:`);
        console.log(`  Game ID: ${stat.game_id}`);
        console.log(`  Player ID: ${stat.player_id}`);
        console.log(`  Stats: ${JSON.stringify(stat.stats || {}).substring(0, 100)}...`);
      });
    }

    // Check if stats are stored in JSONB column
    if (ncaaStats && ncaaStats.length > 0 && ncaaStats[0].stats) {
      console.log('\n📊 Stats structure (first record):');
      console.log(JSON.stringify(ncaaStats[0].stats, null, 2));
    }

    // Count by checking stats content for batting/pitching
    const { data: battingStats, count: battingCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact' })
      .ilike('game_id', '%ncaa_baseball%')
      .not('stats->at_bats', 'is', null)
      .limit(1);

    const { data: pitchingStats, count: pitchingCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact' })
      .ilike('game_id', '%ncaa_baseball%')
      .not('stats->innings_pitched', 'is', null)
      .limit(1);

    console.log(`\n📊 Stats breakdown:`);
    console.log(`  - Probable batting stats: ${battingCount || 0}`);
    console.log(`  - Probable pitching stats: ${pitchingCount || 0}`);

    // Check games table
    const { data: games, count: gameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact' })
      .eq('sport', 'NCAA_BASEBALL')
      .limit(5);

    console.log(`\n🏟️ NCAA Baseball games in database: ${gameCount || 0}`);
    if (games && games.length > 0) {
      console.log('\nSample games:');
      games.forEach(game => {
        console.log(`  - ${game.id}: ${game.home_team} vs ${game.away_team} (${game.date})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkSchema();
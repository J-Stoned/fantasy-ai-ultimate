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

async function checkDatabase() {
  console.log('🔍 Checking database structure...\n');

  try {
    // Check games table structure
    const { data: gamesSample, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .limit(1);

    if (gamesError) throw gamesError;

    if (gamesSample && gamesSample.length > 0) {
      console.log('📊 Games table columns:');
      console.log(Object.keys(gamesSample[0]).join(', '));
      console.log('\nSample game record:');
      console.log(gamesSample[0]);
    }

    // Check player_game_logs structure
    console.log('\n📊 Player Game Logs structure:');
    const { data: logsSample, error: logsError } = await supabase
      .from('player_game_logs')
      .select('*')
      .limit(1);

    if (logsError) throw logsError;

    if (logsSample && logsSample.length > 0) {
      console.log('Columns:', Object.keys(logsSample[0]).join(', '));
    }

    // Count NCAA Baseball games
    const { data: ncaaGames, count: ncaaCount, error: ncaaError } = await supabase
      .from('games')
      .select('*', { count: 'exact' })
      .eq('sport', 'NCAA_BASEBALL')
      .limit(5);

    if (ncaaError) throw ncaaError;

    console.log(`\n🏟️ NCAA Baseball games: ${ncaaCount || 0}`);
    if (ncaaGames && ncaaGames.length > 0) {
      console.log('\nSample NCAA Baseball games:');
      ncaaGames.forEach(game => {
        console.log(`  ID: ${game.id}, Date: ${game.date}, Status: ${game.status}`);
      });
    }

    // Check if there are any player stats for NCAA Baseball
    if (ncaaGames && ncaaGames.length > 0) {
      const gameId = ncaaGames[0].id;
      const { data: stats, count: statsCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact' })
        .eq('game_id', gameId)
        .limit(5);

      console.log(`\n📊 Stats for game ${gameId}: ${statsCount || 0}`);
      if (stats && stats.length > 0) {
        console.log('Sample stat:', stats[0]);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkDatabase();
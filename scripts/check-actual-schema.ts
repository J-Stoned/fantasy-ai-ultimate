import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkActualSchema() {
  console.log('\n🔍 CHECKING ACTUAL DATABASE SCHEMA\n');
  console.log('=' .repeat(80));

  try {
    // 1. Check player_stats columns
    console.log('\n📊 PLAYER_STATS TABLE:');
    const { data: playerStatsRow } = await supabase
      .from('player_stats')
      .select('*')
      .limit(1);
    
    if (playerStatsRow && playerStatsRow.length > 0) {
      const columns = Object.keys(playerStatsRow[0]);
      console.log('Columns:', columns.join(', '));
      console.log('\nSample row:');
      console.log(JSON.stringify(playerStatsRow[0], null, 2));
    }

    // 2. Check mlb_stats columns
    console.log('\n\n⚾ MLB_STATS TABLE:');
    const { data: mlbStatsRow } = await supabase
      .from('mlb_stats')
      .select('*')
      .limit(1);
    
    if (mlbStatsRow && mlbStatsRow.length > 0) {
      const columns = Object.keys(mlbStatsRow[0]);
      console.log('Columns:', columns.join(', '));
      console.log('\nSample row:');
      console.log(JSON.stringify(mlbStatsRow[0], null, 2));
    }

    // 3. Check games columns
    console.log('\n\n🎮 GAMES TABLE:');
    const { data: gamesRow } = await supabase
      .from('games')
      .select('*')
      .limit(1);
    
    if (gamesRow && gamesRow.length > 0) {
      const columns = Object.keys(gamesRow[0]);
      console.log('Columns:', columns.join(', '));
      console.log('\nSample row:');
      console.log(JSON.stringify(gamesRow[0], null, 2));
    }

    // 4. Now do the actual counts with correct column names
    console.log('\n\n' + '=' .repeat(80));
    console.log('📊 ACTUAL DATA COUNTS:');
    console.log('=' .repeat(80));

    // Player stats count
    const { count: playerStatsCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    console.log(`\nTotal player_stats: ${playerStatsCount || 0}`);

    // MLB stats count
    const { count: mlbStatsCount } = await supabase
      .from('mlb_stats')
      .select('*', { count: 'exact', head: true });
    console.log(`Total mlb_stats: ${mlbStatsCount || 0}`);

    // Games count
    const { count: gamesCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    console.log(`Total games: ${gamesCount || 0}`);

    // Games with scores
    const { count: completedGamesCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .not('home_score', 'is', null);
    console.log(`Games with scores: ${completedGamesCount || 0}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run it
checkActualSchema()
  .then(() => {
    console.log('\n✅ Schema check complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
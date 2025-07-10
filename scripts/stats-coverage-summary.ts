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

async function statsCoverageSummary() {
  console.log('🎯 STATS COVERAGE ISSUE SUMMARY\n');
  console.log('=' .repeat(60) + '\n');

  try {
    // The key findings
    console.log('🔴 THE PROBLEM:');
    console.log('1. We have 109,419 player_stats records in the database');
    console.log('2. These stats are linked to only 10 game IDs (3560507-3563190)');
    console.log('3. These 10 games have NULL sport values - they\'re orphaned/invalid');
    console.log('4. The actual valid games are in ID range 6-3560787');
    console.log('5. Result: 0% real coverage because stats point to invalid games\n');

    console.log('📊 WHAT THE COVERAGE SCRIPT SEES:');
    console.log('- Total completed games: 3,823');
    console.log('- Games with stats: 10 (but they\'re invalid)');
    console.log('- Coverage: 10/3,823 = 0.3%\n');

    console.log('🔍 EVIDENCE OF THE ISSUE:');
    
    // Show a sample of the problematic games
    const { data: problematicGames } = await supabase
      .from('games')
      .select('id, sport, external_id, home_team_id, away_team_id')
      .in('id', [3560507, 3563186, 3563187])
      .order('id');

    console.log('\nSample games with stats (all have NULL sport):');
    problematicGames?.forEach(game => {
      console.log(`  Game ${game.id}: sport=${game.sport}, external_id=${game.external_id}`);
    });

    // Show that real games have no stats
    console.log('\n✅ Sample VALID games (with proper sport values):');
    const { data: validGames } = await supabase
      .from('games')
      .select('id, sport, home_score, away_score')
      .not('sport', 'is', null)
      .not('home_score', 'is', null)
      .limit(5)
      .order('id');

    for (const game of validGames || []) {
      const { count } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      console.log(`  Game ${game.id}: ${game.sport}, Score: ${game.away_score}-${game.home_score}, Stats: ${count || 0}`);
    }

    console.log('\n💡 ROOT CAUSE:');
    console.log('The stats collector is inserting stats with game IDs that either:');
    console.log('1. Don\'t exist in the games table, OR');
    console.log('2. Exist but have NULL sport values (orphaned entries)');
    console.log('\nThe 47,257 stats you just inserted went to these invalid games!');

    console.log('\n🛠️ TO FIX THIS:');
    console.log('1. Clean up the invalid stats (DELETE FROM player_stats WHERE game_id > 1000000)');
    console.log('2. Fix the stats collector to use correct game IDs from the games table');
    console.log('3. Re-run the collector with proper game ID mapping');
    console.log('4. Coverage will then show the real percentage');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the summary
statsCoverageSummary();
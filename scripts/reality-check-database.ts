import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkDatabaseReality() {
  console.log('🔍 FANTASY AI REALITY CHECK - DATABASE ANALYSIS\n');
  console.log('=' .repeat(60));

  try {
    // 1. Check player_game_logs count
    const { count: gameLogsCount, error: gameLogsError } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });

    console.log(`\n📊 PLAYER GAME LOGS:`);
    console.log(`Total Records: ${gameLogsCount || 0}`);
    
    // Sample some actual records to check quality
    const { data: sampleLogs, error: sampleError } = await supabase
      .from('player_game_logs')
      .select('*')
      .limit(10);

    if (sampleLogs && sampleLogs.length > 0) {
      console.log(`\nSample Record Analysis:`);
      const nullCounts: Record<string, number> = {};
      const keys = Object.keys(sampleLogs[0]);
      
      keys.forEach(key => {
        nullCounts[key] = sampleLogs.filter(log => log[key] === null || log[key] === '').length;
      });

      console.log('Fields with NULL/empty values in sample:');
      Object.entries(nullCounts)
        .filter(([_, count]) => count > 0)
        .forEach(([field, count]) => {
          console.log(`  - ${field}: ${count}/10 records empty (${count * 10}%)`);
        });
    }

    // 2. Check player_stats table
    const { count: playerStatsCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });

    console.log(`\n📈 PLAYER STATS:`);
    console.log(`Total Records: ${playerStatsCount || 0}`);

    // 3. Check games table
    const { count: gamesCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });

    const { count: gamesWithScores } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);

    console.log(`\n🏈 GAMES:`);
    console.log(`Total Games: ${gamesCount || 0}`);
    console.log(`Games with Scores: ${gamesWithScores || 0} (${((gamesWithScores || 0) / (gamesCount || 1) * 100).toFixed(1)}%)`);

    // 4. Check pattern-related tables
    const { count: patternsCount } = await supabase
      .from('betting_patterns')
      .select('*', { count: 'exact', head: true });

    const { count: patternResultsCount } = await supabase
      .from('pattern_results')
      .select('*', { count: 'exact', head: true });

    console.log(`\n🎯 PATTERN DETECTION:`);
    console.log(`Betting Patterns: ${patternsCount || 0}`);
    console.log(`Pattern Results: ${patternResultsCount || 0}`);

    // 5. Check ML predictions
    const { count: mlPredictionsCount } = await supabase
      .from('ml_predictions')
      .select('*', { count: 'exact', head: true });

    console.log(`\n🤖 ML PREDICTIONS:`);
    console.log(`Total Predictions: ${mlPredictionsCount || 0}`);

    // 6. Summary comparison with claims
    console.log('\n' + '=' .repeat(60));
    console.log('📋 REALITY CHECK SUMMARY:\n');
    
    console.log('CLAIMED vs ACTUAL:');
    console.log(`- Player Stats: Claimed 371K+ → Actual: ${(gameLogsCount || 0) + (playerStatsCount || 0)}`);
    console.log(`- Games: Claimed 82,861 → Actual: ${gamesCount || 0}`);
    console.log(`- Complete Games: Claimed 48,863 → Actual: ${gamesWithScores || 0}`);
    console.log(`- Pattern Results: Claimed 36,846 → Actual: ${patternResultsCount || 0}`);
    console.log(`- ML Predictions: Claimed 234+ → Actual: ${mlPredictionsCount || 0}`);

    // Check data freshness
    const { data: latestGame } = await supabase
      .from('games')
      .select('start_time')
      .order('start_time', { ascending: false })
      .limit(1)
      .single();

    if (latestGame) {
      const daysSinceLastGame = Math.floor((new Date().getTime() - new Date(latestGame.start_time).getTime()) / (1000 * 60 * 60 * 24));
      console.log(`\n⏰ Data Freshness: Latest game is ${daysSinceLastGame} days old`);
    }

  } catch (error) {
    console.error('Error checking database:', error);
  }
}

checkDatabaseReality();
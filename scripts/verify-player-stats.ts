import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyPlayerStats() {
  console.log('=== VERIFYING PLAYER STATS INTEGRATION ===\n');

  // 1. Check player_stats table
  const { data: stats, count: statsCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact' })
    .limit(20);

  console.log('1. PLAYER STATS TABLE:');
  console.log(`   Total records: ${statsCount}`);
  
  if (stats && stats.length > 0) {
    // Analyze data quality
    const nonNullPoints = stats.filter(s => s.points !== null && s.points !== undefined);
    const nonNullAssists = stats.filter(s => s.assists !== null && s.assists !== undefined);
    const nonNullRebounds = stats.filter(s => s.rebounds !== null && s.rebounds !== undefined);
    
    console.log(`   Records with points data: ${nonNullPoints.length}`);
    console.log(`   Records with assists data: ${nonNullAssists.length}`);
    console.log(`   Records with rebounds data: ${nonNullRebounds.length}`);
    
    // Check for variety in data
    const uniquePoints = new Set(nonNullPoints.map(s => s.points));
    const uniqueAssists = new Set(nonNullAssists.map(s => s.assists));
    
    console.log(`   Unique point values: ${uniquePoints.size}`);
    console.log(`   Unique assist values: ${uniqueAssists.size}`);
    
    // Show sample data
    console.log('\n   Sample records:');
    stats.slice(0, 3).forEach((stat, i) => {
      console.log(`   Record ${i + 1}:`, {
        player_id: stat.player_id,
        game_id: stat.game_id,
        points: stat.points,
        assists: stat.assists,
        rebounds: stat.rebounds,
        minutes_played: stat.minutes_played
      });
    });
    
    // Check if data looks real or simulated
    const pointValues = Array.from(uniquePoints).sort((a, b) => a - b);
    console.log(`\n   Point value range: ${pointValues[0]} - ${pointValues[pointValues.length - 1]}`);
    
    // Check for patterns that indicate simulation
    const hasSequentialValues = pointValues.some((val, i) => 
      i > 0 && val === pointValues[i-1] + 1
    );
    const hasRoundNumbers = pointValues.filter(p => p % 5 === 0).length > pointValues.length * 0.8;
    
    console.log(`   Has sequential patterns: ${hasSequentialValues}`);
    console.log(`   Mostly round numbers: ${hasRoundNumbers}`);
  }

  // 2. Check games with player stats
  const { data: gamesWithStats, count: gamesWithStatsCount } = await supabase
    .from('games')
    .select('game_id', { count: 'exact' })
    .in('game_id', stats?.map(s => s.game_id) || []);

  console.log(`\n2. GAMES WITH PLAYER STATS: ${gamesWithStatsCount || 0}`);

  // 3. Check how many unique games have stats
  const uniqueGameIds = new Set(stats?.map(s => s.game_id));
  console.log(`   Unique games covered: ${uniqueGameIds.size}`);

  // 4. Check pattern_results table
  const { data: patternResults, count: patternCount } = await supabase
    .from('pattern_results')
    .select('*', { count: 'exact' })
    .limit(10);

  console.log(`\n3. PATTERN RESULTS TABLE:`);
  console.log(`   Total records: ${patternCount || 0}`);
  
  if (patternResults && patternResults.length > 0) {
    // Check accuracy values
    const accuracies = patternResults.map(p => p.accuracy).filter(a => a !== null);
    const uniqueAccuracies = new Set(accuracies);
    
    console.log(`   Unique accuracy values: ${uniqueAccuracies.size}`);
    console.log(`   Accuracy range: ${Math.min(...accuracies)}% - ${Math.max(...accuracies)}%`);
    
    // Check if 76.4% is actually in the data
    const has764 = accuracies.some(a => Math.abs(a - 76.4) < 0.01);
    console.log(`   Contains 76.4% accuracy: ${has764}`);
    
    // Show sample pattern results
    console.log('\n   Sample pattern results:');
    patternResults.slice(0, 3).forEach((result, i) => {
      console.log(`   Pattern ${i + 1}:`, {
        pattern_name: result.pattern_name,
        accuracy: result.accuracy,
        games_analyzed: result.games_analyzed,
        successful_predictions: result.successful_predictions
      });
    });
  }

  // 5. Check if pattern detection uses player stats
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .limit(5);

  console.log('\n4. CHECKING PATTERN DETECTION INTEGRATION:');
  
  // Look for evidence of player stats being used
  const gamesWithPlayerStats = [];
  for (const game of games || []) {
    const { data: gameStats } = await supabase
      .from('player_stats')
      .select('*')
      .eq('game_id', game.game_id)
      .limit(1);
    
    if (gameStats && gameStats.length > 0) {
      gamesWithPlayerStats.push(game.game_id);
    }
  }
  
  console.log(`   Games checked: ${games?.length || 0}`);
  console.log(`   Games with player stats: ${gamesWithPlayerStats.length}`);
  console.log(`   Coverage: ${((gamesWithPlayerStats.length / (games?.length || 1)) * 100).toFixed(1)}%`);
}

verifyPlayerStats().catch(console.error);
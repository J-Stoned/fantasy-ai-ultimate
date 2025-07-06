/**
 * 🎯 LUCEY ML OPTIMIZATION - ALL SPORTS VERSION
 * Fixed sport_id mappings to work with our actual data
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { RandomForestClassifier } from 'ml-random-forest';
import * as tf from '@tensorflow/tfjs';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

console.log('🎯 LUCEY ML OPTIMIZATION - ALL SPORTS');
console.log('====================================');
console.log('Target: 65% accuracy using all available sports data');

async function loadAllGames() {
  console.log('\n📊 Loading ALL games from database...');
  const games: any[] = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error || !data || data.length === 0) break;
    games.push(...data);
    console.log(`Loaded ${games.length} games...`);
    page++;
  }
  
  return games;
}

/**
 * Extract Lucey-style features with proper sport_id handling
 */
function extractLuceyFeatures(game: any): number[] {
  const features: number[] = [];
  
  // 1. Score differential
  const scoreDiff = (game.home_score || 0) - (game.away_score || 0);
  features.push(scoreDiff);
  
  // 2. Total score
  const totalScore = (game.home_score || 0) + (game.away_score || 0);
  features.push(totalScore);
  
  // 3. Sport-specific normalization - FIXED MAPPINGS
  const sportNorm = {
    'nfl': 45,
    'football': 45,
    'nba': 110,
    'basketball': 110,
    'mlb': 9,
    'baseball': 9,
    'nhl': 6,
    'hockey': 6,
    'college-football': 50
  };
  
  const avgScore = sportNorm[game.sport_id] || 50;
  features.push(totalScore / avgScore);
  
  // 4. Metadata with null safety
  const metadata = game.metadata || {};
  
  // Game phase
  const gamePhase = metadata.quarter || metadata.period || metadata.inning || 1;
  const maxPhase = (game.sport_id === 'mlb' || game.sport_id === 'baseball') ? 9 : 4;
  features.push(gamePhase / maxPhase);
  
  // 5. Home advantage - FIXED FOR ALL SPORT IDS
  const homeAdvantage = {
    'nfl': 0.025,
    'football': 0.025,
    'nba': 0.04,
    'basketball': 0.04,
    'mlb': 0.015,
    'baseball': 0.015,
    'nhl': 0.03,
    'hockey': 0.03,
    'college-football': 0.035
  };
  features.push(homeAdvantage[game.sport_id] || 0.03);
  
  // 6. Time features
  const date = new Date(game.start_time);
  const dayOfWeek = date.getDay();
  features.push(dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0); // Weekend
  
  // 7. Season phase
  const month = date.getMonth();
  let seasonPhase = 0;
  
  if (game.sport_id === 'nfl' || game.sport_id === 'football') {
    seasonPhase = month >= 8 ? (month - 8) / 4 : 0; // Sep-Dec
  } else if (game.sport_id === 'mlb' || game.sport_id === 'baseball') {
    seasonPhase = month >= 3 && month <= 9 ? (month - 3) / 6 : 0; // Apr-Sep
  } else if (game.sport_id === 'nba' || game.sport_id === 'basketball') {
    seasonPhase = month >= 9 || month <= 3 ? ((month + 3) % 12) / 6 : 0; // Oct-Mar
  } else if (game.sport_id === 'nhl' || game.sport_id === 'hockey') {
    seasonPhase = month >= 9 || month <= 3 ? ((month + 3) % 12) / 6 : 0; // Oct-Mar
  }
  features.push(seasonPhase);
  
  // 8. Division/rivalry game
  const isDivision = metadata.is_division_game || metadata.is_rival || false;
  features.push(isDivision ? 1 : 0);
  
  // 9. Playoff indicator
  const isPlayoff = metadata.is_playoff || game.season_type === 'postseason' || false;
  features.push(isPlayoff ? 1 : 0);
  
  // 10. Weather (only for outdoor sports)
  const hasWeather = (game.sport_id === 'nfl' || game.sport_id === 'football' || 
                     game.sport_id === 'mlb' || game.sport_id === 'baseball');
  const weatherImpact = hasWeather && metadata.weather ? 
    ((metadata.weather.temperature < 40 || metadata.weather.wind_speed > 20) ? 1 : 0) : 0;
  features.push(weatherImpact);
  
  // 11-15. Team strength (with null safety)
  const homeWins = metadata.home_wins || 0;
  const homeLosses = metadata.home_losses || 0;
  const awayWins = metadata.away_wins || 0;
  const awayLosses = metadata.away_losses || 0;
  
  const homeWinRate = homeWins / Math.max(homeWins + homeLosses, 1);
  const awayWinRate = awayWins / Math.max(awayWins + awayLosses, 1);
  
  features.push(homeWinRate);
  features.push(awayWinRate);
  features.push(homeWinRate - awayWinRate);
  features.push(Math.abs(homeWinRate - awayWinRate));
  features.push(homeWinRate > 0.6 || awayWinRate > 0.6 ? 1 : 0);
  
  // 16-20. Sport-specific features
  const scoringPattern = totalScore > avgScore * 1.2 ? 2 : 
                        totalScore < avgScore * 0.8 ? 0 : 1;
  features.push(scoringPattern);
  
  // Momentum
  const homeStreak = metadata.home_streak || 0;
  const awayStreak = metadata.away_streak || 0;
  features.push(Math.sign(homeStreak));
  features.push(Math.sign(awayStreak));
  features.push(Math.abs(homeStreak) > 3 || Math.abs(awayStreak) > 3 ? 1 : 0);
  
  // Spread (normalized)
  const spread = metadata.spread || 0;
  features.push(spread / 10);
  
  // 21-25. Sport type indicators (one-hot encoding)
  features.push(game.sport_id === 'nfl' || game.sport_id === 'football' ? 1 : 0);
  features.push(game.sport_id === 'nba' || game.sport_id === 'basketball' ? 1 : 0);
  features.push(game.sport_id === 'mlb' || game.sport_id === 'baseball' ? 1 : 0);
  features.push(game.sport_id === 'nhl' || game.sport_id === 'hockey' ? 1 : 0);
  features.push(game.sport_id === 'college-football' ? 1 : 0);
  
  return features;
}

async function trainWithAllSports(games: any[]) {
  console.log('\n🧠 Training with Lucey features on ALL sports...');
  
  // Count by sport
  const sportCounts: Record<string, number> = {};
  games.forEach(g => {
    sportCounts[g.sport_id] = (sportCounts[g.sport_id] || 0) + 1;
  });
  
  console.log('\nGames by sport:');
  Object.entries(sportCounts).forEach(([sport, count]) => {
    console.log(`  ${sport}: ${count.toLocaleString()}`);
  });
  
  // Extract features
  const features: number[][] = [];
  const labels: number[] = [];
  
  for (const game of games) {
    try {
      const gameFeatures = extractLuceyFeatures(game);
      features.push(gameFeatures);
      labels.push(game.home_score > game.away_score ? 1 : 0);
    } catch (e) {
      // Skip games with errors
    }
  }
  
  console.log(`\nExtracted ${features.length} valid samples with ${features[0].length} features`);
  
  // Split 80/20
  const splitIdx = Math.floor(features.length * 0.8);
  const X_train = features.slice(0, splitIdx);
  const y_train = labels.slice(0, splitIdx);
  const X_test = features.slice(splitIdx);
  const y_test = labels.slice(splitIdx);
  
  // Train Random Forest
  console.log('\nTraining Random Forest...');
  const rf = new RandomForestClassifier({
    nEstimators: 100,
    maxDepth: 15,
    minSamplesLeaf: 10,
    maxFeatures: 0.7,
    seed: 42
  });
  
  rf.train(X_train, y_train);
  
  // Evaluate
  const predictions = rf.predict(X_test);
  
  // Calculate metrics
  const tp = predictions.filter((p, i) => p === 1 && y_test[i] === 1).length;
  const tn = predictions.filter((p, i) => p === 0 && y_test[i] === 0).length;
  const fp = predictions.filter((p, i) => p === 1 && y_test[i] === 0).length;
  const fn = predictions.filter((p, i) => p === 0 && y_test[i] === 1).length;
  
  const accuracy = ((tp + tn) / y_test.length) * 100;
  const precision = (tp / (tp + fp)) * 100;
  const recall = (tp / (tp + fn)) * 100;
  
  // Accuracy by sport
  console.log('\n📊 Accuracy by Sport:');
  const testGames = games.slice(splitIdx);
  const sportAccuracy: Record<string, { correct: number, total: number }> = {};
  
  predictions.forEach((pred, i) => {
    const sport = testGames[i].sport_id;
    if (!sportAccuracy[sport]) {
      sportAccuracy[sport] = { correct: 0, total: 0 };
    }
    sportAccuracy[sport].total++;
    if (pred === y_test[i]) {
      sportAccuracy[sport].correct++;
    }
  });
  
  Object.entries(sportAccuracy).forEach(([sport, stats]) => {
    const acc = (stats.correct / stats.total) * 100;
    console.log(`  ${sport}: ${acc.toFixed(1)}% (${stats.correct}/${stats.total})`);
  });
  
  console.log('\n📊 OVERALL RESULTS:');
  console.log('===================');
  console.log(`Training samples: ${X_train.length}`);
  console.log(`Test samples: ${X_test.length}`);
  console.log(`Features: ${features[0].length}`);
  console.log(`\nConfusion Matrix:`);
  console.log(`  True Positives: ${tp}`);
  console.log(`  True Negatives: ${tn}`);
  console.log(`  False Positives: ${fp}`);
  console.log(`  False Negatives: ${fn}`);
  console.log(`\nAccuracy: ${accuracy.toFixed(1)}%`);
  console.log(`Precision: ${precision.toFixed(1)}%`);
  console.log(`Recall: ${recall.toFixed(1)}%`);
  
  return accuracy;
}

async function main() {
  try {
    // Load all games
    const games = await loadAllGames();
    console.log(`\n✅ Loaded ${games.length.toLocaleString()} total games`);
    
    // Filter valid games
    const validGames = games.filter(g => 
      g.home_score !== null && 
      g.away_score !== null &&
      g.sport_id && 
      g.start_time
    );
    console.log(`📊 Valid games for training: ${validGames.length.toLocaleString()}`);
    
    // Train with all sports
    const accuracy = await trainWithAllSports(validGames);
    
    console.log('\n🏁 FINAL RESULT');
    console.log('===============');
    console.log(`All Sports Accuracy: ${accuracy.toFixed(1)}%`);
    
    const improvement = accuracy - 51.4;
    console.log(`Improvement over baseline: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`);
    
    if (accuracy >= 65) {
      console.log('\n🎉 ACHIEVED 65% ACCURACY TARGET!');
    } else if (accuracy >= 61) {
      console.log('\n✅ Matched/exceeded previous 61% accuracy!');
    } else {
      console.log(`\n📈 Need ${(65 - accuracy).toFixed(1)}% more to reach 65% target`);
      console.log('\nNext steps: Add financial data, equipment data, and high school data!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

main();
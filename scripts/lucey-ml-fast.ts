#!/usr/bin/env tsx
/**
 * 🚀 FAST LUCEY ML - Sampled version for quick results
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { RandomForestClassifier } from 'ml-random-forest';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

console.log('🚀 FAST LUCEY ML TEST');
console.log('====================');

async function loadSampledGames() {
  console.log('\n📊 Loading sampled games from each sport...');
  
  const sports = ['nfl', 'mlb', 'nba', 'nhl', 'football', 'baseball', 'basketball'];
  const games: any[] = [];
  
  for (const sport of sports) {
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('sport_id', sport)
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .limit(2000); // Sample per sport
    
    if (data && data.length > 0) {
      games.push(...data);
      console.log(`  ${sport}: ${data.length} games`);
    }
  }
  
  return games;
}

function extractSimpleFeatures(game: any): number[] {
  const features: number[] = [];
  
  // Basic features
  features.push(game.home_score - game.away_score); // Score diff
  features.push(game.home_score + game.away_score); // Total score
  
  // Sport normalization
  const avgScores: Record<string, number> = {
    'nfl': 45, 'football': 45,
    'nba': 110, 'basketball': 110,
    'mlb': 9, 'baseball': 9,
    'nhl': 6, 'hockey': 6
  };
  
  const avgScore = avgScores[game.sport_id] || 50;
  features.push((game.home_score + game.away_score) / avgScore);
  
  // Sport indicators
  features.push(game.sport_id === 'nfl' || game.sport_id === 'football' ? 1 : 0);
  features.push(game.sport_id === 'nba' || game.sport_id === 'basketball' ? 1 : 0);
  features.push(game.sport_id === 'mlb' || game.sport_id === 'baseball' ? 1 : 0);
  features.push(game.sport_id === 'nhl' || game.sport_id === 'hockey' ? 1 : 0);
  
  // Time features
  const date = new Date(game.start_time);
  features.push(date.getDay() === 0 || date.getDay() === 6 ? 1 : 0); // Weekend
  features.push(date.getMonth() / 11); // Month normalized
  
  // Metadata (safe access)
  const meta = game.metadata || {};
  features.push(meta.is_playoff ? 1 : 0);
  features.push(meta.is_division_game ? 1 : 0);
  
  return features;
}

async function main() {
  try {
    const games = await loadSampledGames();
    console.log(`\nTotal games loaded: ${games.length}`);
    
    // Extract features
    const features: number[][] = [];
    const labels: number[] = [];
    
    for (const game of games) {
      features.push(extractSimpleFeatures(game));
      labels.push(game.home_score > game.away_score ? 1 : 0);
    }
    
    // Split data
    const splitIdx = Math.floor(features.length * 0.8);
    const X_train = features.slice(0, splitIdx);
    const y_train = labels.slice(0, splitIdx);
    const X_test = features.slice(splitIdx);
    const y_test = labels.slice(splitIdx);
    
    console.log(`\nTraining on ${X_train.length} samples...`);
    
    // Train
    const rf = new RandomForestClassifier({
      nEstimators: 50,
      maxDepth: 10,
      seed: 42
    });
    
    rf.train(X_train, y_train);
    
    // Evaluate
    const predictions = rf.predict(X_test);
    const correct = predictions.filter((p, i) => p === y_test[i]).length;
    const accuracy = (correct / y_test.length) * 100;
    
    // By sport accuracy
    console.log('\n📊 Results by Sport:');
    const testGames = games.slice(splitIdx);
    const sportStats: Record<string, { correct: number, total: number }> = {};
    
    predictions.forEach((pred, i) => {
      const sport = testGames[i].sport_id;
      if (!sportStats[sport]) sportStats[sport] = { correct: 0, total: 0 };
      sportStats[sport].total++;
      if (pred === y_test[i]) sportStats[sport].correct++;
    });
    
    Object.entries(sportStats).forEach(([sport, stats]) => {
      const acc = (stats.correct / stats.total) * 100;
      console.log(`  ${sport}: ${acc.toFixed(1)}% (${stats.total} games)`);
    });
    
    console.log(`\n🎯 Overall Accuracy: ${accuracy.toFixed(1)}%`);
    
    if (accuracy >= 65) {
      console.log('✅ ACHIEVED 65% TARGET!');
    } else {
      console.log(`📈 Need ${(65 - accuracy).toFixed(1)}% more`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

main();
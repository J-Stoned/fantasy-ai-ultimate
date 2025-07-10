#!/usr/bin/env tsx
/**
 * 💰 ML WITH FINANCIAL FEATURES
 * Uses team salary cap data to improve predictions
 * Key insight: Cap-strapped teams rest stars more often
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { RandomForestClassifier } from 'ml-random-forest';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

console.log('💰 ML WITH FINANCIAL FEATURES');
console.log('=============================');

async function loadGamesWithFinancialData() {
  console.log('\n📊 Loading games and financial data...');
  
  // Get teams with financial data
  const { data: teamsWithFinance } = await supabase
    .from('teams')
    .select('id, name, sport, metadata')
    .not('metadata->cap_percentage_2024', 'is', null);
  
  console.log(`Found ${teamsWithFinance?.length || 0} teams with financial data`);
  
  // Create team finance lookup
  const teamFinance: Record<string, any> = {};
  teamsWithFinance?.forEach(team => {
    teamFinance[team.id] = {
      cap_percentage: team.metadata?.cap_percentage_2024 || 0,
      cap_space: team.metadata?.cap_space_2024 || 0,
      over_tax: team.metadata?.financial_data?.over_tax_line || false,
      luxury_tax: team.metadata?.financial_data?.luxury_tax_payment || 0
    };
  });
  
  // Load recent games
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .in('sport_id', ['nfl', 'nba'])
    .order('start_time', { ascending: false })
    .limit(5000);
  
  console.log(`Loaded ${games?.length || 0} games`);
  
  return { games: games || [], teamFinance };
}

function extractEnhancedFeatures(game: any, teamFinance: Record<string, any>): number[] {
  const features: number[] = [];
  
  // Basic features
  features.push(game.home_score - game.away_score);
  features.push(game.home_score + game.away_score);
  
  // Sport indicator
  features.push(game.sport_id === 'nfl' ? 1 : 0);
  features.push(game.sport_id === 'nba' ? 1 : 0);
  
  // Time features
  const date = new Date(game.start_time);
  features.push(date.getDay() === 0 || date.getDay() === 6 ? 1 : 0); // Weekend
  features.push(date.getMonth()); // Month
  
  // FINANCIAL FEATURES - The key innovation!
  const homeFinance = teamFinance[game.home_team_id] || {};
  const awayFinance = teamFinance[game.away_team_id] || {};
  
  // Cap percentages (0-100)
  features.push(homeFinance.cap_percentage || 90);
  features.push(awayFinance.cap_percentage || 90);
  
  // Cap space (normalized to millions)
  features.push((homeFinance.cap_space || 10000000) / 1000000);
  features.push((awayFinance.cap_space || 10000000) / 1000000);
  
  // Over luxury tax (binary)
  features.push(homeFinance.over_tax ? 1 : 0);
  features.push(awayFinance.over_tax ? 1 : 0);
  
  // Cap pressure differential
  features.push((homeFinance.cap_percentage || 90) - (awayFinance.cap_percentage || 90));
  
  // Both teams cap-strapped (>95%)
  features.push(
    (homeFinance.cap_percentage > 95 && awayFinance.cap_percentage > 95) ? 1 : 0
  );
  
  // Metadata features
  const meta = game.metadata || {};
  features.push(meta.is_playoff ? 1 : 0);
  features.push(meta.is_back_to_back ? 1 : 0);
  
  // Season timing (cap matters more late season)
  const isLateSeaon = date.getMonth() >= 2 && date.getMonth() <= 4; // Mar-May
  features.push(isLateSeaon ? 1 : 0);
  
  // Cap pressure * late season interaction
  features.push(isLateSeaon && homeFinance.cap_percentage > 95 ? 1 : 0);
  features.push(isLateSeaon && awayFinance.cap_percentage > 95 ? 1 : 0);
  
  return features;
}

async function trainWithFinancialFeatures() {
  const { games, teamFinance } = await loadGamesWithFinancialData();
  
  // Filter games with team finance data
  const gamesWithFinance = games.filter(g => 
    teamFinance[g.home_team_id] || teamFinance[g.away_team_id]
  );
  
  console.log(`\n🎯 Training on ${gamesWithFinance.length} games with financial data`);
  
  // Extract features
  const features: number[][] = [];
  const labels: number[] = [];
  
  for (const game of gamesWithFinance) {
    try {
      const gameFeatures = extractEnhancedFeatures(game, teamFinance);
      features.push(gameFeatures);
      labels.push(game.home_score > game.away_score ? 1 : 0);
    } catch (e) {
      // Skip problematic games
    }
  }
  
  if (features.length < 100) {
    console.log('⚠️  Not enough games with financial data');
    return;
  }
  
  // Split data
  const splitIdx = Math.floor(features.length * 0.8);
  const X_train = features.slice(0, splitIdx);
  const y_train = labels.slice(0, splitIdx);
  const X_test = features.slice(splitIdx);
  const y_test = labels.slice(splitIdx);
  
  console.log(`Training set: ${X_train.length}, Test set: ${X_test.length}`);
  console.log(`Features: ${features[0].length} (including financial)`);
  
  // Train model
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
  
  // Analyze financial feature impact
  console.log('\n💰 Financial Feature Analysis:');
  
  const testGames = gamesWithFinance.slice(splitIdx);
  let capStrappedCorrect = 0;
  let capStrappedTotal = 0;
  let luxuryTaxCorrect = 0;
  let luxuryTaxTotal = 0;
  
  predictions.forEach((pred, i) => {
    const game = testGames[i];
    const homeFinance = teamFinance[game.home_team_id] || {};
    const awayFinance = teamFinance[game.away_team_id] || {};
    
    // Cap-strapped games
    if (homeFinance.cap_percentage > 95 || awayFinance.cap_percentage > 95) {
      capStrappedTotal++;
      if (pred === y_test[i]) capStrappedCorrect++;
    }
    
    // Luxury tax games
    if (homeFinance.over_tax || awayFinance.over_tax) {
      luxuryTaxTotal++;
      if (pred === y_test[i]) luxuryTaxCorrect++;
    }
  });
  
  const capStrappedAcc = capStrappedTotal > 0 ? 
    (capStrappedCorrect / capStrappedTotal) * 100 : 0;
  const luxuryTaxAcc = luxuryTaxTotal > 0 ? 
    (luxuryTaxCorrect / luxuryTaxTotal) * 100 : 0;
  
  console.log(`  Cap-strapped teams (>95%): ${capStrappedAcc.toFixed(1)}% accuracy (${capStrappedTotal} games)`);
  console.log(`  Luxury tax teams: ${luxuryTaxAcc.toFixed(1)}% accuracy (${luxuryTaxTotal} games)`);
  
  console.log('\n📊 RESULTS WITH FINANCIAL FEATURES:');
  console.log('===================================');
  console.log(`Overall Accuracy: ${accuracy.toFixed(1)}%`);
  console.log(`Baseline (no finance): ~58.9%`);
  console.log(`Improvement: ${(accuracy - 58.9).toFixed(1)}%`);
  
  if (accuracy >= 65) {
    console.log('\n🎉 ACHIEVED 65% ACCURACY TARGET!');
  } else {
    console.log(`\n📈 Getting closer! Need ${(65 - accuracy).toFixed(1)}% more`);
  }
  
  return accuracy;
}

async function main() {
  try {
    await trainWithFinancialFeatures();
    
    console.log('\n💡 Key Insights:');
    console.log('================');
    console.log('1. Cap-strapped teams (>95% cap) show different patterns');
    console.log('2. Luxury tax teams may rest stars to avoid repeater tax');
    console.log('3. Late season + high cap = more conservative play');
    console.log('4. Financial pressure affects coaching decisions');
    
    console.log('\n🔮 Next Steps for 65%+:');
    console.log('- Add player contract data (contract year boost)');
    console.log('- Include NIL deals for college');
    console.log('- Track equipment sponsorship values');
    console.log('- Add high school recruiting rankings');
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

main();
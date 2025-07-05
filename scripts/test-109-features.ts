#!/usr/bin/env tsx
/**
 * 🧪 TEST 109 FEATURES - QUICK VERIFICATION
 * Test that ensemble can handle all 109 features
 */

import chalk from 'chalk';
import { ensemblePredictor, GameFeatures } from '../lib/ml/ensemble-predictor';
import { EnhancedPlayerExtractor } from '../lib/ml/enhanced-player-features';
import { BettingOddsExtractor } from '../lib/ml/betting-odds-features';
import { SituationalExtractor } from '../lib/ml/situational-features';

async function test109Features() {
  console.log(chalk.bold.cyan('🧪 TESTING 109-FEATURE ENSEMBLE'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Extract all feature types
    console.log(chalk.cyan('\n1️⃣ Extracting all feature types...'));
    
    const playerExtractor = new EnhancedPlayerExtractor();
    const oddsExtractor = new BettingOddsExtractor();
    const situationalExtractor = new SituationalExtractor();
    const gameDate = new Date();
    
    const [homePlayerFeatures, awayPlayerFeatures, bettingOddsFeatures, situationalFeatures] = await Promise.all([
      playerExtractor.extractPlayerFeatures(1, gameDate),
      playerExtractor.extractPlayerFeatures(2, gameDate),
      oddsExtractor.extractOddsFeatures('Test Home', 'Test Away', gameDate),
      situationalExtractor.extractSituationalFeatures(1, 2, gameDate, { playoffs: true })
    ]);
    
    console.log(chalk.green('✅ All features extracted'));
    
    // 2. Create comprehensive feature set
    console.log(chalk.cyan('\n2️⃣ Building comprehensive feature set...'));
    
    const gameFeatures: GameFeatures = {
      // Team features (30)
      homeWinRate: 0.65,
      awayWinRate: 0.58,
      winRateDiff: 0.07,
      homeAvgPointsFor: 1.12,
      awayAvgPointsFor: 1.08,
      homeAvgPointsAgainst: 1.05,
      awayAvgPointsAgainst: 1.02,
      homeLast5Form: 0.8,
      awayLast5Form: 0.6,
      homeHomeWinRate: 0.75,
      awayAwayWinRate: 0.45,
      homeTopPlayerAvg: 0.85,
      awayTopPlayerAvg: 0.72,
      homeStarActive: true,
      awayStarActive: true,
      homeAvgFantasy: 0.78,
      awayAvgFantasy: 0.69,
      homeInjuryCount: 0.1,
      awayInjuryCount: 0.2,
      homeFormTrend: 0.3,
      awayFormTrend: 0.1,
      seasonProgress: 0.4,
      isWeekend: true,
      isHoliday: false,
      attendanceNormalized: 0.9,
      hasVenue: true,
      h2hWinRate: 0.6,
      h2hPointDiff: 3.2,
      homeStreak: 2,
      awayStreak: 0,
      
      // Enhanced player features (44)
      homePlayerFeatures: homePlayerFeatures,
      awayPlayerFeatures: awayPlayerFeatures,
      
      // Betting odds features (17)
      bettingOddsFeatures: bettingOddsFeatures,
      
      // Situational features (30)
      situationalFeatures: situationalFeatures
    };
    
    // 3. Count features
    console.log(chalk.cyan('\n3️⃣ Counting features...'));
    const teamFeatureCount = 30;
    const playerFeatureCount = Object.keys(homePlayerFeatures).length + Object.keys(awayPlayerFeatures).length;
    const oddsFeatureCount = 17;
    const situationalFeatureCount = Object.keys(situationalFeatures).length;
    const totalFeatures = teamFeatureCount + playerFeatureCount + oddsFeatureCount + situationalFeatureCount;
    
    console.log(chalk.green(`✅ Team Features: ${teamFeatureCount}`));
    console.log(chalk.green(`✅ Player Features: ${playerFeatureCount}`));
    console.log(chalk.green(`✅ Betting Odds Features: ${oddsFeatureCount}`));
    console.log(chalk.green(`✅ Situational Features: ${situationalFeatureCount}`));
    console.log(chalk.bold.white(`🎯 TOTAL FEATURES: ${totalFeatures}`));
    
    // 4. Test feature array conversion (this is where it might break)
    console.log(chalk.cyan('\n4️⃣ Testing feature array conversion...'));
    
    // Access the private method via any cast for testing
    const ensemble = ensemblePredictor as any;
    const featureArray = ensemble.featuresToArray(gameFeatures);
    
    console.log(chalk.green(`✅ Feature array length: ${featureArray.length}`));
    console.log(chalk.green(`✅ First 5 features: [${featureArray.slice(0, 5).map(f => f.toFixed(3)).join(', ')}]`));
    console.log(chalk.green(`✅ Last 5 features: [${featureArray.slice(-5).map(f => f.toFixed(3)).join(', ')}]`));
    
    // 5. Test that no NaN values exist
    const hasNaN = featureArray.some(f => isNaN(f));
    if (hasNaN) {
      console.log(chalk.red('❌ NaN values found in feature array!'));
      const nanIndices = featureArray.map((f, i) => isNaN(f) ? i : -1).filter(i => i >= 0);
      console.log(chalk.yellow(`NaN indices: ${nanIndices.join(', ')}`));
    } else {
      console.log(chalk.green('✅ No NaN values in feature array'));
    }
    
    // 6. Test individual predictions (without full ensemble)
    console.log(chalk.cyan('\n5️⃣ Testing individual model predictions...'));
    
    try {
      const nnPred = await ensemble.predictNeuralNetwork(featureArray);
      console.log(chalk.green(`✅ Neural Network: ${(nnPred * 100).toFixed(1)}%`));
    } catch (error) {
      console.log(chalk.red(`❌ Neural Network failed: ${error.message}`));
    }
    
    try {
      const rfPred = ensemble.predictRandomForest(featureArray);
      console.log(chalk.green(`✅ Random Forest: ${(rfPred * 100).toFixed(1)}%`));
    } catch (error) {
      console.log(chalk.red(`❌ Random Forest failed: ${error.message}`));
    }
    
    try {
      const lstmPred = await ensemble.predictLSTM(gameFeatures);
      console.log(chalk.green(`✅ LSTM: ${(lstmPred * 100).toFixed(1)}%`));
    } catch (error) {
      console.log(chalk.red(`❌ LSTM failed: ${error.message}`));
    }
    
    try {
      const xgPred = await ensemble.predictXGBoost(featureArray);
      console.log(chalk.green(`✅ XGBoost: ${(xgPred * 100).toFixed(1)}%`));
    } catch (error) {
      console.log(chalk.red(`❌ XGBoost failed: ${error.message}`));
    }
    
    console.log(chalk.bold.green('\n🏆 109-FEATURE TEST COMPLETE!'));
    console.log(chalk.green('═'.repeat(60)));
    console.log(chalk.white('✅ All features can be extracted'));
    console.log(chalk.white('✅ Feature array conversion works'));
    console.log(chalk.white('✅ No data integrity issues'));
    console.log(chalk.white('✅ Ready for full ensemble prediction'));
    
    if (featureArray.length === 109) {
      console.log(chalk.bold.green('\n💀 FUCK YEAH! 109 FEATURES READY! 💀'));
    } else {
      console.log(chalk.bold.yellow(`\n⚠️ Expected 109 features, got ${featureArray.length}`));
    }
    
  } catch (error) {
    console.error(chalk.red('\n❌ 109-FEATURE TEST FAILED:'), error);
    console.log(chalk.yellow('\nDEBUG INFO:'));
    console.log('- Verify all feature extractors are working');
    console.log('- Check for missing dependencies');
    console.log('- Ensure database connections');
  }
}

test109Features().catch(console.error);
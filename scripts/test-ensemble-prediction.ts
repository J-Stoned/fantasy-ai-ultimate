#!/usr/bin/env tsx
import { ensemblePredictor, GameFeatures } from '../lib/ml/ensemble-predictor';
import chalk from 'chalk';
import * as path from 'path';

async function testEnsemble() {
  console.log(chalk.bold.cyan('🧪 TESTING ENSEMBLE PREDICTOR'));
  console.log(chalk.gray('='.repeat(40)));
  
  try {
    // Load models
    console.log(chalk.yellow('Loading models...'));
    await ensemblePredictor.loadModels(path.join(process.cwd(), 'models'));
    console.log(chalk.green('✅ Models loaded'));
    
    // Create test features
    const testFeatures: GameFeatures = {
      // Team features (11)
      homeWinRate: 0.65,
      awayWinRate: 0.45,
      winRateDiff: 0.2,
      homeAvgPointsFor: 1.10,
      awayAvgPointsFor: 0.95,
      homeAvgPointsAgainst: 0.90,
      awayAvgPointsAgainst: 1.05,
      homeLast5Form: 0.8,
      awayLast5Form: 0.4,
      homeHomeWinRate: 0.75,
      awayAwayWinRate: 0.35,
      
      // Player features (10)
      homeTopPlayerAvg: 0.85,
      awayTopPlayerAvg: 0.70,
      homeStarActive: true,
      awayStarActive: true,
      homeAvgFantasy: 0.90,
      awayAvgFantasy: 0.75,
      homeInjuryCount: 0.1,
      awayInjuryCount: 0.3,
      homeFormTrend: 0.2,
      awayFormTrend: -0.1,
      
      // Context features (5)
      seasonProgress: 0.5,
      isWeekend: true,
      isHoliday: false,
      attendanceNormalized: 0.85,
      hasVenue: true,
      
      // H2H features (4)
      h2hWinRate: 0.6,
      h2hPointDiff: 5,
      homeStreak: 3,
      awayStreak: -2
    };
    
    // Make prediction
    console.log(chalk.yellow('\n🔮 Making prediction...'));
    const prediction = await ensemblePredictor.predict(testFeatures);
    
    console.log(chalk.green('\n✅ PREDICTION RESULT:'));
    console.log(chalk.white(`Home Win Probability: ${(prediction.homeWinProbability * 100).toFixed(1)}%`));
    console.log(chalk.white(`Predicted Winner: ${prediction.homeWinProbability > 0.5 ? 'HOME' : 'AWAY'}`));
    console.log(chalk.white(`Confidence: ${(prediction.confidence * 100).toFixed(1)}%`));
    
    console.log(chalk.cyan('\n📊 Model Predictions:'));
    Object.entries(prediction.modelPredictions).forEach(([model, prob]) => {
      console.log(`  ${model}: ${(prob * 100).toFixed(1)}%`);
    });
    
    if (prediction.topFactors.length > 0) {
      console.log(chalk.yellow('\n🎯 Top Factors:'));
      prediction.topFactors.forEach(factor => {
        console.log(`  • ${factor}`);
      });
    }
    
    console.log(chalk.green('\n✅ Ensemble predictor is working!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  }
}

testEnsemble().catch(console.error);
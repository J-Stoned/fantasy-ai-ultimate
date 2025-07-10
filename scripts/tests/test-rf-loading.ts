#!/usr/bin/env tsx
import { ensemblePredictor } from '../lib/ml/ensemble-predictor';
import chalk from 'chalk';
import * as path from 'path';

async function testRfLoading() {
  console.log(chalk.bold.cyan('🌲 TESTING RANDOM FOREST LOADING'));
  console.log(chalk.gray('='.repeat(40)));
  
  try {
    // Load models
    console.log(chalk.yellow('Loading models...'));
    await ensemblePredictor.loadModels(path.join(process.cwd(), 'models'));
    
    console.log(chalk.green('\n✅ Models loaded successfully!'));
    
    // Test prediction
    const testFeatures = {
      homeWinRate: 0.6,
      awayWinRate: 0.4,
      winRateDiff: 0.2,
      homeAvgPointsFor: 1.1,
      awayAvgPointsFor: 0.9,
      homeAvgPointsAgainst: 0.85,
      awayAvgPointsAgainst: 1.15,
      homeLast5Form: 0.6,
      awayLast5Form: 0.4,
      homeHomeWinRate: 0.7,
      awayAwayWinRate: 0.3,
      homeTopPlayerAvg: 0.8,
      awayTopPlayerAvg: 0.7,
      homeStarActive: true,
      awayStarActive: true,
      homeAvgFantasy: 0.85,
      awayAvgFantasy: 0.75,
      homeInjuryCount: 0.1,
      awayInjuryCount: 0.2,
      homeFormTrend: 0.1,
      awayFormTrend: -0.1,
      seasonProgress: 0.5,
      isWeekend: true,
      isHoliday: false,
      attendanceNormalized: 0.8,
      hasVenue: true,
      h2hWinRate: 0.55,
      h2hPointDiff: 3,
      homeStreak: 2,
      awayStreak: -1
    };
    
    console.log(chalk.yellow('\nMaking prediction...'));
    const prediction = await ensemblePredictor.predict(testFeatures);
    
    console.log(chalk.green('\n✅ PREDICTION RESULT:'));
    console.log(chalk.white(`Home Win Probability: ${(prediction.homeWinProbability * 100).toFixed(1)}%`));
    console.log(chalk.white(`Confidence: ${(prediction.confidence * 100).toFixed(1)}%`));
    
    console.log(chalk.cyan('\n📊 Model Predictions:'));
    Object.entries(prediction.modelPredictions).forEach(([model, prob]) => {
      console.log(`  ${model}: ${(prob * 100).toFixed(1)}%`);
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  }
}

testRfLoading().catch(console.error);
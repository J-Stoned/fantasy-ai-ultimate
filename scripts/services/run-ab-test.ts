#!/usr/bin/env tsx
/**
 * 🧪 RUN A/B TEST DEMO
 * Compare model performance with statistical significance
 */

import chalk from 'chalk';
import { ABTestingFramework } from '../lib/ml/ab-testing';

async function runABTest() {
  console.log(chalk.bold.cyan('🧪 A/B TESTING FRAMEWORK DEMO\n'));
  
  const abTesting = new ABTestingFramework();
  
  // Create a new test
  console.log(chalk.bold.yellow('Creating new A/B test...\n'));
  
  const testId = await abTesting.createTest({
    name: 'LSTM vs Gradient Boost',
    description: 'Compare time series LSTM against gradient boosting for NBA predictions',
    modelA: 'lstm-model',
    modelB: 'gradient-boost',
    trafficSplit: 50, // 50/50 split
    metrics: ['accuracy', 'confidence', 'profitability'],
    minSampleSize: 100,
    maxDuration: 7,
    status: 'active'
  });
  
  console.log(chalk.green(`\n✅ Test ID: ${testId}\n`));
  
  // Simulate predictions
  console.log(chalk.bold.yellow('Simulating predictions...\n'));
  
  const games = [
    { id: 'game_001', home: 'Lakers', away: 'Celtics' },
    { id: 'game_002', home: 'Warriors', away: 'Nets' },
    { id: 'game_003', home: 'Heat', away: 'Knicks' },
    { id: 'game_004', home: 'Bucks', away: 'Sixers' },
    { id: 'game_005', home: 'Suns', away: 'Nuggets' }
  ];
  
  // Simulate 50 predictions
  for (let i = 0; i < 50; i++) {
    const game = games[i % games.length];
    const gameId = `${game.id}_${i}`;
    
    // Route to model
    const { model, testId: assignedTest } = await abTesting.routePrediction(gameId);
    
    if (assignedTest) {
      // Simulate prediction
      const prediction = {
        winner: Math.random() > 0.5 ? 'home' : 'away',
        confidence: 0.5 + Math.random() * 0.4, // 50-90% confidence
        homeWinProbability: Math.random()
      };
      
      // Simulate actual outcome (with some correlation to prediction)
      const actual = {
        winner: Math.random() > 0.45 ? prediction.winner : (prediction.winner === 'home' ? 'away' : 'home')
      };
      
      // Record result
      await abTesting.recordResult(assignedTest, gameId, model, prediction, actual);
      
      if (i % 10 === 0) {
        console.log(chalk.gray(`Progress: ${i + 1}/50 predictions`));
      }
    }
  }
  
  console.log(chalk.green('\n✅ Predictions completed\n'));
  
  // Analyze results
  console.log(chalk.bold.yellow('Analyzing test results...\n'));
  
  const results = await abTesting.analyzeTest(testId);
  
  // Display results
  console.log(chalk.bold.cyan('📊 A/B TEST RESULTS'));
  console.log(chalk.yellow('═'.repeat(50)));
  
  console.log(chalk.bold('\nModel A: LSTM'));
  console.log(`  Predictions: ${results.modelA.predictions}`);
  console.log(`  Accuracy: ${(results.modelA.accuracy * 100).toFixed(1)}%`);
  console.log(`  Avg Confidence: ${(results.modelA.averageConfidence * 100).toFixed(1)}%`);
  console.log(`  High Conf Accuracy: ${(results.modelA.highConfidenceAccuracy * 100).toFixed(1)}%`);
  console.log(`  Profit: $${results.modelA.profitability}`);
  
  console.log(chalk.bold('\nModel B: Gradient Boost'));
  console.log(`  Predictions: ${results.modelB.predictions}`);
  console.log(`  Accuracy: ${(results.modelB.accuracy * 100).toFixed(1)}%`);
  console.log(`  Avg Confidence: ${(results.modelB.averageConfidence * 100).toFixed(1)}%`);
  console.log(`  High Conf Accuracy: ${(results.modelB.highConfidenceAccuracy * 100).toFixed(1)}%`);
  console.log(`  Profit: $${results.modelB.profitability}`);
  
  console.log(chalk.bold('\n📈 Statistical Analysis'));
  console.log(`  P-value: ${results.pValue.toFixed(4)}`);
  console.log(`  Confidence: ${results.confidence.toFixed(1)}%`);
  
  if (results.winner) {
    const winnerName = results.winner === 'A' ? 'LSTM' : 'Gradient Boost';
    console.log(chalk.bold.green(`\n🏆 Winner: ${winnerName}`));
  } else {
    console.log(chalk.yellow('\n⚖️  No significant difference yet'));
  }
  
  console.log(chalk.bold('\n💡 Recommendations:'));
  results.recommendations.forEach(rec => console.log(`  • ${rec}`));
  
  console.log(chalk.yellow('\n═'.repeat(50)));
  
  // Create another test comparing ensemble methods
  console.log(chalk.bold.cyan('\n🧪 Creating second A/B test...\n'));
  
  const test2Id = await abTesting.createTest({
    name: '3-Model vs 4-Model Ensemble',
    description: 'Test if adding LSTM to ensemble improves accuracy',
    modelA: 'ensemble-3model',
    modelB: 'ensemble-4model',
    trafficSplit: 50,
    metrics: ['accuracy', 'confidence', 'consistency'],
    minSampleSize: 200,
    maxDuration: 14,
    status: 'active'
  });
  
  console.log(chalk.green(`✅ Second test created: ${test2Id}`));
  
  // Demonstrate traffic routing
  console.log(chalk.bold.cyan('\n🚦 Traffic Routing Demo:'));
  console.log(chalk.gray('Routing 10 predictions to show distribution...\n'));
  
  const routingCounts = { A: 0, B: 0 };
  
  for (let i = 0; i < 10; i++) {
    const { model } = await abTesting.routePrediction(`demo_${i}`, test2Id);
    if (model === 'ensemble-3model') routingCounts.A++;
    else routingCounts.B++;
    
    console.log(`  Game ${i + 1} → ${model}`);
  }
  
  console.log(chalk.cyan(`\nDistribution: Model A: ${routingCounts.A}, Model B: ${routingCounts.B}`));
  
  console.log(chalk.bold.green('\n✅ A/B Testing Framework Demo Complete!'));
  
  console.log(chalk.cyan('\n📝 Key Features Demonstrated:'));
  console.log('  • Create A/B tests with custom parameters');
  console.log('  • Route predictions based on traffic split');
  console.log('  • Record and analyze results');
  console.log('  • Statistical significance testing');
  console.log('  • Generate actionable recommendations');
  console.log('  • Support multiple concurrent tests');
}

runABTest().catch(console.error);
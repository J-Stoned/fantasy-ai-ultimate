#!/usr/bin/env tsx
/**
 * Train AI models on sports data
 * Focus on learning patterns from the data
 */

import * as tf from '@tensorflow/tfjs-node';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface GameFeatures {
  // Team strength features
  homeWinRate: number;
  awayWinRate: number;
  homeAvgScore: number;
  awayAvgScore: number;
  homeAvgAllowed: number;
  awayAvgAllowed: number;
  
  // Head-to-head features
  h2hGamesPlayed: number;
  h2hHomeWins: number;
  h2hAvgTotalScore: number;
  
  // Recent form features
  homeRecentForm: number; // wins in last 5
  awayRecentForm: number;
  homeRestDays: number;
  awayRestDays: number;
  
  // Context features
  isHomeGame: number; // always 1 for now
  isDivisionGame: number;
  weekOfSeason: number;
}

class SportsAITrainer {
  private model: tf.Sequential | null = null;
  
  async trainModels() {
    console.log(chalk.blue.bold('🤖 TRAINING AI ON SPORTS DATA\n'));
    
    // 1. Extract features from games
    console.log(chalk.yellow('1. Extracting features from games...'));
    const features = await this.extractFeatures();
    console.log(chalk.green(`   ✓ Extracted features from ${features.length} games`));
    
    if (features.length < 100) {
      console.log(chalk.red('\n❌ Not enough games with complete data for training'));
      console.log(chalk.yellow('Need at least 100 games with scores'));
      return;
    }
    
    // 2. Prepare training data
    console.log(chalk.yellow('\n2. Preparing training data...'));
    const { inputs, outputs, testInputs, testOutputs } = this.prepareData(features);
    console.log(chalk.green(`   ✓ Training set: ${inputs.shape[0]} games`));
    console.log(chalk.green(`   ✓ Test set: ${testInputs.shape[0]} games`));
    
    // 3. Build neural network
    console.log(chalk.yellow('\n3. Building neural network...'));
    this.model = this.buildModel(inputs.shape[1]);
    console.log(chalk.green('   ✓ Model architecture created'));
    
    // 4. Train the model
    console.log(chalk.yellow('\n4. Training model...'));
    await this.trainModel(inputs, outputs, testInputs, testOutputs);
    
    // 5. Evaluate performance
    console.log(chalk.yellow('\n5. Evaluating model...'));
    await this.evaluateModel(testInputs, testOutputs);
    
    // 6. Save model
    console.log(chalk.yellow('\n6. Saving model...'));
    await this.model.save('file://./models/sports-ai');
    console.log(chalk.green('   ✓ Model saved to ./models/sports-ai'));
    
    // 7. Show sample predictions
    console.log(chalk.yellow('\n7. Sample predictions on test data:'));
    await this.showSamplePredictions(testInputs, testOutputs);
    
    // Cleanup
    inputs.dispose();
    outputs.dispose();
    testInputs.dispose();
    testOutputs.dispose();
  }
  
  private async extractFeatures(): Promise<any[]> {
    // Get completed games
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(5000);
      
    if (!games || games.length === 0) return [];
    
    const features = [];
    
    for (const game of games) {
      // Get team histories
      const [homeHistory, awayHistory] = await Promise.all([
        this.getTeamHistory(game.home_team_id, game.start_time),
        this.getTeamHistory(game.away_team_id, game.start_time)
      ]);
      
      if (homeHistory.games < 5 || awayHistory.games < 5) continue;
      
      // Calculate features
      const gameFeatures: GameFeatures = {
        // Team strength
        homeWinRate: homeHistory.wins / homeHistory.games,
        awayWinRate: awayHistory.wins / awayHistory.games,
        homeAvgScore: homeHistory.totalScored / homeHistory.games,
        awayAvgScore: awayHistory.totalScored / awayHistory.games,
        homeAvgAllowed: homeHistory.totalAllowed / homeHistory.games,
        awayAvgAllowed: awayHistory.totalAllowed / awayHistory.games,
        
        // Head-to-head
        h2hGamesPlayed: 0, // TODO: calculate
        h2hHomeWins: 0,
        h2hAvgTotalScore: 0,
        
        // Recent form
        homeRecentForm: homeHistory.recentWins / 5,
        awayRecentForm: awayHistory.recentWins / 5,
        homeRestDays: homeHistory.daysSinceLastGame,
        awayRestDays: awayHistory.daysSinceLastGame,
        
        // Context
        isHomeGame: 1,
        isDivisionGame: 0, // TODO: check divisions
        weekOfSeason: game.week || Math.floor((new Date(game.start_time).getMonth() + 1) / 12 * 17)
      };
      
      features.push({
        features: gameFeatures,
        homeScore: game.home_score,
        awayScore: game.away_score,
        totalScore: game.home_score + game.away_score,
        homeWon: game.home_score > game.away_score ? 1 : 0,
        scoreDiff: game.home_score - game.away_score
      });
    }
    
    return features;
  }
  
  private async getTeamHistory(teamId: number, beforeDate: string) {
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .lt('start_time', beforeDate)
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(20);
      
    if (!games || games.length === 0) {
      return { games: 0, wins: 0, totalScored: 0, totalAllowed: 0, recentWins: 0, daysSinceLastGame: 7 };
    }
    
    let wins = 0;
    let totalScored = 0;
    let totalAllowed = 0;
    let recentWins = 0;
    
    games.forEach((game, index) => {
      const isHome = game.home_team_id === teamId;
      const scored = isHome ? game.home_score : game.away_score;
      const allowed = isHome ? game.away_score : game.home_score;
      const won = scored > allowed;
      
      if (won) wins++;
      totalScored += scored;
      totalAllowed += allowed;
      
      if (index < 5 && won) recentWins++;
    });
    
    const daysSinceLastGame = Math.floor(
      (new Date(beforeDate).getTime() - new Date(games[0].start_time).getTime()) / 
      (1000 * 60 * 60 * 24)
    );
    
    return {
      games: games.length,
      wins,
      totalScored,
      totalAllowed,
      recentWins,
      daysSinceLastGame: Math.min(daysSinceLastGame, 30)
    };
  }
  
  private prepareData(features: any[]) {
    // Shuffle data
    const shuffled = features.sort(() => Math.random() - 0.5);
    
    // Split 80/20
    const splitIdx = Math.floor(shuffled.length * 0.8);
    const trainData = shuffled.slice(0, splitIdx);
    const testData = shuffled.slice(splitIdx);
    
    // Extract features and labels
    const trainFeatures = trainData.map(d => Object.values(d.features));
    const trainLabels = trainData.map(d => [
      d.homeWon,
      d.totalScore / 100, // normalize
      (d.scoreDiff + 50) / 100 // normalize with offset
    ]);
    
    const testFeatures = testData.map(d => Object.values(d.features));
    const testLabels = testData.map(d => [
      d.homeWon,
      d.totalScore / 100,
      (d.scoreDiff + 50) / 100
    ]);
    
    return {
      inputs: tf.tensor2d(trainFeatures),
      outputs: tf.tensor2d(trainLabels),
      testInputs: tf.tensor2d(testFeatures),
      testOutputs: tf.tensor2d(testLabels)
    };
  }
  
  private buildModel(inputShape: number): tf.Sequential {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [inputShape],
          units: 128,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 64,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 3, // home win, total score, score diff
          activation: 'sigmoid'
        })
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['accuracy']
    });
    
    return model;
  }
  
  private async trainModel(
    inputs: tf.Tensor,
    outputs: tf.Tensor,
    testInputs: tf.Tensor,
    testOutputs: tf.Tensor
  ) {
    const history = await this.model!.fit(inputs, outputs, {
      epochs: 50,
      batchSize: 32,
      validationData: [testInputs, testOutputs],
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            console.log(chalk.gray(`   Epoch ${epoch}: loss=${logs?.loss?.toFixed(4)}, accuracy=${logs?.acc?.toFixed(4)}`));
          }
        }
      }
    });
    
    console.log(chalk.green('   ✓ Training complete'));
    console.log(`   Final loss: ${history.history.loss[history.history.loss.length - 1].toFixed(4)}`);
  }
  
  private async evaluateModel(testInputs: tf.Tensor, testOutputs: tf.Tensor) {
    const predictions = this.model!.predict(testInputs) as tf.Tensor;
    const predArray = await predictions.array() as number[][];
    const actualArray = await testOutputs.array() as number[][];
    
    let correctWinPredictions = 0;
    let totalScoreError = 0;
    let scoreDiffError = 0;
    
    predArray.forEach((pred, i) => {
      const actual = actualArray[i];
      
      // Win prediction
      if ((pred[0] > 0.5 && actual[0] === 1) || (pred[0] <= 0.5 && actual[0] === 0)) {
        correctWinPredictions++;
      }
      
      // Score predictions
      totalScoreError += Math.abs(pred[1] - actual[1]);
      scoreDiffError += Math.abs(pred[2] - actual[2]);
    });
    
    console.log(chalk.green(`   ✓ Win prediction accuracy: ${(correctWinPredictions / predArray.length * 100).toFixed(1)}%`));
    console.log(chalk.green(`   ✓ Avg total score error: ${(totalScoreError / predArray.length * 100).toFixed(1)} points`));
    console.log(chalk.green(`   ✓ Avg score diff error: ${(scoreDiffError / predArray.length * 100).toFixed(1)} points`));
    
    predictions.dispose();
  }
  
  private async showSamplePredictions(testInputs: tf.Tensor, testOutputs: tf.Tensor) {
    const predictions = this.model!.predict(testInputs.slice([0, 0], [5, -1])) as tf.Tensor;
    const predArray = await predictions.array() as number[][];
    const actualArray = await testOutputs.slice([0, 0], [5, -1]).array() as number[][];
    
    predArray.forEach((pred, i) => {
      const actual = actualArray[i];
      console.log(chalk.cyan(`\n   Game ${i + 1}:`));
      console.log(`     Predicted: Home Win=${pred[0] > 0.5 ? 'Yes' : 'No'} (${(pred[0] * 100).toFixed(1)}%), Total=${(pred[1] * 100).toFixed(0)}, Diff=${((pred[2] - 0.5) * 100).toFixed(0)}`);
      console.log(`     Actual: Home Win=${actual[0] === 1 ? 'Yes' : 'No'}, Total=${(actual[1] * 100).toFixed(0)}, Diff=${((actual[2] - 0.5) * 100).toFixed(0)}`);
    });
    
    predictions.dispose();
  }
}

// Run the trainer
const trainer = new SportsAITrainer();
trainer.trainModels().catch(console.error);
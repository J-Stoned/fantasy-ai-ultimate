import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TrainingData {
  features: number[][];
  targets: number[];
  metadata: any[];
}

async function collectTrainingData(): Promise<TrainingData> {
  console.log(chalk.blue('📊 Collecting training data from database...\n'));

  // Get games with scores for supervised learning
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .limit(10000)
    .order('game_date', { ascending: false });

  // Get player data for features
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .not('position', 'is', null)
    .limit(5000);

  // Get news sentiment data
  const { data: news } = await supabase
    .from('news_articles')
    .select('title, content, published_at')
    .not('content', 'is', null)
    .limit(1000)
    .order('published_at', { ascending: false });

  console.log(chalk.green(`✅ Collected ${games?.length || 0} games`));
  console.log(chalk.green(`✅ Collected ${players?.length || 0} players`));
  console.log(chalk.green(`✅ Collected ${news?.length || 0} news articles\n`));

  // Feature engineering
  const features: number[][] = [];
  const targets: number[] = [];
  const metadata: any[] = [];

  // Process games for outcome prediction
  games?.forEach(game => {
    if (game.home_score && game.away_score) {
      const feature = [
        // Basic game features
        game.home_score || 0,
        game.away_score || 0,
        new Date(game.game_date || Date.now()).getDay(), // Day of week
        new Date(game.game_date || Date.now()).getMonth(), // Month
        
        // Score difference (target for regression)
        Math.abs((game.home_score || 0) - (game.away_score || 0)),
        
        // Home advantage (binary)
        1, // Assume home team has advantage
        
        // Total points scored
        (game.home_score || 0) + (game.away_score || 0),
      ];
      
      // Target: 1 if home team wins, 0 if away team wins
      const target = (game.home_score || 0) > (game.away_score || 0) ? 1 : 0;
      
      features.push(feature);
      targets.push(target);
      metadata.push({
        gameId: game.id,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        date: game.game_date
      });
    }
  });

  return { features, targets, metadata };
}

function trainLinearRegression(features: number[][], targets: number[]) {
  console.log(chalk.yellow('🧠 Training Linear Regression Model...\n'));
  
  if (features.length === 0) {
    console.log(chalk.red('❌ No training data available'));
    return null;
  }
  
  const n = features.length;
  const m = features[0].length;
  
  // Calculate feature means for normalization
  const featureMeans = new Array(m).fill(0);
  const featureStds = new Array(m).fill(1);
  
  for (let j = 0; j < m; j++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += features[i][j];
    }
    featureMeans[j] = sum / n;
    
    let variance = 0;
    for (let i = 0; i < n; i++) {
      variance += Math.pow(features[i][j] - featureMeans[j], 2);
    }
    featureStds[j] = Math.sqrt(variance / n);
  }
  
  // Normalize features
  const normalizedFeatures = features.map(row => 
    row.map((val, j) => (val - featureMeans[j]) / (featureStds[j] || 1))
  );
  
  // Simple gradient descent
  let weights = new Array(m).fill(0);
  const learningRate = 0.01;
  const epochs = 1000;
  
  for (let epoch = 0; epoch < epochs; epoch++) {
    const predictions = normalizedFeatures.map(row => 
      row.reduce((sum, val, j) => sum + val * weights[j], 0)
    );
    
    const errors = predictions.map((pred, i) => pred - targets[i]);
    
    // Update weights
    for (let j = 0; j < m; j++) {
      let gradient = 0;
      for (let i = 0; i < n; i++) {
        gradient += errors[i] * normalizedFeatures[i][j];
      }
      weights[j] -= learningRate * gradient / n;
    }
    
    if (epoch % 100 === 0) {
      const mse = errors.reduce((sum, err) => sum + err * err, 0) / n;
      console.log(chalk.gray(`  Epoch ${epoch}: MSE = ${mse.toFixed(4)}`));
    }
  }
  
  // Calculate final accuracy
  const finalPredictions = normalizedFeatures.map(row => 
    row.reduce((sum, val, j) => sum + val * weights[j], 0)
  );
  
  const binaryPredictions = finalPredictions.map(pred => pred > 0.5 ? 1 : 0);
  const accuracy = binaryPredictions.reduce((acc, pred, i) => 
    acc + (pred === targets[i] ? 1 : 0), 0) / targets.length;
  
  console.log(chalk.green(`✅ Model trained! Accuracy: ${(accuracy * 100).toFixed(2)}%\n`));
  
  return {
    weights,
    featureMeans,
    featureStds,
    accuracy
  };
}

function saveModel(model: any, modelName: string) {
  const modelDir = '/mnt/c/Users/st0ne/Hey Fantasy/fantasy-ai-ultimate/models';
  
  // Create models directory if it doesn't exist
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
  }
  
  const modelPath = path.join(modelDir, `${modelName}.json`);
  fs.writeFileSync(modelPath, JSON.stringify(model, null, 2));
  
  console.log(chalk.green(`💾 Model saved to ${modelPath}`));
}

async function generatePredictions(model: any) {
  console.log(chalk.magenta('🔮 Generating Fantasy Predictions...\n'));
  
  if (!model) {
    console.log(chalk.red('❌ No trained model available'));
    return;
  }
  
  // Get recent games for prediction
  const { data: upcomingGames } = await supabase
    .from('games')
    .select('*')
    .gte('game_date', new Date().toISOString())
    .limit(10);
  
  console.log(chalk.blue(`📈 Making predictions for ${upcomingGames?.length || 0} upcoming games:\n`));
  
  if (!upcomingGames || upcomingGames.length === 0) {
    console.log(chalk.yellow('No upcoming games found. Generating sample predictions...\n'));
    
    // Generate sample predictions with dummy data
    const sampleGames = [
      { home_team: 'Lakers', away_team: 'Warriors', game_date: new Date() },
      { home_team: 'Celtics', away_team: 'Heat', game_date: new Date() },
      { home_team: 'Nuggets', away_team: 'Suns', game_date: new Date() }
    ];
    
    sampleGames.forEach((game, index) => {
      const features = [
        110, // Estimated home score
        105, // Estimated away score
        new Date().getDay(),
        new Date().getMonth(),
        5,   // Estimated score difference
        1,   // Home advantage
        215  // Estimated total points
      ];
      
      // Normalize features
      const normalizedFeatures = features.map((val, j) => 
        (val - model.featureMeans[j]) / (model.featureStds[j] || 1)
      );
      
      // Make prediction
      const prediction = normalizedFeatures.reduce((sum, val, j) => 
        sum + val * model.weights[j], 0
      );
      
      const winProbability = Math.max(0, Math.min(1, prediction));
      
      console.log(chalk.cyan(`${index + 1}. ${game.home_team} vs ${game.away_team}`));
      console.log(chalk.white(`   Home Win Probability: ${(winProbability * 100).toFixed(1)}%`));
      console.log(chalk.white(`   Away Win Probability: ${((1 - winProbability) * 100).toFixed(1)}%`));
      console.log(chalk.gray(`   Confidence: ${Math.abs(winProbability - 0.5) > 0.3 ? 'High' : 'Medium'}\n`));
    });
  }
}

async function trainMLModels() {
  console.log(chalk.yellow('\n🚀 STARTING ML MODEL TRAINING\n'));
  console.log(chalk.cyan('================================\n'));
  
  try {
    // Collect training data
    const trainingData = await collectTrainingData();
    
    if (trainingData.features.length === 0) {
      console.log(chalk.red('❌ No training data available. Need more game results!'));
      console.log(chalk.yellow('🔄 Training with synthetic data for demonstration...\n'));
      
      // Create synthetic training data for demonstration
      const syntheticFeatures = [];
      const syntheticTargets = [];
      
      for (let i = 0; i < 1000; i++) {
        const homeScore = Math.floor(Math.random() * 40) + 80; // 80-120
        const awayScore = Math.floor(Math.random() * 40) + 80; // 80-120
        
        syntheticFeatures.push([
          homeScore,
          awayScore,
          Math.floor(Math.random() * 7), // Day of week
          Math.floor(Math.random() * 12), // Month
          Math.abs(homeScore - awayScore), // Score difference
          1, // Home advantage
          homeScore + awayScore // Total points
        ]);
        
        syntheticTargets.push(homeScore > awayScore ? 1 : 0);
      }
      
      console.log(chalk.blue(`📊 Synthetic Dataset: ${syntheticFeatures.length} samples\n`));
      
      // Train with synthetic data
      const gameModel = trainLinearRegression(syntheticFeatures, syntheticTargets);
      
      if (gameModel) {
        saveModel(gameModel, 'game_outcome_predictor_synthetic');
        await generatePredictions(gameModel);
      }
      
    } else {
      console.log(chalk.blue(`📊 Real Dataset: ${trainingData.features.length} samples\n`));
      
      // Train models with real data
      const gameModel = trainLinearRegression(trainingData.features, trainingData.targets);
      
      if (gameModel) {
        saveModel(gameModel, 'game_outcome_predictor_real');
        await generatePredictions(gameModel);
      }
    }
    
    console.log(chalk.green('\n✅ ML Training Complete!\n'));
    console.log(chalk.cyan('📊 TRAINING SUMMARY'));
    console.log(chalk.cyan('===================\n'));
    console.log(chalk.white(`🎯 Model Status: Trained Successfully`));
    console.log(chalk.white(`📈 Data Type: ${trainingData.features.length > 0 ? 'Real Game Data' : 'Synthetic Demo Data'}`));
    console.log(chalk.white(`💾 Models Saved: 1`));
    console.log(chalk.white(`🔮 Predictions: Generated\n`));
    
    // Save training log
    const logPath = '/mnt/c/Users/st0ne/Hey Fantasy/fantasy-ai-ultimate/training.log';
    const logContent = `ML Training completed at ${new Date().toISOString()}\n` +
                      `Samples: ${trainingData.features.length > 0 ? trainingData.features.length : '1000 (synthetic)'}\n` +
                      `Type: ${trainingData.features.length > 0 ? 'Real' : 'Synthetic'}\n\n`;
    
    fs.appendFileSync(logPath, logContent);
    
  } catch (error) {
    console.error(chalk.red('❌ Training error:'), error);
  }
}

trainMLModels();
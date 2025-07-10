#!/usr/bin/env tsx
/**
 * 🧠 LSTM TIME SERIES MODEL
 * 
 * Captures momentum and psychological patterns
 * Uses 10-game rolling windows for predictions
 */

import * as tf from '@tensorflow/tfjs-node';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class LSTMMomentumModel {
  private model?: tf.LayersModel;
  private sequenceLength = 10; // Look at last 10 games
  private featureCount = 15; // Features per game
  
  async buildModel() {
    console.log(chalk.yellow('\n🧠 Building LSTM momentum model...'));
    
    this.model = tf.sequential({
      layers: [
        // LSTM layer 1 - captures short-term patterns
        tf.layers.lstm({
          units: 64,
          returnSequences: true,
          inputShape: [this.sequenceLength, this.featureCount],
          dropout: 0.2,
          recurrentDropout: 0.2
        }),
        
        // LSTM layer 2 - captures longer-term patterns
        tf.layers.lstm({
          units: 32,
          returnSequences: false,
          dropout: 0.2,
          recurrentDropout: 0.2
        }),
        
        // Dense layers
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });
    
    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
    
    console.log(chalk.green('✅ LSTM model built'));
    this.model.summary();
  }
  
  async extractSequenceFeatures(teamId: string): Promise<number[][]> {
    // Get last N games for the team
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(this.sequenceLength);
    
    if (!games || games.length < this.sequenceLength) {
      // Pad with zeros if not enough games
      return Array(this.sequenceLength).fill(Array(this.featureCount).fill(0));
    }
    
    const sequences: number[][] = [];
    
    for (const game of games.reverse()) {
      const isHome = game.home_team_id === teamId;
      const teamScore = isHome ? game.home_score : game.away_score;
      const oppScore = isHome ? game.away_score : game.home_score;
      
      const features = [
        // Performance features
        teamScore / 50, // Normalized score
        oppScore / 50,
        (teamScore - oppScore) / 30, // Point differential
        teamScore > oppScore ? 1 : 0, // Win/loss
        
        // Momentum features
        Math.tanh((teamScore - oppScore) / 20), // Margin impact
        isHome ? 1 : 0, // Home/away
        
        // Time features
        new Date(game.start_time).getDay() / 6, // Day of week
        new Date(game.start_time).getMonth() / 11, // Month
        
        // Scoring patterns
        teamScore / (teamScore + oppScore || 1), // Score share
        Math.min(teamScore / 30, 1), // High scoring
        Math.min(oppScore / 30, 1), // Defensive performance
        
        // Additional context (would be enhanced with real data)
        0.5, // Injury impact placeholder
        0.5, // Rest days placeholder
        0.5, // Travel distance placeholder
        0.5  // Rivalry game placeholder
      ];
      
      sequences.push(features);
    }
    
    return sequences;
  }
  
  async trainOnHistoricalData() {
    console.log(chalk.yellow('\n📊 Training LSTM on historical data...'));
    
    // Get all completed games
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(1000);
    
    if (!games || games.length < 100) {
      console.error('Not enough historical data');
      return;
    }
    
    // Extract training sequences
    const sequences: number[][][] = [];
    const labels: number[] = [];
    
    // Get unique teams
    const teams = new Set<string>();
    games.forEach(g => {
      teams.add(g.home_team_id);
      teams.add(g.away_team_id);
    });
    
    console.log(`Processing ${teams.size} teams...`);
    
    for (const teamId of Array.from(teams).slice(0, 20)) { // Limit for testing
      const teamGames = games.filter(g => 
        g.home_team_id === teamId || g.away_team_id === teamId
      );
      
      if (teamGames.length >= this.sequenceLength + 1) {
        // Create sequences for each possible window
        for (let i = this.sequenceLength; i < teamGames.length; i++) {
          const sequence = await this.extractSequenceFeatures(teamId);
          const nextGame = teamGames[i];
          const isHome = nextGame.home_team_id === teamId;
          const won = isHome ? 
            nextGame.home_score > nextGame.away_score :
            nextGame.away_score > nextGame.home_score;
          
          sequences.push(sequence);
          labels.push(won ? 1 : 0);
        }
      }
    }
    
    if (sequences.length === 0) {
      console.error('No training sequences generated');
      return;
    }
    
    console.log(chalk.green(`Generated ${sequences.length} training sequences`));
    
    // Convert to tensors
    const xTrain = tf.tensor3d(sequences);
    const yTrain = tf.tensor2d(labels, [labels.length, 1]);
    
    // Train model
    const history = await this.model!.fit(xTrain, yTrain, {
      epochs: 20,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch + 1}: loss=${logs?.loss?.toFixed(4)}, acc=${logs?.acc?.toFixed(4)}, val_acc=${logs?.val_acc?.toFixed(4)}`);
        }
      }
    });
    
    // Clean up
    xTrain.dispose();
    yTrain.dispose();
    
    console.log(chalk.green('\n✅ LSTM training complete!'));
    
    // Save model
    await this.saveModel();
  }
  
  async saveModel() {
    const modelPath = path.join(process.cwd(), 'models/lstm_momentum');
    
    if (!fs.existsSync(modelPath)) {
      fs.mkdirSync(modelPath, { recursive: true });
    }
    
    await this.model!.save(`file://${modelPath}`);
    console.log(chalk.green(`✅ Model saved to ${modelPath}`));
  }
  
  async loadModel() {
    const modelPath = path.join(process.cwd(), 'models/lstm_momentum');
    
    if (fs.existsSync(`${modelPath}/model.json`)) {
      this.model = await tf.loadLayersModel(`file://${modelPath}/model.json`);
      console.log(chalk.green('✅ LSTM model loaded'));
      return true;
    }
    
    return false;
  }
  
  async predictMomentum(teamId: string): Promise<number> {
    if (!this.model) {
      console.error('Model not loaded');
      return 0.5;
    }
    
    const sequence = await this.extractSequenceFeatures(teamId);
    const input = tf.tensor3d([sequence]);
    
    const prediction = this.model.predict(input) as tf.Tensor;
    const probability = (await prediction.data())[0];
    
    input.dispose();
    prediction.dispose();
    
    return probability;
  }
  
  async testModel() {
    console.log(chalk.bold.cyan('\n🧪 TESTING LSTM MOMENTUM MODEL\n'));
    
    // Try to load existing model
    const loaded = await this.loadModel();
    
    if (!loaded) {
      await this.buildModel();
      await this.trainOnHistoricalData();
    }
    
    // Test on some teams
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name')
      .limit(5);
    
    if (teams) {
      console.log(chalk.yellow('\n📊 Momentum predictions:'));
      
      for (const team of teams) {
        const momentum = await this.predictMomentum(team.id);
        const trend = momentum > 0.6 ? '🔥 HOT' : momentum < 0.4 ? '❄️  COLD' : '➡️  NEUTRAL';
        console.log(`${team.name}: ${(momentum * 100).toFixed(1)}% win probability ${trend}`);
      }
    }
  }
}

// Export for use in ensemble
export const lstmModel = new LSTMMomentumModel();

// Run test if called directly
if (require.main === module) {
  const model = new LSTMMomentumModel();
  model.testModel().catch(console.error);
}
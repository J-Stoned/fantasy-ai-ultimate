/**
 * 🧠 LSTM Predictor for Temporal Patterns
 * 
 * Captures time-series patterns in team performance
 */

import * as tf from '@tensorflow/tfjs-node-gpu';
import chalk from 'chalk';

export class LSTMPredictor {
  private model: tf.LayersModel | null = null;
  private inputShape: number;
  private sequenceLength: number;
  
  constructor(inputShape: number = 36, sequenceLength: number = 10) {
    this.inputShape = inputShape;
    this.sequenceLength = sequenceLength;
  }
  
  /**
   * Build LSTM model architecture
   */
  async build() {
    console.log(chalk.yellow('Building LSTM model...'));
    
    this.model = tf.sequential({
      layers: [
        // First LSTM layer
        tf.layers.lstm({
          units: 128,
          returnSequences: true,
          inputShape: [this.sequenceLength, this.inputShape],
          kernelInitializer: 'glorotUniform',
          recurrentInitializer: 'orthogonal',
          dropout: 0.2,
          recurrentDropout: 0.2
        }),
        
        // Second LSTM layer
        tf.layers.lstm({
          units: 64,
          returnSequences: false,
          kernelInitializer: 'glorotUniform',
          recurrentInitializer: 'orthogonal',
          dropout: 0.2,
          recurrentDropout: 0.2
        }),
        
        // Dense layers
        tf.layers.dense({
          units: 32,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        
        tf.layers.dropout({ rate: 0.3 }),
        
        tf.layers.dense({
          units: 16,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        
        // Output layer
        tf.layers.dense({
          units: 1,
          activation: 'sigmoid'
        })
      ]
    });
    
    // Compile with Adam optimizer
    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
    
    console.log(chalk.green('✅ LSTM model built'));
    this.model.summary();
  }
  
  /**
   * Train LSTM on sequence data
   */
  async train(
    sequences: number[][][], // [samples, timesteps, features]
    labels: number[],
    epochs: number = 50,
    batchSize: number = 32
  ) {
    console.log(chalk.yellow('Training LSTM model...'));
    
    if (!this.model) {
      await this.build();
    }
    
    // Convert to tensors
    const xTensor = tf.tensor3d(sequences);
    const yTensor = tf.tensor2d(labels, [labels.length, 1]);
    
    // Train with callbacks
    const history = await this.model!.fit(xTensor, yTensor, {
      epochs,
      batchSize,
      validationSplit: 0.2,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0 || epoch === epochs - 1) {
            console.log(chalk.gray(
              `  Epoch ${epoch + 1}: loss=${logs?.loss?.toFixed(4)}, ` +
              `acc=${logs?.acc?.toFixed(4)}, val_acc=${logs?.val_acc?.toFixed(4)}`
            ));
          }
        }
      }
    });
    
    // Cleanup
    xTensor.dispose();
    yTensor.dispose();
    
    console.log(chalk.green('✅ LSTM training complete'));
    
    return history;
  }
  
  /**
   * Make prediction on sequence
   */
  async predict(sequence: number[][]): Promise<number> {
    if (!this.model) {
      throw new Error('Model not trained');
    }
    
    // Ensure sequence has correct length
    let paddedSequence = sequence;
    if (sequence.length < this.sequenceLength) {
      // Pad with zeros if too short
      const padding = Array(this.sequenceLength - sequence.length)
        .fill(null)
        .map(() => new Array(this.inputShape).fill(0));
      paddedSequence = [...padding, ...sequence];
    } else if (sequence.length > this.sequenceLength) {
      // Take last N timesteps
      paddedSequence = sequence.slice(-this.sequenceLength);
    }
    
    // Make prediction
    const input = tf.tensor3d([paddedSequence]);
    const prediction = this.model.predict(input) as tf.Tensor;
    const confidence = (await prediction.data())[0];
    
    // Cleanup
    input.dispose();
    prediction.dispose();
    
    return confidence;
  }
  
  /**
   * Create sequences from game history
   */
  static createSequences(
    games: any[],
    sequenceLength: number = 10,
    features: string[]
  ): { sequences: number[][][]; labels: number[] } {
    const sequences: number[][][] = [];
    const labels: number[] = [];
    
    // Group games by team
    const teamGames = new Map<string, any[]>();
    
    for (const game of games) {
      // Add to home team history
      if (!teamGames.has(game.home_team_id)) {
        teamGames.set(game.home_team_id, []);
      }
      teamGames.get(game.home_team_id)!.push({
        ...game,
        isHome: true
      });
      
      // Add to away team history
      if (!teamGames.has(game.away_team_id)) {
        teamGames.set(game.away_team_id, []);
      }
      teamGames.get(game.away_team_id)!.push({
        ...game,
        isHome: false
      });
    }
    
    // Create sequences for each team
    for (const [teamId, teamHistory] of teamGames) {
      // Sort by date
      teamHistory.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      
      // Create sequences
      for (let i = sequenceLength; i < teamHistory.length; i++) {
        const sequence: number[][] = [];
        
        // Build sequence from previous games
        for (let j = i - sequenceLength; j < i; j++) {
          const game = teamHistory[j];
          const gameFeatures = extractGameFeatures(game, features);
          sequence.push(gameFeatures);
        }
        
        // Current game is the label
        const currentGame = teamHistory[i];
        const won = currentGame.isHome 
          ? currentGame.home_score > currentGame.away_score
          : currentGame.away_score > currentGame.home_score;
          
        sequences.push(sequence);
        labels.push(won ? 1 : 0);
      }
    }
    
    return { sequences, labels };
  }
  
  /**
   * Save LSTM model
   */
  async save(path: string) {
    if (!this.model) {
      throw new Error('No model to save');
    }
    
    await this.model.save(`file://${path}`);
    
    // Save config
    const fs = require('fs').promises;
    await fs.writeFile(
      `${path}/config.json`,
      JSON.stringify({
        inputShape: this.inputShape,
        sequenceLength: this.sequenceLength
      }, null, 2)
    );
    
    console.log(chalk.green(`✅ LSTM model saved to ${path}`));
  }
  
  /**
   * Load LSTM model
   */
  async load(path: string) {
    // Load config
    const fs = require('fs').promises;
    const configJson = await fs.readFile(`${path}/config.json`, 'utf-8');
    const config = JSON.parse(configJson);
    
    this.inputShape = config.inputShape;
    this.sequenceLength = config.sequenceLength;
    
    // Load model
    this.model = await tf.loadLayersModel(`file://${path}/model.json`);
    
    console.log(chalk.green(`✅ LSTM model loaded from ${path}`));
  }
}

/**
 * Extract features from game for LSTM
 */
function extractGameFeatures(game: any, featureNames: string[]): number[] {
  const features: number[] = [];
  
  // Basic game features
  features.push(game.isHome ? 1 : 0);
  features.push(game.home_score || 0);
  features.push(game.away_score || 0);
  features.push((game.home_score || 0) - (game.away_score || 0)); // Point differential
  
  // Win/loss
  const won = game.isHome 
    ? game.home_score > game.away_score
    : game.away_score > game.home_score;
  features.push(won ? 1 : 0);
  
  // Time features
  const date = new Date(game.start_time);
  features.push(date.getMonth() / 11); // Normalized month
  features.push(date.getDay() / 6); // Normalized day of week
  
  // Add any additional requested features
  for (const feature of featureNames) {
    if (game[feature] !== undefined) {
      features.push(game[feature]);
    } else {
      features.push(0); // Default value
    }
  }
  
  return features;
}
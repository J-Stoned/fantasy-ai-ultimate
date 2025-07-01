#!/usr/bin/env tsx
/**
 * 🧠 ML HISTORICAL TRAINING SYSTEM
 * Trains models on all 49K+ historical games
 */

import { createClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs-node';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GameFeatures {
  // Team performance features
  homeWinRate: number;
  awayWinRate: number;
  homeRecentForm: number; // Last 5 games
  awayRecentForm: number;
  homeOffenseRating: number; // Avg points scored
  homeDefenseRating: number; // Avg points allowed
  awayOffenseRating: number;
  awayDefenseRating: number;
  
  // Head to head
  h2hHomeWinRate: number;
  h2hAvgTotalScore: number;
  h2hLastMeetingDays: number;
  
  // Schedule features
  homeRestDays: number;
  awayRestDays: number;
  homeIsBackToBack: number;
  awayIsBackToBack: number;
  
  // Time features
  hourOfDay: number;
  dayOfWeek: number;
  monthOfYear: number;
  isWeekend: number;
  isPrimetime: number;
  
  // Streak features
  homeWinStreak: number;
  awayWinStreak: number;
  homeLossStreak: number;
  awayLossStreak: number;
  
  // Season progress
  gamesPlayedRatio: number; // How far into season
  
  // Outcome (for training)
  homeWin?: number;
  totalScore?: number;
  scoreDifferential?: number;
}

class HistoricalMLTrainer {
  private allGames: any[] = [];
  private teamStats: Map<number, any> = new Map();
  private h2hStats: Map<string, any> = new Map();
  
  async loadHistoricalData() {
    console.log(chalk.cyan.bold('📚 Loading historical data...\n'));
    
    // Load all completed games
    let offset = 0;
    const limit = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: games, error } = await supabase
        .from('games')
        .select('*')
        .not('home_score', 'is', null)
        .order('start_time', { ascending: true })
        .range(offset, offset + limit - 1);
      
      if (error) {
        console.error(chalk.red('Error loading games:', error.message));
        break;
      }
      
      if (games && games.length > 0) {
        this.allGames.push(...games);
        offset += games.length;
        console.log(chalk.gray(`Loaded ${this.allGames.length} games...`));
        
        if (games.length < limit) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
    
    console.log(chalk.green(`\n✅ Loaded ${this.allGames.length} historical games!\n`));
  }
  
  async extractFeatures(): Promise<GameFeatures[]> {
    console.log(chalk.cyan.bold('🔧 Extracting features from games...\n'));
    
    const features: GameFeatures[] = [];
    let processed = 0;
    
    for (const game of this.allGames) {
      // Only process games with enough history
      const gameDate = new Date(game.start_time);
      const priorGames = this.allGames.filter(g => 
        new Date(g.start_time) < gameDate
      );
      
      if (priorGames.length < 100) continue; // Need some history
      
      const gameFeatures = await this.extractGameFeatures(game, priorGames);
      if (gameFeatures) {
        features.push(gameFeatures);
        processed++;
        
        if (processed % 1000 === 0) {
          console.log(chalk.gray(`Processed ${processed} games...`));
        }
      }
    }
    
    console.log(chalk.green(`\n✅ Extracted features from ${features.length} games!\n`));
    return features;
  }
  
  private async extractGameFeatures(game: any, priorGames: any[]): Promise<GameFeatures | null> {
    try {
      const gameDate = new Date(game.start_time);
      
      // Get team histories
      const homeGames = priorGames.filter(g => 
        g.home_team_id === game.home_team_id || g.away_team_id === game.home_team_id
      );
      const awayGames = priorGames.filter(g => 
        g.home_team_id === game.away_team_id || g.away_team_id === game.away_team_id
      );
      
      if (homeGames.length < 10 || awayGames.length < 10) return null;
      
      // Calculate win rates
      const homeWins = homeGames.filter(g => 
        (g.home_team_id === game.home_team_id && g.home_score > g.away_score) ||
        (g.away_team_id === game.home_team_id && g.away_score > g.home_score)
      ).length;
      const awayWins = awayGames.filter(g => 
        (g.home_team_id === game.away_team_id && g.home_score > g.away_score) ||
        (g.away_team_id === game.away_team_id && g.away_score > g.home_score)
      ).length;
      
      // Recent form (last 5 games)
      const homeRecent = homeGames.slice(-5);
      const awayRecent = awayGames.slice(-5);
      
      const homeRecentWins = homeRecent.filter(g => 
        (g.home_team_id === game.home_team_id && g.home_score > g.away_score) ||
        (g.away_team_id === game.home_team_id && g.away_score > g.home_score)
      ).length;
      const awayRecentWins = awayRecent.filter(g => 
        (g.home_team_id === game.away_team_id && g.home_score > g.away_score) ||
        (g.away_team_id === game.away_team_id && g.away_score > g.home_score)
      ).length;
      
      // Offensive and defensive ratings
      const homeScored = homeGames.slice(-20).reduce((sum, g) => {
        return sum + (g.home_team_id === game.home_team_id ? g.home_score : g.away_score);
      }, 0) / Math.min(20, homeGames.length);
      
      const homeAllowed = homeGames.slice(-20).reduce((sum, g) => {
        return sum + (g.home_team_id === game.home_team_id ? g.away_score : g.home_score);
      }, 0) / Math.min(20, homeGames.length);
      
      const awayScored = awayGames.slice(-20).reduce((sum, g) => {
        return sum + (g.home_team_id === game.away_team_id ? g.home_score : g.away_score);
      }, 0) / Math.min(20, awayGames.length);
      
      const awayAllowed = awayGames.slice(-20).reduce((sum, g) => {
        return sum + (g.home_team_id === game.away_team_id ? g.away_score : g.home_score);
      }, 0) / Math.min(20, awayGames.length);
      
      // Head to head history
      const h2hGames = priorGames.filter(g => 
        (g.home_team_id === game.home_team_id && g.away_team_id === game.away_team_id) ||
        (g.home_team_id === game.away_team_id && g.away_team_id === game.home_team_id)
      );
      
      const h2hHomeWins = h2hGames.filter(g => 
        (g.home_team_id === game.home_team_id && g.home_score > g.away_score) ||
        (g.away_team_id === game.home_team_id && g.away_score > g.home_score)
      ).length;
      
      const h2hAvgTotal = h2hGames.length > 0 ? 
        h2hGames.reduce((sum, g) => sum + g.home_score + g.away_score, 0) / h2hGames.length : 
        (homeScored + awayScored);
      
      // Rest days calculation
      const lastHomeGame = homeGames[homeGames.length - 1];
      const lastAwayGame = awayGames[awayGames.length - 1];
      
      const homeRestDays = Math.floor((gameDate.getTime() - new Date(lastHomeGame.start_time).getTime()) / (1000 * 60 * 60 * 24));
      const awayRestDays = Math.floor((gameDate.getTime() - new Date(lastAwayGame.start_time).getTime()) / (1000 * 60 * 60 * 24));
      
      // Streaks
      const homeStreak = this.calculateStreak(homeGames.slice(-10), game.home_team_id);
      const awayStreak = this.calculateStreak(awayGames.slice(-10), game.away_team_id);
      
      // Time features
      const hour = gameDate.getHours();
      const day = gameDate.getDay();
      const month = gameDate.getMonth();
      
      return {
        // Team performance
        homeWinRate: homeWins / homeGames.length,
        awayWinRate: awayWins / awayGames.length,
        homeRecentForm: homeRecentWins / 5,
        awayRecentForm: awayRecentWins / 5,
        homeOffenseRating: homeScored / 25,
        homeDefenseRating: homeAllowed / 25,
        awayOffenseRating: awayScored / 25,
        awayDefenseRating: awayAllowed / 25,
        
        // Head to head
        h2hHomeWinRate: h2hGames.length > 0 ? h2hHomeWins / h2hGames.length : 0.5,
        h2hAvgTotalScore: h2hAvgTotal / 50,
        h2hLastMeetingDays: h2hGames.length > 0 ? 
          Math.min((gameDate.getTime() - new Date(h2hGames[h2hGames.length - 1].start_time).getTime()) / (1000 * 60 * 60 * 24), 365) / 365 : 1,
        
        // Schedule
        homeRestDays: Math.min(homeRestDays, 14) / 14,
        awayRestDays: Math.min(awayRestDays, 14) / 14,
        homeIsBackToBack: homeRestDays <= 1 ? 1 : 0,
        awayIsBackToBack: awayRestDays <= 1 ? 1 : 0,
        
        // Time
        hourOfDay: hour / 24,
        dayOfWeek: day / 7,
        monthOfYear: month / 12,
        isWeekend: (day === 0 || day === 6) ? 1 : 0,
        isPrimetime: hour >= 19 ? 1 : 0,
        
        // Streaks
        homeWinStreak: Math.min(homeStreak.wins, 10) / 10,
        awayWinStreak: Math.min(awayStreak.wins, 10) / 10,
        homeLossStreak: Math.min(homeStreak.losses, 10) / 10,
        awayLossStreak: Math.min(awayStreak.losses, 10) / 10,
        
        // Season progress
        gamesPlayedRatio: Math.min(homeGames.filter(g => {
          const gDate = new Date(g.start_time);
          return gDate.getFullYear() === gameDate.getFullYear() &&
                 gDate < gameDate;
        }).length / 82, 1), // Assuming 82 game season
        
        // Outcomes for training
        homeWin: game.home_score > game.away_score ? 1 : 0,
        totalScore: (game.home_score + game.away_score) / 100,
        scoreDifferential: (game.home_score - game.away_score) / 50
      };
      
    } catch (error) {
      return null;
    }
  }
  
  private calculateStreak(recentGames: any[], teamId: number): { wins: number, losses: number } {
    let wins = 0;
    let losses = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    
    // Go through games in reverse order (most recent first)
    for (let i = recentGames.length - 1; i >= 0; i--) {
      const game = recentGames[i];
      const won = (game.home_team_id === teamId && game.home_score > game.away_score) ||
                  (game.away_team_id === teamId && game.away_score > game.home_score);
      
      if (won) {
        if (currentLossStreak > 0) break; // Streak broken
        currentWinStreak++;
      } else {
        if (currentWinStreak > 0) break; // Streak broken
        currentLossStreak++;
      }
    }
    
    return { wins: currentWinStreak, losses: currentLossStreak };
  }
  
  async trainModels(features: GameFeatures[]) {
    console.log(chalk.cyan.bold('🏋️ Training ML models on historical data...\n'));
    
    // Split data chronologically (no future data leakage)
    const trainSize = Math.floor(features.length * 0.7);
    const valSize = Math.floor(features.length * 0.15);
    
    const trainData = features.slice(0, trainSize);
    const valData = features.slice(trainSize, trainSize + valSize);
    const testData = features.slice(trainSize + valSize);
    
    console.log(chalk.yellow(`Training set: ${trainData.length} games`));
    console.log(chalk.yellow(`Validation set: ${valData.length} games`));
    console.log(chalk.yellow(`Test set: ${testData.length} games\n`));
    
    // Prepare tensors
    const inputFeatures = [
      'homeWinRate', 'awayWinRate', 'homeRecentForm', 'awayRecentForm',
      'homeOffenseRating', 'homeDefenseRating', 'awayOffenseRating', 'awayDefenseRating',
      'h2hHomeWinRate', 'h2hAvgTotalScore', 'homeRestDays', 'awayRestDays',
      'isPrimetime', 'isWeekend', 'homeWinStreak', 'awayWinStreak'
    ];
    
    const trainX = tf.tensor2d(trainData.map(d => 
      inputFeatures.map(f => d[f] || 0)
    ));
    const trainY = tf.tensor2d(trainData.map(d => [d.homeWin || 0]));
    
    const valX = tf.tensor2d(valData.map(d => 
      inputFeatures.map(f => d[f] || 0)
    ));
    const valY = tf.tensor2d(valData.map(d => [d.homeWin || 0]));
    
    // Create and train model
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [inputFeatures.length], units: 128, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
    
    // Custom callback for progress
    let bestValAcc = 0;
    const history = await model.fit(trainX, trainY, {
      epochs: 100,
      batchSize: 32,
      validationData: [valX, valY],
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0 || logs?.val_acc > bestValAcc) {
            console.log(chalk.gray(
              `Epoch ${epoch}: loss=${logs?.loss?.toFixed(4)}, ` +
              `acc=${logs?.acc?.toFixed(4)}, ` +
              `val_loss=${logs?.val_loss?.toFixed(4)}, ` +
              `val_acc=${logs?.val_acc?.toFixed(4)}`
            ));
            
            if (logs?.val_acc > bestValAcc) {
              bestValAcc = logs.val_acc;
              console.log(chalk.green(`  📈 New best validation accuracy!`));
            }
          }
        }
      }
    });
    
    // Test set evaluation
    const testX = tf.tensor2d(testData.map(d => 
      inputFeatures.map(f => d[f] || 0)
    ));
    const testY = tf.tensor2d(testData.map(d => [d.homeWin || 0]));
    
    const testEval = model.evaluate(testX, testY) as tf.Scalar[];
    const testLoss = await testEval[0].data();
    const testAcc = await testEval[1].data();
    
    console.log(chalk.green.bold(`\n📊 Test Set Performance:`));
    console.log(chalk.white(`   Loss: ${testLoss[0].toFixed(4)}`));
    console.log(chalk.white(`   Accuracy: ${(testAcc[0] * 100).toFixed(2)}%`));
    
    // Save model
    await model.save('file://./models/historical-game-predictor');
    console.log(chalk.green('\n✅ Model saved to ./models/historical-game-predictor'));
    
    // Feature importance analysis
    await this.analyzeFeatureImportance(model, inputFeatures, valX);
    
    // Clean up tensors
    trainX.dispose();
    trainY.dispose();
    valX.dispose();
    valY.dispose();
    testX.dispose();
    testY.dispose();
    testEval.forEach(t => t.dispose());
  }
  
  private async analyzeFeatureImportance(model: tf.LayersModel, features: string[], data: tf.Tensor) {
    console.log(chalk.cyan.bold('\n📊 Feature Importance Analysis:\n'));
    
    const baseline = model.predict(data) as tf.Tensor;
    const baselineMean = await baseline.mean().data();
    
    const importances: { feature: string, importance: number }[] = [];
    
    for (let i = 0; i < features.length; i++) {
      // Permute one feature
      const permuted = await data.array() as number[][];
      const permutedData = permuted.map(row => {
        const newRow = [...row];
        // Shuffle this feature across all samples
        newRow[i] = permuted[Math.floor(Math.random() * permuted.length)][i];
        return newRow;
      });
      
      const permutedTensor = tf.tensor2d(permutedData);
      const permutedPred = model.predict(permutedTensor) as tf.Tensor;
      const permutedMean = await permutedPred.mean().data();
      
      const importance = Math.abs(baselineMean[0] - permutedMean[0]);
      importances.push({ feature: features[i], importance });
      
      permutedTensor.dispose();
      permutedPred.dispose();
    }
    
    // Sort by importance
    importances.sort((a, b) => b.importance - a.importance);
    
    console.log(chalk.yellow('Top 10 Most Important Features:'));
    importances.slice(0, 10).forEach((item, i) => {
      const bar = '█'.repeat(Math.round(item.importance * 200));
      console.log(chalk.white(`${i + 1}. ${item.feature.padEnd(20)} ${bar} ${(item.importance * 100).toFixed(2)}%`));
    });
    
    baseline.dispose();
  }
}

// Main execution
async function main() {
  const trainer = new HistoricalMLTrainer();
  
  await trainer.loadHistoricalData();
  const features = await trainer.extractFeatures();
  
  if (features.length > 1000) {
    await trainer.trainModels(features);
  } else {
    console.log(chalk.red('Not enough historical data for training'));
  }
  
  console.log(chalk.green.bold('\n✨ Historical training complete!\n'));
}

main().catch(console.error);
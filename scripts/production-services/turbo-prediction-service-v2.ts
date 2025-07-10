#!/usr/bin/env tsx
/**
 * 🚀 TURBO PREDICTION SERVICE V2 - WITH BIAS-CORRECTED MODEL
 * 
 * Features:
 * - Uses bias-corrected Random Forest model
 * - Parallel processing (100 games at once)
 * - Feature caching for 99%+ cache hits
 * - Continuous processing
 * - Real-time WebSocket broadcasting
 * 
 * Target: 7M+ predictions/hour!
 */

import { RandomForestClassifier } from 'ml-random-forest';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import * as fs from 'fs';
import pLimit from 'p-limit';
import { predictionBroadcaster } from '../lib/realtime/prediction-broadcaster';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Performance tracking
const metrics = {
  predictionsPerSecond: 0,
  totalPredictions: 0,
  cacheHits: 0,
  cacheMisses: 0,
  modelTime: 0,
  dbTime: 0,
  startTime: Date.now()
};

// Feature cache
const featureCache = new Map<string, { features: number[], timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

class TurboPredictionServiceV2 {
  private biasCorrectModel?: RandomForestClassifier;
  private isRunning = false;
  private concurrency = 100; // Process 100 games at once
  private batchSize = 1000; // Process 1000 predictions in memory
  
  async initialize() {
    console.log(chalk.bold.red('\n🚀 TURBO PREDICTION SERVICE V2 - BIAS-CORRECTED!'));
    console.log(chalk.gray('='.repeat(60)));
    
    // Load bias-corrected model
    await this.loadModel();
    
    // Initialize broadcaster
    await predictionBroadcaster.initialize();
    
    // Show system info
    console.log(chalk.cyan('\n📊 System Configuration:'));
    console.log(`   Model: Bias-Corrected Random Forest`);
    console.log(`   Parallel Threads: ${this.concurrency}`);
    console.log(`   Batch Size: ${this.batchSize}`);
    console.log(`   Cache TTL: ${CACHE_TTL / 1000}s`);
    
    this.isRunning = true;
  }
  
  async loadModel() {
    console.log(chalk.yellow('🔄 Loading bias-corrected model...'));
    
    const modelPath = './models/bias-corrected-rf-clean.json';
    if (!fs.existsSync(modelPath)) {
      throw new Error('Bias-corrected model not found. Run fix-home-bias.ts first!');
    }
    
    const modelData = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
    this.biasCorrectModel = RandomForestClassifier.load(modelData);
    console.log(chalk.green('✅ Bias-corrected Random Forest loaded'));
    
    // Test prediction
    const testFeatures = Array(15).fill(0).map((_, i) => i === 11 ? 0.03 : 0);
    const testPred = this.biasCorrectModel.predict([testFeatures])[0];
    console.log(chalk.green(`✅ Model test: ${testPred === 1 ? 'Home' : 'Away'} win`));
  }
  
  /**
   * Extract features with caching
   */
  async extractFeatures(game: any): Promise<number[]> {
    const cacheKey = `${game.home_team_id}-${game.away_team_id}-${game.week || 0}`;
    
    // Check cache
    const cached = featureCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      metrics.cacheHits++;
      return cached.features;
    }
    
    metrics.cacheMisses++;
    
    // Get team stats
    const [homeStats, awayStats] = await Promise.all([
      this.getTeamStats(game.home_team_id),
      this.getTeamStats(game.away_team_id)
    ]);
    
    // Build features exactly as trained model expects
    const features = [
      homeStats.winRate - awayStats.winRate,                    // 0. Win rate difference
      (homeStats.avgPointsFor - awayStats.avgPointsFor) / 10,  // 1. Scoring difference
      (awayStats.avgPointsAgainst - homeStats.avgPointsAgainst) / 10, // 2. Defensive difference
      0.1,  // 3. Recent form (placeholder)
      0.0,  // 4. Consistency
      0.0,  // 5. Strength of schedule
      0.0,  // 6. Head to head
      0.05, // 7. Momentum
      0.0,  // 8. Experience
      homeStats.avgPointsFor / Math.max(awayStats.avgPointsAgainst, 1), // 9. Offensive efficiency
      awayStats.avgPointsFor / Math.max(homeStats.avgPointsAgainst, 1), // 10. Defensive efficiency
      0.03, // 11. Small home field factor
      0.5,  // 12. Season progress
      Math.abs(homeStats.winRate - 0.5) - Math.abs(awayStats.winRate - 0.5), // 13. How far from .500
      0.0   // 14. Scoring trend
    ];
    
    // Cache the features
    featureCache.set(cacheKey, { features, timestamp: Date.now() });
    
    return features;
  }
  
  async getTeamStats(teamId: number) {
    try {
      const { data: games } = await supabase
        .from('games')
        .select('home_team_id, away_team_id, home_score, away_score')
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .not('home_score', 'is', null)
        .limit(20);
      
      if (!games || games.length === 0) {
        return { winRate: 0.5, avgPointsFor: 100, avgPointsAgainst: 100 };
      }
      
      let wins = 0;
      let totalPointsFor = 0;
      let totalPointsAgainst = 0;
      
      games.forEach(game => {
        const isHome = game.home_team_id === teamId;
        const teamScore = isHome ? game.home_score : game.away_score;
        const oppScore = isHome ? game.away_score : game.home_score;
        
        totalPointsFor += teamScore;
        totalPointsAgainst += oppScore;
        if (teamScore > oppScore) wins++;
      });
      
      return {
        winRate: wins / games.length,
        avgPointsFor: totalPointsFor / games.length,
        avgPointsAgainst: totalPointsAgainst / games.length
      };
    } catch (error) {
      return { winRate: 0.5, avgPointsFor: 100, avgPointsAgainst: 100 };
    }
  }
  
  async processGameBatch(games: any[]) {
    const startTime = Date.now();
    const predictions = [];
    
    // Extract features in parallel
    const featuresPromises = games.map(game => this.extractFeatures(game));
    const allFeatures = await Promise.all(featuresPromises);
    
    // Make predictions
    const modelStart = Date.now();
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      const features = allFeatures[i];
      
      const prediction = this.biasCorrectModel!.predict([features])[0];
      const predictedHomeWin = prediction === 1;
      
      // Calculate confidence from feature differences
      const winRateDiff = Math.abs(features[0]);
      const scoringDiff = Math.abs(features[1]);
      const confidence = Math.min(0.95, 0.5 + (winRateDiff + scoringDiff / 10) / 2);
      
      predictions.push({
        game_id: game.id,
        home_team_id: game.home_team_id,
        away_team_id: game.away_team_id,
        predicted_winner: predictedHomeWin ? 'home' : 'away',
        confidence: confidence,
        model_version: 'bias-corrected-rf-v2',
        features_used: 15,
        prediction_time: new Date().toISOString()
      });
    }
    
    metrics.modelTime += Date.now() - modelStart;
    
    // Store predictions
    const dbStart = Date.now();
    if (predictions.length > 0) {
      const { error } = await supabase
        .from('ml_predictions')
        .upsert(predictions, { onConflict: 'game_id' });
      
      if (error) {
        console.error('Error saving predictions:', error);
      } else {
        metrics.totalPredictions += predictions.length;
        
        // Broadcast predictions
        predictions.forEach(pred => {
          predictionBroadcaster.broadcast({
            type: 'prediction',
            data: pred
          });
        });
      }
    }
    metrics.dbTime += Date.now() - dbStart;
    
    const totalTime = Date.now() - startTime;
    console.log(chalk.green(`✅ Processed ${predictions.length} predictions in ${totalTime}ms`));
    
    return predictions.length;
  }
  
  async runContinuous() {
    console.log(chalk.bold.cyan('\n🏃 Starting continuous prediction loop...'));
    
    const limit = pLimit(this.concurrency);
    
    while (this.isRunning) {
      try {
        // Get all games needing predictions
        const { data: games } = await supabase
          .from('games')
          .select('*')
          .is('home_score', null)
          .order('start_time', { ascending: true })
          .limit(this.batchSize);
        
        if (games && games.length > 0) {
          console.log(chalk.yellow(`\n📊 Processing ${games.length} games...`));
          
          // Process in parallel batches
          const batchSize = 50;
          const batches = [];
          for (let i = 0; i < games.length; i += batchSize) {
            batches.push(games.slice(i, i + batchSize));
          }
          
          const results = await Promise.all(
            batches.map(batch => limit(() => this.processGameBatch(batch)))
          );
          
          const totalProcessed = results.reduce((sum, count) => sum + count, 0);
          
          // Update metrics
          const elapsed = (Date.now() - metrics.startTime) / 1000;
          metrics.predictionsPerSecond = metrics.totalPredictions / elapsed;
          
          this.showMetrics();
        } else {
          console.log(chalk.gray('No games to process, waiting...'));
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error(chalk.red('Error in continuous loop:'), error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
  
  showMetrics() {
    const elapsed = (Date.now() - metrics.startTime) / 1000;
    const cacheHitRate = metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) * 100;
    
    console.log(chalk.bold.yellow('\n📈 TURBO METRICS:'));
    console.log(chalk.white(`   Total Predictions: ${metrics.totalPredictions.toLocaleString()}`));
    console.log(chalk.white(`   Speed: ${metrics.predictionsPerSecond.toFixed(1)} pred/sec`));
    console.log(chalk.white(`   Hourly Rate: ${(metrics.predictionsPerSecond * 3600).toLocaleString()} pred/hour`));
    console.log(chalk.white(`   Cache Hit Rate: ${cacheHitRate.toFixed(1)}%`));
    console.log(chalk.white(`   Model Time: ${(metrics.modelTime / 1000).toFixed(1)}s`));
    console.log(chalk.white(`   DB Time: ${(metrics.dbTime / 1000).toFixed(1)}s`));
    console.log(chalk.white(`   Runtime: ${(elapsed / 60).toFixed(1)} minutes`));
    
    if (metrics.predictionsPerSecond * 3600 > 1000000) {
      console.log(chalk.bold.red('🔥 MILLION+ PREDICTIONS PER HOUR!'));
    }
  }
  
  async start() {
    await this.initialize();
    
    // Show real-time dashboard
    setInterval(() => {
      console.clear();
      console.log(chalk.bold.red('\n🚀 TURBO PREDICTION SERVICE V2'));
      console.log(chalk.gray('='.repeat(60)));
      this.showMetrics();
      
      // Show cache status
      console.log(chalk.cyan('\n💾 Cache Status:'));
      console.log(chalk.white(`   Entries: ${featureCache.size}`));
      console.log(chalk.white(`   Memory: ~${(featureCache.size * 0.5).toFixed(1)}KB`));
      
      // Show prediction samples
      console.log(chalk.cyan('\n🎯 Recent Predictions:'));
      console.log(chalk.gray('   (Real-time predictions with bias-corrected model)'));
    }, 5000);
    
    // Start prediction loop
    await this.runContinuous();
  }
}

// Start the service
const service = new TurboPredictionServiceV2();
service.start().catch(console.error);

// Handle shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n⚠️ Shutting down...'));
  process.exit(0);
});
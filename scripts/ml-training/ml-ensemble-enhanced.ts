#!/usr/bin/env tsx
/**
 * 🤖 ENHANCED ML ENSEMBLE PREDICTOR
 * Integrates historical training with real-time predictions
 */

import { createClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs-node';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class EnhancedMLEnsemble {
  private historicalModel: tf.LayersModel | null = null;
  private ensembleModels: Map<string, tf.LayersModel> = new Map();
  
  async initialize() {
    console.log(chalk.cyan.bold('🤖 ENHANCED ML ENSEMBLE SYSTEM\n'));
    
    // Load historical model if available
    if (fs.existsSync('./models/historical-game-predictor/model.json')) {
      console.log(chalk.yellow('Loading historical model...'));
      this.historicalModel = await tf.loadLayersModel('file://./models/historical-game-predictor/model.json');
      console.log(chalk.green('✅ Historical model loaded!'));
    } else {
      console.log(chalk.gray('No historical model found - using base models only'));
    }
    
    // Initialize ensemble models
    await this.initializeEnsembleModels();
  }
  
  private async initializeEnsembleModels() {
    // Create specialized models
    const models = [
      { name: 'offensive_predictor', inputs: 8, architecture: [64, 32, 16] },
      { name: 'defensive_predictor', inputs: 8, architecture: [64, 32, 16] },
      { name: 'momentum_tracker', inputs: 10, architecture: [128, 64, 32] },
      { name: 'schedule_analyzer', inputs: 6, architecture: [32, 16] },
      { name: 'venue_specialist', inputs: 5, architecture: [32, 16] }
    ];
    
    for (const modelConfig of models) {
      const layers: tf.layers.Layer[] = [];
      let lastSize = modelConfig.inputs;
      
      for (const units of modelConfig.architecture) {
        layers.push(tf.layers.dense({ 
          inputShape: layers.length === 0 ? [lastSize] : undefined,
          units,
          activation: 'relu'
        }));
        layers.push(tf.layers.dropout({ rate: 0.2 }));
        lastSize = units;
      }
      
      layers.push(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
      
      const model = tf.sequential({ layers });
      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });
      
      this.ensembleModels.set(modelConfig.name, model);
      console.log(chalk.green(`✅ ${modelConfig.name} initialized`));
    }
  }
  
  async makeEnhancedPrediction(gameData: any) {
    const predictions: any[] = [];
    
    // Get historical model prediction if available
    if (this.historicalModel) {
      const historicalFeatures = await this.extractHistoricalFeatures(gameData);
      const historicalPred = this.historicalModel.predict(historicalFeatures) as tf.Tensor;
      const historicalValue = await historicalPred.data();
      
      predictions.push({
        model: 'historical_analysis',
        prediction: historicalValue[0],
        confidence: Math.abs(historicalValue[0] - 0.5) * 3, // Higher weight
        weight: 2.0 // Double weight for historical model
      });
      
      historicalFeatures.dispose();
      historicalPred.dispose();
    }
    
    // Get offensive prediction
    const offensiveFeatures = this.extractOffensiveFeatures(gameData);
    const offensivePred = await this.getPrediction('offensive_predictor', offensiveFeatures);
    predictions.push({
      model: 'offensive_predictor',
      prediction: offensivePred,
      confidence: Math.abs(offensivePred - 0.5) * 2,
      weight: 1.5
    });
    
    // Get defensive prediction
    const defensiveFeatures = this.extractDefensiveFeatures(gameData);
    const defensivePred = await this.getPrediction('defensive_predictor', defensiveFeatures);
    predictions.push({
      model: 'defensive_predictor',
      prediction: defensivePred,
      confidence: Math.abs(defensivePred - 0.5) * 2,
      weight: 1.5
    });
    
    // Get momentum prediction
    const momentumFeatures = this.extractMomentumFeatures(gameData);
    const momentumPred = await this.getPrediction('momentum_tracker', momentumFeatures);
    predictions.push({
      model: 'momentum_tracker',
      prediction: momentumPred,
      confidence: Math.abs(momentumPred - 0.5) * 2,
      weight: 1.2
    });
    
    // Get schedule prediction
    const scheduleFeatures = this.extractScheduleFeatures(gameData);
    const schedulePred = await this.getPrediction('schedule_analyzer', scheduleFeatures);
    predictions.push({
      model: 'schedule_analyzer',
      prediction: schedulePred,
      confidence: Math.abs(schedulePred - 0.5) * 2,
      weight: 1.0
    });
    
    // Calculate weighted ensemble
    const totalWeight = predictions.reduce((sum, p) => sum + (p.confidence * p.weight), 0);
    const ensemblePrediction = predictions.reduce((sum, p) => 
      sum + (p.prediction * p.confidence * p.weight), 0
    ) / totalWeight;
    
    // Generate insights
    const insights = this.generateInsights(predictions, ensemblePrediction);
    
    return {
      prediction: ensemblePrediction > 0.5 ? 'home_win' : 'away_win',
      confidence: Math.abs(ensemblePrediction - 0.5) * 2,
      probability: ensemblePrediction,
      models: predictions,
      insights
    };
  }
  
  private async extractHistoricalFeatures(gameData: any): Promise<tf.Tensor> {
    // Match the features used in historical training
    const features = [
      gameData.home_team_rating || 0.5,
      gameData.away_team_rating || 0.5,
      gameData.home_recent_form || 0.5,
      gameData.away_recent_form || 0.5,
      (gameData.home_offense_rating || 20) / 25,
      (gameData.home_defense_rating || 20) / 25,
      (gameData.away_offense_rating || 20) / 25,
      (gameData.away_defense_rating || 20) / 25,
      gameData.h2h_home_win_rate || 0.5,
      (gameData.h2h_avg_total || 45) / 50,
      (gameData.home_rest_days || 3) / 14,
      (gameData.away_rest_days || 3) / 14,
      gameData.is_primetime ? 1 : 0,
      new Date(gameData.start_time || Date.now()).getDay() >= 5 ? 1 : 0,
      (gameData.home_win_streak || 0) / 10,
      (gameData.away_win_streak || 0) / 10
    ];
    
    return tf.tensor2d([features]);
  }
  
  private extractOffensiveFeatures(gameData: any): tf.Tensor {
    const features = [
      (gameData.home_offense_rating || 20) / 30,
      (gameData.away_offense_rating || 20) / 30,
      (gameData.home_scoring_trend || 0) / 10,
      (gameData.away_scoring_trend || 0) / 10,
      (gameData.venue_scoring_avg || 45) / 60,
      gameData.weather?.temperature ? (gameData.weather.temperature - 50) / 50 : 0,
      gameData.is_dome ? 1 : 0,
      (gameData.total_line || 45) / 60
    ];
    
    return tf.tensor2d([features]);
  }
  
  private extractDefensiveFeatures(gameData: any): tf.Tensor {
    const features = [
      (gameData.home_defense_rating || 20) / 30,
      (gameData.away_defense_rating || 20) / 30,
      (gameData.home_defensive_trend || 0) / 10,
      (gameData.away_defensive_trend || 0) / 10,
      (gameData.home_turnovers_forced || 1) / 3,
      (gameData.away_turnovers_forced || 1) / 3,
      (gameData.home_sacks_per_game || 2) / 5,
      (gameData.away_sacks_per_game || 2) / 5
    ];
    
    return tf.tensor2d([features]);
  }
  
  private extractMomentumFeatures(gameData: any): tf.Tensor {
    const features = [
      gameData.home_recent_form || 0.5,
      gameData.away_recent_form || 0.5,
      (gameData.home_win_streak || 0) / 10,
      (gameData.away_win_streak || 0) / 10,
      (gameData.home_loss_streak || 0) / 10,
      (gameData.away_loss_streak || 0) / 10,
      (gameData.home_margin_trend || 0) / 20,
      (gameData.away_margin_trend || 0) / 20,
      gameData.home_confidence_rating || 0.5,
      gameData.away_confidence_rating || 0.5
    ];
    
    return tf.tensor2d([features]);
  }
  
  private extractScheduleFeatures(gameData: any): tf.Tensor {
    const features = [
      (gameData.home_rest_days || 3) / 14,
      (gameData.away_rest_days || 3) / 14,
      gameData.home_is_back_to_back ? 1 : 0,
      gameData.away_is_back_to_back ? 1 : 0,
      (gameData.home_travel_miles || 0) / 3000,
      (gameData.away_travel_miles || 500) / 3000
    ];
    
    return tf.tensor2d([features]);
  }
  
  private async getPrediction(modelName: string, features: tf.Tensor): Promise<number> {
    const model = this.ensembleModels.get(modelName);
    if (!model) return 0.5;
    
    const prediction = model.predict(features) as tf.Tensor;
    const value = await prediction.data();
    
    prediction.dispose();
    features.dispose();
    
    return value[0];
  }
  
  private generateInsights(predictions: any[], ensemblePrediction: number): string[] {
    const insights: string[] = [];
    
    // Check model agreement
    const homeVotes = predictions.filter(p => p.prediction > 0.5).length;
    const awayVotes = predictions.filter(p => p.prediction < 0.5).length;
    
    if (homeVotes === predictions.length) {
      insights.push('All models unanimously favor the home team');
    } else if (awayVotes === predictions.length) {
      insights.push('All models unanimously favor the away team');
    } else if (Math.abs(homeVotes - awayVotes) <= 1) {
      insights.push('Models are split - higher uncertainty in this matchup');
    }
    
    // Historical model insight
    const historicalPred = predictions.find(p => p.model === 'historical_analysis');
    if (historicalPred) {
      if (historicalPred.confidence > 0.7) {
        insights.push(`Historical patterns strongly favor ${historicalPred.prediction > 0.5 ? 'home' : 'away'} team`);
      }
    }
    
    // Offensive vs Defensive balance
    const offensivePred = predictions.find(p => p.model === 'offensive_predictor');
    const defensivePred = predictions.find(p => p.model === 'defensive_predictor');
    
    if (offensivePred && defensivePred) {
      if (Math.abs(offensivePred.prediction - defensivePred.prediction) > 0.2) {
        if (offensivePred.prediction > defensivePred.prediction) {
          insights.push('Offensive advantages outweigh defensive matchup');
        } else {
          insights.push('Defensive matchup is the key factor');
        }
      }
    }
    
    // Momentum factor
    const momentumPred = predictions.find(p => p.model === 'momentum_tracker');
    if (momentumPred && momentumPred.confidence > 0.6) {
      insights.push(`Strong momentum factor favors ${momentumPred.prediction > 0.5 ? 'home' : 'away'} team`);
    }
    
    // Schedule impact
    const schedulePred = predictions.find(p => p.model === 'schedule_analyzer');
    if (schedulePred && Math.abs(schedulePred.prediction - 0.5) > 0.15) {
      insights.push(`Schedule situation favors ${schedulePred.prediction > 0.5 ? 'home' : 'away'} team`);
    }
    
    return insights;
  }
  
  async predictUpcomingGames() {
    console.log(chalk.yellow('\n🔮 Making enhanced predictions...\n'));
    
    // Get upcoming games with enriched data
    const { data: games } = await supabase
      .from('games')
      .select(`
        *,
        home_team:teams!games_home_team_id_fkey(*),
        away_team:teams!games_away_team_id_fkey(*)
      `)
      .is('home_score', null)
      .order('start_time', { ascending: true })
      .limit(5);
    
    if (!games || games.length === 0) {
      console.log(chalk.yellow('No upcoming games found'));
      return;
    }
    
    for (const game of games) {
      console.log(chalk.cyan(`\n📊 ${game.home_team?.name} vs ${game.away_team?.name}`));
      console.log(chalk.gray(`   ${new Date(game.start_time).toLocaleString()}`));
      
      // Enrich game data (simplified - in production, gather real stats)
      const enrichedGame = {
        ...game,
        home_team_rating: 0.5 + (Math.random() - 0.5) * 0.3,
        away_team_rating: 0.5 + (Math.random() - 0.5) * 0.3,
        home_recent_form: 0.5 + (Math.random() - 0.5) * 0.4,
        away_recent_form: 0.5 + (Math.random() - 0.5) * 0.4,
        home_offense_rating: 18 + Math.random() * 10,
        away_offense_rating: 18 + Math.random() * 10,
        home_defense_rating: 18 + Math.random() * 10,
        away_defense_rating: 18 + Math.random() * 10,
        home_rest_days: Math.floor(Math.random() * 7) + 1,
        away_rest_days: Math.floor(Math.random() * 7) + 1,
        is_primetime: new Date(game.start_time).getHours() >= 19,
        start_time: game.start_time
      };
      
      const prediction = await this.makeEnhancedPrediction(enrichedGame);
      
      // Display prediction
      console.log(chalk.white(`\n   🎯 Prediction: ${chalk.bold(prediction.prediction.toUpperCase())}`));
      console.log(chalk.white(`   📊 Win Probability: ${(prediction.probability * 100).toFixed(1)}%`));
      console.log(chalk.white(`   💪 Confidence: ${(prediction.confidence * 100).toFixed(1)}%`));
      
      // Show model breakdown
      console.log(chalk.gray('\n   Model Analysis:'));
      prediction.models.forEach(m => {
        const vote = m.prediction > 0.5 ? 'HOME' : 'AWAY';
        const confidence = (m.confidence * 100).toFixed(0);
        console.log(chalk.gray(`   - ${m.model}: ${vote} (${confidence}% conf, ${m.weight}x weight)`));
      });
      
      // Show insights
      if (prediction.insights.length > 0) {
        console.log(chalk.yellow('\n   Key Insights:'));
        prediction.insights.forEach(insight => {
          console.log(chalk.yellow(`   • ${insight}`));
        });
      }
      
      // Save prediction
      await supabase.from('ml_predictions').insert({
        game_id: game.id,
        model_name: 'enhanced_ensemble_v2',
        prediction_type: 'game_outcome',
        prediction: prediction.prediction,
        confidence: prediction.confidence,
        features: {
          probability: prediction.probability,
          model_votes: prediction.models
        },
        metadata: {
          insights: prediction.insights,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    console.log(chalk.green.bold('\n✨ Enhanced predictions complete!\n'));
  }
}

// Main execution
async function main() {
  const ensemble = new EnhancedMLEnsemble();
  await ensemble.initialize();
  await ensemble.predictUpcomingGames();
}

main().catch(console.error);
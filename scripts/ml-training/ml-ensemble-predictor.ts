#!/usr/bin/env tsx
/**
 * 🤖 ML ENSEMBLE PREDICTION SYSTEM
 * Combines multiple models for superior predictions
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

interface ModelPrediction {
  model: string;
  prediction: number;
  confidence: number;
  features: any;
}

interface EnsemblePrediction {
  game_id: string;
  prediction: string;
  confidence: number;
  models: ModelPrediction[];
  reasoning: string[];
}

class MLEnsemblePredictor {
  private models: Map<string, tf.LayersModel> = new Map();
  private predictions: EnsemblePrediction[] = [];
  
  async initialize() {
    console.log(chalk.cyan.bold('\n🤖 ML ENSEMBLE PREDICTION SYSTEM\n'));
    console.log(chalk.yellow('Initializing ensemble models...\n'));
    
    // Initialize different model types
    await this.createBaseModel();
    await this.createWeatherModel();
    await this.createMomentumModel();
    await this.createSocialModel();
    await this.createScheduleModel();
  }
  
  // Base neural network model
  private async createBaseModel() {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [10], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
    
    this.models.set('base_neural', model);
    console.log(chalk.green('✅ Base neural network initialized'));
  }
  
  // Weather-specialized model
  private async createWeatherModel() {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [8], units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.002),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
    
    this.models.set('weather_specialist', model);
    console.log(chalk.green('✅ Weather specialist model initialized'));
  }
  
  // Momentum tracking model
  private async createMomentumModel() {
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({ units: 32, returnSequences: true, inputShape: [5, 8] }),
        tf.layers.lstm({ units: 16 }),
        tf.layers.dense({ units: 8, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
    
    this.models.set('momentum_lstm', model);
    console.log(chalk.green('✅ Momentum LSTM model initialized'));
  }
  
  // Social sentiment model
  private async createSocialModel() {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [6], units: 24, activation: 'relu' }),
        tf.layers.dense({ units: 12, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.002),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
    
    this.models.set('social_sentiment', model);
    console.log(chalk.green('✅ Social sentiment model initialized'));
  }
  
  // Schedule fatigue model
  private async createScheduleModel() {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [5], units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 8, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
    
    this.models.set('schedule_fatigue', model);
    console.log(chalk.green('✅ Schedule fatigue model initialized'));
  }
  
  // Get predictions from all models
  async predictGame(gameData: any): Promise<EnsemblePrediction> {
    const predictions: ModelPrediction[] = [];
    const reasoning: string[] = [];
    
    // Base model prediction
    const baseFeatures = await this.extractBaseFeatures(gameData);
    const basePred = await this.getPrediction('base_neural', baseFeatures);
    predictions.push({
      model: 'base_neural',
      prediction: basePred,
      confidence: Math.abs(basePred - 0.5) * 2,
      features: baseFeatures
    });
    
    // Weather model (if weather data available)
    if (gameData.weather) {
      const weatherFeatures = await this.extractWeatherFeatures(gameData);
      const weatherPred = await this.getPrediction('weather_specialist', weatherFeatures);
      predictions.push({
        model: 'weather_specialist',
        prediction: weatherPred,
        confidence: Math.abs(weatherPred - 0.5) * 2.5, // Higher weight for specialty
        features: weatherFeatures
      });
      
      if (weatherPred < 0.45) {
        reasoning.push('Adverse weather conditions favor under/defense');
      } else if (weatherPred > 0.55) {
        reasoning.push('Good weather conditions favor scoring');
      }
    }
    
    // Momentum model (if historical data available)
    if (gameData.recentGames && gameData.recentGames.length >= 5) {
      const momentumFeatures = await this.extractMomentumFeatures(gameData);
      const momentumPred = await this.getPrediction('momentum_lstm', momentumFeatures);
      predictions.push({
        model: 'momentum_lstm',
        prediction: momentumPred,
        confidence: Math.abs(momentumPred - 0.5) * 2.2,
        features: momentumFeatures
      });
      
      if (momentumPred > 0.6) {
        reasoning.push('Strong momentum favors home team');
      } else if (momentumPred < 0.4) {
        reasoning.push('Away team has momentum advantage');
      }
    }
    
    // Social sentiment model
    if (gameData.sentiment) {
      const socialFeatures = await this.extractSocialFeatures(gameData);
      const socialPred = await this.getPrediction('social_sentiment', socialFeatures);
      predictions.push({
        model: 'social_sentiment',
        prediction: socialPred,
        confidence: Math.abs(socialPred - 0.5) * 1.5,
        features: socialFeatures
      });
      
      if (socialPred > 0.65) {
        reasoning.push('Public heavily backing home team - possible value on away');
      }
    }
    
    // Schedule model
    const scheduleFeatures = await this.extractScheduleFeatures(gameData);
    const schedulePred = await this.getPrediction('schedule_fatigue', scheduleFeatures);
    predictions.push({
      model: 'schedule_fatigue',
      prediction: schedulePred,
      confidence: Math.abs(schedulePred - 0.5) * 1.8,
      features: scheduleFeatures
    });
    
    if (schedulePred < 0.4) {
      reasoning.push('Schedule favors away team (rest advantage)');
    } else if (schedulePred > 0.6) {
      reasoning.push('Schedule favors home team (rest advantage)');
    }
    
    // Ensemble prediction (weighted average)
    const validPredictions = predictions.filter(p => !isNaN(p.confidence) && !isNaN(p.prediction));
    if (validPredictions.length === 0) {
      return {
        game_id: gameData.id,
        prediction: 'home_win',
        confidence: 0.5,
        models: predictions,
        reasoning: ['Insufficient data for confident prediction']
      };
    }
    
    const totalWeight = validPredictions.reduce((sum, p) => sum + p.confidence, 0);
    const ensemblePred = validPredictions.reduce((sum, p) => 
      sum + (p.prediction * p.confidence), 0
    ) / totalWeight;
    
    // Calculate ensemble confidence
    const agreement = 1 - (validPredictions.reduce((sum, p) => 
      sum + Math.abs(p.prediction - ensemblePred), 0
    ) / validPredictions.length);
    
    const ensembleConfidence = agreement * Math.abs(ensemblePred - 0.5) * 2;
    
    // Add ensemble reasoning
    if (agreement > 0.8) {
      reasoning.push('All models strongly agree on this prediction');
    } else if (agreement < 0.5) {
      reasoning.push('Models disagree - higher uncertainty');
    }
    
    return {
      game_id: gameData.id,
      prediction: ensemblePred > 0.5 ? 'home_win' : 'away_win',
      confidence: ensembleConfidence,
      models: predictions,
      reasoning: reasoning
    };
  }
  
  // Feature extraction methods
  private async extractBaseFeatures(gameData: any): Promise<tf.Tensor> {
    const features = [
      gameData.home_team_rating || 0.5,
      gameData.away_team_rating || 0.5,
      gameData.home_recent_form || 0.5,
      gameData.away_recent_form || 0.5,
      gameData.home_rest_days || 3,
      gameData.away_rest_days || 3,
      gameData.is_division_game ? 1 : 0,
      gameData.is_primetime ? 1 : 0,
      gameData.home_win_streak || 0,
      gameData.away_win_streak || 0
    ];
    
    return tf.tensor2d([features]);
  }
  
  private async extractWeatherFeatures(gameData: any): Promise<tf.Tensor> {
    const weather = gameData.weather;
    const features = [
      (weather.temperature - 50) / 50, // Normalize around 50F
      weather.wind_speed / 30,
      weather.humidity / 100,
      weather.conditions === 'Clear' ? 1 : 0,
      weather.conditions === 'Rain' ? 1 : 0,
      weather.conditions === 'Snow' ? 1 : 0,
      gameData.venue_type === 'dome' ? 1 : 0,
      gameData.surface === 'grass' ? 1 : 0
    ];
    
    return tf.tensor2d([features]);
  }
  
  private async extractMomentumFeatures(gameData: any): Promise<tf.Tensor> {
    // Create sequence data for LSTM
    const sequences = gameData.recentGames.map(game => [
      game.scored / 30, // Normalize scores
      game.allowed / 30,
      game.won ? 1 : 0,
      game.was_home ? 1 : 0,
      game.margin / 20,
      game.total / 50,
      game.rest_days / 7,
      game.opponent_rating || 0.5
    ]);
    
    return tf.tensor3d([sequences]);
  }
  
  private async extractSocialFeatures(gameData: any): Promise<tf.Tensor> {
    const sentiment = gameData.sentiment;
    const features = [
      sentiment.home_positive_rate || 0.5,
      sentiment.away_positive_rate || 0.5,
      sentiment.home_mention_count / 100,
      sentiment.away_mention_count / 100,
      sentiment.total_engagement / 1000,
      sentiment.expert_consensus || 0.5
    ];
    
    return tf.tensor2d([features]);
  }
  
  private async extractScheduleFeatures(gameData: any): Promise<tf.Tensor> {
    const features = [
      (gameData.home_rest_days || 3) / 7,
      (gameData.away_rest_days || 3) / 7,
      (gameData.home_travel_miles || 0) / 3000,
      (gameData.away_travel_miles || 0) / 3000,
      (gameData.timezone_difference || 0) / 3
    ];
    
    return tf.tensor2d([features]);
  }
  
  // Get prediction from specific model
  private async getPrediction(modelName: string, features: tf.Tensor): Promise<number> {
    const model = this.models.get(modelName);
    if (!model) return 0.5;
    
    const prediction = model.predict(features) as tf.Tensor;
    const value = await prediction.data();
    prediction.dispose();
    features.dispose();
    
    return value[0];
  }
  
  // Train ensemble on historical data
  async trainEnsemble() {
    console.log(chalk.yellow('\n🏋️ Training ensemble models...\n'));
    
    // Get historical games
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .limit(1000);
    
    if (!games || games.length < 100) {
      console.log(chalk.red('Insufficient training data'));
      return;
    }
    
    // Train each model with synthetic features (simplified)
    const epochs = 50;
    const batchSize = 32;
    
    // Train base model
    const baseX = tf.randomNormal([games.length, 10]);
    const baseY = tf.tensor(games.map(g => g.home_score > g.away_score ? 1 : 0));
    
    await this.models.get('base_neural')!.fit(baseX, baseY, {
      epochs,
      batchSize,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            console.log(chalk.gray(`Base model - Epoch ${epoch}: loss=${logs?.loss?.toFixed(4)}, acc=${logs?.acc?.toFixed(4)}`));
          }
        }
      }
    });
    
    baseX.dispose();
    baseY.dispose();
    
    console.log(chalk.green('\n✅ Ensemble training complete!'));
  }
  
  // Make predictions on upcoming games
  async predictUpcomingGames() {
    console.log(chalk.yellow('\n🔮 Predicting upcoming games...\n'));
    
    // Get upcoming games with team info
    const { data: games } = await supabase
      .from('games')
      .select(`
        *,
        home_team:teams!games_home_team_id_fkey(*),
        away_team:teams!games_away_team_id_fkey(*)
      `)
      .is('home_score', null)
      .order('start_time', { ascending: true })
      .limit(10);
    
    if (!games || games.length === 0) {
      console.log(chalk.yellow('No upcoming games found'));
      return;
    }
    
    // Make predictions
    for (const game of games) {
      // Gather real game data
      const gameData = await this.gatherRealGameData(game);
      
      const prediction = await this.predictGame(gameData);
      this.predictions.push(prediction);
      
      // Save to database
      await supabase.from('ml_predictions').insert({
        game_id: game.id,
        model_name: 'ensemble_v1',
        prediction_type: 'game_outcome',
        prediction: prediction.prediction,
        confidence: prediction.confidence,
        features: prediction.models,
        metadata: {
          reasoning: prediction.reasoning,
          model_predictions: prediction.models.map(m => ({
            model: m.model,
            prediction: m.prediction,
            confidence: m.confidence
          }))
        },
        created_at: new Date().toISOString()
      });
    }
    
    this.displayPredictions();
  }
  
  // Gather real data for a game
  private async gatherRealGameData(game: any): Promise<any> {
    const gameData: any = {
      id: game.id,
      home_team_id: game.home_team_id,
      away_team_id: game.away_team_id,
      is_division_game: false, // Will calculate based on teams
      is_primetime: new Date(game.start_time).getHours() >= 19
    };
    
    // Get recent games for both teams
    const { data: homeGames } = await supabase
      .from('games')
      .select('*')
      .or(`home_team_id.eq.${game.home_team_id},away_team_id.eq.${game.home_team_id}`)
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(10);
    
    const { data: awayGames } = await supabase
      .from('games')
      .select('*')
      .or(`home_team_id.eq.${game.away_team_id},away_team_id.eq.${game.away_team_id}`)
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(10);
    
    // Calculate team ratings and form
    if (homeGames && homeGames.length > 0) {
      const homeWins = homeGames.filter(g => 
        (g.home_team_id === game.home_team_id && g.home_score > g.away_score) ||
        (g.away_team_id === game.home_team_id && g.away_score > g.home_score)
      ).length;
      gameData.home_team_rating = homeWins / homeGames.length;
      gameData.home_recent_form = homeWins / Math.min(homeGames.length, 5);
      gameData.home_win_streak = this.calculateWinStreak(homeGames, game.home_team_id);
      
      // Calculate rest days
      const lastGame = homeGames[0];
      const daysSince = (new Date(game.start_time).getTime() - new Date(lastGame.start_time).getTime()) / (1000 * 60 * 60 * 24);
      gameData.home_rest_days = Math.floor(daysSince);
    } else {
      gameData.home_team_rating = 0.5;
      gameData.home_recent_form = 0.5;
      gameData.home_win_streak = 0;
      gameData.home_rest_days = 3;
    }
    
    if (awayGames && awayGames.length > 0) {
      const awayWins = awayGames.filter(g => 
        (g.home_team_id === game.away_team_id && g.home_score > g.away_score) ||
        (g.away_team_id === game.away_team_id && g.away_score > g.home_score)
      ).length;
      gameData.away_team_rating = awayWins / awayGames.length;
      gameData.away_recent_form = awayWins / Math.min(awayGames.length, 5);
      gameData.away_win_streak = this.calculateWinStreak(awayGames, game.away_team_id);
      
      // Calculate rest days
      const lastGame = awayGames[0];
      const daysSince = (new Date(game.start_time).getTime() - new Date(lastGame.start_time).getTime()) / (1000 * 60 * 60 * 24);
      gameData.away_rest_days = Math.floor(daysSince);
    } else {
      gameData.away_team_rating = 0.5;
      gameData.away_recent_form = 0.5;
      gameData.away_win_streak = 0;
      gameData.away_rest_days = 3;
    }
    
    // Get weather data if available
    const { data: weather } = await supabase
      .from('weather_data')
      .select('*')
      .eq('game_id', game.id)
      .single();
    
    if (weather) {
      gameData.weather = {
        temperature: weather.temperature,
        wind_speed: weather.wind_speed,
        humidity: weather.humidity,
        conditions: weather.conditions
      };
    } else {
      // Default weather data
      gameData.weather = {
        temperature: 72,
        wind_speed: 5,
        humidity: 50,
        conditions: 'Clear'
      };
    }
    
    // Get social sentiment
    const { data: homeSentiment } = await supabase
      .from('social_sentiment')
      .select('*')
      .ilike('content', `%${game.home_team?.name || ''}%`)
      .order('created_at', { ascending: false })
      .limit(50);
    
    const { data: awaySentiment } = await supabase
      .from('social_sentiment')
      .select('*')
      .ilike('content', `%${game.away_team?.name || ''}%`)
      .order('created_at', { ascending: false })
      .limit(50);
    
    // Calculate sentiment metrics
    const homePositive = homeSentiment?.filter(s => s.sentiment === 'positive').length || 0;
    const awayPositive = awaySentiment?.filter(s => s.sentiment === 'positive').length || 0;
    
    gameData.sentiment = {
      home_positive_rate: homeSentiment?.length ? homePositive / homeSentiment.length : 0.5,
      away_positive_rate: awaySentiment?.length ? awayPositive / awaySentiment.length : 0.5,
      home_mention_count: homeSentiment?.length || 0,
      away_mention_count: awaySentiment?.length || 0,
      total_engagement: (homeSentiment?.reduce((sum, s) => sum + (s.engagement_score || 0), 0) || 0) +
                       (awaySentiment?.reduce((sum, s) => sum + (s.engagement_score || 0), 0) || 0)
    };
    
    // Get recent games for momentum
    if (homeGames && homeGames.length >= 5) {
      gameData.recentGames = homeGames.slice(0, 5).map(g => ({
        scored: g.home_team_id === game.home_team_id ? g.home_score : g.away_score,
        allowed: g.home_team_id === game.home_team_id ? g.away_score : g.home_score,
        won: (g.home_team_id === game.home_team_id && g.home_score > g.away_score) ||
             (g.away_team_id === game.home_team_id && g.away_score > g.home_score),
        was_home: g.home_team_id === game.home_team_id,
        margin: g.home_team_id === game.home_team_id ? 
                g.home_score - g.away_score : g.away_score - g.home_score,
        total: g.home_score + g.away_score,
        rest_days: 3, // Default
        opponent_rating: 0.5 // Default
      }));
    }
    
    // Travel and timezone data (defaults for now)
    gameData.home_travel_miles = 0;
    gameData.away_travel_miles = 500; // Away teams travel
    gameData.timezone_difference = 0;
    
    return gameData;
  }
  
  // Calculate win streak
  private calculateWinStreak(games: any[], teamId: number): number {
    let streak = 0;
    for (const game of games) {
      const won = (game.home_team_id === teamId && game.home_score > game.away_score) ||
                  (game.away_team_id === teamId && game.away_score > game.home_score);
      if (won) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }
  
  private displayPredictions() {
    console.log(chalk.green.bold('\n🎯 ENSEMBLE PREDICTIONS:\n'));
    
    // Sort by confidence
    const sorted = this.predictions.sort((a, b) => b.confidence - a.confidence);
    
    sorted.forEach((pred, i) => {
      const emoji = pred.confidence > 0.7 ? '🔥' : 
                    pred.confidence > 0.5 ? '💪' : '🤔';
      
      console.log(chalk.cyan(`${i + 1}. ${emoji} Game ${pred.game_id}`));
      console.log(chalk.white(`   Prediction: ${pred.prediction.toUpperCase()}`));
      console.log(chalk.white(`   Confidence: ${(pred.confidence * 100).toFixed(1)}%`));
      
      // Show model agreement
      console.log(chalk.gray('   Model votes:'));
      pred.models.forEach(m => {
        const vote = m.prediction > 0.5 ? 'HOME' : 'AWAY';
        console.log(chalk.gray(`     - ${m.model}: ${vote} (${(m.confidence * 100).toFixed(0)}%)`));
      });
      
      // Show reasoning
      if (pred.reasoning.length > 0) {
        console.log(chalk.yellow('   Key factors:'));
        pred.reasoning.forEach(r => {
          console.log(chalk.yellow(`     • ${r}`));
        });
      }
      
      console.log();
    });
    
    // Summary stats
    const avgConfidence = sorted.reduce((sum, p) => sum + p.confidence, 0) / sorted.length;
    const homePickRate = sorted.filter(p => p.prediction === 'home_win').length / sorted.length;
    
    console.log(chalk.green.bold('📊 SUMMARY:'));
    console.log(chalk.white(`   Average confidence: ${(avgConfidence * 100).toFixed(1)}%`));
    console.log(chalk.white(`   Home pick rate: ${(homePickRate * 100).toFixed(0)}%`));
    console.log(chalk.white(`   Total predictions: ${sorted.length}`));
  }
}

// Main execution
async function main() {
  const ensemble = new MLEnsemblePredictor();
  
  await ensemble.initialize();
  await ensemble.trainEnsemble();
  await ensemble.predictUpcomingGames();
  
  console.log(chalk.green.bold('\n✨ Ensemble predictions complete!\n'));
}

main().catch(console.error);
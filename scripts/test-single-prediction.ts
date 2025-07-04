import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { ensemblePredictor, GameFeatures } from '../lib/ml/ensemble-predictor';
import chalk from 'chalk';
import * as path from 'path';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testSinglePrediction() {
  console.log(chalk.bold.cyan('🧪 TESTING SINGLE PREDICTION'));
  console.log(chalk.gray('='.repeat(40)));
  
  try {
    // Load models
    await ensemblePredictor.loadModels(path.join(process.cwd(), 'models'));
    console.log(chalk.green('✅ Models loaded'));
    
    // Get one game
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'scheduled')
      .limit(1);
    
    if (!games || games.length === 0) {
      console.log('No scheduled games found');
      return;
    }
    
    const game = games[0];
    console.log(chalk.yellow(`\nTesting with game ${game.id}`));
    
    // Create test features
    const features: GameFeatures = {
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
    
    // Make prediction
    console.log(chalk.yellow('Making prediction...'));
    const prediction = await ensemblePredictor.predict(features);
    console.log(chalk.green('✅ Prediction made:'), prediction);
    
    // Save prediction with correct schema
    const predictionRecord = {
      game_id: game.id,
      model_name: 'ensemble_v2',
      prediction_type: 'game_outcome',
      prediction: prediction.homeWinProbability,
      confidence: prediction.confidence,
      metadata: {
        predicted_winner: prediction.homeWinProbability > 0.5 ? 'home' : 'away',
        home_win_probability: prediction.homeWinProbability,
        features: features,
        model_predictions: prediction.modelPredictions,
        top_factors: prediction.topFactors
      },
      created_at: new Date().toISOString()
    };
    
    console.log(chalk.yellow('\nSaving prediction...'));
    const { data, error } = await supabase
      .from('ml_predictions')
      .insert(predictionRecord)
      .select();
    
    if (error) {
      console.error(chalk.red('❌ Save error:'), error);
    } else {
      console.log(chalk.green('✅ Prediction saved!'));
      console.log('Saved data:', data);
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  }
}

testSinglePrediction().catch(console.error);
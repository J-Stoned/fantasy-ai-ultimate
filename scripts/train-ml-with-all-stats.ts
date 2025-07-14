#!/usr/bin/env tsx
import * as tf from '@tensorflow/tfjs-node';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Import our aggregation helper
import { getAggregatedPlayerGameStats } from '../lib/stats-aggregation-helper';

async function trainMLWithAllStats() {
  console.log('🧠 TRAINING ML MODEL WITH ALL 3.6M STATS!\n');
  console.log('━'.repeat(60));
  
  try {
    // Step 1: Get games with final scores for supervised learning
    console.log('📊 Fetching completed games with scores...\n');
    
    const { data: completedGames, error: gamesError } = await supabase
      .from('games')
      .select('id, home_team_id, away_team_id, home_score, away_score, start_time')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(1000); // Start with 1000 recent games
    
    if (gamesError) throw gamesError;
    
    console.log(`✅ Found ${completedGames?.length} completed games\n`);
    
    // Step 2: Get player stats for these games
    console.log('🏀 Fetching player stats for training...\n');
    
    const gameIds = completedGames?.map(g => g.id) || [];
    
    // Get all player-game combinations with stats
    const { data: playerGamesWithStats, error: pgError } = await supabase
      .from('player_stats')
      .select('player_id, game_id')
      .in('game_id', gameIds)
      .limit(10000); // Get up to 10K player-game combinations
    
    if (pgError) throw pgError;
    
    // Deduplicate
    const uniqueCombos = new Map<string, any>();
    playerGamesWithStats?.forEach(pg => {
      const key = `${pg.player_id}-${pg.game_id}`;
      if (!uniqueCombos.has(key)) {
        uniqueCombos.set(key, pg);
      }
    });
    
    console.log(`✅ Found ${uniqueCombos.size} unique player-game combinations\n`);
    
    // Step 3: Aggregate stats and prepare training data
    console.log('📈 Aggregating stats for ML training...\n');
    
    const features: number[][] = [];
    const labels: number[] = [];
    let processedCount = 0;
    let validSamples = 0;
    
    // Process in batches to avoid memory issues
    const combosArray = Array.from(uniqueCombos.values());
    const BATCH_SIZE = 100;
    
    for (let i = 0; i < Math.min(combosArray.length, 2000); i += BATCH_SIZE) {
      const batch = combosArray.slice(i, i + BATCH_SIZE);
      
      // Fetch stats for batch
      const batchPromises = batch.map(async (combo) => {
        const { data: stats } = await supabase
          .from('player_stats')
          .select('*')
          .eq('player_id', combo.player_id)
          .eq('game_id', combo.game_id);
        
        return { combo, stats };
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      // Process each result
      for (const { combo, stats } of batchResults) {
        if (!stats || stats.length === 0) continue;
        
        // Aggregate stats
        const aggregated = aggregateStats(stats);
        
        // Only use samples with meaningful playing time
        if (aggregated.minutes_played > 5) {
          // Create feature vector
          const featureVector = [
            aggregated.points,
            aggregated.rebounds,
            aggregated.assists,
            aggregated.steals,
            aggregated.blocks,
            aggregated.turnovers,
            aggregated.field_goals_made,
            aggregated.field_goals_attempted,
            aggregated.field_goal_percentage,
            aggregated.three_pointers_made,
            aggregated.three_pointers_attempted,
            aggregated.three_point_percentage,
            aggregated.free_throws_made,
            aggregated.free_throws_attempted,
            aggregated.free_throw_percentage,
            aggregated.minutes_played,
            aggregated.personal_fouls,
            aggregated.plus_minus
          ];
          
          features.push(featureVector);
          labels.push(aggregated.fantasy_points);
          validSamples++;
        }
        
        processedCount++;
        if (processedCount % 500 === 0) {
          console.log(`Processed ${processedCount} player-games, valid samples: ${validSamples}`);
        }
      }
    }
    
    console.log(`\n✅ TRAINING DATA READY:`);
    console.log(`├─ Total samples: ${validSamples}`);
    console.log(`├─ Features per sample: ${features[0]?.length || 0}`);
    console.log(`└─ Ready for model training!\n`);
    
    if (validSamples < 100) {
      console.error('❌ Not enough valid samples for training. Need at least 100.');
      return;
    }
    
    // Step 4: Create and train model
    console.log('🤖 BUILDING NEURAL NETWORK...\n');
    
    // Convert to tensors
    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels, [labels.length, 1]);
    
    // Normalize features
    const xsNorm = tf.div(xs, tf.scalar(100));
    
    // Create model architecture
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ 
          inputShape: [features[0].length], 
          units: 128, 
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.3 }),
        
        tf.layers.dense({ 
          units: 64, 
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.2 }),
        
        tf.layers.dense({ 
          units: 32, 
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dropout({ rate: 0.1 }),
        
        tf.layers.dense({ units: 1 })
      ]
    });
    
    // Compile model
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae', 'mse']
    });
    
    console.log('Model architecture:');
    model.summary();
    
    // Train model
    console.log('\n🏋️ TRAINING MODEL...\n');
    
    const history = await model.fit(xsNorm, ys, {
      epochs: 100,
      validationSplit: 0.2,
      batchSize: 32,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0 || epoch === 99) {
            console.log(
              `Epoch ${epoch + 1}: ` +
              `loss = ${logs?.loss.toFixed(4)}, ` +
              `mae = ${logs?.mae.toFixed(2)}, ` +
              `val_loss = ${logs?.val_loss?.toFixed(4)}, ` +
              `val_mae = ${logs?.val_mae?.toFixed(2)}`
            );
          }
        }
      }
    });
    
    // Save model
    const modelPath = 'file://./models/all-stats-ml-model';
    await model.save(modelPath);
    
    console.log(`\n✅ MODEL TRAINED AND SAVED!`);
    console.log(`├─ Location: ${modelPath}`);
    console.log(`├─ Training samples: ${Math.floor(validSamples * 0.8)}`);
    console.log(`├─ Validation samples: ${Math.floor(validSamples * 0.2)}`);
    console.log(`└─ Final validation MAE: ${history.history.val_mae[history.history.val_mae.length - 1].toFixed(2)}\n`);
    
    // Test predictions
    console.log('🎯 SAMPLE PREDICTIONS:\n');
    
    // Make predictions on a few samples
    const testSamples = features.slice(0, 5);
    const testTensor = tf.div(tf.tensor2d(testSamples), tf.scalar(100));
    const predictions = model.predict(testTensor) as tf.Tensor;
    const predArray = await predictions.array();
    
    testSamples.forEach((sample, i) => {
      console.log(`Sample ${i + 1}:`);
      console.log(`  Points: ${sample[0]}, Rebounds: ${sample[1]}, Assists: ${sample[2]}`);
      console.log(`  Predicted Fantasy Points: ${predArray[i][0].toFixed(2)}`);
      console.log(`  Actual Fantasy Points: ${labels[i].toFixed(2)}\n`);
    });
    
    // Cleanup
    xs.dispose();
    ys.dispose();
    xsNorm.dispose();
    testTensor.dispose();
    predictions.dispose();
    
    console.log('🎉 SUCCESS! Your ML model can now use all 3.6M stats!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

function aggregateStats(stats: any[]): any {
  const aggregated: any = {
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    field_goals_made: 0,
    field_goals_attempted: 0,
    field_goal_percentage: 0,
    three_pointers_made: 0,
    three_pointers_attempted: 0,
    three_point_percentage: 0,
    free_throws_made: 0,
    free_throws_attempted: 0,
    free_throw_percentage: 0,
    minutes_played: 0,
    personal_fouls: 0,
    plus_minus: 0,
    fantasy_points: 0
  };
  
  // Map of stat types to aggregated fields
  const statMapping: Record<string, string> = {
    'points': 'points',
    'pts': 'points',
    'rebounds': 'rebounds',
    'reb': 'rebounds',
    'assists': 'assists',
    'ast': 'assists',
    'steals': 'steals',
    'stl': 'steals',
    'blocks': 'blocks',
    'blk': 'blocks',
    'turnovers': 'turnovers',
    'to': 'turnovers',
    'tov': 'turnovers',
    'field_goals_made': 'field_goals_made',
    'fgm': 'field_goals_made',
    'field_goals_attempted': 'field_goals_attempted',
    'fga': 'field_goals_attempted',
    'three_pointers_made': 'three_pointers_made',
    'three_point_field_goals_made': 'three_pointers_made',
    '3pm': 'three_pointers_made',
    'three_pointers_attempted': 'three_pointers_attempted',
    'three_point_field_goals_attempted': 'three_pointers_attempted',
    '3pa': 'three_pointers_attempted',
    'free_throws_made': 'free_throws_made',
    'ftm': 'free_throws_made',
    'free_throws_attempted': 'free_throws_attempted',
    'fta': 'free_throws_attempted',
    'minutes': 'minutes_played',
    'min': 'minutes_played',
    'minutes_played': 'minutes_played',
    'personal_fouls': 'personal_fouls',
    'pf': 'personal_fouls',
    'plus_minus': 'plus_minus',
    '+/-': 'plus_minus'
  };
  
  // Aggregate all stats
  stats.forEach(stat => {
    const statType = stat.stat_type?.toLowerCase();
    const mappedField = statMapping[statType];
    
    if (mappedField && mappedField in aggregated) {
      aggregated[mappedField] = parseFloat(stat.stat_value) || 0;
    }
    
    if (stat.fantasy_points) {
      aggregated.fantasy_points = Math.max(aggregated.fantasy_points, stat.fantasy_points);
    }
  });
  
  // Calculate fantasy points if not present
  if (aggregated.fantasy_points === 0 && aggregated.points > 0) {
    aggregated.fantasy_points = 
      aggregated.points +
      (aggregated.rebounds * 1.2) +
      (aggregated.assists * 1.5) +
      (aggregated.steals * 3) +
      (aggregated.blocks * 3) -
      (aggregated.turnovers * 1);
  }
  
  // Calculate shooting percentages
  if (aggregated.field_goals_attempted > 0) {
    aggregated.field_goal_percentage = aggregated.field_goals_made / aggregated.field_goals_attempted;
  }
  if (aggregated.three_pointers_attempted > 0) {
    aggregated.three_point_percentage = aggregated.three_pointers_made / aggregated.three_pointers_attempted;
  }
  if (aggregated.free_throws_attempted > 0) {
    aggregated.free_throw_percentage = aggregated.free_throws_made / aggregated.free_throws_attempted;
  }
  
  return aggregated;
}

// Run the training
trainMLWithAllStats();
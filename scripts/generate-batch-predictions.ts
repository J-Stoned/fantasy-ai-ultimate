import { supabase } from '../lib/supabase-client';
import { loadModels } from '../lib/prediction/ensemble-predictor';
import { extractGameFeatures } from '../lib/ml/feature-extraction';
import { createWebSocketBroadcaster } from '../lib/streaming/websocket-broadcaster';

async function generateBatchPredictions(targetCount: number = 1000) {
  console.log(`\n🎯 BATCH PREDICTION GENERATOR`);
  console.log(`==================================================`);
  console.log(`Target: ${targetCount} predictions\n`);

  // Load models
  console.log('Loading ML models...');
  const models = await loadModels();
  console.log('✅ Models loaded\n');

  // Connect WebSocket
  const broadcaster = createWebSocketBroadcaster('ws://localhost:8080');
  await broadcaster.connect();
  console.log('✅ WebSocket connected\n');

  // Get all games that need predictions
  const { data: games, error } = await supabase
    .from('games')
    .select('*')
    .or('home_score.is.null,away_score.is.null')
    .order('game_date', { ascending: false })
    .limit(targetCount * 2); // Get extra in case some already have predictions

  if (error) {
    console.error('Error fetching games:', error);
    return;
  }

  console.log(`Found ${games.length} games without final scores`);

  let newPredictions = 0;
  let skipped = 0;

  for (const game of games) {
    if (newPredictions >= targetCount) break;

    // Check if prediction already exists
    const { data: existing } = await supabase
      .from('ml_predictions')
      .select('id')
      .eq('game_id', game.id)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    try {
      // Extract features
      const features = await extractGameFeatures(game);
      if (!features) continue;

      // Make ensemble prediction
      const neuralPred = await models.neuralNetwork.predict(features.normalized);
      const rfPred = models.randomForest.predict([features.raw]);
      
      const ensembleProbability = (neuralPred * 0.4 + rfPred[0] * 0.6);
      const prediction = ensembleProbability > 0.5 ? 'away' : 'home';
      const confidence = Math.abs(ensembleProbability - 0.5) * 2;

      // Store prediction
      const { error: insertError } = await supabase
        .from('ml_predictions')
        .insert({
          game_id: game.id,
          model_type: 'ensemble_v2',
          prediction,
          confidence: confidence * 100,
          features_used: Object.keys(features.raw),
          created_at: new Date().toISOString()
        });

      if (!insertError) {
        newPredictions++;
        
        // Broadcast via WebSocket
        await broadcaster.broadcast({
          type: 'prediction',
          data: {
            gameId: game.id,
            teams: `${game.home_team} vs ${game.away_team}`,
            prediction: prediction.toUpperCase(),
            confidence: (confidence * 100).toFixed(1)
          }
        });

        if (newPredictions % 10 === 0) {
          console.log(`✅ Generated ${newPredictions} predictions...`);
        }
      }
    } catch (err) {
      console.error(`Error predicting game ${game.id}:`, err);
    }
  }

  console.log(`\n✨ BATCH COMPLETE!`);
  console.log(`==============================`);
  console.log(`New predictions: ${newPredictions}`);
  console.log(`Skipped (existing): ${skipped}`);
  console.log(`Total predictions in DB: ${248 + newPredictions}`);

  await broadcaster.disconnect();
  process.exit(0);
}

// Parse command line args
const args = process.argv.slice(2);
const countArg = args.find(arg => arg.startsWith('--count='));
const count = countArg ? parseInt(countArg.split('=')[1]) : 1000;

generateBatchPredictions(count).catch(console.error);
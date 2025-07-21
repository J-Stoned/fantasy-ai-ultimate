#!/usr/bin/env tsx
/**
 * 🧠 Train Predictor on Clean Baseball Data
 * Uses filtered, validated data for better predictions
 */

import chalk from 'chalk';
import { simplePredictor } from './models/simple-predictor';
import { pgPool } from './config/database';
import fs from 'fs/promises';
import path from 'path';

async function trainCleanPredictor() {
  console.log(chalk.cyan.bold('\n🧠 Training on Clean Baseball Data...\n'));
  
  try {
    // 1. Load clean baseball data
    console.log(chalk.cyan('⚾ Loading clean baseball statistics...'));
    
    const playerData = await pgPool.query(`
      SELECT 
        player_id,
        name as player_name,
        clean_position as position,
        is_pitcher,
        fantasy_points,
        created_at,
        stat_type
      FROM v_baseball_stats
      ORDER BY player_id, created_at DESC
      LIMIT 50000  -- Reasonable limit
    `);
    
    console.log(chalk.green(`✅ Loaded ${playerData.rows.length} clean game records`));
    
    // 2. Group by player
    const playerMap = new Map<string, any[]>();
    
    playerData.rows.forEach(row => {
      const key = row.player_id.toString();
      if (!playerMap.has(key)) {
        playerMap.set(key, []);
      }
      playerMap.get(key)!.push(row);
    });
    
    console.log(chalk.green(`✅ Found ${playerMap.size} unique players`));
    
    // 3. Separate pitchers and batters
    const pitcherMap = new Map<string, any[]>();
    const batterMap = new Map<string, any[]>();
    
    for (const [playerId, games] of playerMap) {
      if (games[0].is_pitcher) {
        pitcherMap.set(playerId, games);
      } else {
        batterMap.set(playerId, games);
      }
    }
    
    console.log(chalk.yellow(`  Pitchers: ${pitcherMap.size}`));
    console.log(chalk.yellow(`  Batters: ${batterMap.size}`));
    
    // 4. Generate predictions for each group
    console.log(chalk.cyan('\n🎯 Generating predictions...'));
    
    const pitcherPredictions = await simplePredictor.predictBatch(pitcherMap);
    const batterPredictions = await simplePredictor.predictBatch(batterMap);
    
    console.log(chalk.green(`✅ Generated ${pitcherPredictions.length} pitcher predictions`));
    console.log(chalk.green(`✅ Generated ${batterPredictions.length} batter predictions`));
    
    // 5. Show top predictions for each
    console.log(chalk.cyan('\n⚾ Top 5 Pitcher Predictions:'));
    pitcherPredictions.slice(0, 5).forEach((pred, i) => {
      console.log(chalk.yellow(
        `${i+1}. ${pred.player_name}: ${pred.predicted_points} pts ` +
        `(${pred.floor}-${pred.ceiling}) ` +
        `${pred.trend === 'up' ? '📈' : pred.trend === 'down' ? '📉' : '➡️'} ` +
        `${Math.round(pred.confidence * 100)}% conf`
      ));
    });
    
    console.log(chalk.cyan('\n🏏 Top 5 Batter Predictions:'));
    batterPredictions.slice(0, 5).forEach((pred, i) => {
      console.log(chalk.yellow(
        `${i+1}. ${pred.player_name}: ${pred.predicted_points} pts ` +
        `(${pred.floor}-${pred.ceiling}) ` +
        `${pred.trend === 'up' ? '📈' : pred.trend === 'down' ? '📉' : '➡️'} ` +
        `${Math.round(pred.confidence * 100)}% conf`
      ));
    });
    
    // 6. Save clean predictions
    const outputPath = path.join(process.cwd(), 'models', 'clean-predictions.json');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    const allPredictions = {
      generated_at: new Date().toISOString(),
      total_predictions: pitcherPredictions.length + batterPredictions.length,
      pitchers: {
        count: pitcherPredictions.length,
        top_20: pitcherPredictions.slice(0, 20)
      },
      batters: {
        count: batterPredictions.length,
        top_20: batterPredictions.slice(0, 20)
      }
    };
    
    await fs.writeFile(outputPath, JSON.stringify(allPredictions, null, 2));
    
    console.log(chalk.green(`\n✅ Clean predictions saved to ${outputPath}`));
    
    // 7. Statistical summary
    console.log(chalk.cyan('\n📊 Prediction Statistics:'));
    
    const pitcherAvg = pitcherPredictions.reduce((sum, p) => sum + p.predicted_points, 0) / pitcherPredictions.length;
    const batterAvg = batterPredictions.reduce((sum, p) => sum + p.predicted_points, 0) / batterPredictions.length;
    
    console.log(`  Pitcher avg prediction: ${pitcherAvg.toFixed(1)} pts`);
    console.log(`  Batter avg prediction: ${batterAvg.toFixed(1)} pts`);
    
    console.log(chalk.green.bold('\n✅ Clean training complete!\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Training error:'), error);
  } finally {
    await pgPool.end();
  }
}

trainCleanPredictor();
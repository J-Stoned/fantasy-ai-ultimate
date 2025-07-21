#!/usr/bin/env tsx
/**
 * 🚀 Train Simple Predictor with Actual Data
 * Uses your real database structure
 */

import chalk from 'chalk';
import { simplePredictor } from './models/simple-predictor';
import { pgPool } from './config/database';
import fs from 'fs/promises';
import path from 'path';

async function trainSimplePredictor() {
  console.log(chalk.cyan.bold('\n🧠 Training Simple Predictor with Real Data...\n'));
  
  try {
    // 1. Load player data
    console.log(chalk.cyan('📊 Loading player statistics...'));
    
    const playerData = await pgPool.query(`
      WITH player_games AS (
        SELECT 
          p.id::VARCHAR(255) as player_id,
          p.name as player_name,
          p.sport,
          p.position,
          ps.fantasy_points,
          ps.created_at,
          ps.stat_value::JSONB as stats,
          ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY ps.created_at DESC) as game_num
        FROM players p
        JOIN player_stats ps ON p.id = ps.player_id
        WHERE ps.fantasy_points IS NOT NULL
        AND ps.fantasy_points > 0
      )
      SELECT *
      FROM player_games
      WHERE game_num <= 50  -- Last 50 games per player
      ORDER BY player_id, created_at DESC
    `);
    
    console.log(chalk.green(`✅ Loaded ${playerData.rows.length} player game records`));
    
    // 2. Group by player
    const playerMap = new Map<string, any[]>();
    
    playerData.rows.forEach(row => {
      if (!playerMap.has(row.player_id)) {
        playerMap.set(row.player_id, []);
      }
      playerMap.get(row.player_id)!.push(row);
    });
    
    console.log(chalk.green(`✅ Found ${playerMap.size} unique players`));
    
    // 3. Generate predictions
    console.log(chalk.cyan('\n🎯 Generating predictions...'));
    
    const predictions = await simplePredictor.predictBatch(playerMap);
    
    console.log(chalk.green(`✅ Generated ${predictions.length} predictions`));
    
    // 4. Show top predictions
    console.log(chalk.cyan('\n🏆 Top 10 Predicted Players:'));
    
    predictions.slice(0, 10).forEach((pred, index) => {
      console.log(chalk.yellow(
        `${index + 1}. ${pred.player_name || pred.player_id}: ` +
        `${pred.predicted_points} pts (${pred.floor}-${pred.ceiling}) ` +
        `${pred.trend === 'up' ? '📈' : pred.trend === 'down' ? '📉' : '➡️'} ` +
        `${Math.round(pred.confidence * 100)}% conf`
      ));
    });
    
    // 5. Save predictions
    const outputPath = path.join(process.cwd(), 'models', 'predictions.json');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    await fs.writeFile(
      outputPath,
      JSON.stringify({
        generated_at: new Date().toISOString(),
        total_predictions: predictions.length,
        predictions: predictions.slice(0, 100) // Save top 100
      }, null, 2)
    );
    
    console.log(chalk.green(`\n✅ Predictions saved to ${outputPath}`));
    
    // 6. Analyze by sport
    console.log(chalk.cyan('\n📊 Predictions by Sport:'));
    
    const bySport = await pgPool.query(`
      SELECT 
        p.sport,
        COUNT(DISTINCT p.id) as players,
        AVG(ps.fantasy_points) as avg_points,
        MAX(ps.fantasy_points) as max_points
      FROM players p
      JOIN player_stats ps ON p.id = ps.player_id
      WHERE ps.fantasy_points IS NOT NULL
      GROUP BY p.sport
      ORDER BY players DESC
    `);
    
    bySport.rows.forEach(row => {
      console.log(chalk.yellow(
        `  ${row.sport}: ${row.players} players, ` +
        `avg ${parseFloat(row.avg_points).toFixed(1)} pts, ` +
        `max ${parseFloat(row.max_points).toFixed(1)} pts`
      ));
    });
    
    console.log(chalk.green.bold('\n✅ Training complete!\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Training error:'), error);
  } finally {
    await pgPool.end();
  }
}

// Run training
trainSimplePredictor();
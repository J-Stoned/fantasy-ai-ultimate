#!/usr/bin/env tsx
/**
 * 🎮 Simulate Game Outcomes
 * 
 * Updates games with scores to test continuous learning
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function simulateOutcomes() {
  console.log(chalk.bold.cyan('\n🎮 SIMULATING GAME OUTCOMES'));
  console.log(chalk.gray('='.repeat(40)));
  
  // Get recent predictions
  const { data: predictions, error } = await supabase
    .from('ml_predictions')
    .select('*')
    .eq('model_name', 'ensemble_v2')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (error || !predictions || predictions.length === 0) {
    console.log(chalk.yellow('No predictions found'));
    return;
  }
  
  console.log(chalk.blue(`Found ${predictions.length} predictions`));
  
  // Get corresponding games
  const gameIds = predictions.map(p => p.game_id);
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .in('id', gameIds)
    .is('home_score', null);
  
  if (gamesError || !games || games.length === 0) {
    console.log(chalk.yellow('No games without scores found'));
    return;
  }
  
  console.log(chalk.blue(`Found ${games.length} games to simulate`));
  
  let simulatedCount = 0;
  
  // Create a map of predictions by game_id
  const predictionMap = new Map(predictions.map(p => [p.game_id, p]));
  
  for (const game of games) {
    const pred = predictionMap.get(game.id);
    if (!pred) {
      console.log(chalk.gray(`  No prediction found for game ${game.id}`));
      continue;
    }
    
    const metadata = pred.metadata as any;
    if (!metadata || !metadata.home_win_probability) {
      console.log(chalk.gray(`  No metadata for game ${game.id}`));
      continue;
    }
    
    const predictedHomeWin = metadata.home_win_probability > 0.5;
    const confidence = pred.confidence || 0.5;
    
    // Simulate outcome based on prediction confidence
    // Higher confidence = more likely to be correct
    const randomFactor = Math.random();
    const isCorrect = randomFactor < confidence;
    
    // Generate realistic scores
    const baseScore = 20 + Math.floor(Math.random() * 15);
    const margin = 3 + Math.floor(Math.random() * 14);
    
    let homeScore: number;
    let awayScore: number;
    
    if ((predictedHomeWin && isCorrect) || (!predictedHomeWin && !isCorrect)) {
      // Home team wins
      homeScore = baseScore + margin;
      awayScore = baseScore;
    } else {
      // Away team wins
      homeScore = baseScore;
      awayScore = baseScore + margin;
    }
    
    // Update game with scores
    const { error: updateError } = await supabase
      .from('games')
      .update({
        home_score: homeScore,
        away_score: awayScore,
        status: 'completed',
        end_time: new Date().toISOString()
      })
      .eq('id', game.id);
    
    if (!updateError) {
      simulatedCount++;
      const actualWinner = homeScore > awayScore ? 'HOME' : 'AWAY';
      const predictedWinner = predictedHomeWin ? 'HOME' : 'AWAY';
      const correct = actualWinner === predictedWinner;
      
      console.log(chalk.gray(
        `  Game ${game.id}: ${homeScore}-${awayScore} ` +
        `(predicted ${predictedWinner}, actual ${actualWinner}) ` +
        `${correct ? chalk.green('✓') : chalk.red('✗')}`
      ));
    } else {
      console.log(chalk.red(`  Failed to update game ${game.id}:`, updateError.message));
    }
  }
  
  console.log(chalk.bold.green(`\n✅ Simulated ${simulatedCount} game outcomes!`));
  console.log(chalk.gray('The continuous learner can now analyze these results'));
}

simulateOutcomes().catch(console.error);
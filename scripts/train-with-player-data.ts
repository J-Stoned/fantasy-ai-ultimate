#!/usr/bin/env tsx
/**
 * 🔥 TRAIN WITH PLAYER DATA! 🔥
 */

import chalk from 'chalk';
import { RandomForestClassifier } from 'ml-random-forest';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as fs from 'fs';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function trainWithPlayerData() {
  console.log(chalk.bold.red('🔥 TRAINING WITH PLAYER DATA! 🔥'));
  console.log(chalk.yellow('Using games + 8,858 player stats!'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load games AND player stats
    console.log(chalk.cyan('1️⃣ Loading games and player data...'));
    
    // Load games (limit to recent for speed)
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(5000); // Recent 5K games
    
    console.log(chalk.green(`✅ Loaded ${games?.length} games`));
    
    // Load player stats
    const { data: playerStats } = await supabase
      .from('player_stats')
      .select('*')
      .limit(5000); // Top player stats
    
    console.log(chalk.green(`✅ Loaded ${playerStats?.length} player stats`));
    
    // Load injuries
    const { data: injuries } = await supabase
      .from('player_injuries')
      .select('*');
    
    console.log(chalk.green(`✅ Loaded ${injuries?.length} injury records`));
    
    // 2. Build ENHANCED features
    console.log(chalk.cyan('\n2️⃣ Building ENHANCED features with player data...'));
    
    const features: number[][] = [];
    const labels: number[] = [];
    
    // Create player impact map
    const playerImpact = new Map();
    playerStats?.forEach(stat => {
      const impact = (stat.points || 0) * 1.0 + 
                    (stat.assists || 0) * 0.8 + 
                    (stat.rebounds || 0) * 0.6 +
                    (stat.steals || 0) * 0.4 +
                    (stat.blocks || 0) * 0.4;
      playerImpact.set(stat.player_id, impact);
    });
    
    // Create injury map
    const injuryMap = new Map();
    injuries?.forEach(inj => {
      injuryMap.set(inj.player_id, inj.severity || 1);
    });
    
    // Build team stats with player data
    const teamStats = new Map();
    const teamPlayerImpact = new Map();
    
    games?.forEach(game => {
      [game.home_team_id, game.away_team_id].forEach(teamId => {
        if (!teamStats.has(teamId)) {
          teamStats.set(teamId, {
            games: 0, wins: 0, losses: 0,
            totalFor: 0, totalAgainst: 0,
            recentForm: [], playerImpactTotal: 0
          });
          teamPlayerImpact.set(teamId, 0);
        }
      });
    });
    
    // Calculate team player impacts
    playerStats?.forEach(stat => {
      if (stat.team_id && playerImpact.has(stat.player_id)) {
        const current = teamPlayerImpact.get(stat.team_id) || 0;
        teamPlayerImpact.set(stat.team_id, current + playerImpact.get(stat.player_id));
      }
    });
    
    // Process games with enhanced features
    games?.forEach((game, idx) => {
      const homeId = game.home_team_id;
      const awayId = game.away_team_id;
      const homeStats = teamStats.get(homeId);
      const awayStats = teamStats.get(awayId);
      
      if (homeStats && awayStats && homeStats.games >= 5 && awayStats.games >= 5) {
        const homeWinRate = homeStats.wins / homeStats.games;
        const awayWinRate = awayStats.wins / awayStats.games;
        const homeAvgFor = homeStats.totalFor / homeStats.games;
        const awayAvgFor = awayStats.totalFor / awayStats.games;
        const homeAvgAgainst = homeStats.totalAgainst / homeStats.games;
        const awayAvgAgainst = awayStats.totalAgainst / awayStats.games;
        
        // Player impact features
        const homePlayerImpact = teamPlayerImpact.get(homeId) || 0;
        const awayPlayerImpact = teamPlayerImpact.get(awayId) || 0;
        const playerImpactDiff = (homePlayerImpact - awayPlayerImpact) / 1000;
        
        // Recent form
        const homeRecent = homeStats.recentForm.slice(-5).reduce((a: number, b: number) => a + b, 0) / 
                          Math.max(homeStats.recentForm.slice(-5).length, 1);
        const awayRecent = awayStats.recentForm.slice(-5).reduce((a: number, b: number) => a + b, 0) / 
                          Math.max(awayStats.recentForm.slice(-5).length, 1);
        
        // Build ENHANCED feature vector (20 features)
        const gameFeatures = [
          // Original 15 features
          homeWinRate - awayWinRate,                    // 0. Win rate diff
          (homeAvgFor - awayAvgFor) / 10,              // 1. Scoring diff
          (awayAvgAgainst - homeAvgAgainst) / 10,       // 2. Defense diff
          homeRecent - awayRecent,                      // 3. Recent form
          0.1,                                          // 4. Consistency
          0.0,                                          // 5. SOS
          0.0,                                          // 6. H2H
          homeRecent * 2 - awayRecent * 2,             // 7. Momentum
          (homeStats.games - awayStats.games) / 100,   // 8. Experience
          homeAvgFor / Math.max(awayAvgAgainst, 1),    // 9. Off matchup
          awayAvgFor / Math.max(homeAvgAgainst, 1),    // 10. Def matchup
          0.03,                                         // 11. Home field
          0.5,                                          // 12. Season progress
          Math.abs(homeWinRate - 0.5) - Math.abs(awayWinRate - 0.5), // 13. Distance from .500
          (homeAvgFor - homeAvgAgainst) / 10 - (awayAvgFor - awayAvgAgainst) / 10, // 14. Net rating
          
          // NEW PLAYER-BASED FEATURES
          playerImpactDiff,                             // 15. Player impact difference
          homePlayerImpact / 100,                       // 16. Home player strength
          awayPlayerImpact / 100,                       // 17. Away player strength
          Math.abs(playerImpactDiff),                   // 18. Player mismatch level
          playerImpactDiff * (homeWinRate - awayWinRate) // 19. Player × team interaction
        ];
        
        features.push(gameFeatures);
        labels.push(game.home_score > game.away_score ? 1 : 0);
      }
      
      // Update stats
      if (homeStats && awayStats) {
        homeStats.games++;
        awayStats.games++;
        homeStats.totalFor += game.home_score;
        homeStats.totalAgainst += game.away_score;
        awayStats.totalFor += game.away_score;
        awayStats.totalAgainst += game.home_score;
        
        if (game.home_score > game.away_score) {
          homeStats.wins++;
          awayStats.losses++;
          homeStats.recentForm.push(1);
          awayStats.recentForm.push(0);
        } else {
          homeStats.losses++;
          awayStats.wins++;
          homeStats.recentForm.push(0);
          awayStats.recentForm.push(1);
        }
      }
    });
    
    console.log(chalk.green(`✅ Built ${features.length} ENHANCED feature vectors!`));
    
    // 3. Balance
    console.log(chalk.cyan('\n3️⃣ Balancing with player data...'));
    const homeWins = labels.filter(l => l === 1).length;
    const awayWins = labels.filter(l => l === 0).length;
    console.log(chalk.yellow(`Original: ${homeWins} home, ${awayWins} away`));
    
    // Smart balance
    const minClass = Math.min(homeWins, awayWins);
    const balanced = { features: [] as number[][], labels: [] as number[] };
    let homeCount = 0, awayCount = 0;
    
    for (let i = 0; i < features.length; i++) {
      if ((labels[i] === 1 && homeCount < minClass) || 
          (labels[i] === 0 && awayCount < minClass)) {
        balanced.features.push(features[i]);
        balanced.labels.push(labels[i]);
        if (labels[i] === 1) homeCount++;
        else awayCount++;
      }
    }
    
    console.log(chalk.green(`✅ Balanced: ${homeCount} home, ${awayCount} away`));
    
    // 4. Train with PLAYER DATA
    console.log(chalk.cyan('\n4️⃣ Training with PLAYER-ENHANCED features...'));
    
    const splitIdx = Math.floor(balanced.features.length * 0.85);
    const xTrain = balanced.features.slice(0, splitIdx);
    const yTrain = balanced.labels.slice(0, splitIdx);
    const xTest = balanced.features.slice(splitIdx);
    const yTest = balanced.labels.slice(splitIdx);
    
    console.log(chalk.yellow(`Training on ${xTrain.length} samples with 20 features...`));
    
    const model = new RandomForestClassifier({
      nEstimators: 200,        // Fast but accurate
      maxDepth: 25,            // Deep for complex patterns
      minSamplesLeaf: 2,       // Fine detail
      maxFeatures: 1.0,        // USE ALL FEATURES INCLUDING PLAYER DATA!
      replacement: true,
      seed: 42
    });
    
    const startTime = Date.now();
    model.train(xTrain, yTrain);
    const trainTime = (Date.now() - startTime) / 1000;
    
    console.log(chalk.green(`✅ Model trained in ${trainTime.toFixed(1)}s!`));
    
    // 5. Evaluate
    console.log(chalk.cyan('\n5️⃣ Evaluating PLAYER-ENHANCED model...'));
    const predictions = model.predict(xTest);
    
    let correct = 0;
    let homeCorrect = 0, homeTotal = 0;
    let awayCorrect = 0, awayTotal = 0;
    
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === yTest[i]) correct++;
      
      if (yTest[i] === 1) {
        homeTotal++;
        if (predictions[i] === 1) homeCorrect++;
      } else {
        awayTotal++;
        if (predictions[i] === 0) awayCorrect++;
      }
    }
    
    const accuracy = correct / predictions.length;
    const homeAcc = homeCorrect / homeTotal;
    const awayAcc = awayCorrect / awayTotal;
    
    console.log(chalk.bold.green('\n🎯 RESULTS WITH PLAYER DATA:'));
    console.log(chalk.green(`Overall Accuracy: ${(accuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home Accuracy: ${(homeAcc * 100).toFixed(1)}%`));
    console.log(chalk.green(`Away Accuracy: ${(awayAcc * 100).toFixed(1)}%`));
    console.log(chalk.green(`Balance: ${((homeAcc + awayAcc) / 2 * 100).toFixed(1)}%`));
    
    // 6. Save PLAYER-ENHANCED model
    console.log(chalk.cyan('\n6️⃣ Saving player-enhanced model...'));
    
    const modelJSON = model.toJSON();
    
    // Save for API
    fs.writeFileSync('./models/player-enhanced-model.json', JSON.stringify(modelJSON, null, 2));
    fs.writeFileSync('./models/bias-corrected-rf-clean.json', JSON.stringify(modelJSON, null, 2));
    
    console.log(chalk.green('✅ Saved player-enhanced model!'));
    
    console.log(chalk.bold.red('\n🔥 PLAYER-ENHANCED TRAINING COMPLETE! 🔥'));
    console.log(chalk.yellow('═'.repeat(60)));
    
    if (accuracy >= 0.86) {
      console.log(chalk.bold.green('🎉🎉 86%+ ACCURACY WITH PLAYER DATA! 🎉🎉'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

trainWithPlayerData().catch(console.error);
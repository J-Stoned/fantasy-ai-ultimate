#!/usr/bin/env tsx
/**
 * 🔮 Send Test Predictions
 * 
 * Sends fake predictions to test the real-time dashboard
 */

import WebSocket from 'ws';
import chalk from 'chalk';

const WS_URL = 'ws://localhost:8080';

const teams = [
  'Kansas City Chiefs', 'Buffalo Bills', 'Cincinnati Bengals', 'Miami Dolphins',
  'Baltimore Ravens', 'Cleveland Browns', 'New York Jets', 'New England Patriots',
  'Jacksonville Jaguars', 'Tennessee Titans', 'Indianapolis Colts', 'Houston Texans',
  'Denver Broncos', 'Las Vegas Raiders', 'Los Angeles Chargers', 'Pittsburgh Steelers',
  'Philadelphia Eagles', 'Dallas Cowboys', 'San Francisco 49ers', 'Seattle Seahawks'
];

function getRandomTeams() {
  const shuffled = [...teams].sort(() => 0.5 - Math.random());
  return [shuffled[0], shuffled[1]];
}

async function sendTestPredictions() {
  console.log(chalk.bold.cyan('\n🔮 SENDING TEST PREDICTIONS'));
  console.log(chalk.gray('='.repeat(40)));
  
  const ws = new WebSocket(WS_URL);
  
  ws.on('open', () => {
    console.log(chalk.green('✅ Connected to WebSocket server'));
    
    let count = 0;
    
    // Send predictions every 2 seconds
    const interval = setInterval(() => {
      count++;
      
      const [homeTeam, awayTeam] = getRandomTeams();
      const homeWinProbability = Math.random();
      const confidence = 0.5 + Math.random() * 0.4; // 50-90%
      
      const prediction = {
        gameId: `test_${Date.now()}_${count}`,
        prediction: {
          winner: homeWinProbability > 0.5 ? 'home' : 'away',
          homeWinProbability: homeWinProbability,
          confidence: confidence,
          models: {
            neuralNetwork: homeWinProbability + (Math.random() - 0.5) * 0.1,
            randomForest: homeWinProbability + (Math.random() - 0.5) * 0.1
          }
        },
        game: {
          homeTeam: homeTeam,
          awayTeam: awayTeam,
          startTime: new Date(Date.now() + Math.random() * 86400000).toISOString(),
          sport: 'nfl'
        },
        timestamp: Date.now()
      };
      
      // Send as broadcast message
      ws.send(JSON.stringify({
        type: 'broadcast',
        channel: 'predictions',
        data: {
          type: 'new_prediction',
          data: prediction
        }
      }));
      
      console.log(chalk.yellow(
        `Sent: ${homeTeam} vs ${awayTeam} → ${prediction.prediction.winner.toUpperCase()} ` +
        `(${(confidence * 100).toFixed(1)}%)`
      ));
      
      // Send batch complete every 10 predictions
      if (count % 10 === 0) {
        ws.send(JSON.stringify({
          type: 'broadcast',
          channel: 'system',
          data: {
            type: 'batch_complete',
            data: {
              predictions: 10,
              sport: 'nfl',
              timestamp: Date.now()
            }
          }
        }));
        
        console.log(chalk.green(`\n✅ Batch ${count / 10} complete!\n`));
      }
      
      // Send model update every 15 predictions
      if (count % 15 === 0) {
        ws.send(JSON.stringify({
          type: 'broadcast',
          channel: 'metrics',
          data: {
            type: 'model_accuracy',
            data: {
              model: 'ensemble_v2',
              accuracy: 0.51 + Math.random() * 0.05,
              predictions: count,
              timestamp: Date.now()
            }
          }
        }));
      }
      
      // Stop after 50 predictions
      if (count >= 50) {
        clearInterval(interval);
        console.log(chalk.bold.green('\n✅ Sent 50 test predictions!'));
        ws.close();
        process.exit(0);
      }
    }, 2000);
  });
  
  ws.on('error', (error) => {
    console.error(chalk.red('WebSocket error:'), error.message);
    process.exit(1);
  });
}

sendTestPredictions().catch(console.error);
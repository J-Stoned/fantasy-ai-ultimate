#!/usr/bin/env tsx
/**
 * 🎯 Fantasy Sports ML Training Script
 * Train all fantasy ML models using our 1M+ stats database
 */

import chalk from 'chalk';
import { fantasyDataLoader } from './data-pipeline/fantasy-data-loader';
import { playerPredictor } from './models/player-performance-predictor';
import { dfsOptimizer, DFSPlayer, LineupConstraints } from './models/dfs-lineup-optimizer';

async function trainFantasyModels() {
  console.log(chalk.bold.cyan('🚀 FANTASY SPORTS ML TRAINING - 10X OPPORTUNITY!\n'));
  
  try {
    // Load training data for NBA (most DFS volume)
    console.log(chalk.yellow('Loading NBA training data...'));
    const startDate = '2023-10-01';
    const endDate = '2024-04-01';
    
    const playerStats = await fantasyDataLoader.loadPlayerGameLogs('nba', startDate, endDate);
    console.log(chalk.green(`✅ Loaded ${playerStats.length} player game logs`));
    
    // Prepare features for ML
    const features = await fantasyDataLoader.prepareFeatures(playerStats, 10);
    console.log(chalk.green(`✅ Prepared ${features.length} training samples`));
    
    // Train player performance model
    await playerPredictor.trainModel(features);
    
    // Save the model
    await playerPredictor.saveModel('./models/nba-player-predictor');
    
    // Test DFS optimization
    await testDFSOptimization();
    
    console.log(chalk.bold.green('\n🎯 FANTASY ML TRAINING COMPLETE!'));
    console.log(chalk.yellow('Ready to beat consensus projections and win DFS tournaments!'));
    
  } catch (error) {
    console.error(chalk.red('Error during training:'), error);
    process.exit(1);
  }
}

async function testDFSOptimization() {
  console.log(chalk.cyan('\n🎮 Testing DFS Lineup Optimization...'));
  
  // Create sample DFS players (in production, load from database)
  const samplePlayers: DFSPlayer[] = [
    // Point Guards
    {
      id: '1',
      name: 'Luka Doncic',
      position: 'PG',
      team: 'DAL',
      opponent: 'PHX',
      salary: 11200,
      projected_points: 58.5,
      projected_ownership: 22.5,
      floor: 45,
      ceiling: 75,
      boom_probability: 0.35,
      correlation_partners: ['2'] // Kyrie
    },
    {
      id: '2',
      name: 'Kyrie Irving',
      position: 'PG',
      team: 'DAL',
      opponent: 'PHX',
      salary: 8800,
      projected_points: 42.5,
      projected_ownership: 15.2,
      floor: 32,
      ceiling: 55,
      boom_probability: 0.28,
      correlation_partners: ['1'] // Luka
    },
    {
      id: '3',
      name: 'Tyrese Haliburton',
      position: 'PG',
      team: 'IND',
      opponent: 'MIL',
      salary: 9500,
      projected_points: 45.5,
      projected_ownership: 18.5,
      floor: 35,
      ceiling: 58,
      boom_probability: 0.30
    },
    // Shooting Guards
    {
      id: '4',
      name: 'Devin Booker',
      position: 'SG',
      team: 'PHX',
      opponent: 'DAL',
      salary: 9200,
      projected_points: 43.5,
      projected_ownership: 16.8,
      floor: 33,
      ceiling: 56,
      boom_probability: 0.29
    },
    {
      id: '5',
      name: 'Anthony Edwards',
      position: 'SG',
      team: 'MIN',
      opponent: 'DEN',
      salary: 8600,
      projected_points: 40.5,
      projected_ownership: 14.2,
      floor: 30,
      ceiling: 52,
      boom_probability: 0.26
    },
    // Small Forwards
    {
      id: '6',
      name: 'LeBron James',
      position: 'SF',
      team: 'LAL',
      opponent: 'GSW',
      salary: 9800,
      projected_points: 46.5,
      projected_ownership: 19.5,
      floor: 36,
      ceiling: 60,
      boom_probability: 0.32
    },
    {
      id: '7',
      name: 'Jayson Tatum',
      position: 'SF',
      team: 'BOS',
      opponent: 'MIA',
      salary: 10200,
      projected_points: 48.5,
      projected_ownership: 20.8,
      floor: 38,
      ceiling: 62,
      boom_probability: 0.33
    },
    // Power Forwards
    {
      id: '8',
      name: 'Giannis Antetokounmpo',
      position: 'PF',
      team: 'MIL',
      opponent: 'IND',
      salary: 11800,
      projected_points: 61.5,
      projected_ownership: 25.5,
      floor: 48,
      ceiling: 78,
      boom_probability: 0.38
    },
    {
      id: '9',
      name: 'Kevin Durant',
      position: 'PF',
      team: 'PHX',
      opponent: 'DAL',
      salary: 10400,
      projected_points: 49.5,
      projected_ownership: 21.2,
      floor: 39,
      ceiling: 63,
      boom_probability: 0.34
    },
    // Centers
    {
      id: '10',
      name: 'Nikola Jokic',
      position: 'C',
      team: 'DEN',
      opponent: 'MIN',
      salary: 12000,
      projected_points: 63.5,
      projected_ownership: 28.5,
      floor: 50,
      ceiling: 80,
      boom_probability: 0.40
    },
    {
      id: '11',
      name: 'Joel Embiid',
      position: 'C',
      team: 'PHI',
      opponent: 'BKN',
      salary: 11600,
      projected_points: 60.5,
      projected_ownership: 24.8,
      floor: 47,
      ceiling: 76,
      boom_probability: 0.37
    },
    // Value plays
    {
      id: '12',
      name: 'Alperen Sengun',
      position: 'C',
      team: 'HOU',
      opponent: 'SAS',
      salary: 7200,
      projected_points: 36.5,
      projected_ownership: 12.5,
      floor: 28,
      ceiling: 46,
      boom_probability: 0.22
    }
  ];
  
  // DraftKings NBA Classic constraints
  const constraints: LineupConstraints = {
    salary_cap: 50000,
    positions: new Map([
      ['PG', 1],
      ['SG', 1],
      ['SF', 1],
      ['PF', 1],
      ['C', 1],
      ['G', 1],  // Guard (PG or SG)
      ['F', 1],  // Forward (SF or PF)
      ['UTIL', 1] // Any position
    ]),
    max_from_team: 3
  };
  
  // Generate lineups with different strategies
  console.log(chalk.yellow('\n📊 Balanced Strategy:'));
  const balancedLineups = await dfsOptimizer.optimizeLineups(
    samplePlayers, 
    constraints, 
    5, 
    'balanced'
  );
  
  console.log(chalk.yellow('\n📊 Contrarian Strategy:'));
  const contrarianLineups = await dfsOptimizer.optimizeLineups(
    samplePlayers, 
    constraints, 
    5, 
    'contrarian'
  );
  
  console.log(chalk.yellow('\n📊 Ceiling Strategy:'));
  const ceilingLineups = await dfsOptimizer.optimizeLineups(
    samplePlayers, 
    constraints, 
    5, 
    'ceiling'
  );
}

// Execute training
trainFantasyModels();
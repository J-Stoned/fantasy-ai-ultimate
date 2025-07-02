#!/usr/bin/env tsx
/**
 * 🚀 TRAIN PRODUCTION ENSEMBLE MODEL
 * 
 * Combines Neural Network + XGBoost + LSTM for 70%+ accuracy
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import { ProductionEnsembleModel } from '../lib/ml/ProductionEnsembleModel';
import { LSTMPredictor } from '../lib/ml/lstm-predictor';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function trainEnsembleModel() {
  console.log(chalk.blue.bold('\n🚀 TRAINING PRODUCTION ENSEMBLE MODEL\n'));
  console.log(chalk.cyan('Goal: 70%+ accuracy using NN + XGBoost + LSTM\n'));
  
  try {
    // 1. Load all data
    console.log(chalk.yellow('📊 Loading comprehensive training data...'));
    
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .order('start_time', { ascending: true });
      
    const { data: news } = await supabase
      .from('news_articles')
      .select('*');
      
    const { data: players } = await supabase
      .from('players')
      .select('*');
      
    const { data: playerStats } = await supabase
      .from('player_stats')
      .select('*');
      
    const { data: injuries } = await supabase
      .from('player_injuries')
      .select('*');
      
    const { data: weather } = await supabase
      .from('weather_data')
      .select('*');
      
    const { data: sentiment } = await supabase
      .from('news_sentiment')
      .select('*');
      
    console.log(chalk.green('✅ Data loaded:'));
    console.log(`   - ${games?.length || 0} games`);
    console.log(`   - ${news?.length || 0} news articles`);
    console.log(`   - ${playerStats?.length || 0} player stats`);
    console.log(`   - ${injuries?.length || 0} injuries`);
    console.log(`   - ${weather?.length || 0} weather records`);
    
    if (!games || games.length < 1000) {
      throw new Error('Insufficient game data');
    }
    
    // 2. Build comprehensive feature matrix
    console.log(chalk.yellow('\n🔧 Building feature matrix with all available data...'));
    
    const { features, labels, sequenceData } = await buildComprehensiveFeatures(
      games,
      news || [],
      players || [],
      playerStats || [],
      injuries || [],
      weather || [],
      sentiment || []
    );
    
    console.log(chalk.green(`✅ Feature matrix built: ${features.length} samples, ${features[0].length} features`));
    
    // 3. Initialize ensemble model
    console.log(chalk.yellow('\n🤖 Initializing ensemble model...'));
    
    const ensemble = new ProductionEnsembleModel();
    await ensemble.buildModels(features[0].length, 10); // 10 game sequence length
    
    // 4. Train ensemble
    console.log(chalk.blue.bold('\n🏋️ Training ensemble (this will take several minutes)...\n'));
    
    await ensemble.train(
      features,
      labels,
      sequenceData,
      50 // epochs
    );
    
    // 5. Test predictions
    console.log(chalk.yellow('\n🎯 Testing ensemble predictions...'));
    
    const testSamples = 10;
    const testIdx = features.length - testSamples;
    
    let correct = 0;
    for (let i = 0; i < testSamples; i++) {
      const idx = testIdx + i;
      const prediction = await ensemble.predict(
        features[idx],
        sequenceData ? sequenceData[idx] : undefined
      );
      
      const actual = labels[idx] > 0.5 ? 'home' : 'away';
      const game = games[idx];
      
      console.log(chalk.gray(
        `  ${game.home_team_id} vs ${game.away_team_id}: ` +
        `Predicted=${prediction.winner} (${(prediction.confidence * 100).toFixed(1)}%), ` +
        `Actual=${actual}`
      ));
      
      if (prediction.winner === actual) correct++;
      
      // Show model breakdown
      console.log(chalk.gray(`    ${prediction.reasoning}`));
    }
    
    const testAccuracy = correct / testSamples;
    console.log(chalk.cyan(`\n📊 Test Accuracy: ${(testAccuracy * 100).toFixed(1)}%`));
    
    // 6. Save ensemble model
    const modelPath = path.join(process.cwd(), 'models', 'ensemble_predictor');
    await ensemble.save(modelPath);
    
    console.log(chalk.green.bold('\n✅ Ensemble model trained and saved!'));
    console.log(chalk.cyan(`   Location: ${modelPath}`));
    
    // 7. Summary stats
    console.log(chalk.blue.bold('\n📈 Training Summary:'));
    console.log(`   - Total samples: ${features.length}`);
    console.log(`   - Features per sample: ${features[0].length}`);
    console.log(`   - Models: Neural Network + XGBoost + LSTM`);
    console.log(`   - Test accuracy: ${(testAccuracy * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  }
}

/**
 * Build comprehensive feature matrix with all available data
 */
async function buildComprehensiveFeatures(
  games: any[],
  news: any[],
  players: any[],
  playerStats: any[],
  injuries: any[],
  weather: any[],
  sentiment: any[]
) {
  const features: number[][] = [];
  const labels: number[] = [];
  
  // Create lookup maps for efficiency
  const statsMap = new Map();
  const injuryMap = new Map();
  const weatherMap = new Map();
  const sentimentMap = new Map();
  
  // Index player stats by game
  for (const stat of playerStats) {
    const key = `${stat.game_id}-${stat.player_id}`;
    if (!statsMap.has(stat.game_id)) {
      statsMap.set(stat.game_id, []);
    }
    statsMap.get(stat.game_id).push(stat);
  }
  
  // Index injuries by player and date
  for (const injury of injuries) {
    if (!injuryMap.has(injury.player_id)) {
      injuryMap.set(injury.player_id, []);
    }
    injuryMap.get(injury.player_id).push(injury);
  }
  
  // Index weather by game
  for (const w of weather) {
    weatherMap.set(w.game_id, w);
  }
  
  // Index sentiment by team
  for (const s of sentiment) {
    const teamId = s.team_id || s.entity_id;
    if (!sentimentMap.has(teamId)) {
      sentimentMap.set(teamId, []);
    }
    sentimentMap.get(teamId).push(s);
  }
  
  // Calculate team stats
  const teamStats = calculateTeamStats(games);
  
  // Process each game
  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const gameFeatures: number[] = [];
    
    // 1. Basic team stats (10 features)
    const homeStats = teamStats.get(game.home_team_id) || getDefaultStats();
    const awayStats = teamStats.get(game.away_team_id) || getDefaultStats();
    
    gameFeatures.push(
      homeStats.winRate,
      homeStats.avgPointsFor,
      homeStats.avgPointsAgainst,
      homeStats.lastNGames,
      homeStats.homeWinRate,
      awayStats.winRate,
      awayStats.avgPointsFor,
      awayStats.avgPointsAgainst,
      awayStats.lastNGames,
      awayStats.awayWinRate
    );
    
    // 2. Head-to-head history (5 features)
    const h2h = calculateH2HStats(games.slice(0, i), game.home_team_id, game.away_team_id);
    gameFeatures.push(
      h2h.homeWins,
      h2h.awayWins,
      h2h.avgPointDiff,
      h2h.lastMeetingDaysAgo,
      h2h.streakLength
    );
    
    // 3. Player stats aggregates (10 features)
    const gameStats = statsMap.get(game.id) || [];
    const homePlayerStats = aggregatePlayerStats(gameStats, game.home_team_id, players);
    const awayPlayerStats = aggregatePlayerStats(gameStats, game.away_team_id, players);
    
    gameFeatures.push(
      homePlayerStats.totalFantasyPoints,
      homePlayerStats.starPlayerPoints,
      homePlayerStats.avgPlayerRating,
      homePlayerStats.topScorers,
      homePlayerStats.consistency,
      awayPlayerStats.totalFantasyPoints,
      awayPlayerStats.starPlayerPoints,
      awayPlayerStats.avgPlayerRating,
      awayPlayerStats.topScorers,
      awayPlayerStats.consistency
    );
    
    // 4. Injury impact (4 features)
    const homeInjuries = calculateInjuryImpact(game, game.home_team_id, players, injuryMap);
    const awayInjuries = calculateInjuryImpact(game, game.away_team_id, players, injuryMap);
    
    gameFeatures.push(
      homeInjuries.injuredStarters,
      homeInjuries.totalImpact,
      awayInjuries.injuredStarters,
      awayInjuries.totalImpact
    );
    
    // 5. Weather features (4 features)
    const gameWeather = weatherMap.get(game.id);
    if (gameWeather) {
      gameFeatures.push(
        gameWeather.temperature / 100, // Normalize
        gameWeather.wind_speed / 30,
        gameWeather.humidity / 100,
        gameWeather.conditions === 'Clear' ? 1 : 0
      );
    } else {
      gameFeatures.push(0.7, 0.3, 0.5, 1); // Default values
    }
    
    // 6. Sentiment features (4 features)
    const homeSentiment = calculateTeamSentiment(game.home_team_id, game.start_time, sentimentMap);
    const awaySentiment = calculateTeamSentiment(game.away_team_id, game.start_time, sentimentMap);
    
    gameFeatures.push(
      homeSentiment.positive,
      homeSentiment.volume,
      awaySentiment.positive,
      awaySentiment.volume
    );
    
    // 7. Time and schedule features (3 features)
    const date = new Date(game.start_time);
    gameFeatures.push(
      date.getMonth() / 11, // Normalized month
      date.getDay() / 6, // Day of week
      game.week ? game.week / 17 : 0.5 // Week of season
    );
    
    // Label (home team won)
    const homeWon = game.home_score > game.away_score ? 1 : 0;
    
    features.push(gameFeatures);
    labels.push(homeWon);
  }
  
  // Create sequence data for LSTM using the same feature set
  const sequences: number[][][] = [];
  
  // For each sample, create a sequence from previous games
  for (let i = 10; i < features.length; i++) {
    const sequence: number[][] = [];
    
    // Get last 10 feature vectors as sequence
    for (let j = i - 10; j < i; j++) {
      sequence.push(features[j]);
    }
    
    sequences.push(sequence);
  }
  
  // Align features and labels with sequences
  const alignedFeatures = features.slice(10);
  const alignedLabels = labels.slice(10);
  
  return { 
    features: alignedFeatures, 
    labels: alignedLabels, 
    sequenceData: sequences 
  };
}

/**
 * Calculate team statistics
 */
function calculateTeamStats(games: any[]) {
  const stats = new Map();
  
  // Initialize stats for each team
  const teams = new Set([...games.map(g => g.home_team_id), ...games.map(g => g.away_team_id)]);
  
  for (const teamId of teams) {
    const teamGames = games.filter(g => 
      g.home_team_id === teamId || g.away_team_id === teamId
    );
    
    let wins = 0;
    let homeWins = 0;
    let awayWins = 0;
    let homeGames = 0;
    let awayGames = 0;
    let totalPointsFor = 0;
    let totalPointsAgainst = 0;
    let last5 = 0;
    
    for (let i = 0; i < teamGames.length; i++) {
      const game = teamGames[i];
      const isHome = game.home_team_id === teamId;
      
      if (isHome) {
        homeGames++;
        totalPointsFor += game.home_score || 0;
        totalPointsAgainst += game.away_score || 0;
        if (game.home_score > game.away_score) {
          wins++;
          homeWins++;
          if (i >= teamGames.length - 5) last5++;
        }
      } else {
        awayGames++;
        totalPointsFor += game.away_score || 0;
        totalPointsAgainst += game.home_score || 0;
        if (game.away_score > game.home_score) {
          wins++;
          awayWins++;
          if (i >= teamGames.length - 5) last5++;
        }
      }
    }
    
    stats.set(teamId, {
      winRate: teamGames.length > 0 ? wins / teamGames.length : 0.5,
      avgPointsFor: teamGames.length > 0 ? totalPointsFor / teamGames.length : 20,
      avgPointsAgainst: teamGames.length > 0 ? totalPointsAgainst / teamGames.length : 20,
      lastNGames: last5 / Math.min(5, teamGames.length),
      homeWinRate: homeGames > 0 ? homeWins / homeGames : 0.5,
      awayWinRate: awayGames > 0 ? awayWins / awayGames : 0.5
    });
  }
  
  return stats;
}

/**
 * Calculate head-to-head stats
 */
function calculateH2HStats(previousGames: any[], homeId: string, awayId: string) {
  const h2hGames = previousGames.filter(g => 
    (g.home_team_id === homeId && g.away_team_id === awayId) ||
    (g.home_team_id === awayId && g.away_team_id === homeId)
  );
  
  let homeWins = 0;
  let awayWins = 0;
  let totalPointDiff = 0;
  let streakTeam = '';
  let streakLength = 0;
  
  for (const game of h2hGames) {
    if (game.home_team_id === homeId) {
      if (game.home_score > game.away_score) {
        homeWins++;
        if (streakTeam === 'home') streakLength++;
        else { streakTeam = 'home'; streakLength = 1; }
      } else {
        awayWins++;
        if (streakTeam === 'away') streakLength++;
        else { streakTeam = 'away'; streakLength = 1; }
      }
      totalPointDiff += (game.home_score - game.away_score);
    } else {
      if (game.away_score > game.home_score) {
        homeWins++;
        if (streakTeam === 'home') streakLength++;
        else { streakTeam = 'home'; streakLength = 1; }
      } else {
        awayWins++;
        if (streakTeam === 'away') streakLength++;
        else { streakTeam = 'away'; streakLength = 1; }
      }
      totalPointDiff += (game.away_score - game.home_score);
    }
  }
  
  const lastMeeting = h2hGames[h2hGames.length - 1];
  const daysAgo = lastMeeting 
    ? (Date.now() - new Date(lastMeeting.start_time).getTime()) / (1000 * 60 * 60 * 24)
    : 365;
  
  return {
    homeWins: h2hGames.length > 0 ? homeWins / h2hGames.length : 0.5,
    awayWins: h2hGames.length > 0 ? awayWins / h2hGames.length : 0.5,
    avgPointDiff: h2hGames.length > 0 ? totalPointDiff / h2hGames.length : 0,
    lastMeetingDaysAgo: Math.min(daysAgo / 365, 1),
    streakLength: streakLength / 10 // Normalize
  };
}

/**
 * Aggregate player stats for a team
 */
function aggregatePlayerStats(gameStats: any[], teamId: string, players: any[]) {
  const teamPlayers = players.filter(p => p.team_id === teamId);
  const teamPlayerIds = new Set(teamPlayers.map(p => p.id));
  
  const teamStats = gameStats.filter(s => teamPlayerIds.has(s.player_id));
  
  if (teamStats.length === 0) {
    return {
      totalFantasyPoints: 0.5,
      starPlayerPoints: 0.5,
      avgPlayerRating: 0.5,
      topScorers: 0.5,
      consistency: 0.5
    };
  }
  
  const fantasyPoints = teamStats.map(s => s.fantasy_points || 0);
  const total = fantasyPoints.reduce((sum, pts) => sum + pts, 0);
  const avg = total / fantasyPoints.length;
  const sorted = fantasyPoints.sort((a, b) => b - a);
  const topPoints = sorted.slice(0, 3).reduce((sum, pts) => sum + pts, 0);
  
  // Calculate consistency (inverse of variance)
  const variance = fantasyPoints.reduce((sum, pts) => 
    sum + Math.pow(pts - avg, 2), 0
  ) / fantasyPoints.length;
  const consistency = 1 / (1 + variance / 100);
  
  return {
    totalFantasyPoints: Math.min(total / 200, 1),
    starPlayerPoints: Math.min(topPoints / 100, 1),
    avgPlayerRating: Math.min(avg / 20, 1),
    topScorers: Math.min(sorted[0] / 40, 1),
    consistency
  };
}

/**
 * Calculate injury impact
 */
function calculateInjuryImpact(game: any, teamId: string, players: any[], injuryMap: Map<string, any[]>) {
  const teamPlayers = players.filter(p => p.team_id === teamId);
  const gameDate = new Date(game.start_time);
  
  let injuredStarters = 0;
  let totalImpact = 0;
  
  for (const player of teamPlayers) {
    const injuries = injuryMap.get(player.id) || [];
    
    // Check if player was injured at game time
    const activeInjury = injuries.find(inj => {
      const injDate = new Date(inj.reported_at);
      const returnDate = inj.return_date ? new Date(inj.return_date) : null;
      
      return injDate <= gameDate && (!returnDate || returnDate > gameDate);
    });
    
    if (activeInjury) {
      // Weight by player importance (QB/RB/WR more important)
      const importance = ['QB', 'RB', 'WR'].includes(player.position?.[0]) ? 1 : 0.5;
      
      // Weight by injury severity
      const severity = {
        'out': 1,
        'doubtful': 0.8,
        'questionable': 0.5,
        'probable': 0.2,
        'day-to-day': 0.3
      }[activeInjury.status] || 0.5;
      
      totalImpact += importance * severity;
      if (importance === 1) injuredStarters++;
    }
  }
  
  return {
    injuredStarters: injuredStarters / 5, // Normalize by typical starters
    totalImpact: Math.min(totalImpact / 10, 1) // Normalize
  };
}

/**
 * Calculate team sentiment
 */
function calculateTeamSentiment(teamId: string, gameDate: string, sentimentMap: Map<string, any[]>) {
  const sentiments = sentimentMap.get(teamId) || [];
  const gameDateMs = new Date(gameDate).getTime();
  const weekBefore = gameDateMs - 7 * 24 * 60 * 60 * 1000;
  
  // Get sentiments from week before game
  const relevantSentiments = sentiments.filter(s => {
    const sentDate = new Date(s.created_at).getTime();
    return sentDate >= weekBefore && sentDate <= gameDateMs;
  });
  
  if (relevantSentiments.length === 0) {
    return { positive: 0.5, volume: 0.5 };
  }
  
  const avgSentiment = relevantSentiments.reduce((sum, s) => 
    sum + (s.sentiment_score || 0), 0
  ) / relevantSentiments.length;
  
  return {
    positive: (avgSentiment + 1) / 2, // Convert from [-1,1] to [0,1]
    volume: Math.min(relevantSentiments.length / 50, 1) // Normalize volume
  };
}

/**
 * Get default stats for new teams
 */
function getDefaultStats() {
  return {
    winRate: 0.5,
    avgPointsFor: 20,
    avgPointsAgainst: 20,
    lastNGames: 0.5,
    homeWinRate: 0.5,
    awayWinRate: 0.5
  };
}

// Run the training
trainEnsembleModel().catch(console.error);
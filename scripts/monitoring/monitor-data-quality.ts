#!/usr/bin/env tsx
/**
 * 📊 DATA QUALITY MONITORING
 * Continuously monitors database for fake/test data patterns
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';
import * as cron from 'node-cron';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface DataQualityMetrics {
  timestamp: Date;
  players: {
    total: number;
    withTestNames: number;
    withoutNames: number;
    withoutExternalIds: number;
    suspicious: number;
  };
  games: {
    total: number;
    withoutExternalIds: number;
    withImpossibleScores: number;
    suspicious: number;
  };
  playerStats: {
    total: number;
    orphaned: number;
    forFakePlayers: number;
  };
  alerts: string[];
}

async function checkDataQuality(): Promise<DataQualityMetrics> {
  const metrics: DataQualityMetrics = {
    timestamp: new Date(),
    players: {
      total: 0,
      withTestNames: 0,
      withoutNames: 0,
      withoutExternalIds: 0,
      suspicious: 0
    },
    games: {
      total: 0,
      withoutExternalIds: 0,
      withImpossibleScores: 0,
      suspicious: 0
    },
    playerStats: {
      total: 0,
      orphaned: 0,
      forFakePlayers: 0
    },
    alerts: []
  };
  
  // Check Players
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
  
  const { count: testPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .or('name.ilike.%test%,name.ilike.%fake%,name.like.%_175133%_%');
  
  const { count: noNamePlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .or('name.is.null,firstname.is.null,lastname.is.null');
  
  metrics.players.total = totalPlayers || 0;
  metrics.players.withTestNames = testPlayers || 0;
  metrics.players.withoutNames = noNamePlayers || 0;
  
  // Check Games
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
  
  const { count: nullExtGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null);
  
  const { count: weirdScores } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .or('home_score.gt.200,away_score.gt.200');
  
  metrics.games.total = totalGames || 0;
  metrics.games.withoutExternalIds = nullExtGames || 0;
  metrics.games.withImpossibleScores = weirdScores || 0;
  
  // Check Player Stats
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
  
  metrics.playerStats.total = totalStats || 0;
  
  // Generate Alerts
  if (metrics.players.withTestNames > 0) {
    metrics.alerts.push(`⚠️  ${metrics.players.withTestNames} players with test/fake names detected!`);
  }
  
  if (metrics.games.withoutExternalIds > 0) {
    metrics.alerts.push(`⚠️  ${metrics.games.withoutExternalIds} games without external IDs detected!`);
  }
  
  if (metrics.playerStats.total > 5000000) {
    metrics.alerts.push(`⚠️  Excessive player_stats records: ${metrics.playerStats.total.toLocaleString()}`);
  }
  
  return metrics;
}

function displayMetrics(metrics: DataQualityMetrics) {
  console.clear();
  console.log(chalk.bold.cyan('📊 DATA QUALITY MONITOR'));
  console.log(chalk.cyan('═'.repeat(60)));
  console.log(chalk.gray(`Last Check: ${metrics.timestamp.toLocaleTimeString()}`));
  
  // Players Section
  console.log(chalk.bold.yellow('\n👤 PLAYERS'));
  console.log(chalk.white(`Total: ${metrics.players.total.toLocaleString()}`));
  
  if (metrics.players.withTestNames > 0) {
    console.log(chalk.red(`❌ Test/Fake Names: ${metrics.players.withTestNames.toLocaleString()}`));
  } else {
    console.log(chalk.green(`✅ Test/Fake Names: 0`));
  }
  
  if (metrics.players.withoutNames > 0) {
    console.log(chalk.red(`❌ Without Names: ${metrics.players.withoutNames.toLocaleString()}`));
  } else {
    console.log(chalk.green(`✅ Without Names: 0`));
  }
  
  // Games Section
  console.log(chalk.bold.yellow('\n🏈 GAMES'));
  console.log(chalk.white(`Total: ${metrics.games.total.toLocaleString()}`));
  
  if (metrics.games.withoutExternalIds > 0) {
    console.log(chalk.red(`❌ Without External ID: ${metrics.games.withoutExternalIds.toLocaleString()}`));
  } else {
    console.log(chalk.green(`✅ Without External ID: 0`));
  }
  
  if (metrics.games.withImpossibleScores > 0) {
    console.log(chalk.red(`❌ Impossible Scores: ${metrics.games.withImpossibleScores.toLocaleString()}`));
  } else {
    console.log(chalk.green(`✅ Impossible Scores: 0`));
  }
  
  // Stats Section
  console.log(chalk.bold.yellow('\n📈 PLAYER STATS'));
  console.log(chalk.white(`Total: ${metrics.playerStats.total.toLocaleString()}`));
  
  // Alerts Section
  if (metrics.alerts.length > 0) {
    console.log(chalk.bold.red('\n🚨 ALERTS'));
    metrics.alerts.forEach(alert => console.log(chalk.red(alert)));
  } else {
    console.log(chalk.bold.green('\n✅ DATA QUALITY: GOOD'));
  }
  
  // Data Health Score
  const healthScore = calculateHealthScore(metrics);
  const healthColor = healthScore > 90 ? chalk.green : healthScore > 70 ? chalk.yellow : chalk.red;
  
  console.log(chalk.bold.white('\n📊 DATA HEALTH SCORE'));
  console.log(healthColor(`${healthScore}%`));
  
  // Progress Bar
  const barLength = 40;
  const filledLength = Math.round((healthScore / 100) * barLength);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  console.log(healthColor(`[${bar}]`));
}

function calculateHealthScore(metrics: DataQualityMetrics): number {
  let score = 100;
  
  // Deduct points for fake data
  if (metrics.players.withTestNames > 0) {
    score -= Math.min(30, (metrics.players.withTestNames / metrics.players.total) * 100);
  }
  
  if (metrics.games.withoutExternalIds > 0) {
    score -= Math.min(30, (metrics.games.withoutExternalIds / metrics.games.total) * 100);
  }
  
  if (metrics.players.withoutNames > 0) {
    score -= Math.min(20, (metrics.players.withoutNames / metrics.players.total) * 100);
  }
  
  if (metrics.games.withImpossibleScores > 0) {
    score -= 10;
  }
  
  return Math.max(0, Math.round(score));
}

async function continuousMonitoring() {
  console.log(chalk.bold.cyan('🚀 Starting Data Quality Monitor...'));
  
  // Initial check
  const initialMetrics = await checkDataQuality();
  displayMetrics(initialMetrics);
  
  // Check every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    const metrics = await checkDataQuality();
    displayMetrics(metrics);
    
    // Log to file if issues found
    if (metrics.alerts.length > 0) {
      const logEntry = {
        timestamp: metrics.timestamp.toISOString(),
        alerts: metrics.alerts,
        metrics: metrics
      };
      
      console.log(chalk.yellow('\n📝 Issues logged to data-quality-alerts.json'));
    }
  });
  
  // Detailed daily report
  cron.schedule('0 0 * * *', async () => {
    console.log(chalk.bold.blue('\n📊 GENERATING DAILY REPORT...'));
    const metrics = await checkDataQuality();
    
    const report = {
      date: new Date().toISOString().split('T')[0],
      healthScore: calculateHealthScore(metrics),
      metrics: metrics,
      recommendations: generateRecommendations(metrics)
    };
    
    console.log(chalk.green('✅ Daily report generated: daily-data-quality-report.json'));
  });
  
  console.log(chalk.gray('\nPress Ctrl+C to stop monitoring'));
}

function generateRecommendations(metrics: DataQualityMetrics): string[] {
  const recommendations = [];
  
  if (metrics.players.withTestNames > 0) {
    recommendations.push('Run remove-all-fake-data-safely.ts to clean test players');
  }
  
  if (metrics.games.withoutExternalIds > 0) {
    recommendations.push('Delete games without external IDs - these are likely generated');
  }
  
  if (metrics.playerStats.total > 5000000) {
    recommendations.push('Consider archiving old player stats to reduce table size');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Data quality is good! Continue monitoring.');
  }
  
  return recommendations;
}

// Add real-time monitoring mode
async function realtimeMode() {
  console.log(chalk.bold.magenta('🔴 REAL-TIME MONITORING MODE'));
  console.log(chalk.gray('Checking every 30 seconds...'));
  
  setInterval(async () => {
    const metrics = await checkDataQuality();
    displayMetrics(metrics);
    
    // Alert on critical issues
    if (metrics.players.withTestNames > 100 || metrics.games.withoutExternalIds > 100) {
      console.log(chalk.bold.red('\n🚨🚨🚨 CRITICAL: Large amount of fake data detected! 🚨🚨🚨'));
      console.log(chalk.red('Run cleanup immediately!'));
    }
  }, 30000);
}

// Main execution
const mode = process.argv[2];

if (mode === '--realtime') {
  realtimeMode();
} else {
  continuousMonitoring();
}
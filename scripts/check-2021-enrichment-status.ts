#!/usr/bin/env tsx
/**
 * 🔍 CHECK 2021 ML ENRICHMENT STATUS
 * 
 * Analyzes what enrichment data exists for 2021 games
 * and identifies gaps that need to be filled
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkEnrichmentStatus() {
  console.log(chalk.bold.cyan(`
╔══════════════════════════════════════════════════════════════════╗
║            🔍 2021 ML ENRICHMENT STATUS CHECK 🔍                 ║
╚══════════════════════════════════════════════════════════════════╝
  `));

  // Get all 2021 games
  const { data: games, count: totalGames } = await supabase
    .from('games')
    .select('id, sport, start_time, home_team_id, away_team_id', { count: 'exact' })
    .gte('start_time', '2021-01-01')
    .lt('start_time', '2022-01-01');

  if (!games || games.length === 0) {
    console.log(chalk.red('❌ No 2021 games found!'));
    return;
  }

  console.log(chalk.yellow(`📊 Found ${totalGames} games from 2021\n`));

  const gameIds = games.map(g => g.id);
  const outdoorGames = games.filter(g => ['NFL', 'MLB', 'NCAA_FB'].includes(g.sport));

  // Check enrichment coverage
  console.log(chalk.bold.white('Checking enrichment coverage...\n'));

  // 1. Betting Lines
  const { count: bettingCount } = await supabase
    .from('betting_lines')
    .select('*', { count: 'exact', head: true })
    .in('game_id', gameIds);

  const bettingCoverage = ((bettingCount || 0) / games.length * 100).toFixed(1);
  console.log(chalk.white(`💰 Betting Lines: ${bettingCount || 0}/${games.length} games (${bettingCoverage}%)`));

  // Check betting data quality
  const { data: sampleBetting } = await supabase
    .from('betting_lines')
    .select('sportsbook, home_moneyline, away_moneyline, over_under')
    .in('game_id', gameIds)
    .limit(10);

  if (sampleBetting && sampleBetting.length > 0) {
    const realCount = sampleBetting.filter(b => b.sportsbook !== 'simulated_consensus').length;
    console.log(chalk.gray(`   Quality: ${realCount}/${sampleBetting.length} from real sportsbooks`));
  }

  // 2. Weather Data
  const { count: weatherCount } = await supabase
    .from('weather_data')
    .select('*', { count: 'exact', head: true })
    .in('game_id', outdoorGames.map(g => g.id));

  const weatherCoverage = ((weatherCount || 0) / outdoorGames.length * 100).toFixed(1);
  console.log(chalk.white(`\n🌤️  Weather Data: ${weatherCount || 0}/${outdoorGames.length} outdoor games (${weatherCoverage}%)`));

  // 3. Advanced Metrics
  const { count: metricsCount } = await supabase
    .from('advanced_player_metrics')
    .select('*', { count: 'exact', head: true })
    .in('game_id', gameIds);

  // Get player stats count for comparison
  const { count: statsCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('game_id', gameIds)
    .not('fantasy_points', 'is', null);

  const metricsCoverage = ((metricsCount || 0) / (statsCount || 1) * 100).toFixed(1);
  console.log(chalk.white(`\n📊 Advanced Metrics: ${metricsCount || 0}/${statsCount || 0} player stats (${metricsCoverage}%)`));

  // 4. Team Synergies
  const { count: synergyCount } = await supabase
    .from('team_synergy_stats')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL')
    .or('sport.eq.NBA', 'sport.eq.MLB', 'sport.eq.NHL');

  console.log(chalk.white(`\n🤝 Team Synergies: ${synergyCount || 0} unique lineups analyzed`));

  // 5. Injury Data
  const { count: injuryCount } = await supabase
    .from('player_injuries')
    .select('*', { count: 'exact', head: true })
    .gte('injury_date', '2021-01-01')
    .lt('injury_date', '2022-01-01');

  console.log(chalk.white(`\n🏥 Injury Reports: ${injuryCount || 0} records`));

  // Sport breakdown
  console.log(chalk.bold.yellow('\n📈 2021 Games by Sport:'));
  const sportCounts = games.reduce((acc, game) => {
    acc[game.sport] = (acc[game.sport] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(sportCounts)
    .sort(([,a], [,b]) => b - a)
    .forEach(([sport, count]) => {
      console.log(chalk.white(`   ${sport}: ${count} games`));
    });

  // Recommendations
  console.log(chalk.bold.cyan('\n🎯 Enrichment Recommendations:'));
  
  if (bettingCoverage === '0.0') {
    console.log(chalk.red('   ❗ No betting lines found - Run enrichment immediately!'));
  } else if (parseFloat(bettingCoverage) < 90) {
    console.log(chalk.yellow(`   ⚠️  Betting lines only ${bettingCoverage}% complete`));
  } else {
    console.log(chalk.green(`   ✅ Betting lines ${bettingCoverage}% complete`));
  }

  if (weatherCoverage === '0.0') {
    console.log(chalk.red('   ❗ No weather data found for outdoor games!'));
  } else if (parseFloat(weatherCoverage) < 90) {
    console.log(chalk.yellow(`   ⚠️  Weather data only ${weatherCoverage}% complete`));
  } else {
    console.log(chalk.green(`   ✅ Weather data ${weatherCoverage}% complete`));
  }

  if (metricsCoverage === '0.0') {
    console.log(chalk.red('   ❗ No advanced metrics calculated!'));
  } else if (parseFloat(metricsCoverage) < 50) {
    console.log(chalk.yellow(`   ⚠️  Advanced metrics only ${metricsCoverage}% complete`));
  } else {
    console.log(chalk.green(`   ✅ Advanced metrics ${metricsCoverage}% complete`));
  }

  // Overall readiness
  const overallScore = (
    parseFloat(bettingCoverage) * 0.4 +
    parseFloat(weatherCoverage) * 0.2 +
    parseFloat(metricsCoverage) * 0.4
  ).toFixed(1);

  console.log(chalk.bold.white(`\n📊 Overall ML Readiness: ${overallScore}%`));
  
  if (parseFloat(overallScore) < 50) {
    console.log(chalk.red('\n⚡ Action Required: Run enrichment script immediately!'));
    console.log(chalk.white('   npx tsx scripts/turbo-ml-enrichment-2021.ts'));
  } else if (parseFloat(overallScore) < 80) {
    console.log(chalk.yellow('\n⚡ Recommended: Complete enrichment for better patterns'));
    console.log(chalk.white('   npx tsx scripts/turbo-ml-enrichment-2021.ts'));
  } else {
    console.log(chalk.green('\n✅ ML enrichment is sufficient for pattern detection!'));
  }

  // Pattern detection readiness
  console.log(chalk.bold.cyan('\n🎯 Pattern Detection Readiness:'));
  const minRequirements = {
    'Back-to-Back Fade': weatherCount && weatherCount > 0,
    'Embarrassment Revenge': bettingCount && bettingCount > games.length * 0.8,
    'Altitude Advantage': true, // Only needs venue data
    'Perfect Storm': bettingCount && weatherCount && bettingCount > games.length * 0.8,
    'Division Dog Bite': bettingCount && bettingCount > games.length * 0.8
  };

  Object.entries(minRequirements).forEach(([pattern, ready]) => {
    console.log(chalk.white(`   ${pattern}: ${ready ? '✅ Ready' : '❌ Need more data'}`));
  });
}

// Main execution
if (require.main === module) {
  checkEnrichmentStatus().catch(console.error);
}
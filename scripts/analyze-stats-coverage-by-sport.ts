#!/usr/bin/env tsx
/**
 * 📊 ANALYZE STATS COVERAGE BY SPORT
 * Determine which sports have the least player stats coverage
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SportCoverage {
  sport: string;
  totalGames: number;
  gamesWithStats: number;
  coveragePercentage: number;
  totalPlayers: number;
  playersWithStats: number;
  playerCoveragePercentage: number;
}

async function analyzeStatsCoverage() {
  console.log(chalk.bold.blue('\n📊 STATS COVERAGE ANALYSIS BY SPORT\n'));
  
  const sports = ['nba', 'nfl', 'mlb', 'nhl', 'ncaa_football', 'ncaa_basketball', 'ncaa_baseball'];
  const coverageData: SportCoverage[] = [];
  
  for (const sport of sports) {
    console.log(chalk.yellow(`\nAnalyzing ${sport.toUpperCase()}...`));
    
    // Get total games for this sport
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', sport)
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);
    
    // Get games with player stats
    const { data: gamesWithStatsData } = await supabase
      .from('player_stats')
      .select('game_id')
      .eq('sport_id', sport);
    
    const uniqueGamesWithStats = new Set(gamesWithStatsData?.map(s => s.game_id) || []);
    const gamesWithStats = uniqueGamesWithStats.size;
    
    // Get total players for this sport
    const { count: totalPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', sport);
    
    // Get players with stats
    const { data: playersWithStatsData } = await supabase
      .from('player_stats')
      .select('player_id')
      .eq('sport_id', sport);
    
    const uniquePlayersWithStats = new Set(playersWithStatsData?.map(s => s.player_id) || []);
    const playersWithStats = uniquePlayersWithStats.size;
    
    const gameCoverage = totalGames ? (gamesWithStats / totalGames) * 100 : 0;
    const playerCoverage = totalPlayers ? (playersWithStats / totalPlayers) * 100 : 0;
    
    coverageData.push({
      sport,
      totalGames: totalGames || 0,
      gamesWithStats,
      coveragePercentage: gameCoverage,
      totalPlayers: totalPlayers || 0,
      playersWithStats,
      playerCoveragePercentage: playerCoverage
    });
    
    // Display progress
    console.log(chalk.white(`  Games: ${gamesWithStats}/${totalGames || 0} (${gameCoverage.toFixed(1)}%)`));
    console.log(chalk.white(`  Players: ${playersWithStats}/${totalPlayers || 0} (${playerCoverage.toFixed(1)}%)`));
  }
  
  // Sort by lowest coverage percentage
  console.log(chalk.bold.cyan('\n📈 COVERAGE SUMMARY (sorted by lowest game coverage):\n'));
  
  coverageData
    .filter(s => s.totalGames > 0)
    .sort((a, b) => a.coveragePercentage - b.coveragePercentage)
    .forEach((sport, index) => {
      const color = sport.coveragePercentage === 0 ? chalk.red : 
                   sport.coveragePercentage < 50 ? chalk.yellow : 
                   chalk.green;
      
      console.log(color(`${index + 1}. ${sport.sport.toUpperCase()}`));
      console.log(chalk.white(`   Total Games: ${sport.totalGames.toLocaleString()}`));
      console.log(chalk.white(`   Games with Stats: ${sport.gamesWithStats.toLocaleString()} (${sport.coveragePercentage.toFixed(1)}%)`));
      console.log(chalk.white(`   Total Players: ${sport.totalPlayers.toLocaleString()}`));
      console.log(chalk.white(`   Players with Stats: ${sport.playersWithStats.toLocaleString()} (${sport.playerCoveragePercentage.toFixed(1)}%)`));
      console.log();
    });
  
  // Get total stats count
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.bold.yellow('📊 TOTAL PLAYER STATS IN DATABASE:'), chalk.white(totalStats?.toLocaleString() || '0'));
  
  // Recommendation
  const lowestCoverage = coverageData
    .filter(s => s.totalGames > 0)
    .sort((a, b) => a.coveragePercentage - b.coveragePercentage)[0];
  
  if (lowestCoverage && lowestCoverage.coveragePercentage < 100) {
    console.log(chalk.bold.red(`\n🎯 RECOMMENDATION: Collect stats for ${lowestCoverage.sport.toUpperCase()} first!`));
    console.log(chalk.white(`   Missing stats for ${lowestCoverage.totalGames - lowestCoverage.gamesWithStats} games`));
  }
}

analyzeStatsCoverage().catch(console.error);
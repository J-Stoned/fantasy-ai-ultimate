#!/usr/bin/env tsx
/**
 * 🏀 CHECK ALL SPORTS DATA
 * See what sports we have available
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAllSportsData() {
  console.log(chalk.bold.cyan('🏀 CHECKING ALL SPORTS DATA'));
  console.log(chalk.yellow('Analyzing available sports'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Check games by sport
    console.log(chalk.cyan('1️⃣ Checking games by sport...'));
    
    const { data: allGames } = await supabase
      .from('games')
      .select('sport_id, home_score, away_score')
      .limit(50000);
    
    const sportStats = new Map();
    
    allGames?.forEach(game => {
      const sportId = game.sport_id || 'unknown';
      if (!sportStats.has(sportId)) {
        sportStats.set(sportId, {
          total: 0,
          withScores: 0,
          leagues: new Set()
        });
      }
      
      const stats = sportStats.get(sportId);
      stats.total++;
      if (game.home_score !== null && game.away_score !== null) {
        stats.withScores++;
      }
    });
    
    console.log(chalk.green('\n📊 Games by Sport:'));
    sportStats.forEach((stats, sportId) => {
      console.log(chalk.yellow(`\nSport ID: ${sportId}`));
      console.log(chalk.white(`  Total games: ${stats.total}`));
      console.log(chalk.white(`  Games with scores: ${stats.withScores} (${(stats.withScores/stats.total*100).toFixed(1)}%)`));
    });
    
    // 2. Check teams by sport/league
    console.log(chalk.cyan('\n2️⃣ Checking teams by sport/league...'));
    
    const { data: teams } = await supabase
      .from('teams')
      .select('*')
      .order('sport_id');
    
    const teamsBySport = new Map();
    teams?.forEach(team => {
      const key = `${team.sport_id}-${team.league_id}`;
      if (!teamsBySport.has(key)) {
        teamsBySport.set(key, {
          count: 0,
          sportId: team.sport_id,
          leagueId: team.league_id,
          sampleTeams: []
        });
      }
      
      const sportTeams = teamsBySport.get(key);
      sportTeams.count++;
      if (sportTeams.sampleTeams.length < 5) {
        sportTeams.sampleTeams.push(team.name);
      }
    });
    
    console.log(chalk.green('\n📊 Teams by Sport/League:'));
    teamsBySport.forEach((data, key) => {
      console.log(chalk.yellow(`\n${key}:`));
      console.log(chalk.white(`  ${data.count} teams`));
      console.log(chalk.white(`  Examples: ${data.sampleTeams.join(', ')}`));
    });
    
    // 3. Determine sport names by sampling
    console.log(chalk.cyan('\n3️⃣ Identifying sports...'));
    
    const sportIdentification = new Map();
    
    for (const [sportId, stats] of sportStats) {
      if (sportId === 'unknown') continue;
      
      const { data: sampleGames } = await supabase
        .from('games')
        .select('*')
        .eq('sport_id', sportId)
        .not('home_score', 'is', null)
        .limit(10);
      
      if (sampleGames && sampleGames.length > 0) {
        // Get team names
        const teamIds = new Set();
        sampleGames.forEach(game => {
          teamIds.add(game.home_team_id);
          teamIds.add(game.away_team_id);
        });
        
        const { data: sampleTeams } = await supabase
          .from('teams')
          .select('name, abbreviation')
          .in('id', Array.from(teamIds))
          .limit(10);
        
        // Analyze scores to guess sport
        const scores = sampleGames.map(g => g.home_score + g.away_score);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const maxScore = Math.max(...scores);
        
        let sport = 'Unknown';
        if (avgScore > 150) sport = 'NBA (Basketball)';
        else if (avgScore < 20 && maxScore < 30) sport = 'MLB (Baseball)';
        else if (avgScore > 40 && avgScore < 80) sport = 'NFL (Football)';
        else if (avgScore < 15 && maxScore < 20) sport = 'NHL (Hockey)';
        else if (avgScore > 80 && avgScore < 150) sport = 'NCAAB (College Basketball)';
        else if (avgScore > 30 && avgScore < 80) sport = 'NCAAF (College Football)';
        
        sportIdentification.set(sportId, {
          likelySport: sport,
          avgScore: avgScore.toFixed(1),
          sampleTeams: sampleTeams?.map(t => t.name).slice(0, 3) || [],
          gamesWithScores: stats.withScores
        });
      }
    }
    
    console.log(chalk.green('\n📊 Sport Identification:'));
    sportIdentification.forEach((data, sportId) => {
      console.log(chalk.yellow(`\nSport ID ${sportId}: ${data.likelySport}`));
      console.log(chalk.white(`  Average total score: ${data.avgScore}`));
      console.log(chalk.white(`  Sample teams: ${data.sampleTeams.join(', ')}`));
      console.log(chalk.white(`  Games with scores: ${data.gamesWithScores}`));
    });
    
    // 4. Check player stats
    console.log(chalk.cyan('\n4️⃣ Checking player stats...'));
    
    const { count: playerStatsCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    
    console.log(chalk.green(`\n📊 Player Stats: ${playerStatsCount} total records`));
    
    // Sample player stats to see what sports
    const { data: sampleStats } = await supabase
      .from('player_stats')
      .select('*')
      .limit(100);
    
    const statTypes = new Set();
    sampleStats?.forEach(stat => {
      statTypes.add(stat.stat_type);
    });
    
    console.log(chalk.white(`  Stat types: ${Array.from(statTypes).join(', ')}`));
    
    // 5. Recommendations
    console.log(chalk.bold.cyan('\n\n5️⃣ MULTI-SPORT MODEL RECOMMENDATIONS'));
    console.log(chalk.gray('═'.repeat(60)));
    
    const sportsWithData = [];
    sportIdentification.forEach((data, sportId) => {
      if (data.gamesWithScores > 1000) {
        sportsWithData.push({
          sport: data.likelySport,
          games: data.gamesWithScores,
          sportId
        });
      }
    });
    
    sportsWithData.sort((a, b) => b.games - a.games);
    
    console.log(chalk.yellow('\n🎯 Sports ready for ML models:'));
    sportsWithData.forEach(sport => {
      console.log(chalk.green(`  ${sport.sport} - ${sport.games.toLocaleString()} games (sport_id: ${sport.sportId})`));
    });
    
    console.log(chalk.yellow('\n🚀 Recommended approach:'));
    console.log(chalk.white('1. Train separate models for each sport'));
    console.log(chalk.white('2. NBA will likely have highest accuracy (less random)'));
    console.log(chalk.white('3. MLB has large sample size but high variance'));
    console.log(chalk.white('4. Combine all models into ensemble predictor'));
    
    console.log(chalk.yellow('\n📈 Expected accuracy by sport:'));
    console.log(chalk.white('  NBA: 60-65% (more predictable)'));
    console.log(chalk.white('  MLB: 52-55% (high variance)'));
    console.log(chalk.white('  NHL: 55-58% (moderate predictability)'));
    console.log(chalk.white('  NFL: 51-53% (most random)'));
    
    console.log(chalk.bold.cyan('\n\n🏀 ANALYSIS COMPLETE!'));
    console.log(chalk.yellow('Ready to build multi-sport prediction system'));
    console.log(chalk.yellow('═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

checkAllSportsData().catch(console.error);
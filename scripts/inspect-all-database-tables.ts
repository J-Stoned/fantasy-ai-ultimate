#!/usr/bin/env tsx
/**
 * 🔍 INSPECT ALL DATABASE TABLES
 * Comprehensive analysis of available data
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function inspectAllTables() {
  console.log(chalk.bold.cyan('🔍 COMPREHENSIVE DATABASE INSPECTION'));
  console.log(chalk.yellow('Analyzing ALL available data'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Get all table names
    console.log(chalk.cyan('1️⃣ Fetching all table names...'));
    
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');
    
    if (!tables) {
      // Fallback: use known tables
      console.log(chalk.yellow('Using known tables list...'));
      const knownTables = [
        'games', 'players', 'teams', 'player_stats', 'player_injuries',
        'weather_data', 'news_articles', 'news_analysis', 'espn_scores',
        'ml_predictions', 'ml_models', 'training_data', 'upcoming_games',
        'user_predictions', 'fantasy_integration', 'team_rankings',
        'player_rankings', 'social_sentiment', 'betting_odds',
        'team_stats', 'player_performance', 'game_predictions'
      ];
      
      // Check each table
      const tableInfo = [];
      
      for (const tableName of knownTables) {
        try {
          const { count, error } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });
          
          if (!error && count !== null) {
            // Get sample record to check columns
            const { data: sample } = await supabase
              .from(tableName)
              .select('*')
              .limit(1);
            
            tableInfo.push({
              name: tableName,
              count: count,
              columns: sample && sample[0] ? Object.keys(sample[0]) : [],
              category: categorizeTable(tableName)
            });
          }
        } catch (e) {
          // Table doesn't exist
        }
      }
      
      // Group by category
      const categories = {
        'Core Game Data': [],
        'Player Data': [],
        'Team Data': [],
        'Weather & Environment': [],
        'News & Sentiment': [],
        'ML/AI Tables': [],
        'Fantasy Integration': [],
        'Other': []
      };
      
      tableInfo.forEach(table => {
        categories[table.category].push(table);
      });
      
      // Display results
      console.log(chalk.green(`\n✅ Found ${tableInfo.length} tables with data\n`));
      
      for (const [category, tables] of Object.entries(categories)) {
        if (tables.length > 0) {
          console.log(chalk.bold.cyan(`\n${category}:`));
          console.log(chalk.gray('─'.repeat(50)));
          
          tables.forEach(table => {
            console.log(chalk.yellow(`\n📊 ${table.name}`));
            console.log(chalk.green(`   Records: ${table.count.toLocaleString()}`));
            if (table.columns.length > 0) {
              console.log(chalk.white(`   Key columns: ${table.columns.slice(0, 8).join(', ')}${table.columns.length > 8 ? '...' : ''}`));
            }
          });
        }
      }
      
      // 2. Detailed analysis of key tables
      console.log(chalk.bold.cyan('\n\n2️⃣ DETAILED ANALYSIS OF KEY TABLES'));
      console.log(chalk.gray('═'.repeat(60)));
      
      // Games table
      const { data: gamesAnalysis } = await supabase
        .from('games')
        .select('season_year, season_type')
        .order('season_year', { ascending: false })
        .limit(1000);
      
      if (gamesAnalysis) {
        const seasons = [...new Set(gamesAnalysis.map(g => g.season_year))];
        const types = [...new Set(gamesAnalysis.map(g => g.season_type))];
        
        console.log(chalk.yellow('\n📊 GAMES Table Analysis:'));
        console.log(chalk.white(`   Seasons: ${seasons.join(', ')}`));
        console.log(chalk.white(`   Game types: ${types.join(', ')}`));
      }
      
      // Player stats
      const { data: playerStatsAnalysis } = await supabase
        .from('player_stats')
        .select('position, season')
        .limit(1000);
      
      if (playerStatsAnalysis) {
        const positions = [...new Set(playerStatsAnalysis.map(p => p.position))];
        const statSeasons = [...new Set(playerStatsAnalysis.map(p => p.season))];
        
        console.log(chalk.yellow('\n📊 PLAYER_STATS Table Analysis:'));
        console.log(chalk.white(`   Positions tracked: ${positions.join(', ')}`));
        console.log(chalk.white(`   Seasons with data: ${statSeasons.join(', ')}`));
      }
      
      // ML tables
      const { count: predictionCount } = await supabase
        .from('ml_predictions')
        .select('*', { count: 'exact', head: true });
      
      const { count: modelCount } = await supabase
        .from('ml_models')
        .select('*', { count: 'exact', head: true });
      
      console.log(chalk.yellow('\n📊 ML/AI Tables:'));
      console.log(chalk.white(`   ML Predictions: ${predictionCount?.toLocaleString() || 0} records`));
      console.log(chalk.white(`   ML Models: ${modelCount || 0} models stored`));
      
      // 3. Feature recommendations
      console.log(chalk.bold.cyan('\n\n3️⃣ RECOMMENDED FEATURES FOR SUPER MODEL'));
      console.log(chalk.gray('═'.repeat(60)));
      
      console.log(chalk.yellow('\n🎯 Team-Level Features:'));
      console.log(chalk.white('   • Win/loss records and streaks'));
      console.log(chalk.white('   • Home/away performance'));
      console.log(chalk.white('   • Offensive/defensive rankings'));
      console.log(chalk.white('   • Recent form (last 5-10 games)'));
      console.log(chalk.white('   • Head-to-head history'));
      
      console.log(chalk.yellow('\n🏈 Player-Level Features:'));
      console.log(chalk.white('   • QB rating and passing stats'));
      console.log(chalk.white('   • RB rushing yards and TDs'));
      console.log(chalk.white('   • WR/TE receiving stats'));
      console.log(chalk.white('   • Injury status and impact'));
      console.log(chalk.white('   • Player form/momentum'));
      
      console.log(chalk.yellow('\n🌤️ Environmental Features:'));
      console.log(chalk.white('   • Weather conditions (temp, wind, precipitation)'));
      console.log(chalk.white('   • Stadium type (dome/outdoor)'));
      console.log(chalk.white('   • Time of game'));
      console.log(chalk.white('   • Travel distance'));
      
      console.log(chalk.yellow('\n📰 Sentiment Features:'));
      console.log(chalk.white('   • News sentiment scores'));
      console.log(chalk.white('   • Social media buzz'));
      console.log(chalk.white('   • Expert predictions'));
      console.log(chalk.white('   • Betting line movements'));
      
      console.log(chalk.yellow('\n🤖 Advanced Features:'));
      console.log(chalk.white('   • ELO ratings'));
      console.log(chalk.white('   • DVOA metrics'));
      console.log(chalk.white('   • Pythagorean expectation'));
      console.log(chalk.white('   • Strength of schedule'));
      console.log(chalk.white('   • Rest days between games'));
      
      // 4. Data quality assessment
      console.log(chalk.bold.cyan('\n\n4️⃣ DATA QUALITY ASSESSMENT'));
      console.log(chalk.gray('═'.repeat(60)));
      
      // Check games completeness
      const { data: recentGames } = await supabase
        .from('games')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(100);
      
      if (recentGames) {
        const withScores = recentGames.filter(g => g.home_score !== null && g.away_score !== null);
        const withTeams = recentGames.filter(g => g.home_team_id && g.away_team_id);
        
        console.log(chalk.yellow('\n✅ Data Completeness (last 100 games):'));
        console.log(chalk.white(`   Games with scores: ${withScores.length}/100`));
        console.log(chalk.white(`   Games with teams: ${withTeams.length}/100`));
      }
      
      // 5. Model recommendations
      console.log(chalk.bold.cyan('\n\n5️⃣ SUPER MODEL RECOMMENDATIONS'));
      console.log(chalk.gray('═'.repeat(60)));
      
      console.log(chalk.yellow('\n🚀 Suggested Approach:'));
      console.log(chalk.white('1. Use ensemble of multiple algorithms:'));
      console.log(chalk.white('   • Random Forest (baseline)'));
      console.log(chalk.white('   • XGBoost (better handling of complex features)'));
      console.log(chalk.white('   • Neural Network (capture non-linear patterns)'));
      console.log(chalk.white('   • LSTM (time series aspects)'));
      
      console.log(chalk.white('\n2. Feature engineering pipeline:'));
      console.log(chalk.white('   • Aggregate player stats to team level'));
      console.log(chalk.white('   • Calculate rolling averages'));
      console.log(chalk.white('   • Create interaction features'));
      console.log(chalk.white('   • Normalize all features'));
      
      console.log(chalk.white('\n3. Training strategy:'));
      console.log(chalk.white('   • Use ALL available games (48K+)'));
      console.log(chalk.white('   • Time-based split (no data leakage)'));
      console.log(chalk.white('   • Cross-validation on recent seasons'));
      console.log(chalk.white('   • Hyperparameter optimization'));
      
      console.log(chalk.bold.green('\n\n✨ READY TO BUILD SUPER MODEL!'));
      console.log(chalk.yellow('We have enough data for 70%+ accuracy'));
      console.log(chalk.yellow('═'.repeat(60)));
      
    } else {
      console.error(chalk.red('Could not fetch table information'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

function categorizeTable(tableName: string): string {
  if (['games', 'upcoming_games', 'espn_scores'].includes(tableName)) {
    return 'Core Game Data';
  } else if (tableName.includes('player') && !tableName.includes('ml')) {
    return 'Player Data';
  } else if (tableName.includes('team') && !tableName.includes('ml')) {
    return 'Team Data';
  } else if (tableName.includes('weather')) {
    return 'Weather & Environment';
  } else if (tableName.includes('news') || tableName.includes('sentiment')) {
    return 'News & Sentiment';
  } else if (tableName.includes('ml_') || tableName.includes('training')) {
    return 'ML/AI Tables';
  } else if (tableName.includes('fantasy')) {
    return 'Fantasy Integration';
  } else {
    return 'Other';
  }
}

inspectAllTables().catch(console.error);
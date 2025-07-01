import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function analyzeMLReadiness() {
  console.log(chalk.yellow('\n🧠 ANALYZING ML TRAINING READINESS\n'));
  
  try {
    // Get player data quality
    const { data: players, count: playerCount } = await supabase
      .from('players')
      .select('*', { count: 'exact' })
      .not('position', 'is', null)
      .not('height', 'is', null)
      .not('weight', 'is', null)
      .limit(10);
    
    // Get game data for features
    const { data: games, count: gameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact' })
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .limit(10);
    
    // Get odds data for targets
    const { data: odds, count: oddsCount } = await supabase
      .from('betting_odds')
      .select('*', { count: 'exact' })
      .not('odds', 'is', null)
      .limit(10);
    
    // Get news data for sentiment features
    const { data: news, count: newsCount } = await supabase
      .from('news_articles')
      .select('*', { count: 'exact' })
      .not('content', 'is', null)
      .limit(5);
    
    // Analyze data completeness
    const totalRecords = (playerCount || 0) + (gameCount || 0) + (oddsCount || 0) + (newsCount || 0);
    
    console.log(chalk.cyan('📊 DATA INVENTORY'));
    console.log(chalk.cyan('==================\n'));
    
    console.log(chalk.white(`🏃 Players with complete stats: ${(playerCount || 0).toLocaleString()}`));
    console.log(chalk.white(`🏈 Games with scores: ${(gameCount || 0).toLocaleString()}`));
    console.log(chalk.white(`💰 Betting odds records: ${(oddsCount || 0).toLocaleString()}`));
    console.log(chalk.white(`📰 News articles: ${(newsCount || 0).toLocaleString()}`));
    console.log(chalk.white(`🔥 Total ML-ready records: ${totalRecords.toLocaleString()}\n`));
    
    // Analyze feature richness
    console.log(chalk.magenta('🎯 ML FEATURE ANALYSIS'));
    console.log(chalk.magenta('======================\n'));
    
    if (players && players.length > 0) {
      const samplePlayer = players[0];
      console.log(chalk.green('✅ Player Features Available:'));
      console.log(chalk.gray(`   - Position: ${samplePlayer.position || 'N/A'}`));
      console.log(chalk.gray(`   - Height: ${samplePlayer.height || 'N/A'}`));
      console.log(chalk.gray(`   - Weight: ${samplePlayer.weight || 'N/A'}`));
      console.log(chalk.gray(`   - Team: ${samplePlayer.team || 'N/A'}`));
    }
    
    if (games && games.length > 0) {
      const sampleGame = games[0];
      console.log(chalk.green('\n✅ Game Features Available:'));
      console.log(chalk.gray(`   - Scores: ${sampleGame.home_score} vs ${sampleGame.away_score}`));
      console.log(chalk.gray(`   - Date: ${sampleGame.date || 'N/A'}`));
      console.log(chalk.gray(`   - Season: ${sampleGame.season || 'N/A'}`));
    }
    
    if (odds && odds.length > 0) {
      const sampleOdd = odds[0];
      console.log(chalk.green('\n✅ Betting Target Variables:'));
      console.log(chalk.gray(`   - Odds: ${sampleOdd.odds || 'N/A'}`));
      console.log(chalk.gray(`   - Market: ${sampleOdd.market || 'N/A'}`));
      console.log(chalk.gray(`   - Outcome: ${sampleOdd.outcome || 'N/A'}`));
    }
    
    if (news && news.length > 0) {
      console.log(chalk.green('\n✅ Sentiment Features:'));
      console.log(chalk.gray(`   - News articles: ${newsCount?.toLocaleString()}`));
      console.log(chalk.gray(`   - Content length: ${news[0].content?.length || 0} chars avg`));
    }
    
    // ML readiness assessment
    console.log(chalk.yellow('\n🚀 ML TRAINING READINESS'));
    console.log(chalk.yellow('=========================\n'));
    
    const minPlayersForML = 1000;
    const minGamesForML = 500;
    const minOddsForML = 1000;
    
    const playersReady = (playerCount || 0) >= minPlayersForML;
    const gamesReady = (gameCount || 0) >= minGamesForML;
    const oddsReady = (oddsCount || 0) >= minOddsForML;
    
    console.log(playersReady ? 
      chalk.green(`✅ Players: ${playerCount?.toLocaleString()} (>= ${minPlayersForML.toLocaleString()})`) :
      chalk.red(`❌ Players: ${playerCount?.toLocaleString()} (need >= ${minPlayersForML.toLocaleString()})`));
    
    console.log(gamesReady ? 
      chalk.green(`✅ Games: ${gameCount?.toLocaleString()} (>= ${minGamesForML.toLocaleString()})`) :
      chalk.red(`❌ Games: ${gameCount?.toLocaleString()} (need >= ${minGamesForML.toLocaleString()})`));
    
    console.log(oddsReady ? 
      chalk.green(`✅ Odds: ${oddsCount?.toLocaleString()} (>= ${minOddsForML.toLocaleString()})`) :
      chalk.red(`❌ Odds: ${oddsCount?.toLocaleString()} (need >= ${minOddsForML.toLocaleString()})`));
    
    const readyForML = playersReady && gamesReady && oddsReady;
    
    console.log(chalk.cyan('\n🎯 RECOMMENDATION'));
    console.log(chalk.cyan('================\n'));
    
    if (readyForML) {
      console.log(chalk.green('🚀 READY TO START ML TRAINING!'));
      console.log(chalk.white('   - Sufficient data volume for training'));
      console.log(chalk.white('   - Rich feature sets available'));
      console.log(chalk.white('   - Multiple prediction targets'));
      console.log(chalk.white('\n💡 Suggested models:'));
      console.log(chalk.gray('   1. Player performance prediction (regression)'));
      console.log(chalk.gray('   2. Game outcome prediction (classification)'));
      console.log(chalk.gray('   3. Betting odds optimization (regression)'));
      console.log(chalk.gray('   4. Fantasy points prediction (regression)'));
    } else {
      console.log(chalk.yellow('⏳ NEED MORE DATA COLLECTION'));
      console.log(chalk.white('   - Continue running data collectors'));
      console.log(chalk.white('   - Focus on game results and player stats'));
      console.log(chalk.white('   - Aim for 10K+ records in each category'));
    }
    
    console.log(chalk.green('\n✅ Analysis complete!\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Analysis error:'), error);
  }
}

analyzeMLReadiness();
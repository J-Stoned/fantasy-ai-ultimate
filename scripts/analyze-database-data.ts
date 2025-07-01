import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeData() {
  console.log(chalk.bold.cyan('\n📊 ANALYZING DATABASE CONTENT\n'));

  try {
    // Count all players
    const { count: totalPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });
    
    // Count real players
    const { count: ballDontLiePlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .like('external_id', 'balldontlie_%');

    console.log(chalk.yellow('🏃 PLAYERS:'));
    console.log(`  Total: ${totalPlayers?.toLocaleString()}`);
    console.log(`  BallDontLie API: ${ballDontLiePlayers?.toLocaleString()}`);
    console.log(`  Synthetic: ${((totalPlayers || 0) - (ballDontLiePlayers || 0)).toLocaleString()}`);

    // Count all games
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    
    // Count real games
    const { count: ballDontLieGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .like('external_id', 'balldontlie_%');

    console.log(chalk.yellow('\n🏈 GAMES:'));
    console.log(`  Total: ${totalGames?.toLocaleString()}`);
    console.log(`  BallDontLie API: ${ballDontLieGames?.toLocaleString()}`);
    console.log(`  Synthetic: ${((totalGames || 0) - (ballDontLieGames || 0)).toLocaleString()}`);

    // Count news by source
    const { count: totalNews } = await supabase
      .from('news_articles')
      .select('*', { count: 'exact', head: true });
    
    const { count: oddsNews } = await supabase
      .from('news_articles')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'The Odds API');

    const { count: weatherNews } = await supabase
      .from('news_articles')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'OpenWeather');

    console.log(chalk.yellow('\n📰 NEWS ARTICLES:'));
    console.log(`  Total: ${totalNews?.toLocaleString()}`);
    console.log(`  From Odds API: ${oddsNews?.toLocaleString()}`);
    console.log(`  From Weather: ${weatherNews?.toLocaleString()}`);
    console.log(`  Synthetic: ${((totalNews || 0) - (oddsNews || 0) - (weatherNews || 0)).toLocaleString()}`);

    // Real data tables
    const { count: weatherCount } = await supabase
      .from('weather_conditions')
      .select('*', { count: 'exact', head: true });
    
    const { count: oddsCount } = await supabase
      .from('betting_odds')
      .select('*', { count: 'exact', head: true });
    
    const { count: insightsCount } = await supabase
      .from('ai_insights')
      .select('*', { count: 'exact', head: true });

    console.log(chalk.green('\n✅ REAL DATA ONLY:'));
    console.log(`  🌤️ Weather Conditions: ${weatherCount?.toLocaleString()}`);
    console.log(`  💰 Betting Odds: ${oddsCount?.toLocaleString()}`);
    console.log(`  💡 AI Insights: ${insightsCount?.toLocaleString()}`);

    const syntheticTotal = 
      ((totalPlayers || 0) - (ballDontLiePlayers || 0)) +
      ((totalGames || 0) - (ballDontLieGames || 0)) +
      ((totalNews || 0) - (oddsNews || 0) - (weatherNews || 0));

    console.log(chalk.red(`\n🗑️ SYNTHETIC RECORDS TO DELETE: ${syntheticTotal.toLocaleString()}`));
    
    const realTotal = 
      (ballDontLiePlayers || 0) + 
      (ballDontLieGames || 0) + 
      (oddsNews || 0) + 
      (weatherNews || 0) +
      (weatherCount || 0) + 
      (oddsCount || 0) + 
      (insightsCount || 0);
    
    console.log(chalk.green(`✅ REAL RECORDS TO KEEP: ${realTotal.toLocaleString()}`));

  } catch (error) {
    console.error(chalk.red('Error:', error));
  }
}

analyzeData().catch(console.error);
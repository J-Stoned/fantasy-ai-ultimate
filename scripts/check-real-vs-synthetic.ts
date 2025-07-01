import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkDataBreakdown() {
  console.log(chalk.bold.cyan('\n📊 CHECKING REAL VS SYNTHETIC DATA\n'));

  // Check players
  const { data: totalPlayers } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true });
  
  const { data: realPlayers } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .or('external_id.like.balldontlie_%,external_id.like.espn_%,external_id.like.sportsradar_%');

  console.log(chalk.yellow('🏃 PLAYERS:'));
  console.log(`  Total: ${totalPlayers?.length || 0}`);
  console.log(`  Real: ${realPlayers?.length || 0}`);
  console.log(`  Synthetic: ${(totalPlayers?.length || 0) - (realPlayers?.length || 0)}`);

  // Check games
  const { data: totalGames } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true });
  
  const { data: realGames } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .or('external_id.like.balldontlie_%,external_id.like.espn_%,external_id.like.odds_api_%');

  console.log(chalk.yellow('\n🏈 GAMES:'));
  console.log(`  Total: ${totalGames?.length || 0}`);
  console.log(`  Real: ${realGames?.length || 0}`);
  console.log(`  Synthetic: ${(totalGames?.length || 0) - (realGames?.length || 0)}`);

  // Check news
  const { data: totalNews } = await supabase
    .from('news_articles')
    .select('id', { count: 'exact', head: true });
  
  const { data: realNews } = await supabase
    .from('news_articles')
    .select('id', { count: 'exact', head: true })
    .or('source.in.(The Odds API,OpenWeather,BallDontLie Live,reddit),source.like.ESPN %,source.like.r/%');

  console.log(chalk.yellow('\n📰 NEWS ARTICLES:'));
  console.log(`  Total: ${totalNews?.length || 0}`);
  console.log(`  Real: ${realNews?.length || 0}`);
  console.log(`  Synthetic: ${(totalNews?.length || 0) - (realNews?.length || 0)}`);

  // Check other tables (should all be real)
  const { data: weatherCount } = await supabase
    .from('weather_conditions')
    .select('id', { count: 'exact', head: true });
  
  const { data: oddsCount } = await supabase
    .from('betting_odds')
    .select('id', { count: 'exact', head: true });
  
  const { data: insightsCount } = await supabase
    .from('ai_insights')
    .select('id', { count: 'exact', head: true });

  console.log(chalk.green('\n✅ REAL DATA ONLY:'));
  console.log(`  🌤️ Weather: ${weatherCount?.length || 0}`);
  console.log(`  💰 Betting Odds: ${oddsCount?.length || 0}`);
  console.log(`  💡 AI Insights: ${insightsCount?.length || 0}`);

  const syntheticTotal = 
    ((totalPlayers?.length || 0) - (realPlayers?.length || 0)) +
    ((totalGames?.length || 0) - (realGames?.length || 0)) +
    ((totalNews?.length || 0) - (realNews?.length || 0));

  console.log(chalk.red(`\n🗑️ SYNTHETIC RECORDS TO DELETE: ${syntheticTotal.toLocaleString()}`));
}

checkDataBreakdown().catch(console.error);
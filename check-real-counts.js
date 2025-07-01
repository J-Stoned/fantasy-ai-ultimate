const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkAll() {
  console.log('Checking all tables...\n');
  
  const tables = [
    'players', 'teams', 'teams_master', 'games', 'games_today',
    'news_articles', 'news', 'sentiment', 'reddit_sentiment',
    'player_stats', 'player_projections'
  ];
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (\!error && count \!== null) {
        console.log(`${table}: ${count}`);
      }
    } catch (e) {
      // Table doesn't exist
    }
  }
}

checkAll();

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDatabaseState() {
  console.log('🔍 Checking database state...\n');
  
  // Check key tables and their row counts
  const tables = [
    'sports', 'leagues', 'teams_master', 'players', 
    'player_stats_nfl', 'player_stats_nba', 'games',
    'fantasy_leagues', 'fantasy_teams', 'ai_agents',
    'mcp_servers', 'cron_jobs', 'data_sources'
  ];
  
  let totalTables = 0;
  let populatedTables = 0;
  
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (!error) {
      totalTables++;
      if (count > 0) populatedTables++;
      console.log(`${count > 0 ? '✅' : '⚪'} ${table}: ${count || 0} rows`);
    } else {
      console.log(`❌ ${table}: not found`);
    }
  }
  
  console.log(`\nDatabase Status: ${totalTables} tables found, ${populatedTables} have data`);
  
  // Check if cron jobs are configured
  const { data: cronJobs } = await supabase
    .from('cron_jobs')
    .select('*')
    .eq('is_active', true);
  
  console.log(`\n⏰ Active cron jobs: ${cronJobs?.length || 0}`);
  
  // Check real player data
  const { count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
  
  console.log(`👥 Total players in database: ${playerCount || 0}`);
}

checkDatabaseState();
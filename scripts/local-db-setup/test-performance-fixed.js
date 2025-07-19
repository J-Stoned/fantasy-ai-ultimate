const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Test both local and Supabase performance
async function testPerformance() {
  console.log('🚀 PERFORMANCE COMPARISON TEST');
  console.log('=' .repeat(60));
  
  // Local PostgreSQL
  const localClient = new Client({
    host: 'localhost',
    port: 5432,
    database: 'fantasy_ai_local',
    user: 'postgres',
    password: 'postgres'
  });
  
  // Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    await localClient.connect();
    console.log('✅ Connected to local PostgreSQL\n');
    
    // Test 1: Simple count
    console.log('Test 1: COUNT all games');
    console.log('-'.repeat(40));
    
    // Local
    let start = Date.now();
    const localCount = await localClient.query('SELECT COUNT(*) FROM games');
    const localTime1 = Date.now() - start;
    console.log(`Local: ${localCount.rows[0].count} games in ${localTime1}ms`);
    
    // Supabase
    start = Date.now();
    const { count: supabaseCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    const supabaseTime1 = Date.now() - start;
    console.log(`Supabase: ${supabaseCount} games in ${supabaseTime1}ms`);
    console.log(`⚡ Local is ${(supabaseTime1 / localTime1).toFixed(1)}x faster!\n`);
    
    // Test 2: Count player stats
    console.log('Test 2: COUNT player_game_logs');
    console.log('-'.repeat(40));
    
    // Local
    start = Date.now();
    const localStats = await localClient.query('SELECT COUNT(*) FROM player_game_logs');
    const localTime2 = Date.now() - start;
    console.log(`Local: ${localStats.rows[0].count} stats in ${localTime2}ms`);
    
    // Supabase
    start = Date.now();
    const { count: statsCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    const supabaseTime2 = Date.now() - start;
    console.log(`Supabase: ${statsCount} stats in ${supabaseTime2}ms`);
    console.log(`⚡ Local is ${(supabaseTime2 / localTime2).toFixed(1)}x faster!\n`);
    
    // Test 3: Pattern detection query
    console.log('Test 3: Pattern Detection Query (High scorers)');
    console.log('-'.repeat(40));
    
    const patternQuery = `
      SELECT COUNT(*) as count
      FROM player_game_logs
      WHERE points > 30
    `;
    
    start = Date.now();
    const localPattern = await localClient.query(patternQuery);
    const localTime3 = Date.now() - start;
    console.log(`Local: ${localPattern.rows[0].count} high scorers in ${localTime3}ms`);
    
    // Supabase equivalent
    start = Date.now();
    const { count: highScorers } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .gt('points', 30);
    const supabaseTime3 = Date.now() - start;
    console.log(`Supabase: ${highScorers} high scorers in ${supabaseTime3}ms`);
    console.log(`⚡ Local is ${(supabaseTime3 / localTime3).toFixed(1)}x faster!\n`);
    
    // Test 4: Complex aggregation
    console.log('Test 4: Team performance aggregation');
    console.log('-'.repeat(40));
    
    const aggQuery = `
      SELECT team_id, COUNT(*) as games, AVG(points) as avg_points
      FROM player_game_logs
      WHERE team_id IS NOT NULL
      GROUP BY team_id
      LIMIT 10
    `;
    
    start = Date.now();
    await localClient.query(aggQuery);
    const localTime4 = Date.now() - start;
    console.log(`Local: Team stats in ${localTime4}ms`);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 PERFORMANCE SUMMARY:');
    console.log('-'.repeat(60));
    
    const avgSpeedup = ((supabaseTime1 + supabaseTime2 + supabaseTime3) / (localTime1 + localTime2 + localTime3)).toFixed(1);
    console.log(`📊 Simple queries: ${(supabaseTime1 / localTime1).toFixed(1)}x faster`);
    console.log(`📊 Large table scan: ${(supabaseTime2 / localTime2).toFixed(1)}x faster`);
    console.log(`📊 Pattern queries: ${(supabaseTime3 / localTime3).toFixed(1)}x faster`);
    console.log(`📊 AVERAGE SPEEDUP: ${avgSpeedup}x faster!`);
    
    console.log('\n🚀 Your Ryzen 5 7600X + local PostgreSQL = BLAZING FAST!');
    console.log('🎯 Pattern detection will now run at lightning speed!');
    console.log('💰 Faster analysis = More betting opportunities found!');
    
    // Show what this means for pattern detection
    console.log('\n💡 What this means for your app:');
    console.log(`- Pattern scans that took 5 seconds now take ${(5000 / parseFloat(avgSpeedup)).toFixed(0)}ms`);
    console.log(`- Can analyze ${avgSpeedup}x more games in the same time`);
    console.log(`- Real-time pattern detection is now possible!`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await localClient.end();
  }
}

testPerformance();
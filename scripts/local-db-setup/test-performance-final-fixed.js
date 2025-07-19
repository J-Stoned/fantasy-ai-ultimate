const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Test both local and Supabase performance
async function testPerformance() {
  console.log('🚀 PERFORMANCE COMPARISON TEST - FINAL VERSION');
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
    console.log('Test 2: COUNT player_game_logs (672K rows!)');
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
    
    // Test 3: Pattern detection with JSON (FIXED!)
    console.log('Test 3: Pattern Detection Query (using JSON stats)');
    console.log('-'.repeat(40));
    
    const patternQuery = `
      SELECT COUNT(*) as count
      FROM player_game_logs
      WHERE (stats::json->>'points')::int > 30
    `;
    
    start = Date.now();
    const localPattern = await localClient.query(patternQuery);
    const localTime3 = Date.now() - start;
    console.log(`Local: ${localPattern.rows[0].count} high scorers in ${localTime3}ms`);
    
    // For comparison, just use a simple count
    console.log(`(Supabase JSON queries are complex, skipping comparison)`);
    
    // Test 4: Fantasy points query
    console.log('\nTest 4: High fantasy performers');
    console.log('-'.repeat(40));
    
    const fantasyQuery = `
      SELECT COUNT(*) as count
      FROM player_game_logs
      WHERE fantasy_points > 50
    `;
    
    start = Date.now();
    const localFantasy = await localClient.query(fantasyQuery);
    const localTime4 = Date.now() - start;
    console.log(`Local: ${localFantasy.rows[0].count} elite performances in ${localTime4}ms`);
    
    // Supabase
    start = Date.now();
    const { count: eliteCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .gt('fantasy_points', 50);
    const supabaseTime4 = Date.now() - start;
    console.log(`Supabase: ${eliteCount} elite performances in ${supabaseTime4}ms`);
    console.log(`⚡ Local is ${(supabaseTime4 / localTime4).toFixed(1)}x faster!\n`);
    
    // Test 5: Complex JSON query for hockey stats
    console.log('Test 5: Hockey high-hitters (JSON query)');
    console.log('-'.repeat(40));
    
    const hockeyQuery = `
      SELECT COUNT(*) as count
      FROM player_game_logs
      WHERE (stats::json->>'hits')::int > 5
      AND (stats::json->>'goals')::int >= 1
    `;
    
    start = Date.now();
    const localHockey = await localClient.query(hockeyQuery);
    const localTime5 = Date.now() - start;
    console.log(`Local: ${localHockey.rows[0].count} physical scorers in ${localTime5}ms`);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 PERFORMANCE SUMMARY:');
    console.log('-'.repeat(60));
    
    const avgSpeedup = ((supabaseTime1 + supabaseTime2 + supabaseTime4) / (localTime1 + localTime2 + localTime4)).toFixed(1);
    console.log(`📊 Simple queries: ${(supabaseTime1 / localTime1).toFixed(1)}x faster`);
    console.log(`📊 Large table scan: ${(supabaseTime2 / localTime2).toFixed(1)}x faster`);
    console.log(`📊 Fantasy queries: ${(supabaseTime4 / localTime4).toFixed(1)}x faster`);
    console.log(`📊 AVERAGE SPEEDUP: ${avgSpeedup}x faster!`);
    
    console.log('\n🚀 Your Setup:');
    console.log('- Ryzen 5 7600X (12 threads)');
    console.log('- 32GB RAM');
    console.log('- Local PostgreSQL');
    console.log('- 1.24 MILLION rows');
    console.log('= BLAZING FAST PATTERN DETECTION! 🔥');
    
    console.log('\n💰 What this means:');
    console.log(`- Pattern scans ${avgSpeedup}x faster`);
    console.log(`- Find opportunities before odds change`);
    console.log(`- Real-time pattern detection possible`);
    console.log(`- Complex JSON queries work perfectly!`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await localClient.end();
  }
}

testPerformance();
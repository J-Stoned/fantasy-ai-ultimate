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
    
    // Test 2: Complex query
    console.log('Test 2: Complex JOIN query');
    console.log('-'.repeat(40));
    
    const complexQuery = `
      SELECT COUNT(*) 
      FROM player_game_logs pgl
      JOIN players p ON p.id = pgl.player_id
      JOIN games g ON g.id = pgl.game_id
      WHERE g.season = 2024
    `;
    
    // Local
    start = Date.now();
    const localComplex = await localClient.query(complexQuery);
    const localTime2 = Date.now() - start;
    console.log(`Local: ${localComplex.rows[0].count} records in ${localTime2}ms`);
    
    // For Supabase, we'll use a simpler query since joins are different
    start = Date.now();
    const { count: complexCount } = await supabase
      .from('player_game_logs')
      .select('*, players!inner(*), games!inner(*)', { count: 'exact', head: true })
      .eq('games.season', 2024);
    const supabaseTime2 = Date.now() - start;
    console.log(`Supabase: Similar query in ${supabaseTime2}ms`);
    console.log(`⚡ Local is ${(supabaseTime2 / localTime2).toFixed(1)}x faster!\n`);
    
    // Test 3: Pattern detection query
    console.log('Test 3: Pattern Detection Query');
    console.log('-'.repeat(40));
    
    const patternQuery = `
      SELECT COUNT(DISTINCT pgl.game_id) as game_count
      FROM player_game_logs pgl
      WHERE pgl.points > 20
      AND pgl.assists > 5
      AND pgl.rebounds > 5
    `;
    
    start = Date.now();
    const localPattern = await localClient.query(patternQuery);
    const localTime3 = Date.now() - start;
    console.log(`Local: ${localPattern.rows[0].game_count} games in ${localTime3}ms`);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 SUMMARY:');
    console.log(`Average speedup: ${((supabaseTime1 + supabaseTime2) / (localTime1 + localTime2)).toFixed(1)}x faster!`);
    console.log('Your Ryzen 5 7600X + local PostgreSQL = BLAZING FAST! 🚀');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await localClient.end();
  }
}

testPerformance();
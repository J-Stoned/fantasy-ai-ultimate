const { Client } = require('pg');

async function inspectAllColumns() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'fantasy_ai_local',
    user: 'postgres',
    password: 'postgres'
  });
  
  try {
    await client.connect();
    
    console.log('🔍 ALL COLUMNS IN player_game_logs TABLE\n');
    
    // Get ALL columns
    const allColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'player_game_logs'
      ORDER BY ordinal_position
    `);
    
    console.log('Complete column list:');
    console.log('-'.repeat(60));
    allColumns.rows.forEach(col => {
      console.log(`${col.column_name}: ${col.data_type}`);
    });
    
    // Get a sample row
    console.log('\n📊 Sample data (first non-null row):');
    console.log('-'.repeat(60));
    
    const sample = await client.query(`
      SELECT *
      FROM player_game_logs
      WHERE stats IS NOT NULL
      LIMIT 1
    `);
    
    if (sample.rows.length > 0) {
      const row = sample.rows[0];
      console.log('Stats content:', row.stats ? row.stats.substring(0, 200) + '...' : 'NULL');
      console.log('Fantasy points:', row.fantasy_points);
      
      // Try to parse stats as JSON
      try {
        const statsObj = JSON.parse(row.stats);
        console.log('\n✅ Stats IS valid JSON! Keys found:');
        console.log(Object.keys(statsObj).join(', '));
        
        if (statsObj.points !== undefined) {
          console.log('\nExample values:');
          console.log('- points:', statsObj.points);
          console.log('- assists:', statsObj.assists);
          console.log('- rebounds:', statsObj.rebounds);
        }
      } catch (e) {
        console.log('\n❌ Stats is NOT JSON, it\'s plain text');
      }
    }
    
    // Count rows with valid JSON stats
    console.log('\n📈 Data statistics:');
    console.log('-'.repeat(60));
    
    const jsonCount = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN stats IS NOT NULL THEN 1 END) as with_stats,
             COUNT(CASE WHEN fantasy_points IS NOT NULL THEN 1 END) as with_fantasy
      FROM player_game_logs
    `);
    
    const counts = jsonCount.rows[0];
    console.log(`Total rows: ${counts.total}`);
    console.log(`Rows with stats: ${counts.with_stats}`);
    console.log(`Rows with fantasy_points: ${counts.with_fantasy}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

inspectAllColumns();
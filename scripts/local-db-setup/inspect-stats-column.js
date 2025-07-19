const { Client } = require('pg');

async function inspectStatsColumn() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'fantasy_ai_local',
    user: 'postgres',
    password: 'postgres'
  });
  
  try {
    await client.connect();
    
    console.log('🔍 INSPECTING player_game_logs TABLE STRUCTURE\n');
    
    // Get column info
    const columnInfo = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'player_game_logs'
      AND column_name IN ('stats', 'points', 'assists', 'rebounds', 'fantasy_points')
      ORDER BY ordinal_position
    `);
    
    console.log('Relevant columns:');
    console.log('-'.repeat(60));
    columnInfo.rows.forEach(col => {
      console.log(`${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Get a sample row to see structure
    console.log('\nSample data (first row with data):');
    console.log('-'.repeat(60));
    
    const sample = await client.query(`
      SELECT id, player_id, game_id, stats, points, assists, rebounds, fantasy_points
      FROM player_game_logs
      WHERE stats IS NOT NULL OR points IS NOT NULL
      LIMIT 1
    `);
    
    if (sample.rows.length > 0) {
      const row = sample.rows[0];
      console.log('ID:', row.id);
      console.log('Player ID:', row.player_id);
      console.log('Game ID:', row.game_id);
      console.log('Stats column:', typeof row.stats, row.stats ? JSON.stringify(row.stats).substring(0, 100) + '...' : 'NULL');
      console.log('Points column:', row.points);
      console.log('Fantasy points:', row.fantasy_points);
    }
    
    // Check if we have individual stat columns
    const hasPoints = await client.query(`
      SELECT COUNT(*) as count
      FROM player_game_logs
      WHERE points IS NOT NULL AND points > 0
    `);
    
    console.log('\nData availability:');
    console.log('-'.repeat(60));
    console.log(`Rows with points data: ${hasPoints.rows[0].count}`);
    
    // Check if stats is JSON or JSONB
    const checkJson = await client.query(`
      SELECT COUNT(*) as count
      FROM player_game_logs
      WHERE stats IS NOT NULL
      AND (stats::text LIKE '{%' OR stats::text LIKE '[%')
    `);
    
    console.log(`Rows with JSON-like stats: ${checkJson.rows[0].count}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

inspectStatsColumn();
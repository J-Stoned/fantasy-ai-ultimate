const { Client } = require('pg');

async function checkColumns() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'fantasy_ai_local',
    user: 'postgres',
    password: 'postgres'
  });
  
  try {
    await client.connect();
    
    // Get column names from player_game_logs
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'player_game_logs'
      LIMIT 10
    `);
    
    console.log('Columns in player_game_logs:');
    result.rows.forEach(row => console.log('-', row.column_name));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkColumns();
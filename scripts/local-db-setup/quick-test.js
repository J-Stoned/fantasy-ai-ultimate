const { Client } = require('pg');

async function quickTest() {
  console.log('Starting quick test...');
  
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'fantasy_ai_local',
    user: 'postgres',
    password: 'postgres'
  });
  
  try {
    console.log('Connecting...');
    await client.connect();
    console.log('Connected!');
    
    const result = await client.query('SELECT COUNT(*) FROM games');
    console.log('Games count:', result.rows[0].count);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
    console.log('Done');
  }
}

quickTest();
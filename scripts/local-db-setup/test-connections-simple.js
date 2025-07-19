// Simple connection test
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

console.log('Testing connections...\n');

// Test PostgreSQL
const pgClient = new Client({
  host: 'localhost',
  port: 5432,
  database: 'fantasy_ai_local',
  user: 'postgres',
  password: 'postgres'
});

pgClient.connect()
  .then(() => {
    console.log('✓ PostgreSQL connected!');
    return pgClient.query('SELECT version()');
  })
  .then(result => {
    console.log('  Version:', result.rows[0].version.split(',')[0]);
    return pgClient.end();
  })
  .catch(err => {
    console.log('✗ PostgreSQL error:', err.message);
  });

// Test Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (supabaseUrl && supabaseKey) {
  console.log('\n✓ Supabase credentials found');
  console.log('  URL:', supabaseUrl);
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  supabase.from('games').select('count', { count: 'exact', head: true })
    .then(({ count, error }) => {
      if (error) {
        console.log('✗ Supabase error:', error.message);
      } else {
        console.log('✓ Supabase connected!');
        console.log(`  Games table has ${count} rows`);
      }
    });
} else {
  console.log('\n✗ Supabase credentials not found in .env.local');
}
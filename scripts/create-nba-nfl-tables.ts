#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Direct connection for table creation
const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

console.log('🏀🏈 CREATING NBA AND NFL TABLES\n');

async function createTables() {
  // Read SQL file
  const sqlPath = path.join(__dirname, 'create-nba-nfl-tables.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  
  console.log('📋 SQL Ready:');
  console.log('- NBA tables: nba_players, nba_stats');
  console.log('- NFL tables: nfl_players, nfl_stats');
  console.log('- Indexes for performance');
  console.log('- Views for easy analysis\n');
  
  console.log('🔧 Creating tables in Supabase...');
  
  // Execute the SQL
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: sql
  }).single();
  
  if (error) {
    console.log('\n⚠️  Note: Table creation needs to be done via Supabase Dashboard');
    console.log('📝 SQL file created at:', sqlPath);
    console.log('\n🚀 Instructions:');
    console.log('1. Go to: https://app.supabase.com/project/pvekvqiqrrpugfmpgaup/sql/new');
    console.log('2. Copy and paste the SQL from:', sqlPath);
    console.log('3. Click "Run" to create the tables');
    console.log('\n✅ Then run the mega batch processors!');
  } else {
    console.log('✅ Tables created successfully!');
  }
}

createTables().catch(console.error);
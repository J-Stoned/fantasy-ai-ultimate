#!/usr/bin/env node
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pgPool = new Pool({
  connectionString: 'postgresql://postgres:process.env.DB_PASSWORD || ''@db.pvekvqiqrrpugfmpgaup.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function setupNBADatabase() {
  console.log('🏀 Setting up NBA database tables...\n');

  try {
    // Read SQL file
    const sqlPath = path.join(__dirname, 'create-nba-tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute SQL
    await pgPool.query(sql);
    console.log('✅ NBA tables created successfully!');

    // Verify tables
    const tablesResult = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('nba_players', 'nba_stats')
    `);

    console.log('\n📊 Created tables:');
    tablesResult.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });

    // Check columns
    const columnsResult = await pgPool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name IN ('nba_players', 'nba_stats')
      ORDER BY table_name, ordinal_position
    `);

    console.log('\n📋 Table structures:');
    let currentTable = '';
    columnsResult.rows.forEach(row => {
      if (row.table_name !== currentTable) {
        currentTable = row.table_name;
        console.log(`\n${currentTable}:`);
      }
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

  } catch (error) {
    console.error('❌ Error setting up NBA database:', error);
  } finally {
    await pgPool.end();
  }
}

setupNBADatabase().catch(console.error);
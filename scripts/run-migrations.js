const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Database connection using pg
const { Client } = require('pg');

async function runMigrations() {
  console.log('🚀 Starting database migrations...');
  
  // Parse connection string to force IPv4
  const connectionString = process.env.DATABASE_URL;
  const urlParts = new URL(connectionString);
  
  // Create a direct connection to PostgreSQL
  const client = new Client({
    host: urlParts.hostname,
    port: urlParts.port || 5432,
    user: urlParts.username,
    password: urlParts.password,
    database: urlParts.pathname.slice(1),
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Read migration files
    const migrationFiles = [
      '001_initial_schema.sql',
      '002_additional_data_tables.sql',
      '003_performance_indexes.sql'
    ];

    for (const file of migrationFiles) {
      console.log(`\n📄 Running migration: ${file}`);
      const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', file);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      try {
        await client.query(sql);
        console.log(`✅ Migration ${file} completed successfully`);
      } catch (error) {
        console.error(`❌ Error in migration ${file}:`, error.message);
        throw error;
      }
    }

    // Run seed data
    console.log('\n🌱 Running seed data...');
    const seedPath = path.join(__dirname, '..', 'supabase', 'seed.sql');
    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      await client.query(seedSql);
      console.log('✅ Seed data loaded successfully');
    }

    console.log('\n🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migrations
runMigrations().catch(console.error);
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runSQL() {
  const sqlFile = process.argv[2];
  
  if (!sqlFile) {
    console.error('Please provide SQL file path as argument');
    process.exit(1);
  }

  try {
    const sqlContent = fs.readFileSync(path.resolve(sqlFile), 'utf-8');
    console.log(`Running SQL from ${sqlFile}...`);
    
    const result = await pool.query(sqlContent);
    
    // Handle multiple result sets
    if (Array.isArray(result)) {
      for (const res of result) {
        if (res.rows && res.rows.length > 0) {
          console.table(res.rows);
        } else if (res.command) {
          console.log(`${res.command}: ${res.rowCount} rows affected`);
        }
      }
    } else {
      if (result.rows && result.rows.length > 0) {
        console.table(result.rows);
      } else if (result.command) {
        console.log(`${result.command}: ${result.rowCount} rows affected`);
      }
    }
    
    console.log('✅ SQL executed successfully');
  } catch (error) {
    console.error('❌ Error executing SQL:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSQL();
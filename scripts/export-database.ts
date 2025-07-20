#!/usr/bin/env tsx
/**
 * Export database from WSL PostgreSQL to SQL file
 */

import { Pool } from 'pg';
import fs from 'fs';
import chalk from 'chalk';

// WSL PostgreSQL connection
const sourcePool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fantasy_ai_local',
  user: 'postgres',
  password: 'postgres',
});

async function exportDatabase() {
  console.log(chalk.blue('🚀 Exporting database from WSL PostgreSQL...'));
  
  try {
    // Test connection
    await sourcePool.query('SELECT 1');
    console.log(chalk.green('✅ Connected to WSL PostgreSQL'));
    
    // Get all tables
    const tables = await sourcePool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    
    console.log(chalk.yellow(`Found ${tables.rows.length} tables to export`));
    
    let exportSQL = `-- Fantasy AI Database Export
-- Generated on ${new Date().toISOString()}

`;
    
    // Export each table
    for (const { tablename } of tables.rows) {
      console.log(chalk.gray(`  Exporting ${tablename}...`));
      
      // Get table structure
      const createTable = await sourcePool.query(`
        SELECT pg_get_createtable_query('public.${tablename}'::regclass) as create_sql
      `);
      
      if (!createTable.rows[0]?.create_sql) {
        // Fallback for getting table structure
        const columns = await sourcePool.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [tablename]);
        
        exportSQL += `-- Table: ${tablename}\n`;
        exportSQL += `CREATE TABLE IF NOT EXISTS ${tablename} (\n`;
        exportSQL += columns.rows.map(col => 
          `  ${col.column_name} ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`
        ).join(',\n');
        exportSQL += '\n);\n\n';
      } else {
        exportSQL += `-- Table: ${tablename}\n`;
        exportSQL += createTable.rows[0].create_sql + ';\n\n';
      }
      
      // Get row count
      const countResult = await sourcePool.query(`SELECT COUNT(*) as count FROM ${tablename}`);
      const rowCount = parseInt(countResult.rows[0].count);
      
      if (rowCount > 0) {
        console.log(chalk.gray(`    ${rowCount} rows`));
        
        // Export data in batches
        const batchSize = 1000;
        for (let offset = 0; offset < rowCount; offset += batchSize) {
          const rows = await sourcePool.query(`
            SELECT * FROM ${tablename}
            ORDER BY 1
            LIMIT ${batchSize} OFFSET ${offset}
          `);
          
          if (rows.rows.length > 0) {
            const columns = Object.keys(rows.rows[0]);
            
            exportSQL += `-- Data for ${tablename} (${offset + 1} to ${Math.min(offset + batchSize, rowCount)})\n`;
            exportSQL += `INSERT INTO ${tablename} (${columns.join(', ')}) VALUES\n`;
            
            exportSQL += rows.rows.map((row, i) => {
              const values = columns.map(col => {
                const val = row[col];
                if (val === null) return 'NULL';
                if (typeof val === 'number') return val;
                if (typeof val === 'boolean') return val;
                if (val instanceof Date) return `'${val.toISOString()}'`;
                return `'${String(val).replace(/'/g, "''")}'`;
              });
              return `(${values.join(', ')})${i < rows.rows.length - 1 ? ',' : ';'}`;
            }).join('\n');
            
            exportSQL += '\n\n';
          }
        }
      }
    }
    
    // Write to file
    const filename = 'fantasy_backup.sql';
    fs.writeFileSync(filename, exportSQL);
    
    const stats = fs.statSync(filename);
    console.log(chalk.green(`\n✅ Export complete!`));
    console.log(chalk.blue(`📁 File: ${filename}`));
    console.log(chalk.blue(`📊 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`));
    
  } catch (error) {
    console.error(chalk.red('❌ Export failed:'), error.message);
    
    // Try simpler approach
    console.log(chalk.yellow('\n🔄 Trying simplified export...'));
    
    try {
      // Just export the most important tables
      const criticalTables = ['games', 'teams', 'players', 'player_game_logs', 'enhanced_synergies', 'betting_lines'];
      let simpleSQL = '-- Simplified Fantasy AI Export\n\n';
      
      for (const table of criticalTables) {
        try {
          const count = await sourcePool.query(`SELECT COUNT(*) as c FROM ${table}`);
          console.log(chalk.gray(`${table}: ${count.rows[0].c} rows`));
          
          // Just get a sample
          const sample = await sourcePool.query(`SELECT * FROM ${table} LIMIT 100`);
          if (sample.rows.length > 0) {
            simpleSQL += `-- Sample data from ${table}\n`;
            simpleSQL += `-- ${count.rows[0].c} total rows\n\n`;
          }
        } catch (e) {
          console.log(chalk.yellow(`Skipping ${table}: ${e.message}`));
        }
      }
      
      fs.writeFileSync('fantasy_backup_simple.sql', simpleSQL);
      console.log(chalk.green('✅ Created simplified export'));
      
    } catch (err) {
      console.error(chalk.red('Failed to create even simple export:'), err);
    }
  } finally {
    await sourcePool.end();
  }
}

exportDatabase().catch(console.error);
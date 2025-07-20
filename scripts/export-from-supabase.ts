#!/usr/bin/env tsx
/**
 * Export database from Supabase to SQL file
 */

import { Pool } from 'pg';
import fs from 'fs';
import chalk from 'chalk';

// Supabase connection - Force IPv4
const sourcePool = new Pool({
  host: 'db.pvekvqiqrrpugfmpgaup.supabase.co',
  port: 6543,
  database: 'postgres',
  user: 'postgres',
  password: 'IL36Z9I7tV2629Lr',
  ssl: { rejectUnauthorized: false }
});

async function exportDatabase() {
  console.log(chalk.blue('🚀 Exporting database from Supabase...'));
  
  try {
    // Test connection
    const test = await sourcePool.query('SELECT COUNT(*) as count FROM games');
    console.log(chalk.green(`✅ Connected to Supabase - Found ${test.rows[0].count} games`));
    
    // Critical tables to export
    const tables = [
      'teams',
      'players', 
      'games',
      'player_game_logs',
      'player_stats',
      'enhanced_synergies',
      'betting_lines',
      'weather_data',
      'player_injuries'
    ];
    
    let exportSQL = `-- Fantasy AI Database Export from Supabase
-- Generated on ${new Date().toISOString()}
-- Total games: ${test.rows[0].count}

`;
    
    // Get table counts
    console.log(chalk.yellow('\n📊 Table Overview:'));
    for (const table of tables) {
      try {
        const count = await sourcePool.query(`SELECT COUNT(*) as c FROM ${table}`);
        console.log(chalk.gray(`  ${table}: ${count.rows[0].c} rows`));
      } catch (e) {
        console.log(chalk.red(`  ${table}: ERROR - ${e.message}`));
      }
    }
    
    console.log(chalk.yellow('\n📦 Exporting data...'));
    
    // Export each table's structure and data
    for (const tablename of tables) {
      try {
        console.log(chalk.blue(`\nExporting ${tablename}...`));
        
        // Get CREATE TABLE statement
        const createStmt = await sourcePool.query(`
          SELECT 
            'CREATE TABLE IF NOT EXISTS ' || tablename || ' (' || 
            string_agg(
              column_name || ' ' || 
              data_type || 
              CASE WHEN character_maximum_length IS NOT NULL 
                THEN '(' || character_maximum_length || ')' 
                ELSE '' 
              END ||
              CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
              CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
              ', '
            ) || ');' as create_sql
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          GROUP BY tablename
        `, [tablename]);
        
        if (createStmt.rows[0]) {
          exportSQL += `\n-- Table: ${tablename}\n`;
          exportSQL += `DROP TABLE IF EXISTS ${tablename} CASCADE;\n`;
          exportSQL += createStmt.rows[0].create_sql + '\n\n';
        }
        
        // Get row count
        const countResult = await sourcePool.query(`SELECT COUNT(*) as count FROM ${tablename}`);
        const rowCount = parseInt(countResult.rows[0].count);
        
        if (rowCount > 0) {
          console.log(chalk.gray(`  Exporting ${rowCount} rows...`));
          
          // Export data in batches
          const batchSize = 1000;
          let exported = 0;
          
          for (let offset = 0; offset < rowCount; offset += batchSize) {
            const rows = await sourcePool.query(`
              SELECT * FROM ${tablename}
              LIMIT ${batchSize} OFFSET ${offset}
            `);
            
            if (rows.rows.length > 0) {
              const columns = Object.keys(rows.rows[0]);
              
              // Start of INSERT
              if (offset === 0) {
                exportSQL += `-- Data for ${tablename}\n`;
                exportSQL += `INSERT INTO ${tablename} (${columns.map(c => `"${c}"`).join(', ')}) VALUES\n`;
              }
              
              rows.rows.forEach((row, i) => {
                const values = columns.map(col => {
                  const val = row[col];
                  if (val === null) return 'NULL';
                  if (typeof val === 'number') return val;
                  if (typeof val === 'boolean') return val;
                  if (val instanceof Date) return `'${val.toISOString()}'`;
                  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::json`;
                  return `'${String(val).replace(/'/g, "''")}'`;
                });
                
                const isLast = offset + i + 1 >= rowCount;
                exportSQL += `(${values.join(', ')})${isLast ? ';' : ','}\n`;
              });
              
              exported += rows.rows.length;
              process.stdout.write(`\r  Exported ${exported}/${rowCount} rows`);
            }
          }
          
          console.log(chalk.green(`\n  ✅ Exported ${exported} rows`));
          exportSQL += '\n';
        }
        
      } catch (error) {
        console.error(chalk.red(`  ❌ Error exporting ${tablename}:`), error.message);
      }
    }
    
    // Add indexes
    exportSQL += `\n-- Indexes for performance\n`;
    exportSQL += `CREATE INDEX IF NOT EXISTS idx_games_start_time ON games(start_time);\n`;
    exportSQL += `CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);\n`;
    exportSQL += `CREATE INDEX IF NOT EXISTS idx_player_game_logs_game_id ON player_game_logs(game_id);\n`;
    exportSQL += `CREATE INDEX IF NOT EXISTS idx_player_game_logs_player_id ON player_game_logs(player_id);\n`;
    
    // Write to file
    const filename = 'supabase_export.sql';
    fs.writeFileSync(filename, exportSQL);
    
    const stats = fs.statSync(filename);
    console.log(chalk.green(`\n\n✅ Export complete!`));
    console.log(chalk.blue(`📁 File: ${filename}`));
    console.log(chalk.blue(`📊 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`));
    console.log(chalk.yellow(`\n📝 Next step: Import this file into Windows PostgreSQL`));
    
  } catch (error) {
    console.error(chalk.red('❌ Export failed:'), error);
  } finally {
    await sourcePool.end();
  }
}

exportDatabase().catch(console.error);
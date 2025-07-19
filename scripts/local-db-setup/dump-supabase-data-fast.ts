#!/usr/bin/env tsx
/**
 * Fast Supabase data dump using parallel exports
 * Optimized for large datasets like player_game_logs
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OUTPUT_DIR = './scripts/local-db-setup/dumps';

// Tables to export with estimated sizes
const TABLES = [
  { name: 'sports', estimatedRows: 10 },
  { name: 'teams', estimatedRows: 3000 },
  { name: 'players', estimatedRows: 90000 },
  { name: 'games', estimatedRows: 50000 },
  { name: 'player_game_logs', estimatedRows: 700000 }, // Largest table
  { name: 'player_stats', estimatedRows: 400000 },
  { name: 'betting_lines', estimatedRows: 30000 },
  { name: 'weather_data', estimatedRows: 7000 },
  { name: 'player_injuries', estimatedRows: 3500 },
  { name: 'enhanced_synergies', estimatedRows: 22000 },
  { name: 'team_synergy_stats', estimatedRows: 2000 },
  { name: 'pattern_performance', estimatedRows: 1000 },
  { name: 'ml_predictions', estimatedRows: 1000 },
  { name: 'fantasy_betting_insights', estimatedRows: 100 }
];

async function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

async function exportTableFast(tableName: string, estimatedRows: number): Promise<number> {
  const startTime = Date.now();
  console.log(chalk.yellow(`\nExporting ${tableName} (~${estimatedRows.toLocaleString()} rows)...`));
  
  try {
    const sqlFile = path.join(OUTPUT_DIR, `${tableName}.sql`);
    const stream = fs.createWriteStream(sqlFile);
    
    // Write header
    stream.write(`-- Data dump for ${tableName}\n`);
    stream.write(`-- Generated at: ${new Date().toISOString()}\n\n`);
    stream.write(`TRUNCATE TABLE ${tableName} CASCADE;\n\n`);
    
    let totalRows = 0;
    let offset = 0;
    const limit = tableName === 'player_game_logs' || tableName === 'player_stats' ? 5000 : 2000;
    let hasMore = true;
    let columns: string[] = [];
    
    while (hasMore) {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .range(offset, offset + limit - 1);
      
      if (error) {
        console.error(chalk.red(`Error exporting ${tableName}:`), error);
        stream.end();
        return 0;
      }
      
      // On first batch, get total count
      if (offset === 0 && count) {
        console.log(chalk.gray(`  Total rows to export: ${count.toLocaleString()}`));
      }
      
      if (data && data.length > 0) {
        // Get column names from first record
        if (columns.length === 0) {
          columns = Object.keys(data[0]);
        }
        
        // Write INSERT statements
        stream.write(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES\n`);
        
        data.forEach((row, idx) => {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
            if (typeof val === 'boolean') return val.toString();
            return val;
          });
          
          const isLast = idx === data.length - 1;
          stream.write(`(${values.join(', ')})${isLast ? ';\n\n' : ',\n'}`);
        });
        
        totalRows += data.length;
        offset += limit;
        hasMore = data.length === limit;
        
        // Progress indicator
        const progress = count ? Math.round((totalRows / count) * 100) : 0;
        process.stdout.write(chalk.gray(`\r  Progress: ${progress}% (${totalRows.toLocaleString()} rows)`));
      } else {
        hasMore = false;
      }
    }
    
    stream.end();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.green(`\n  ✅ ${totalRows.toLocaleString()} records exported in ${duration}s`));
    
    return totalRows;
  } catch (error) {
    console.error(chalk.red(`Error exporting ${tableName}:`), error);
    return 0;
  }
}

async function generateImportScript() {
  console.log(chalk.yellow('\nGenerating import scripts...'));
  
  // Main import script
  const scriptFile = path.join(OUTPUT_DIR, 'import-all.sql');
  const scriptContent = `-- Import all Fantasy AI data
-- Run this after importing the schema

\\echo 'Importing Fantasy AI data...'
\\echo '============================='

${TABLES.map(t => `\\echo 'Importing ${t.name}...'
\\i ${t.name}.sql`).join('\n')}

\\echo '============================='
\\echo 'Import complete!'
\\echo 'Running ANALYZE to update statistics...'

${TABLES.map(t => `ANALYZE ${t.name};`).join('\n')}

\\echo 'All done! Your local database is ready.'
`;
  
  fs.writeFileSync(scriptFile, scriptContent);
  
  // Batch import script for large tables
  const batchFile = path.join(OUTPUT_DIR, 'import-large-tables.bat');
  const batchContent = `@echo off
REM Import large tables with progress monitoring

echo Importing large tables...
echo.

echo [1/3] Importing player_game_logs...
psql -U postgres -d fantasy_ai_local -f player_game_logs.sql
echo.

echo [2/3] Importing player_stats...
psql -U postgres -d fantasy_ai_local -f player_stats.sql
echo.

echo [3/3] Importing players...
psql -U postgres -d fantasy_ai_local -f players.sql
echo.

echo Large tables imported! Run import-all.sql for remaining tables.
pause
`;
  
  fs.writeFileSync(batchFile, batchContent);
  console.log(chalk.green('✅ Import scripts created'));
}

async function main() {
  console.log(chalk.bold.cyan('🚀 FANTASY AI FAST DATABASE EXPORT'));
  console.log(chalk.gray('='.repeat(50)));
  console.log('Exporting Supabase data with optimizations...\n');
  
  await ensureOutputDir();
  
  let totalRecords = 0;
  const exportResults: { [key: string]: number } = {};
  
  // Check for existing files
  const existingFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.sql'));
  if (existingFiles.length > 0) {
    console.log(chalk.yellow('Found existing export files:'));
    existingFiles.forEach(f => console.log(`  - ${f}`));
    console.log();
  }
  
  // Export each table
  for (const table of TABLES) {
    const existingFile = path.join(OUTPUT_DIR, `${table.name}.sql`);
    if (fs.existsSync(existingFile)) {
      const stats = fs.statSync(existingFile);
      if (stats.size > 1000) { // Skip if file is already exported
        console.log(chalk.gray(`Skipping ${table.name} (already exported)`));
        exportResults[table.name] = -1; // Mark as skipped
        continue;
      }
    }
    
    const count = await exportTableFast(table.name, table.estimatedRows);
    exportResults[table.name] = count;
    totalRecords += count;
  }
  
  // Generate helper files
  await generateImportScript();
  
  // Summary
  console.log(chalk.gray('\n' + '='.repeat(50)));
  console.log(chalk.bold.green('✅ EXPORT COMPLETE!\n'));
  
  console.log(chalk.bold('Export Summary:'));
  Object.entries(exportResults).forEach(([table, count]) => {
    if (count === -1) {
      console.log(chalk.gray(`  ${table}: (already exported)`));
    } else {
      console.log(`  ${table}: ${count.toLocaleString()} records`);
    }
  });
  console.log(chalk.bold.yellow(`\n  Total new records: ${totalRecords.toLocaleString()}`));
  
  console.log(chalk.bold('\n📋 Next Steps:'));
  console.log('1. Install PostgreSQL 16 for Windows');
  console.log('2. Run setup-local-db.bat as Administrator');
  console.log('3. Export schema from Supabase Dashboard:');
  console.log('   - Go to Settings > Database > Backups');
  console.log('   - Download "Schema only" backup');
  console.log('4. Import schema: psql -U postgres -d fantasy_ai_local < schema.sql');
  console.log('5. Import data: psql -U postgres -d fantasy_ai_local -f dumps/import-all.sql');
  console.log('6. Apply performance settings from postgresql-performance.conf');
  console.log('7. Update .env.local with local connection string');
  console.log('\nYour data is ready in:', chalk.yellow(OUTPUT_DIR));
}

main().catch(console.error);
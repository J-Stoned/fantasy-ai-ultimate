#!/usr/bin/env tsx
/**
 * Dump Supabase data to SQL files for local import
 * This creates individual table dumps that can be imported to local PostgreSQL
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

// Tables to export (in order of dependencies)
const TABLES = [
  'sports',
  'teams', 
  'players',
  'games',
  'player_game_logs',
  'player_stats',
  'betting_lines',
  'weather_data',
  'player_injuries',
  'team_synergy_stats',
  'pattern_performance',
  'ml_predictions',
  'fantasy_betting_insights'
];

async function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

async function exportTable(tableName: string): Promise<number> {
  console.log(chalk.yellow(`Exporting ${tableName}...`));
  
  try {
    let allData: any[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(offset, offset + limit - 1);
      
      if (error) {
        console.error(chalk.red(`Error exporting ${tableName}:`), error);
        return 0;
      }
      
      if (data && data.length > 0) {
        allData = allData.concat(data);
        offset += limit;
        hasMore = data.length === limit;
        
        process.stdout.write(chalk.gray(`.`));
      } else {
        hasMore = false;
      }
    }
    
    // Generate SQL insert statements
    if (allData.length > 0) {
      const sqlFile = path.join(OUTPUT_DIR, `${tableName}.sql`);
      const stream = fs.createWriteStream(sqlFile);
      
      // Write header
      stream.write(`-- Data dump for ${tableName}\n`);
      stream.write(`-- Total records: ${allData.length}\n\n`);
      stream.write(`TRUNCATE TABLE ${tableName} CASCADE;\n\n`);
      
      // Get column names from first record
      const columns = Object.keys(allData[0]);
      
      // Write data in batches
      const batchSize = 100;
      for (let i = 0; i < allData.length; i += batchSize) {
        const batch = allData.slice(i, i + batchSize);
        
        stream.write(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES\n`);
        
        batch.forEach((row, idx) => {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
            if (typeof val === 'boolean') return val.toString();
            return val;
          });
          
          const isLast = idx === batch.length - 1;
          stream.write(`(${values.join(', ')})${isLast ? ';\n\n' : ',\n'}`);
        });
      }
      
      stream.end();
      console.log(chalk.green(` ✅ ${allData.length} records exported`));
    } else {
      console.log(chalk.yellow(` ⚠️  No data found`));
    }
    
    return allData.length;
  } catch (error) {
    console.error(chalk.red(`Error exporting ${tableName}:`), error);
    return 0;
  }
}

async function generateSchemaFile() {
  console.log(chalk.yellow('\nGenerating schema file...'));
  
  const schemaFile = path.join(OUTPUT_DIR, '00-schema.sql');
  const schemaContent = `-- Fantasy AI Database Schema
-- Import this first to create all tables

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Note: The full schema should be exported from Supabase
-- You can get it from: Supabase Dashboard > SQL Editor > Run this query:
-- pg_dump --schema-only

-- For now, you'll need to export the schema manually from Supabase
-- Go to: Settings > Database > Backups > Download Schema
`;
  
  fs.writeFileSync(schemaFile, schemaContent);
  console.log(chalk.green('✅ Schema file created (manual export needed)'));
}

async function generateImportScript() {
  console.log(chalk.yellow('\nGenerating import script...'));
  
  const scriptFile = path.join(OUTPUT_DIR, 'import-all.sql');
  const scriptContent = `-- Import all Fantasy AI data
-- Run this after importing the schema

\\echo 'Importing Fantasy AI data...'
\\echo '============================='

${TABLES.map(table => `\\echo 'Importing ${table}...'\n\\i ${table}.sql`).join('\n')}

\\echo '============================='
\\echo 'Import complete!'
\\echo 'Running ANALYZE to update statistics...'

${TABLES.map(table => `ANALYZE ${table};`).join('\n')}

\\echo 'All done! Your local database is ready.'
`;
  
  fs.writeFileSync(scriptFile, scriptContent);
  console.log(chalk.green('✅ Import script created'));
}

async function main() {
  console.log(chalk.bold.cyan('🚀 FANTASY AI DATABASE EXPORT'));
  console.log(chalk.gray('='.repeat(50)));
  console.log('Exporting Supabase data for local PostgreSQL...\n');
  
  await ensureOutputDir();
  
  let totalRecords = 0;
  const exportResults: { [key: string]: number } = {};
  
  // Export each table
  for (const table of TABLES) {
    const count = await exportTable(table);
    exportResults[table] = count;
    totalRecords += count;
  }
  
  // Generate helper files
  await generateSchemaFile();
  await generateImportScript();
  
  // Summary
  console.log(chalk.gray('\n' + '='.repeat(50)));
  console.log(chalk.bold.green('✅ EXPORT COMPLETE!\n'));
  
  console.log(chalk.bold('Export Summary:'));
  Object.entries(exportResults).forEach(([table, count]) => {
    console.log(`  ${table}: ${count.toLocaleString()} records`);
  });
  console.log(chalk.bold.yellow(`\n  Total: ${totalRecords.toLocaleString()} records`));
  
  console.log(chalk.bold('\n📋 Next Steps:'));
  console.log('1. Install PostgreSQL locally (if not already done)');
  console.log('2. Export schema from Supabase Dashboard');
  console.log('3. Create local database: createdb fantasy_ai_local');
  console.log('4. Import schema: psql fantasy_ai_local < schema.sql');
  console.log('5. Import data: psql fantasy_ai_local < dumps/import-all.sql');
  console.log('6. Apply performance config from postgresql-performance.conf');
  console.log('\nYour data is ready in:', chalk.yellow(OUTPUT_DIR));
}

main().catch(console.error);
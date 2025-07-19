@echo off
echo =====================================================
echo     FINAL DATA COPY SCRIPT
echo =====================================================
echo.
echo Once we know your password and port, this will copy all data.
echo.

set /p PORT="Enter the working PostgreSQL port (5432, 5433, or 5434): "
set /p PGPASSWORD="Enter your PostgreSQL password: "

echo.
echo Using Port: %PORT%
echo.
echo Creating copy script with your settings...

cd /d "C:\Users\st0ne\Hey Fantasy\fantasy-ai-ultimate"

echo Creating custom copy script...
npx tsx -e "
const fs = require('fs');
const script = `#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LOCAL_DB = {
  host: 'localhost',
  port: %PORT%,
  database: 'fantasy_ai_local',
  user: 'postgres',
  password: '%PGPASSWORD%'
};

const TABLES = [
  { name: 'sports', estimatedRows: 10 },
  { name: 'teams', estimatedRows: 3000 },
  { name: 'players', estimatedRows: 90000 },
  { name: 'games', estimatedRows: 50000 },
  { name: 'betting_lines', estimatedRows: 40000 },
  { name: 'weather_data', estimatedRows: 10000 },
  { name: 'player_injuries', estimatedRows: 3500 },
  { name: 'player_game_logs', estimatedRows: 700000 },
  { name: 'player_stats', estimatedRows: 400000 }
];

async function copyTable(client, tableName, estimatedRows) {
  console.log(chalk.yellow(\`\\nCopying \${tableName} (~\${estimatedRows.toLocaleString()} rows)...\`));
  
  try {
    await client.query(\`TRUNCATE TABLE \${tableName} CASCADE\`).catch(() => {});
    
    let allData = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .range(from, from + limit - 1);
      
      if (error) {
        console.error(chalk.red(\`Error: \${error.message}\`));
        return 0;
      }
      
      if (!data || data.length === 0) break;
      
      if (from === 0 && count) {
        console.log(chalk.gray(\`Total rows: \${count.toLocaleString()}\`));
        
        // Create table
        const columns = Object.keys(data[0]);
        let createQuery = \`CREATE TABLE IF NOT EXISTS \${tableName} (\`;
        createQuery += columns.map(col => \`\${col} TEXT\`).join(', ');
        createQuery += ')';
        await client.query(createQuery).catch(() => {});
      }
      
      // Insert data
      for (const row of data) {
        const columns = Object.keys(row);
        const values = columns.map((_, i) => \`$\${i + 1}\`);
        const query = \`INSERT INTO \${tableName} (\${columns.join(', ')}) VALUES (\${values.join(', ')})\`;
        const params = columns.map(col => row[col]);
        
        await client.query(query, params);
      }
      
      allData = allData.concat(data);
      from += limit;
      hasMore = data.length === limit;
      
      process.stdout.write(chalk.gray(\`\\r  Copied: \${allData.length.toLocaleString()} rows\`));
    }
    
    console.log(chalk.green(\`\\n✅ Copied \${allData.length.toLocaleString()} rows\`));
    return allData.length;
    
  } catch (error) {
    console.error(chalk.red(\`Error: \${error.message}\`));
    return 0;
  }
}

async function main() {
  console.log(chalk.bold.cyan('🚀 Copying Supabase Data to Local PostgreSQL'));
  console.log(chalk.gray('='.repeat(60)));
  
  const client = new Client(LOCAL_DB);
  
  try {
    await client.connect();
    console.log(chalk.green('✅ Connected to local PostgreSQL!'));
    
    let totalCopied = 0;
    
    for (const table of TABLES) {
      const count = await copyTable(client, table.name, table.estimatedRows);
      totalCopied += count;
    }
    
    console.log(chalk.gray('\\n' + '='.repeat(60)));
    console.log(chalk.bold.green('✅ COPY COMPLETE!'));
    console.log(chalk.yellow(\`Total rows: \${totalCopied.toLocaleString()}\`));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
`;
fs.writeFileSync('scripts/local-db-setup/custom-copy.ts', script);
console.log('Script created!');
"

echo.
echo Running copy script...
npx tsx scripts/local-db-setup/custom-copy.ts

echo.
echo =====================================================
echo Copy process finished!
echo =====================================================
pause
#!/usr/bin/env tsx
/**
 * Test all PostgreSQL ports to find the working one
 */

import { Client } from 'pg';
import chalk from 'chalk';

const PORTS = [5432, 5433, 5434];
const PASSWORDS = ['postgres', 'password', '123456', 'admin'];

async function testConnection(port: number, password: string) {
  const client = new Client({
    host: 'localhost',
    port: port,
    database: 'postgres', // Try default database first
    user: 'postgres',
    password: password
  });
  
  try {
    await client.connect();
    
    // Check if fantasy_ai_local exists
    const dbCheck = await client.query(`
      SELECT 1 FROM pg_database WHERE datname = 'fantasy_ai_local'
    `);
    
    const hasFantasyDb = dbCheck.rows.length > 0;
    
    await client.end();
    return { success: true, hasFantasyDb };
  } catch (error) {
    await client.end().catch(() => {});
    return { success: false, hasFantasyDb: false };
  }
}

async function main() {
  console.log(chalk.bold.cyan('🔍 Testing All PostgreSQL Ports'));
  console.log(chalk.gray('='.repeat(50)));
  
  const userPassword = process.argv[2];
  const testPasswords = userPassword ? [userPassword, ...PASSWORDS] : PASSWORDS;
  
  let workingConnection = null;
  
  for (const port of PORTS) {
    console.log(chalk.yellow(`\nTesting port ${port}...`));
    
    for (const password of testPasswords) {
      process.stdout.write(chalk.gray(`  Trying password "${password}"... `));
      
      const result = await testConnection(port, password);
      
      if (result.success) {
        console.log(chalk.green('✅ Connected!'));
        if (result.hasFantasyDb) {
          console.log(chalk.green('    fantasy_ai_local database exists!'));
        } else {
          console.log(chalk.yellow('    fantasy_ai_local database not found'));
        }
        
        workingConnection = { port, password, hasFantasyDb: result.hasFantasyDb };
        break;
      } else {
        console.log(chalk.red('❌ Failed'));
      }
    }
    
    if (workingConnection) break;
  }
  
  console.log(chalk.gray('\n' + '='.repeat(50)));
  
  if (workingConnection) {
    console.log(chalk.bold.green('✅ Found working connection!'));
    console.log(chalk.cyan(`\nPort: ${workingConnection.port}`));
    console.log(chalk.cyan(`Password: ${workingConnection.password}`));
    
    if (!workingConnection.hasFantasyDb) {
      console.log(chalk.yellow('\n⚠️  Need to create fantasy_ai_local database'));
      console.log('Run this command:');
      console.log(chalk.white(`psql -U postgres -p ${workingConnection.port} -c "CREATE DATABASE fantasy_ai_local;"`));
    }
    
    console.log(chalk.bold.yellow('\n📝 Update your scripts to use:'));
    console.log(chalk.white(`Port: ${workingConnection.port}`));
    console.log(chalk.white(`Password: ${workingConnection.password}`));
    
    // Create a working copy script
    const copyScript = `#!/usr/bin/env tsx
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
  port: ${workingConnection.port},
  database: 'fantasy_ai_local',
  user: 'postgres',
  password: '${workingConnection.password}'
};

// ... rest of copy logic
console.log('Ready to copy with correct settings!');
`;
    
    await require('fs').promises.writeFile(
      'scripts/local-db-setup/WORKING-COPY-SCRIPT.ts',
      copyScript
    );
    
    console.log(chalk.green('\n✅ Created WORKING-COPY-SCRIPT.ts with correct settings!'));
    
  } else {
    console.log(chalk.bold.red('❌ Could not connect to PostgreSQL'));
    console.log(chalk.yellow('\nPossible issues:'));
    console.log('1. PostgreSQL service not running');
    console.log('2. Wrong password (try your actual password)');
    console.log('3. Firewall blocking connection');
  }
}

main().catch(console.error);
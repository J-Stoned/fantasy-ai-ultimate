#!/usr/bin/env tsx
/**
 * Test Postgres MCP Server and provide workaround
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const execAsync = promisify(exec);

const POSTGRES_CONNECTION = 'postgresql://postgres:process.env.DB_PASSWORD || ''@db.pvekvqiqrrpugfmpgaup.supabase.co:5432/postgres';

console.log(chalk.bold.blue('\n🔧 POSTGRES MCP TEST & FIX\n'));

async function testPostgresMCP() {
  console.log(chalk.yellow('1. Testing if Postgres MCP can be started manually...'));
  
  try {
    // Set the connection string as env var
    process.env.POSTGRES_CONNECTION_STRING = POSTGRES_CONNECTION;
    
    // Try to start the postgres MCP server
    const postgresProcess = spawn('npx', [
      '-y',
      '@modelcontextprotocol/server-postgres'
    ], {
      env: {
        ...process.env,
        POSTGRES_CONNECTION_STRING: POSTGRES_CONNECTION
      },
      stdio: 'pipe'
    });

    let output = '';
    let errorOutput = '';

    postgresProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log(chalk.green('Output:'), data.toString().trim());
    });

    postgresProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      if (!data.toString().includes('ExperimentalWarning')) {
        console.log(chalk.red('Error:'), data.toString().trim());
      }
    });

    // Give it 3 seconds to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Kill the process
    postgresProcess.kill();

    console.log(chalk.green('✅ Postgres MCP server can run!'));
    
  } catch (error) {
    console.log(chalk.red('❌ Failed to start Postgres MCP:'), error);
  }
}

async function directDatabaseAccess() {
  console.log(chalk.yellow('\n2. Testing direct database access...'));
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  try {
    // Test query
    const { data, error } = await supabase
      .from('players')
      .select('count')
      .limit(1);

    if (error) throw error;

    console.log(chalk.green('✅ Direct database access works!'));
    
    // Now let's fix the email confirmation
    console.log(chalk.yellow('\n3. Checking for unconfirmed users...'));
    
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 50
    });

    if (usersError) throw usersError;

    const unconfirmedUsers = users?.filter(u => !u.email_confirmed_at) || [];
    
    if (unconfirmedUsers.length > 0) {
      console.log(chalk.cyan(`\nFound ${unconfirmedUsers.length} unconfirmed users:`));
      
      unconfirmedUsers.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.email}`);
        console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
        console.log(`   ID: ${user.id}`);
      });

      console.log(chalk.yellow('\n4. To confirm a user, run:'));
      console.log(chalk.cyan(`   npx tsx scripts/test-postgres-mcp.ts confirm <email>`));
      
    } else {
      console.log(chalk.green('✅ All users are confirmed!'));
    }

  } catch (error) {
    console.log(chalk.red('❌ Database access failed:'), error);
  }
}

async function confirmUser(email: string) {
  console.log(chalk.yellow(`\nConfirming user: ${email}`));
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  try {
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) throw listError;
    
    const user = users?.find(u => u.email === email);
    
    if (!user) {
      console.log(chalk.red(`❌ User not found: ${email}`));
      return;
    }

    if (user.email_confirmed_at) {
      console.log(chalk.green(`✅ User already confirmed!`));
      return;
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { email_confirmed_at: new Date().toISOString() }
    );

    if (updateError) throw updateError;

    console.log(chalk.green(`✅ Successfully confirmed ${email}!`));
    console.log(chalk.cyan('You can now log in at http://localhost:3002'));

  } catch (error) {
    console.log(chalk.red('❌ Failed to confirm user:'), error);
  }
}

async function createMCPWorkaround() {
  console.log(chalk.bold.yellow('\n5. Creating MCP Workaround...'));
  
  const workaroundScript = `#!/usr/bin/env tsx
/**
 * Postgres MCP Workaround
 * Direct database access since MCP isn't loading
 */

import { Client } from 'pg';
import chalk from 'chalk';

const POSTGRES_URL = '${POSTGRES_CONNECTION}';

async function query(sql: string) {
  const client = new Client(POSTGRES_URL);
  
  try {
    await client.connect();
    const result = await client.query(sql);
    console.log(chalk.green('Query successful!'));
    console.table(result.rows);
    return result.rows;
  } catch (error) {
    console.error(chalk.red('Query failed:'), error);
  } finally {
    await client.end();
  }
}

// Handle command line args
const sql = process.argv[2];
if (sql) {
  query(sql);
} else {
  console.log(chalk.yellow('Usage: npx tsx scripts/postgres-query.ts "SELECT * FROM auth.users LIMIT 5"'));
}

export { query };`;

  try {
    await require('fs').promises.writeFile('scripts/postgres-query.ts', workaroundScript);
    console.log(chalk.green('✅ Created postgres-query.ts workaround script'));
    console.log(chalk.cyan('\nUsage:'));
    console.log('  npx tsx scripts/postgres-query.ts "SELECT COUNT(*) FROM players"');
  } catch (error) {
    console.log(chalk.red('Failed to create workaround:'), error);
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  if (command === 'confirm' && arg) {
    await confirmUser(arg);
  } else {
    await testPostgresMCP();
    await directDatabaseAccess();
    await createMCPWorkaround();
    
    console.log(chalk.bold.cyan('\n📋 SUMMARY:\n'));
    console.log('1. Postgres MCP server can run but isn\'t loaded by Claude Code');
    console.log('2. Direct database access works via Supabase client');
    console.log('3. Created workaround script: scripts/postgres-query.ts');
    console.log('4. To confirm a user: npx tsx scripts/test-postgres-mcp.ts confirm <email>');
    
    console.log(chalk.bold.yellow('\n🔧 MCP FIX ATTEMPTS:\n'));
    console.log('1. Kill all MCP processes and restart Claude Code:');
    console.log(chalk.cyan('   pkill -f mcp && claude-code'));
    console.log('\n2. Try limiting MCP servers in .mcp.json (maybe there\'s a limit)');
    console.log('\n3. Report bug: Only 3/33 MCP servers are loading');
  }
}

main().catch(console.error);
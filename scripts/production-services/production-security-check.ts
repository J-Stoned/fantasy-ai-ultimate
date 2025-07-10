#!/usr/bin/env tsx
/**
 * PRODUCTION SECURITY VERIFICATION SCRIPT
 * By Marcus "The Fixer" Rodriguez
 * 
 * This ACTUALLY checks if your database is secure!
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(chalk.red('❌ Missing environment variables!'));
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkRLSStatus() {
  console.log(chalk.blue.bold('\n🔒 PRODUCTION SECURITY CHECK\n'));
  
  // Get all tables
  const { data: tables, error } = await supabase
    .from('pg_tables')
    .select('tablename')
    .eq('schemaname', 'public')
    .not('tablename', 'in', '(schema_migrations,spatial_ref_sys)');
    
  if (error) {
    console.error(chalk.red('Failed to fetch tables:'), error);
    return;
  }
  
  console.log(chalk.yellow(`Found ${tables?.length || 0} tables to check...\n`));
  
  let secureCount = 0;
  let insecureCount = 0;
  const insecureTables: string[] = [];
  
  // Check RLS status for each table
  for (const table of tables || []) {
    const { data: rlsStatus } = await supabase.rpc('check_rls_enabled', {
      table_name: table.tablename
    }).single();
    
    if (rlsStatus?.enabled) {
      console.log(chalk.green(`✅ ${table.tablename} - RLS ENABLED`));
      secureCount++;
    } else {
      console.log(chalk.red(`❌ ${table.tablename} - RLS DISABLED`));
      insecureCount++;
      insecureTables.push(table.tablename);
    }
  }
  
  // Summary
  console.log(chalk.blue.bold('\n📊 SECURITY SUMMARY\n'));
  console.log(`Total Tables: ${tables?.length || 0}`);
  console.log(chalk.green(`Secure (RLS Enabled): ${secureCount}`));
  console.log(chalk.red(`Insecure (RLS Disabled): ${insecureCount}`));
  
  if (insecureCount > 0) {
    console.log(chalk.red.bold('\n⚠️  SECURITY RISK: The following tables need RLS:'));
    insecureTables.forEach(t => console.log(chalk.red(`  - ${t}`)));
    
    console.log(chalk.yellow('\n🔧 TO FIX: Run this SQL in Supabase:'));
    console.log(chalk.cyan(`
-- Enable RLS on insecure tables
${insecureTables.map(t => `ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`).join('\n')}
    `));
  } else {
    console.log(chalk.green.bold('\n✅ ALL TABLES ARE SECURE!'));
  }
  
  // Check for missing auth on API routes
  console.log(chalk.blue.bold('\n🔍 Checking API Route Security...\n'));
  
  const apiRoutes = [
    '/api/mcp/servers/test',
    '/api/mcp/workflows',
    '/api/mcp/status',
    '/api/voice/process',
    '/api/ar/player-stats'
  ];
  
  for (const route of apiRoutes) {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${route}`, {
        method: route.includes('servers') || route.includes('workflows') ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        body: route.includes('servers') || route.includes('workflows') ? JSON.stringify({ action: 'test' }) : undefined
      });
      
      if (response.status === 401) {
        console.log(chalk.green(`✅ ${route} - Requires authentication`));
      } else if (response.status === 200) {
        console.log(chalk.red(`❌ ${route} - NO AUTHENTICATION!`));
      } else {
        console.log(chalk.yellow(`⚠️  ${route} - Status: ${response.status}`));
      }
    } catch (error) {
      console.log(chalk.gray(`⏭️  ${route} - Skipped (not running)`));
    }
  }
  
  console.log(chalk.blue.bold('\n🏁 SECURITY CHECK COMPLETE!\n'));
}

// Create RLS check function if it doesn't exist
async function createRLSCheckFunction() {
  const functionSQL = `
CREATE OR REPLACE FUNCTION check_rls_enabled(table_name text)
RETURNS TABLE(enabled boolean) AS $$
BEGIN
  RETURN QUERY
  SELECT relrowsecurity 
  FROM pg_class 
  WHERE relname = table_name 
  AND relnamespace = 'public'::regnamespace;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  
  await supabase.rpc('exec_sql', { sql: functionSQL }).catch(() => {
    // Function might already exist
  });
}

// Run the check
async function main() {
  await createRLSCheckFunction();
  await checkRLSStatus();
}

main().catch(console.error);
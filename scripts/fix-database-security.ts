#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

console.log('🔐 Fixing Supabase Database Security Issues\n');

// Get Supabase credentials
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZWt2cWlxcnJwdWdmbXBnYXVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTA0NTA1MiwiZXhwIjoyMDY2NjIxMDUyfQ.EzHZ-WJkjbCXEAVP750VEp38ge35nsjVQ_ajzXadbPE';

// Create Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration(migrationFile: string) {
  try {
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log(`📄 Running migration: ${migrationFile}`);
    console.log(`   SQL statements: ${sql.split(';').filter(s => s.trim()).length}`);
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error(`❌ Migration failed: ${error.message}`);
      return false;
    }
    
    console.log(`✅ Migration completed successfully!\n`);
    return true;
  } catch (err: any) {
    console.error(`❌ Error running migration: ${err.message}\n`);
    return false;
  }
}

async function checkSecurityStatus() {
  console.log('🔍 Checking current security status...\n');
  
  try {
    // Check RLS status on tables
    const { data: tables, error: tablesError } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT 
          schemaname,
          tablename,
          rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename;
      `
    });
    
    if (tablesError) {
      console.error('Error checking table security:', tablesError);
      return;
    }
    
    const rlsDisabled = tables.filter((t: any) => !t.rowsecurity);
    console.log(`📊 Tables without RLS: ${rlsDisabled.length}/${tables.length}`);
    
    // Check for SECURITY DEFINER views
    const { data: views, error: viewsError } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT 
          schemaname,
          viewname,
          definition
        FROM pg_views
        WHERE schemaname = 'public'
          AND definition LIKE '%SECURITY DEFINER%';
      `
    });
    
    if (viewsError) {
      console.error('Error checking view security:', viewsError);
      return;
    }
    
    console.log(`👁️  Views with SECURITY DEFINER: ${views?.length || 0}\n`);
    
    return {
      tablesWithoutRLS: rlsDisabled.length,
      viewsWithSecurityDefiner: views?.length || 0
    };
  } catch (err: any) {
    console.error('Error checking security status:', err.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting Supabase Security Fix\n');
  console.log('Project:', SUPABASE_URL);
  console.log('');
  
  // Check initial status
  const beforeStatus = await checkSecurityStatus();
  
  if (!beforeStatus) {
    console.error('❌ Could not check security status. Make sure:');
    console.error('   1. Database is not paused');
    console.error('   2. Service role key is correct');
    console.error('   3. Network connection is working');
    return;
  }
  
  // If exec_sql RPC doesn't exist, we need to use Supabase CLI or dashboard
  if (beforeStatus.tablesWithoutRLS === 0 && beforeStatus.viewsWithSecurityDefiner === 0) {
    console.log('✅ No security issues found! Your database is already secure.');
    return;
  }
  
  console.log('\n⚠️  Security issues found. To fix them:\n');
  console.log('Option 1: Use Supabase Dashboard (Recommended)');
  console.log('1. Go to: https://supabase.com/dashboard/project/pvekvqiqrrpugfmpgaup/sql/new');
  console.log('2. Copy and paste the SQL from these files:');
  console.log('   - supabase/migrations/20250109_enable_rls_security.sql');
  console.log('   - supabase/migrations/20250109_fix_security_definer_views.sql');
  console.log('3. Click "Run" to execute each migration\n');
  
  console.log('Option 2: Use Supabase CLI');
  console.log('1. Install Supabase CLI: npm install -g supabase');
  console.log('2. Login: supabase login');
  console.log('3. Link project: supabase link --project-ref pvekvqiqrrpugfmpgaup');
  console.log('4. Run migrations: supabase db push\n');
  
  console.log('Option 3: Use psql directly');
  console.log('1. Install PostgreSQL client');
  console.log('2. Connect: psql "postgresql://postgres:IL36Z9I7tV2629Lr@db.pvekvqiqrrpugfmpgaup.supabase.co:5432/postgres"');
  console.log('3. Run the SQL files manually\n');
  
  console.log('📁 Migration files created:');
  console.log('   - supabase/migrations/20250109_enable_rls_security.sql');
  console.log('   - supabase/migrations/20250109_fix_security_definer_views.sql');
}

// Run the script
main().catch(console.error);
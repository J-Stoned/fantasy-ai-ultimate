#!/usr/bin/env tsx
/**
 * AUTO-ENABLE RLS SCRIPT
 * 
 * Uses Supabase's SQL execution endpoint to enable RLS on all tables
 */

import chalk from 'chalk';

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZWt2cWlxcnJwdWdmbXBnYXVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwNDUwNTIsImV4cCI6MjA2NjYyMTA1Mn0.NhVUmDfHDzfch4cldZDOnd8DveAJbBYqv7zKJ6tNqi4';

// You need the service role key to execute SQL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error(chalk.red.bold('\n❌ ERROR: SUPABASE_SERVICE_ROLE_KEY is required to execute SQL commands\n'));
  console.log(chalk.yellow('To find your service role key:'));
  console.log('1. Go to https://app.supabase.com');
  console.log('2. Select your project: pvekvqiqrrpugfmpgaup');
  console.log('3. Go to Settings → API');
  console.log('4. Copy the service_role key (starts with eyJ...)');
  console.log('5. Add to your .env.local file:\n');
  console.log(chalk.gray('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here\n'));
  process.exit(1);
}

// SQL to enable RLS on all exposed tables
const ENABLE_RLS_SQL = `
-- EMERGENCY RLS ENABLEMENT
-- Enable RLS on all exposed tables

DO $$ 
DECLARE 
    tables_secured INTEGER := 0;
BEGIN
    -- User data tables
    ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.platform_connections ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.fantasy_leagues ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.fantasy_teams ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.import_history ENABLE ROW LEVEL SECURITY;
    
    -- Sports data tables
    ALTER TABLE IF EXISTS public.sports ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.leagues ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.teams_master ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.players ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.player_stats ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.player_game_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.player_injuries ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.player_trends ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.matchup_history ENABLE ROW LEVEL SECURITY;
    
    -- Financial tables
    ALTER TABLE IF EXISTS public.player_contracts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.nil_deals ENABLE ROW LEVEL SECURITY;
    
    -- Content tables
    ALTER TABLE IF EXISTS public.news_articles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.social_mentions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.weather_conditions ENABLE ROW LEVEL SECURITY;
    
    -- Educational tables
    ALTER TABLE IF EXISTS public.schools ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.conferences ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.recruiting_profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.combine_results ENABLE ROW LEVEL SECURITY;
    
    -- Equipment tables
    ALTER TABLE IF EXISTS public.equipment_brands ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.equipment_models ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.player_equipment ENABLE ROW LEVEL SECURITY;
    
    -- Platform tables
    ALTER TABLE IF EXISTS public.player_platform_mapping ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.sync_logs ENABLE ROW LEVEL SECURITY;
    
    -- Count secured tables
    SELECT COUNT(*) INTO tables_secured
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND rowsecurity = true;
    
    RAISE NOTICE 'Successfully secured % tables', tables_secured;
END $$;

-- Create basic policies for user tables
-- Users can only see their own data
CREATE POLICY IF NOT EXISTS "Users can view own profile" 
ON public.user_profiles FOR SELECT 
USING (auth.uid()::text = "userId");

CREATE POLICY IF NOT EXISTS "Users can update own profile" 
ON public.user_profiles FOR UPDATE 
USING (auth.uid()::text = "userId");

CREATE POLICY IF NOT EXISTS "Users can view own fantasy teams" 
ON public.fantasy_teams FOR SELECT 
USING (auth.uid()::text = "userId");

CREATE POLICY IF NOT EXISTS "Users can view own fantasy leagues" 
ON public.fantasy_leagues FOR SELECT 
USING (auth.uid()::text = "userId");

-- Make sports data read-only for authenticated users
CREATE POLICY IF NOT EXISTS "Public sports data readable" 
ON public.sports FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY IF NOT EXISTS "Public leagues data readable" 
ON public.leagues FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY IF NOT EXISTS "Public teams data readable" 
ON public.teams_master FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY IF NOT EXISTS "Public players data readable" 
ON public.players FOR SELECT 
TO authenticated
USING (true);

-- Return security status
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY rowsecurity DESC, tablename;
`;

async function executeSQL(sql: string) {
  try {
    // Supabase doesn't have a direct SQL execution endpoint in the REST API
    // We need to use RPC or the service role key with a different approach
    
    console.log(chalk.red.bold('\n⚠️  AUTOMATED SQL EXECUTION NOT AVAILABLE VIA REST API\n'));
    console.log(chalk.yellow('You need to manually execute the SQL in Supabase:\n'));
    console.log('1. Go to https://app.supabase.com');
    console.log('2. Select your project');
    console.log('3. Go to SQL Editor');
    console.log('4. Create a new query');
    console.log('5. Paste the following SQL:\n');
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.cyan(sql));
    console.log(chalk.gray('─'.repeat(60)));
    
    // Save to file for easy copy
    const fs = await import('fs/promises');
    const sqlFile = 'scripts/emergency-enable-rls.sql';
    await fs.writeFile(sqlFile, sql);
    console.log(chalk.green(`\n✅ SQL saved to: ${sqlFile}`));
    console.log(chalk.yellow('You can also copy from this file\n'));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
  }
}

async function main() {
  console.log(chalk.red.bold('🚨 EMERGENCY RLS ENABLEMENT 🚨\n'));
  
  console.log(chalk.yellow('This script will generate SQL to:'));
  console.log('• Enable RLS on all 28 exposed tables');
  console.log('• Create basic security policies');
  console.log('• Block all anonymous access\n');
  
  await executeSQL(ENABLE_RLS_SQL);
  
  console.log(chalk.green.bold('\n✅ After running the SQL:'));
  console.log('1. Run: npm run security:rls:check');
  console.log('2. Verify security score is 100%');
  console.log('3. Test your app to ensure policies work correctly\n');
}

main().catch(console.error);
-- 🚨 EMERGENCY RLS FIX V2 - MORE ROBUST VERSION! 🚨
-- Fixes all potential issues we discovered
-- Run this entire script in Supabase SQL Editor

-- ============================================
-- STEP 1: ENABLE RLS ON ALL EXPOSED TABLES
-- ============================================
-- This is safe to run multiple times

-- User data tables (CRITICAL - contains personal data!)
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

-- Financial tables (SENSITIVE!)
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

-- ============================================
-- STEP 2: DROP EXISTING POLICIES (CLEAN SLATE)
-- ============================================
-- This prevents duplicate policy errors

DO $$ 
DECLARE 
    pol RECORD;
BEGIN
    -- Drop all existing policies on our tables
    FOR pol IN 
        SELECT schemaname, tablename, policyname
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN (
            'user_profiles', 'platform_connections', 'fantasy_leagues',
            'fantasy_teams', 'import_history', 'sports', 'leagues',
            'teams_master', 'players', 'player_stats', 'player_game_logs',
            'player_injuries', 'player_trends', 'matchup_history',
            'player_contracts', 'nil_deals', 'news_articles',
            'social_mentions', 'weather_conditions', 'schools',
            'conferences', 'recruiting_profiles', 'combine_results',
            'equipment_brands', 'equipment_models', 'player_equipment',
            'player_platform_mapping', 'sync_logs'
        )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', 
            pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- ============================================
-- STEP 3: REVOKE DEFAULT PERMISSIONS
-- ============================================

-- Revoke from anon (anonymous users)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- ============================================
-- STEP 4: CREATE POLICIES FOR USER TABLES
-- ============================================

-- USER PROFILES
CREATE POLICY "Users can view own profile" 
ON public.user_profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
ON public.user_profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" 
ON public.user_profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- FANTASY TEAMS
CREATE POLICY "Users can view own fantasy teams" 
ON public.fantasy_teams FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create fantasy teams" 
ON public.fantasy_teams FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fantasy teams" 
ON public.fantasy_teams FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fantasy teams" 
ON public.fantasy_teams FOR DELETE 
USING (auth.uid() = user_id);

-- FANTASY LEAGUES  
CREATE POLICY "Users can view own leagues" 
ON public.fantasy_leagues FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create leagues" 
ON public.fantasy_leagues FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leagues" 
ON public.fantasy_leagues FOR UPDATE 
USING (auth.uid() = user_id);

-- PLATFORM CONNECTIONS
CREATE POLICY "Users can view own connections" 
ON public.platform_connections FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create connections" 
ON public.platform_connections FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections" 
ON public.platform_connections FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connections" 
ON public.platform_connections FOR DELETE 
USING (auth.uid() = user_id);

-- IMPORT HISTORY
CREATE POLICY "Users can view own imports" 
ON public.import_history FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create imports" 
ON public.import_history FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- STEP 5: PUBLIC READ-ONLY SPORTS DATA
-- ============================================

-- These tables are read-only for all authenticated users
DO $$ 
DECLARE 
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'sports', 'leagues', 'teams_master', 'players',
        'player_stats', 'player_game_logs', 'player_injuries',
        'player_trends', 'matchup_history', 'schools',
        'conferences', 'equipment_brands', 'equipment_models'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        -- Create read policy for authenticated users
        EXECUTE format(
            'CREATE POLICY "Authenticated users can read %I" ON public.%I FOR SELECT TO authenticated USING (true);',
            tbl, tbl
        );
        
        -- Create policy for service role to manage data
        EXECUTE format(
            'CREATE POLICY "Service role can manage %I" ON public.%I FOR ALL TO service_role USING (true);',
            tbl, tbl
        );
    END LOOP;
END $$;

-- ============================================
-- STEP 6: CONTENT TABLES (READ-ONLY)
-- ============================================

-- News and weather - authenticated read, service write
CREATE POLICY "Authenticated can read news" 
ON public.news_articles FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service can manage news" 
ON public.news_articles FOR ALL 
TO service_role USING (true);

CREATE POLICY "Authenticated can read weather" 
ON public.weather_conditions FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service can manage weather" 
ON public.weather_conditions FOR ALL 
TO service_role USING (true);

CREATE POLICY "Authenticated can read social mentions" 
ON public.social_mentions FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service can manage social mentions" 
ON public.social_mentions FOR ALL 
TO service_role USING (true);

-- ============================================
-- STEP 7: RESTRICTED TABLES (SERVICE ONLY)
-- ============================================

-- Financial data - service role only
CREATE POLICY "Service role only - contracts" 
ON public.player_contracts FOR ALL 
TO service_role USING (true);

CREATE POLICY "Service role only - NIL deals" 
ON public.nil_deals FOR ALL 
TO service_role USING (true);

-- Sync logs - service role only
CREATE POLICY "Service role only - sync logs" 
ON public.sync_logs FOR ALL 
TO service_role USING (true);

-- Recruiting profiles - authenticated read, service write
CREATE POLICY "Authenticated can read recruiting" 
ON public.recruiting_profiles FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service can manage recruiting" 
ON public.recruiting_profiles FOR ALL 
TO service_role USING (true);

-- Combine results - authenticated read, service write
CREATE POLICY "Authenticated can read combine" 
ON public.combine_results FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service can manage combine" 
ON public.combine_results FOR ALL 
TO service_role USING (true);

-- Player equipment - authenticated read, service write
CREATE POLICY "Authenticated can read equipment" 
ON public.player_equipment FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service can manage equipment" 
ON public.player_equipment FOR ALL 
TO service_role USING (true);

-- Platform mapping - service role only
CREATE POLICY "Service role only - platform mapping" 
ON public.player_platform_mapping FOR ALL 
TO service_role USING (true);

-- ============================================
-- STEP 8: GRANT NECESSARY PERMISSIONS
-- ============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant sequence usage for authenticated users (for inserts)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- STEP 9: VERIFY SECURITY
-- ============================================

-- Create temporary tables for reporting
CREATE TEMP TABLE IF NOT EXISTS security_report AS
SELECT 
    t.tablename,
    t.rowsecurity as has_rls,
    COUNT(p.policyname) as policy_count,
    CASE 
        WHEN t.rowsecurity AND COUNT(p.policyname) > 0 THEN '✅ SECURED'
        WHEN t.rowsecurity AND COUNT(p.policyname) = 0 THEN '⚠️  RLS ON but NO POLICIES'
        ELSE '❌ EXPOSED'
    END as status
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY 
    CASE 
        WHEN t.rowsecurity AND COUNT(p.policyname) > 0 THEN 1
        WHEN t.rowsecurity AND COUNT(p.policyname) = 0 THEN 2
        ELSE 3
    END,
    t.tablename;

-- Display report
SELECT * FROM security_report;

-- Summary
DO $$
DECLARE
    total_tables INTEGER;
    secured_tables INTEGER;
    rls_no_policy INTEGER;
    exposed_tables INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_tables FROM security_report;
    SELECT COUNT(*) INTO secured_tables FROM security_report WHERE status = '✅ SECURED';
    SELECT COUNT(*) INTO rls_no_policy FROM security_report WHERE status = '⚠️  RLS ON but NO POLICIES';
    SELECT COUNT(*) INTO exposed_tables FROM security_report WHERE status = '❌ EXPOSED';
    
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'RLS SECURITY REPORT';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Total tables: %', total_tables;
    RAISE NOTICE 'Secured (RLS + Policies): %', secured_tables;
    RAISE NOTICE 'RLS enabled (no policies): %', rls_no_policy;
    RAISE NOTICE 'Completely exposed: %', exposed_tables;
    RAISE NOTICE 'Security score: %', ROUND((secured_tables::numeric / total_tables::numeric) * 100) || '%';
    RAISE NOTICE '===========================================';
    
    IF secured_tables = total_tables THEN
        RAISE NOTICE '✅ ALL TABLES ARE NOW SECURED!';
    ELSIF exposed_tables = 0 THEN
        RAISE NOTICE '✅ RLS is enabled on all tables!';
        RAISE NOTICE '⚠️  Some tables lack policies - they are inaccessible';
    ELSE
        RAISE NOTICE '❌ Some tables are still exposed!';
    END IF;
END $$;

-- List tables without policies
SELECT tablename as "Tables with RLS but no policies"
FROM security_report 
WHERE has_rls = true AND policy_count = 0
ORDER BY tablename;
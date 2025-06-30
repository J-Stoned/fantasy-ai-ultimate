-- COMPREHENSIVE RLS ENABLEMENT SCRIPT
-- Run this in Supabase SQL Editor to secure all tables
-- Generated: 2025-06-29

-- First, enable RLS on all user tables
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Enable RLS on all tables in public schema
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND tablename NOT IN ('schema_migrations', 'spatial_ref_sys')
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
        RAISE NOTICE 'Enabled RLS on table: %', r.tablename;
    END LOOP;
END $$;

-- Core User Tables Policies
-- user_profiles: Users can only see and modify their own profile
CREATE POLICY IF NOT EXISTS "Users can view own profile" ON public.user_profiles
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own profile" ON public.user_profiles
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own profile" ON public.user_profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Public read-only tables (sports data)
CREATE POLICY IF NOT EXISTS "Public read access" ON public.sports
    FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Public read access" ON public.leagues
    FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Public read access" ON public.teams_master
    FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Public read access" ON public.players
    FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Public read access" ON public.player_stats
    FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Public read access" ON public.player_game_logs
    FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Public read access" ON public.player_injuries
    FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Public read access" ON public.schools
    FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Public read access" ON public.conferences
    FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Public read access" ON public.equipment_brands
    FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Public read access" ON public.equipment_models
    FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Public read access" ON public.weather_conditions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Public read access" ON public.news_articles
    FOR SELECT TO authenticated USING (true);

-- Fantasy league data (user-specific)
CREATE POLICY IF NOT EXISTS "Users can view own fantasy leagues" ON public.fantasy_leagues
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can create fantasy leagues" ON public.fantasy_leagues
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own fantasy leagues" ON public.fantasy_leagues
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete own fantasy leagues" ON public.fantasy_leagues
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Fantasy teams (league member access)
CREATE POLICY IF NOT EXISTS "League members can view teams" ON public.fantasy_teams
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.fantasy_leagues
            WHERE fantasy_leagues.id = fantasy_teams.league_id
            AND fantasy_leagues.user_id = auth.uid()
        )
        OR user_id = auth.uid()
    );

CREATE POLICY IF NOT EXISTS "Users can manage own teams" ON public.fantasy_teams
    FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Platform connections (sensitive - user only)
CREATE POLICY IF NOT EXISTS "Users can view own connections" ON public.platform_connections
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can create own connections" ON public.platform_connections
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own connections" ON public.platform_connections
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete own connections" ON public.platform_connections
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Import history (user-specific)
CREATE POLICY IF NOT EXISTS "Users can view own import history" ON public.import_history
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can create import records" ON public.import_history
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Sensitive financial data (restricted access)
-- Only allow system/admin access to these tables
CREATE POLICY IF NOT EXISTS "No public access to contracts" ON public.player_contracts
    FOR SELECT TO authenticated USING (false);

CREATE POLICY IF NOT EXISTS "No public access to NIL deals" ON public.nil_deals
    FOR SELECT TO authenticated USING (false);

-- Player platform mapping (read-only for authenticated users)
CREATE POLICY IF NOT EXISTS "Authenticated users can read mappings" ON public.player_platform_mapping
    FOR SELECT TO authenticated USING (true);

-- Sync logs (system use only)
CREATE POLICY IF NOT EXISTS "No direct access to sync logs" ON public.sync_logs
    FOR SELECT TO authenticated USING (false);

-- Player trends and analytics (read access)
CREATE POLICY IF NOT EXISTS "Public read access to trends" ON public.player_trends
    FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Public read access to matchup history" ON public.matchup_history
    FOR SELECT TO authenticated USING (true);

-- Social mentions (public read)
CREATE POLICY IF NOT EXISTS "Public read access to social mentions" ON public.social_mentions
    FOR SELECT TO authenticated USING (true);

-- Recruiting profiles (public read)
CREATE POLICY IF NOT EXISTS "Public read access to recruiting" ON public.recruiting_profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Public read access to combine results" ON public.combine_results
    FOR SELECT TO authenticated USING (true);

-- Player equipment (public read)
CREATE POLICY IF NOT EXISTS "Public read access to player equipment" ON public.player_equipment
    FOR SELECT TO authenticated USING (true);

-- Revolutionary feature tables (if they exist)
DO $$
BEGIN
    -- Quantum correlations
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'quantum_correlations') THEN
        CREATE POLICY IF NOT EXISTS "Authenticated read quantum data" ON public.quantum_correlations
            FOR SELECT TO authenticated USING (true);
    END IF;

    -- Neural nodes
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'neural_nodes') THEN
        CREATE POLICY IF NOT EXISTS "Users view own neural data" ON public.neural_nodes
            FOR SELECT TO authenticated USING (auth.uid() = user_id);
    END IF;

    -- Biometric analyses
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'biometric_analyses') THEN
        CREATE POLICY IF NOT EXISTS "No public biometric access" ON public.biometric_analyses
            FOR SELECT TO authenticated USING (false);
    END IF;

    -- AR sessions
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'ar_sessions') THEN
        CREATE POLICY IF NOT EXISTS "Users view own AR sessions" ON public.ar_sessions
            FOR SELECT TO authenticated USING (auth.uid() = user_id);
    END IF;

    -- Voice interactions
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'voice_interactions') THEN
        CREATE POLICY IF NOT EXISTS "Users view own voice data" ON public.voice_interactions
            FOR SELECT TO authenticated USING (auth.uid() = user_id);
    END IF;

    -- AI coach sessions
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'ai_coach_sessions') THEN
        CREATE POLICY IF NOT EXISTS "Users view own coach sessions" ON public.ai_coach_sessions
            FOR SELECT TO authenticated USING (auth.uid() = user_id);
    END IF;

    -- Agent interactions
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'agent_interactions') THEN
        CREATE POLICY IF NOT EXISTS "Users view own agent data" ON public.agent_interactions
            FOR SELECT TO authenticated USING (auth.uid() = user_id);
    END IF;

    -- Memory contexts
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'memory_contexts') THEN
        CREATE POLICY IF NOT EXISTS "Users view own memory data" ON public.memory_contexts
            FOR SELECT TO authenticated USING (auth.uid() = user_id);
    END IF;
END $$;

-- Create a security audit function
CREATE OR REPLACE FUNCTION check_rls_status()
RETURNS TABLE (
    schema_name text,
    table_name text,
    rls_enabled boolean,
    policy_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.schemaname::text,
        t.tablename::text,
        t.rowsecurity,
        COUNT(p.policyname)
    FROM pg_tables t
    LEFT JOIN pg_policies p ON t.schemaname = p.schemaname AND t.tablename = p.tablename
    WHERE t.schemaname = 'public'
    GROUP BY t.schemaname, t.tablename, t.rowsecurity
    ORDER BY t.tablename;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the audit function
GRANT EXECUTE ON FUNCTION check_rls_status() TO authenticated;

-- Display the RLS status
SELECT * FROM check_rls_status();

-- Summary message
DO $$
DECLARE
    total_tables integer;
    secured_tables integer;
    total_policies integer;
BEGIN
    SELECT COUNT(*) INTO total_tables FROM pg_tables WHERE schemaname = 'public';
    SELECT COUNT(*) INTO secured_tables FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;
    SELECT COUNT(*) INTO total_policies FROM pg_policies WHERE schemaname = 'public';
    
    RAISE NOTICE '';
    RAISE NOTICE '=== RLS SECURITY SUMMARY ===';
    RAISE NOTICE 'Total tables: %', total_tables;
    RAISE NOTICE 'Tables with RLS enabled: %', secured_tables;
    RAISE NOTICE 'Total policies created: %', total_policies;
    RAISE NOTICE '';
    
    IF secured_tables = total_tables THEN
        RAISE NOTICE '✅ ALL TABLES ARE NOW SECURED WITH RLS!';
    ELSE
        RAISE NOTICE '⚠️  Some tables may still need RLS enabled';
    END IF;
END $$;
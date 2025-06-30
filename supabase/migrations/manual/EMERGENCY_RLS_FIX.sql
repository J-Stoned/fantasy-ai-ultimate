-- 🚨 EMERGENCY RLS FIX - RUN THIS NOW! 🚨
-- Your database has 28 exposed tables with 0% security
-- Run this entire script in Supabase SQL Editor

-- ============================================
-- STEP 1: ENABLE RLS ON ALL EXPOSED TABLES
-- ============================================

-- User data tables (CRITICAL - contains personal data!)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fantasy_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fantasy_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

-- Sports data tables
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_game_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_injuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchup_history ENABLE ROW LEVEL SECURITY;

-- Financial tables (SENSITIVE!)
ALTER TABLE public.player_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nil_deals ENABLE ROW LEVEL SECURITY;

-- Content tables
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_conditions ENABLE ROW LEVEL SECURITY;

-- Educational tables
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiting_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combine_results ENABLE ROW LEVEL SECURITY;

-- Equipment tables
ALTER TABLE public.equipment_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_equipment ENABLE ROW LEVEL SECURITY;

-- Platform tables
ALTER TABLE public.player_platform_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: REVOKE ALL PUBLIC ACCESS
-- ============================================

-- Remove all permissions from anonymous users
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- ============================================
-- STEP 3: CREATE SECURITY POLICIES
-- ============================================

-- User profiles - users can only see/edit their own
CREATE POLICY "Users view own profile" 
ON public.user_profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users update own profile" 
ON public.user_profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own profile" 
ON public.user_profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Fantasy teams - users manage their own
CREATE POLICY "Users view own fantasy teams" 
ON public.fantasy_teams FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users create fantasy teams" 
ON public.fantasy_teams FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own fantasy teams" 
ON public.fantasy_teams FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own fantasy teams" 
ON public.fantasy_teams FOR DELETE 
USING (auth.uid() = user_id);

-- Fantasy leagues - users see their own
CREATE POLICY "Users view own leagues" 
ON public.fantasy_leagues FOR SELECT 
USING (auth.uid() = user_id);

-- Platform connections - private to user
CREATE POLICY "Users view own connections" 
ON public.platform_connections FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users manage own connections" 
ON public.platform_connections FOR ALL 
USING (auth.uid() = user_id);

-- Import history - private to user  
CREATE POLICY "Users view own imports" 
ON public.import_history FOR SELECT 
USING (auth.uid() = user_id);

-- ============================================
-- STEP 4: PUBLIC READ-ONLY DATA
-- ============================================

-- Sports reference data - authenticated users can read
CREATE POLICY "Authenticated read sports" 
ON public.sports FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated read leagues" 
ON public.leagues FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated read teams" 
ON public.teams_master FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated read players" 
ON public.players FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated read player stats" 
ON public.player_stats FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated read game logs" 
ON public.player_game_logs FOR SELECT 
TO authenticated 
USING (true);

-- News/content - authenticated can read
CREATE POLICY "Authenticated read news" 
ON public.news_articles FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated read weather" 
ON public.weather_conditions FOR SELECT 
TO authenticated 
USING (true);

-- ============================================
-- STEP 5: ADMIN-ONLY TABLES
-- ============================================

-- Financial data - admin only (no policies = no access)
-- player_contracts - NO POLICIES (admin only)
-- nil_deals - NO POLICIES (admin only)

-- Sync logs - service role only
-- sync_logs - NO POLICIES (service only)

-- ============================================
-- STEP 6: VERIFY SECURITY
-- ============================================

-- Check which tables now have RLS enabled
SELECT 
    tablename,
    rowsecurity as "RLS Enabled",
    CASE 
        WHEN rowsecurity THEN '✅ SECURED'
        ELSE '❌ EXPOSED'
    END as "Status"
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY rowsecurity DESC, tablename;

-- Count policies per table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- FINAL MESSAGE
-- ============================================
DO $$
DECLARE
    secured_count INTEGER;
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM pg_tables WHERE schemaname = 'public';
    SELECT COUNT(*) INTO secured_count FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;
    
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'RLS SECURITY REPORT';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Total tables: %', total_count;
    RAISE NOTICE 'Secured tables: %', secured_count;
    RAISE NOTICE 'Security score: %', ROUND((secured_count::numeric / total_count::numeric) * 100) || '%';
    RAISE NOTICE '===========================================';
    
    IF secured_count = total_count THEN
        RAISE NOTICE '✅ ALL TABLES ARE NOW SECURED!';
    ELSE
        RAISE NOTICE '⚠️  Some tables may still be exposed!';
    END IF;
END $$;
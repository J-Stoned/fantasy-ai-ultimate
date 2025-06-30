-- 🚨 EMERGENCY RLS FIX - REMAINING 26 EXPOSED TABLES! 🚨
-- Your database has 26 MORE exposed tables we didn't know about!
-- Run this IMMEDIATELY after the first script

-- ============================================
-- STEP 1: ENABLE RLS ON ALL REMAINING TABLES
-- ============================================

-- AAU and Youth Sports
ALTER TABLE IF EXISTS public.aau_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.player_aau_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.high_school_leagues ENABLE ROW LEVEL SECURITY;

-- Betting and DFS (SENSITIVE!)
ALTER TABLE IF EXISTS public.betting_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.prop_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dfs_ownership_projections ENABLE ROW LEVEL SECURITY;

-- Development and Training
ALTER TABLE IF EXISTS public.development_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.player_development_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.player_training ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.training_facilities ENABLE ROW LEVEL SECURITY;

-- Equipment and Safety
ALTER TABLE IF EXISTS public.equipment_safety_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.injury_equipment_correlation ENABLE ROW LEVEL SECURITY;

-- Game Related
ALTER TABLE IF EXISTS public.game_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.game_officials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officials ENABLE ROW LEVEL SECURITY;

-- International
ALTER TABLE IF EXISTS public.international_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.international_rosters ENABLE ROW LEVEL SECURITY;

-- Marketing and Business (SENSITIVE!)
ALTER TABLE IF EXISTS public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sponsorship_deals ENABLE ROW LEVEL SECURITY;

-- Medical (HIPAA SENSITIVE!)
ALTER TABLE IF EXISTS public.medical_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.player_medical_history ENABLE ROW LEVEL SECURITY;

-- Player Analytics
ALTER TABLE IF EXISTS public.player_advanced_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.player_media ENABLE ROW LEVEL SECURITY;

-- Social Media (CONTAINS CREDENTIALS!)
ALTER TABLE IF EXISTS public.social_media_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.social_media_posts ENABLE ROW LEVEL SECURITY;

-- Team Analytics
ALTER TABLE IF EXISTS public.team_chemistry_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: REVOKE ACCESS FROM ANONYMOUS USERS
-- ============================================

-- Make sure anon role can't access these new tables
REVOKE ALL ON TABLE public.aau_teams FROM anon;
REVOKE ALL ON TABLE public.betting_lines FROM anon;
REVOKE ALL ON TABLE public.prop_bets FROM anon;
REVOKE ALL ON TABLE public.player_medical_history FROM anon;
REVOKE ALL ON TABLE public.sponsorship_deals FROM anon;
REVOKE ALL ON TABLE public.social_media_accounts FROM anon;

-- ============================================
-- STEP 3: CREATE POLICIES - HIGHLY SENSITIVE
-- ============================================

-- MEDICAL DATA (HIPAA) - SERVICE ROLE ONLY!
CREATE POLICY "Service role only - medical history" 
ON public.player_medical_history FOR ALL 
TO service_role USING (true);

CREATE POLICY "Service role only - medical providers" 
ON public.medical_providers FOR ALL 
TO service_role USING (true);

-- BETTING/GAMBLING DATA - SERVICE ROLE ONLY!
CREATE POLICY "Service role only - betting lines" 
ON public.betting_lines FOR ALL 
TO service_role USING (true);

CREATE POLICY "Service role only - prop bets" 
ON public.prop_bets FOR ALL 
TO service_role USING (true);

CREATE POLICY "Service role only - DFS projections" 
ON public.dfs_ownership_projections FOR ALL 
TO service_role USING (true);

-- FINANCIAL/BUSINESS - SERVICE ROLE ONLY!
CREATE POLICY "Service role only - sponsorships" 
ON public.sponsorship_deals FOR ALL 
TO service_role USING (true);

CREATE POLICY "Service role only - marketing" 
ON public.marketing_campaigns FOR ALL 
TO service_role USING (true);

-- SOCIAL MEDIA (MAY CONTAIN TOKENS) - SERVICE ROLE ONLY!
CREATE POLICY "Service role only - social accounts" 
ON public.social_media_accounts FOR ALL 
TO service_role USING (true);

CREATE POLICY "Service role only - social posts" 
ON public.social_media_posts FOR ALL 
TO service_role USING (true);

-- ============================================
-- STEP 4: CREATE POLICIES - PUBLIC READ DATA
-- ============================================

-- Youth sports - authenticated can read
CREATE POLICY "Authenticated read AAU teams" 
ON public.aau_teams FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service manage AAU teams" 
ON public.aau_teams FOR ALL 
TO service_role USING (true);

CREATE POLICY "Authenticated read AAU history" 
ON public.player_aau_history FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service manage AAU history" 
ON public.player_aau_history FOR ALL 
TO service_role USING (true);

CREATE POLICY "Authenticated read HS leagues" 
ON public.high_school_leagues FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service manage HS leagues" 
ON public.high_school_leagues FOR ALL 
TO service_role USING (true);

-- Development programs - authenticated read
CREATE POLICY "Authenticated read dev programs" 
ON public.development_programs FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service manage dev programs" 
ON public.development_programs FOR ALL 
TO service_role USING (true);

CREATE POLICY "Authenticated read dev history" 
ON public.player_development_history FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service manage dev history" 
ON public.player_development_history FOR ALL 
TO service_role USING (true);

-- Training - authenticated read
CREATE POLICY "Authenticated read training" 
ON public.player_training FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service manage training" 
ON public.player_training FOR ALL 
TO service_role USING (true);

CREATE POLICY "Authenticated read facilities" 
ON public.training_facilities FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service manage facilities" 
ON public.training_facilities FOR ALL 
TO service_role USING (true);

-- Equipment safety - authenticated read
CREATE POLICY "Authenticated read safety tests" 
ON public.equipment_safety_tests FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service manage safety tests" 
ON public.equipment_safety_tests FOR ALL 
TO service_role USING (true);

CREATE POLICY "Authenticated read injury correlation" 
ON public.injury_equipment_correlation FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service manage injury correlation" 
ON public.injury_equipment_correlation FOR ALL 
TO service_role USING (true);

-- Game data - authenticated read
CREATE POLICY "Authenticated read highlights" 
ON public.game_highlights FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service manage highlights" 
ON public.game_highlights FOR ALL 
TO service_role USING (true);

CREATE POLICY "Authenticated read game officials" 
ON public.game_officials FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service manage game officials" 
ON public.game_officials FOR ALL 
TO service_role USING (true);

CREATE POLICY "Authenticated read officials" 
ON public.officials FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service manage officials" 
ON public.officials FOR ALL 
TO service_role USING (true);

-- International - authenticated read
CREATE POLICY "Authenticated read intl competitions" 
ON public.international_competitions FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service manage intl competitions" 
ON public.international_competitions FOR ALL 
TO service_role USING (true);

CREATE POLICY "Authenticated read intl rosters" 
ON public.international_rosters FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service manage intl rosters" 
ON public.international_rosters FOR ALL 
TO service_role USING (true);

-- Analytics - authenticated read
CREATE POLICY "Authenticated read advanced metrics" 
ON public.player_advanced_metrics FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service manage advanced metrics" 
ON public.player_advanced_metrics FOR ALL 
TO service_role USING (true);

CREATE POLICY "Authenticated read player media" 
ON public.player_media FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service manage player media" 
ON public.player_media FOR ALL 
TO service_role USING (true);

CREATE POLICY "Authenticated read team chemistry" 
ON public.team_chemistry_metrics FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Service manage team chemistry" 
ON public.team_chemistry_metrics FOR ALL 
TO service_role USING (true);

-- ============================================
-- STEP 5: VERIFY ALL TABLES ARE SECURED
-- ============================================

-- Check final security status
SELECT 
    tablename,
    rowsecurity as "RLS Enabled",
    CASE 
        WHEN rowsecurity THEN '✅ SECURED'
        ELSE '❌ STILL EXPOSED!'
    END as "Status"
FROM pg_tables 
WHERE schemaname = 'public'
AND rowsecurity = false
ORDER BY tablename;

-- Final count
DO $$
DECLARE
    remaining_exposed INTEGER;
    total_tables INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_exposed 
    FROM pg_tables 
    WHERE schemaname = 'public' AND rowsecurity = false;
    
    SELECT COUNT(*) INTO total_tables 
    FROM pg_tables 
    WHERE schemaname = 'public';
    
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'FINAL SECURITY STATUS';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Total tables: %', total_tables;
    RAISE NOTICE 'Remaining exposed: %', remaining_exposed;
    
    IF remaining_exposed = 0 THEN
        RAISE NOTICE '✅ ALL TABLES ARE NOW SECURED! 🎉';
        RAISE NOTICE 'Security Score: 100%%';
    ELSE
        RAISE NOTICE '❌ STILL HAVE % EXPOSED TABLES!', remaining_exposed;
        RAISE NOTICE 'Run this script again or check for errors above';
    END IF;
    RAISE NOTICE '===========================================';
END $$;
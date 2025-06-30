-- MARCUS "THE FIXER" RODRIGUEZ - EMERGENCY RLS LOCKDOWN
-- Run this in Supabase SQL Editor NOW to secure your database

-- Enable RLS on ALL tables (this blocks all access by default)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
        RAISE NOTICE 'Enabled RLS on table: %', r.tablename;
    END LOOP;
END $$;

-- Revoke default permissions from anon and authenticated roles
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

-- Grant back only what's needed (adjust based on your needs)
-- Example: authenticated users can read specific tables
-- GRANT SELECT ON public.players TO authenticated;
-- GRANT SELECT ON public.teams TO authenticated;

-- Create basic RLS policies for critical tables
-- Example for user_profiles table (adjust table names as needed)
DO $$ 
BEGIN
    -- Users can only see their own profile
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_profiles') THEN
        CREATE POLICY "Users can view own profile" 
        ON public.user_profiles FOR SELECT 
        USING (auth.uid()::text = user_id);
        
        CREATE POLICY "Users can update own profile" 
        ON public.user_profiles FOR UPDATE 
        USING (auth.uid()::text = user_id);
    END IF;

    -- Add more policies for your other tables here
    -- Example for fantasy_teams:
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'fantasy_teams') THEN
        CREATE POLICY "Users can view own teams" 
        ON public.fantasy_teams FOR SELECT 
        USING (auth.uid()::text = user_id);
    END IF;
END $$;

-- Log the changes
INSERT INTO public.security_audit_log (action, timestamp, details)
VALUES (
    'EMERGENCY_RLS_ENABLED',
    NOW(),
    jsonb_build_object(
        'reason', 'Exposed credentials',
        'tables_secured', (
            SELECT COUNT(*) 
            FROM pg_tables 
            WHERE schemaname = 'public'
        )
    )
);

-- Create the audit table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id SERIAL PRIMARY KEY,
    action TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    details JSONB
);

-- Final security check
SELECT 
    schemaname,
    tablename,
    hasindexes,
    hasrules,
    hastriggers,
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
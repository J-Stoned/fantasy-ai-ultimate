-- 🚀 QUICK FIX FOR MISSING COLUMNS
-- Run this in Supabase SQL Editor NOW!

-- Add season and week to player_stats
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='player_stats') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_stats' AND column_name='season') THEN
            ALTER TABLE player_stats ADD COLUMN season INTEGER;
            RAISE NOTICE '✅ Added season to player_stats';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_stats' AND column_name='week') THEN
            ALTER TABLE player_stats ADD COLUMN week INTEGER;
            RAISE NOTICE '✅ Added week to player_stats';
        END IF;
    END IF;
END $$;

-- Add season and week to games
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='season') THEN
        ALTER TABLE games ADD COLUMN season INTEGER;
        RAISE NOTICE '✅ Added season to games';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='week') THEN
        ALTER TABLE games ADD COLUMN week INTEGER;
        RAISE NOTICE '✅ Added week to games';
    END IF;
END $$;

-- Quick check
SELECT 'DONE! Now run the turbo loader!' as message;
-- 🌤️ CREATE JUST THE WEATHER TABLE
-- Minimal approach - one table at a time

-- Disable any row level security that might be interfering
SET session_replication_role = replica;

-- Create schema if needed
CREATE SCHEMA IF NOT EXISTS public;

-- Create the weather table with a different approach
DO $$
BEGIN
    -- Check if table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'weather_conditions'
    ) THEN
        -- Create the table using EXECUTE to avoid parse-time checks
        EXECUTE '
        CREATE TABLE weather_conditions (
            id BIGSERIAL PRIMARY KEY,
            city VARCHAR(100) NOT NULL,
            temperature DECIMAL(5,2),
            feels_like DECIMAL(5,2),
            conditions VARCHAR(50),
            description VARCHAR(255),
            wind_speed DECIMAL(5,2),
            humidity INTEGER,
            visibility INTEGER,
            external_id VARCHAR(255) UNIQUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )';
        
        RAISE NOTICE 'Weather table created successfully';
    ELSE
        RAISE NOTICE 'Weather table already exists';
    END IF;
END $$;

-- Reset session
SET session_replication_role = DEFAULT;

-- Verify the table was created
SELECT 
    'Weather table columns:' as info,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'weather_conditions'
AND table_schema = 'public'
ORDER BY ordinal_position;
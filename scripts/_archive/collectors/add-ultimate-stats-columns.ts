import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Script to verify and document what columns we need to add
async function analyzeAndPlanSchemaUpdates() {
    console.log('🔍 ANALYZING CURRENT SCHEMA vs ULTIMATE REQUIREMENTS');
    console.log('==================================================\n');
    
    // Check current player_game_logs structure
    const { data: sampleLog } = await supabase
        .from('player_game_logs')
        .select('*')
        .limit(1)
        .single();
        
    if (sampleLog) {
        console.log('Current player_game_logs columns:');
        Object.keys(sampleLog).forEach(col => {
            console.log(`  ✅ ${col}: ${typeof sampleLog[col]}`);
        });
    }
    
    console.log('\n📋 COLUMNS NEEDED FOR ULTIMATE STATS:');
    console.log('====================================');
    
    const requiredColumns = [
        { name: 'raw_stats', type: 'JSONB', purpose: 'Store original API response data' },
        { name: 'computed_metrics', type: 'JSONB', purpose: 'All calculated advanced metrics' },
        { name: 'tracking_data', type: 'JSONB', purpose: 'Player movement and tracking stats' },
        { name: 'situational_stats', type: 'JSONB', purpose: 'Clutch, red zone, power play stats' },
        { name: 'play_by_play_stats', type: 'JSONB', purpose: 'Stats derived from play-by-play data' },
        { name: 'matchup_stats', type: 'JSONB', purpose: 'Performance vs specific opponents' },
        { name: 'metadata', type: 'JSONB', purpose: 'Game context, weather, lineup info' },
        { name: 'quality_metrics', type: 'JSONB', purpose: 'Data completeness indicators' }
    ];
    
    // Check which columns exist
    const existingColumns = sampleLog ? Object.keys(sampleLog) : [];
    
    requiredColumns.forEach(col => {
        const exists = existingColumns.includes(col.name);
        console.log(`${exists ? '✅' : '❌'} ${col.name} (${col.type})`);
        console.log(`   Purpose: ${col.purpose}`);
    });
    
    // Check if we need stat_definitions table
    console.log('\n📊 CHECKING STAT DEFINITIONS TABLE:');
    console.log('==================================');
    
    try {
        const { count } = await supabase
            .from('stat_definitions')
            .select('*', { count: 'exact', head: true });
            
        console.log(`✅ stat_definitions table exists with ${count || 0} entries`);
    } catch (error) {
        console.log('❌ stat_definitions table does not exist');
    }
    
    // Generate SQL for missing pieces
    console.log('\n💾 SQL COMMANDS NEEDED:');
    console.log('=====================\n');
    
    console.log('-- Add missing columns to player_game_logs');
    requiredColumns.forEach(col => {
        if (!existingColumns.includes(col.name)) {
            console.log(`ALTER TABLE player_game_logs ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} DEFAULT '{}';`);
        }
    });
    
    console.log('\n-- Create indexes for performance');
    requiredColumns.forEach(col => {
        if (!existingColumns.includes(col.name) && col.type === 'JSONB') {
            console.log(`CREATE INDEX IF NOT EXISTS idx_pgl_${col.name} ON player_game_logs USING GIN (${col.name});`);
        }
    });
    
    // Plan for data migration
    console.log('\n\n📈 DATA MIGRATION PLAN:');
    console.log('=====================');
    
    const { count: totalLogs } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log(`Total logs to enhance: ${totalLogs?.toLocaleString()}`);
    console.log(`Estimated time: ${((totalLogs || 0) / 1000).toFixed(1)} minutes at 1000 logs/minute`);
    
    console.log('\nMigration steps:');
    console.log('1. Add new columns (immediate)');
    console.log('2. Create stat_definitions table and populate');
    console.log('3. Backfill computed_metrics for existing logs');
    console.log('4. Start collecting new data with all fields populated');
    console.log('5. Add play-by-play data collection for enhanced stats');
    
    // Check current data quality
    console.log('\n\n🎯 CURRENT DATA QUALITY CHECK:');
    console.log('=============================');
    
    const sports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAA_BB', 'NCAA_FB'];
    
    for (const sport of sports) {
        const { data: sportGames } = await supabase
            .from('games')
            .select('id')
            .eq('sport', sport)
            .limit(10);
            
        if (!sportGames || sportGames.length === 0) continue;
        
        const gameIds = sportGames.map(g => g.id);
        
        const { data: logs } = await supabase
            .from('player_game_logs')
            .select('stats')
            .in('game_id', gameIds)
            .limit(10);
            
        if (logs && logs.length > 0) {
            const avgStatKeys = logs.reduce((sum, log) => {
                return sum + (log.stats ? Object.keys(log.stats).length : 0);
            }, 0) / logs.length;
            
            console.log(`${sport}: Avg ${avgStatKeys.toFixed(1)} stats per log`);
        }
    }
    
    // Recommendations
    console.log('\n\n💡 RECOMMENDATIONS:');
    console.log('==================');
    console.log('1. Run schema updates during low-traffic period');
    console.log('2. Test with small batch first (100 logs)');
    console.log('3. Monitor database performance during backfill');
    console.log('4. Keep old stats column until migration verified');
    console.log('5. Set up monitoring for data quality metrics');
    
    return {
        requiredColumns,
        existingColumns,
        totalLogs: totalLogs || 0
    };
}

// Function to create SQL file for manual execution
async function generateSchemaUpdateSQL() {
    const analysis = await analyzeAndPlanSchemaUpdates();
    
    const sqlContent = `-- Ultimate Stats Schema Enhancement
-- Generated: ${new Date().toISOString()}
-- Total logs to migrate: ${analysis.totalLogs.toLocaleString()}

-- =====================================================
-- STEP 1: Add comprehensive stats columns
-- =====================================================

-- Add JSONB columns for complete stats storage
ALTER TABLE player_game_logs 
ADD COLUMN IF NOT EXISTS raw_stats JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS computed_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS tracking_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS situational_stats JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS play_by_play_stats JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS matchup_stats JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS quality_metrics JSONB DEFAULT '{}';

-- =====================================================
-- STEP 2: Create performance indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_pgl_raw_stats ON player_game_logs USING GIN (raw_stats);
CREATE INDEX IF NOT EXISTS idx_pgl_computed_metrics ON player_game_logs USING GIN (computed_metrics);
CREATE INDEX IF NOT EXISTS idx_pgl_tracking_data ON player_game_logs USING GIN (tracking_data);
CREATE INDEX IF NOT EXISTS idx_pgl_situational_stats ON player_game_logs USING GIN (situational_stats);
CREATE INDEX IF NOT EXISTS idx_pgl_metadata ON player_game_logs USING GIN (metadata);

-- Compound indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pgl_player_date_sport 
ON player_game_logs(player_id, game_date) 
WHERE computed_metrics IS NOT NULL;

-- =====================================================
-- STEP 3: Create stat definitions table
-- =====================================================

CREATE TABLE IF NOT EXISTS stat_definitions (
  id SERIAL PRIMARY KEY,
  sport TEXT NOT NULL,
  stat_category TEXT NOT NULL,
  stat_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  calculation_formula TEXT,
  source_field TEXT,
  importance_score INTEGER DEFAULT 5,
  fantasy_relevance BOOLEAN DEFAULT true,
  requires_tracking_data BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sport, stat_name)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_stat_def_sport ON stat_definitions(sport);
CREATE INDEX IF NOT EXISTS idx_stat_def_category ON stat_definitions(sport, stat_category);

-- =====================================================
-- STEP 4: Create data quality tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS data_quality_metrics (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  sport TEXT NOT NULL,
  basic_stats_coverage FLOAT,
  advanced_stats_coverage FLOAT,
  tracking_data_available BOOLEAN DEFAULT false,
  play_by_play_available BOOLEAN DEFAULT false,
  data_source TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  issues JSONB DEFAULT '[]',
  UNIQUE(game_id)
);

-- =====================================================
-- STEP 5: Create helper functions
-- =====================================================

-- Function to check data completeness
CREATE OR REPLACE FUNCTION calculate_stat_completeness(stats JSONB, sport TEXT)
RETURNS FLOAT AS $$
DECLARE
  expected_count INTEGER;
  actual_count INTEGER;
BEGIN
  -- Define expected stats per sport
  CASE sport
    WHEN 'NBA', 'NCAA_BB' THEN expected_count := 15;
    WHEN 'NFL', 'NCAA_FB' THEN expected_count := 10;
    WHEN 'MLB' THEN expected_count := 12;
    WHEN 'NHL' THEN expected_count := 10;
    ELSE expected_count := 8;
  END CASE;
  
  -- Count non-null stats
  SELECT COUNT(*) INTO actual_count
  FROM jsonb_each(stats)
  WHERE value::text != 'null' AND value::text != '0';
  
  RETURN actual_count::FLOAT / expected_count::FLOAT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 6: Add comments for documentation
-- =====================================================

COMMENT ON COLUMN player_game_logs.raw_stats IS 
'Original stats data exactly as received from data source (ESPN, etc)';

COMMENT ON COLUMN player_game_logs.computed_metrics IS 
'Calculated advanced metrics: PER, true shooting %, usage rate, etc';

COMMENT ON COLUMN player_game_logs.tracking_data IS 
'Player movement data: distance, speed, touches, time of possession';

COMMENT ON COLUMN player_game_logs.situational_stats IS 
'Context-specific: clutch time, red zone, power play, RISP';

COMMENT ON COLUMN player_game_logs.play_by_play_stats IS 
'Aggregated from granular play data: touches, play types, etc';

COMMENT ON COLUMN player_game_logs.metadata IS 
'Game context: weather, injuries, starter/bench, lineup position';

COMMENT ON COLUMN player_game_logs.quality_metrics IS 
'Data quality indicators: completeness, source, last updated';

-- =====================================================
-- STEP 7: Initial stat definitions
-- =====================================================

-- Basketball core stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, unit, importance_score) VALUES
('NBA', 'basic', 'points', 'Points', 'count', 10),
('NBA', 'basic', 'rebounds', 'Rebounds', 'count', 8),
('NBA', 'basic', 'assists', 'Assists', 'count', 8),
('NBA', 'basic', 'steals', 'Steals', 'count', 7),
('NBA', 'basic', 'blocks', 'Blocks', 'count', 7),
('NBA', 'basic', 'turnovers', 'Turnovers', 'count', 6),
('NBA', 'shooting', 'fg_percentage', 'Field Goal %', 'percentage', 9),
('NBA', 'shooting', 'three_percentage', '3-Point %', 'percentage', 8),
('NBA', 'shooting', 'ft_percentage', 'Free Throw %', 'percentage', 7),
('NBA', 'advanced', 'true_shooting_pct', 'True Shooting %', 'percentage', 10),
('NBA', 'advanced', 'usage_rate', 'Usage Rate', 'percentage', 9),
('NBA', 'advanced', 'player_efficiency_rating', 'PER', 'rating', 10),
('NBA', 'tracking', 'touches', 'Touches', 'count', 7),
('NBA', 'tracking', 'distance_traveled', 'Distance', 'feet', 6),
('NBA', 'situational', 'clutch_points', 'Clutch Points', 'count', 8)
ON CONFLICT (sport, stat_name) DO NOTHING;

-- Add other sports...

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check column addition
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'player_game_logs' 
AND column_name IN ('raw_stats', 'computed_metrics', 'tracking_data', 
                    'situational_stats', 'metadata', 'quality_metrics');

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'player_game_logs' 
AND indexname LIKE 'idx_pgl_%';

-- Sample data quality check
SELECT 
  COUNT(*) as total_logs,
  COUNT(computed_metrics) as logs_with_metrics,
  COUNT(raw_stats) as logs_with_raw_stats,
  AVG(CASE WHEN stats IS NOT NULL 
    THEN jsonb_array_length(jsonb_object_keys(stats)) 
    ELSE 0 END) as avg_stat_count
FROM player_game_logs
LIMIT 1000;
`;
    
    // Save to file
    const fs = await import('fs/promises');
    await fs.writeFile('ultimate-stats-schema-update.sql', sqlContent);
    
    console.log('\n✅ SQL file generated: ultimate-stats-schema-update.sql');
    console.log('Review and run this SQL in your database admin tool.');
}

// Main execution
async function main() {
    console.log('🚀 ULTIMATE STATS SCHEMA ANALYZER');
    console.log('================================\n');
    
    await analyzeAndPlanSchemaUpdates();
    
    console.log('\n\nGenerate SQL file? This will create ultimate-stats-schema-update.sql');
    console.log('Run: npm run generate-schema-sql\n');
}

// Allow running specific functions
const command = process.argv[2];

if (command === 'generate-sql') {
    generateSchemaUpdateSQL().catch(console.error);
} else {
    main().catch(console.error);
}

export { analyzeAndPlanSchemaUpdates, generateSchemaUpdateSQL };
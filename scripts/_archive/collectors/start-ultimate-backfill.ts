import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { SurgicalBackfill } from './surgical-backfill-advanced-metrics';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function startUltimateBackfill() {
    console.log('🚀 STARTING ULTIMATE STATS BACKFILL');
    console.log('==================================\n');
    
    // First, let's check if we have the computed_metrics column
    // If not, we need to run the SQL first
    const { data: testLog } = await supabase
        .from('player_game_logs')
        .select('id, computed_metrics')
        .limit(1)
        .single();
        
    if (testLog && 'computed_metrics' in testLog) {
        console.log('✅ computed_metrics column exists! Starting backfill...\n');
        
        // Start with one sport as a test
        const testSport = 'NBA';
        console.log(`🏀 Starting with ${testSport} as test...\n`);
        
        const backfiller = new SurgicalBackfill();
        await backfiller.analyzeCurrentState();
        
        console.log('\nStarting backfill for NBA...');
        await backfiller.backfillSport(testSport);
        
        console.log('\n✅ Test backfill complete! Check the results.');
        
        // Show sample results
        const { data: samples } = await supabase
            .from('player_game_logs')
            .select('id, player_id, computed_metrics')
            .not('computed_metrics', 'is', null)
            .limit(5);
            
        if (samples && samples.length > 0) {
            console.log('\n📊 Sample backfilled logs:');
            samples.forEach((log, i) => {
                console.log(`\nLog ${i + 1}:`);
                console.log(`  Player ID: ${log.player_id}`);
                console.log(`  Metrics: ${Object.keys(log.computed_metrics).length} calculated`);
                console.log(`  Sample metrics:`, Object.keys(log.computed_metrics).slice(0, 5));
            });
        }
        
    } else {
        console.log('❌ computed_metrics column does not exist yet!');
        console.log('\n📋 NEXT STEPS:');
        console.log('1. Go to your Supabase dashboard');
        console.log('2. Navigate to SQL Editor');
        console.log('3. Open the file: ultimate-stats-schema-update.sql');
        console.log('4. Run the SQL commands');
        console.log('5. Come back and run this script again\n');
        
        console.log('Or if you have database access, run:');
        console.log('psql -U postgres -d your_database < ultimate-stats-schema-update.sql\n');
    }
}

// Also create a function to populate stat definitions
async function populateStatDefinitions() {
    console.log('\n📊 POPULATING STAT DEFINITIONS');
    console.log('=============================\n');
    
    const statDefinitions = [
        // Basketball
        { sport: 'NBA', stat_category: 'basic', stat_name: 'points', display_name: 'Points', unit: 'count', importance_score: 10 },
        { sport: 'NBA', stat_category: 'basic', stat_name: 'rebounds', display_name: 'Rebounds', unit: 'count', importance_score: 8 },
        { sport: 'NBA', stat_category: 'basic', stat_name: 'assists', display_name: 'Assists', unit: 'count', importance_score: 8 },
        { sport: 'NBA', stat_category: 'basic', stat_name: 'steals', display_name: 'Steals', unit: 'count', importance_score: 7 },
        { sport: 'NBA', stat_category: 'basic', stat_name: 'blocks', display_name: 'Blocks', unit: 'count', importance_score: 7 },
        { sport: 'NBA', stat_category: 'advanced', stat_name: 'true_shooting_pct', display_name: 'True Shooting %', unit: 'percentage', importance_score: 10 },
        { sport: 'NBA', stat_category: 'advanced', stat_name: 'usage_rate', display_name: 'Usage Rate', unit: 'percentage', importance_score: 9 },
        { sport: 'NBA', stat_category: 'advanced', stat_name: 'player_efficiency_rating', display_name: 'PER', unit: 'rating', importance_score: 10 },
        { sport: 'NBA', stat_category: 'tracking', stat_name: 'touches', display_name: 'Touches', unit: 'count', importance_score: 7, requires_tracking_data: true },
        { sport: 'NBA', stat_category: 'tracking', stat_name: 'distance_traveled', display_name: 'Distance', unit: 'feet', importance_score: 6, requires_tracking_data: true },
        { sport: 'NBA', stat_category: 'situational', stat_name: 'clutch_points', display_name: 'Clutch Points', unit: 'count', importance_score: 8 },
        
        // Football
        { sport: 'NFL', stat_category: 'passing', stat_name: 'passing_yards', display_name: 'Passing Yards', unit: 'yards', importance_score: 10 },
        { sport: 'NFL', stat_category: 'passing', stat_name: 'passer_rating', display_name: 'Passer Rating', unit: 'rating', importance_score: 10 },
        { sport: 'NFL', stat_category: 'passing', stat_name: 'air_yards', display_name: 'Air Yards', unit: 'yards', importance_score: 8 },
        { sport: 'NFL', stat_category: 'rushing', stat_name: 'rushing_yards', display_name: 'Rushing Yards', unit: 'yards', importance_score: 10 },
        { sport: 'NFL', stat_category: 'rushing', stat_name: 'yards_after_contact', display_name: 'YAC', unit: 'yards', importance_score: 9 },
        { sport: 'NFL', stat_category: 'receiving', stat_name: 'receiving_yards', display_name: 'Receiving Yards', unit: 'yards', importance_score: 10 },
        { sport: 'NFL', stat_category: 'receiving', stat_name: 'target_separation', display_name: 'Separation', unit: 'yards', importance_score: 8 },
        
        // Baseball
        { sport: 'MLB', stat_category: 'hitting', stat_name: 'batting_average', display_name: 'AVG', unit: 'average', importance_score: 9 },
        { sport: 'MLB', stat_category: 'hitting', stat_name: 'exit_velocity', display_name: 'Exit Velocity', unit: 'mph', importance_score: 8 },
        { sport: 'MLB', stat_category: 'hitting', stat_name: 'launch_angle', display_name: 'Launch Angle', unit: 'degrees', importance_score: 7 },
        { sport: 'MLB', stat_category: 'pitching', stat_name: 'era', display_name: 'ERA', unit: 'runs', importance_score: 10 },
        { sport: 'MLB', stat_category: 'pitching', stat_name: 'spin_rate', display_name: 'Spin Rate', unit: 'rpm', importance_score: 8 },
        
        // Hockey
        { sport: 'NHL', stat_category: 'basic', stat_name: 'goals', display_name: 'Goals', unit: 'count', importance_score: 10 },
        { sport: 'NHL', stat_category: 'basic', stat_name: 'assists', display_name: 'Assists', unit: 'count', importance_score: 9 },
        { sport: 'NHL', stat_category: 'advanced', stat_name: 'corsi_percentage', display_name: 'Corsi %', unit: 'percentage', importance_score: 8 },
        { sport: 'NHL', stat_category: 'advanced', stat_name: 'expected_goals', display_name: 'xG', unit: 'goals', importance_score: 9 },
        
        // Soccer
        { sport: 'MLS', stat_category: 'basic', stat_name: 'goals', display_name: 'Goals', unit: 'count', importance_score: 10 },
        { sport: 'MLS', stat_category: 'basic', stat_name: 'assists', display_name: 'Assists', unit: 'count', importance_score: 9 },
        { sport: 'MLS', stat_category: 'advanced', stat_name: 'expected_goals', display_name: 'xG', unit: 'goals', importance_score: 9 },
        { sport: 'MLS', stat_category: 'advanced', stat_name: 'progressive_carries', display_name: 'Progressive Carries', unit: 'count', importance_score: 7 }
    ];
    
    // Insert in batches
    const batchSize = 50;
    for (let i = 0; i < statDefinitions.length; i += batchSize) {
        const batch = statDefinitions.slice(i, i + batchSize);
        
        const { error } = await supabase
            .from('stat_definitions')
            .upsert(batch, {
                onConflict: 'sport,stat_name'
            });
            
        if (error) {
            console.error('Error inserting batch:', error);
        } else {
            console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}`);
        }
    }
    
    console.log('\n✅ Stat definitions populated!');
}

// Allow running specific functions
const command = process.argv[2];

if (command === 'populate-stats') {
    populateStatDefinitions().catch(console.error);
} else {
    startUltimateBackfill().catch(console.error);
}
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkUltimateColumns() {
    console.log('🔍 CHECKING ULTIMATE STATS COLUMNS');
    console.log('==================================\n');

    // List of ultimate stats columns that should exist
    const ultimateColumns = [
        'computed_metrics',
        'advanced_metrics',
        'contextual_metrics',
        'performance_metrics',
        'efficiency_metrics',
        'impact_metrics',
        'predictive_metrics',
        'comparative_metrics'
    ];

    // Test query to check which columns exist
    const { data: sampleLog } = await supabase
        .from('player_game_logs')
        .select('*')
        .limit(1)
        .single();

    if (!sampleLog) {
        console.log('❌ Could not fetch sample log');
        return;
    }

    console.log('📊 Column Status:');
    console.log('----------------');

    const existingColumns: string[] = [];
    const missingColumns: string[] = [];

    for (const column of ultimateColumns) {
        if (column in sampleLog) {
            existingColumns.push(column);
            console.log(`✅ ${column}: EXISTS`);
            
            // Check if it has data
            const value = sampleLog[column];
            if (value && typeof value === 'object' && Object.keys(value).length > 0) {
                console.log(`   └─ Has data: ${Object.keys(value).length} fields`);
            } else {
                console.log(`   └─ Empty or null`);
            }
        } else {
            missingColumns.push(column);
            console.log(`❌ ${column}: MISSING`);
        }
    }

    console.log(`\n📈 Summary:`);
    console.log(`   Existing columns: ${existingColumns.length}`);
    console.log(`   Missing columns: ${missingColumns.length}`);

    if (missingColumns.length > 0) {
        console.log('\n⚠️  MISSING COLUMNS DETECTED!');
        console.log('You need to run the SQL migration to add these columns.');
        console.log('\nMissing columns:', missingColumns.join(', '));
        console.log('\n📋 Next Steps:');
        console.log('1. Run: ultimate-stats-schema-update.sql in Supabase');
        console.log('2. Then run the backfill scripts');
    } else {
        console.log('\n✅ All ultimate stats columns exist!');
        
        // Check data population
        console.log('\n📊 Checking data population...');
        
        for (const column of existingColumns) {
            const { count: populated } = await supabase
                .from('player_game_logs')
                .select('*', { count: 'exact', head: true })
                .not(column, 'eq', '{}')
                .not(column, 'is', null);

            const { count: total } = await supabase
                .from('player_game_logs')
                .select('*', { count: 'exact', head: true });

            const coverage = total ? (populated! / total * 100) : 0;
            
            if (populated && populated > 0) {
                console.log(`${column}: ${populated.toLocaleString()} / ${total?.toLocaleString()} (${coverage.toFixed(1)}%)`);
            }
        }
    }

    // Check the actual data structure
    console.log('\n🔍 Checking actual data in computed_metrics...');
    
    const { data: metricsExamples } = await supabase
        .from('player_game_logs')
        .select('id, computed_metrics, stats, minutes_played')
        .not('computed_metrics', 'is', null)
        .not('computed_metrics', 'eq', '{}')
        .limit(5);

    if (metricsExamples && metricsExamples.length > 0) {
        console.log('\nSample metrics:');
        metricsExamples.forEach((log, i) => {
            console.log(`\nExample ${i + 1}:`);
            console.log(`  Minutes: ${log.minutes_played}`);
            console.log(`  Stats fields: ${log.stats ? Object.keys(log.stats).length : 0}`);
            console.log(`  Metrics fields: ${log.computed_metrics ? Object.keys(log.computed_metrics).length : 0}`);
            if (log.computed_metrics) {
                console.log(`  Sample metrics:`, Object.entries(log.computed_metrics).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', '));
            }
        });
    } else {
        console.log('\n⚠️  No logs with computed_metrics found!');
    }
}

checkUltimateColumns()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Check failed:', error);
        process.exit(1);
    });
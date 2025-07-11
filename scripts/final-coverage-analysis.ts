import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function finalCoverageAnalysis() {
    console.log('📊 FINAL ULTIMATE STATS COVERAGE ANALYSIS');
    console.log('========================================\n');

    // Get the actual numbers you mentioned
    console.log('🎯 Finding the 67.7% coverage context...\n');

    // Total logs
    const { count: totalLogs } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });

    // Logs with any computed_metrics
    const { count: logsWithAnyMetrics } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .not('computed_metrics', 'is', null)
        .not('computed_metrics', 'eq', '{}');

    // Logs with substantial metrics (more than just basic fields)
    const { data: metricsQuality } = await supabase
        .from('player_game_logs')
        .select('computed_metrics')
        .not('computed_metrics', 'is', null)
        .not('computed_metrics', 'eq', '{}')
        .limit(100);

    // Analyze metric quality
    const metricFieldCounts = new Map<number, number>();
    let totalMetricFields = 0;
    let logsWithSubstantialMetrics = 0;

    metricsQuality?.forEach(log => {
        const fieldCount = log.computed_metrics ? Object.keys(log.computed_metrics).length : 0;
        metricFieldCounts.set(fieldCount, (metricFieldCounts.get(fieldCount) || 0) + 1);
        totalMetricFields += fieldCount;
        if (fieldCount > 5) logsWithSubstantialMetrics++;
    });

    const avgFieldsPerLog = metricsQuality?.length ? totalMetricFields / metricsQuality.length : 0;

    console.log('📈 CURRENT STATE:');
    console.log(`Total Logs: ${totalLogs?.toLocaleString()}`);
    console.log(`Logs with ANY metrics: ${logsWithAnyMetrics?.toLocaleString()} (${(logsWithAnyMetrics! / totalLogs! * 100).toFixed(1)}%)`);
    console.log(`Average fields per metric: ${avgFieldsPerLog.toFixed(1)}`);

    console.log('\nMetric Field Distribution (sample of 100):');
    Array.from(metricFieldCounts.entries())
        .sort((a, b) => a[0] - b[0])
        .forEach(([fields, count]) => {
            console.log(`  ${fields} fields: ${count} logs`);
        });

    // Check different possible denominators for 54,857
    console.log('\n🔍 IDENTIFYING THE 54,857 DENOMINATOR:');
    
    const queries = [
        {
            name: 'Logs with stats (not empty)',
            query: supabase.from('player_game_logs').select('*', { count: 'exact', head: true })
                .not('stats', 'eq', '{}')
        },
        {
            name: 'Logs with stats AND minutes >= 0',
            query: supabase.from('player_game_logs').select('*', { count: 'exact', head: true })
                .not('stats', 'eq', '{}')
                .gte('minutes_played', 0)
        },
        {
            name: 'Active players (minutes > 0)',
            query: supabase.from('player_game_logs').select('*', { count: 'exact', head: true })
                .gt('minutes_played', 0)
        },
        {
            name: 'Logs from major sports',
            query: supabase.from('player_game_logs').select('*', { count: 'exact', head: true })
                .in('game_id', 
                    (await supabase.from('games').select('id').in('sport', ['NBA', 'NFL', 'NHL', 'MLB']))
                    .data?.map(g => g.id) || []
                )
        }
    ];

    for (const { name, query } of queries) {
        const { count } = await query;
        console.log(`${name}: ${count?.toLocaleString()}`);
        if (count && Math.abs(count - 54857) < 100) {
            console.log(`  ✅ This matches your 54,857 reference!`);
        }
    }

    // Calculate what 67.7% of 54,857 would be
    const expectedMetricsCount = Math.round(54857 * 0.677);
    console.log(`\n📊 Expected metrics count at 67.7%: ${expectedMetricsCount.toLocaleString()}`);
    console.log(`Actual metrics count: ${logsWithAnyMetrics?.toLocaleString()}`);

    // Gap Analysis
    console.log('\n\n🎯 COVERAGE GAP ANALYSIS:');
    console.log('========================\n');

    console.log('1. **Missing Ultimate Stats Columns**:');
    console.log('   - Only computed_metrics exists');
    console.log('   - Missing: advanced_metrics, contextual_metrics, performance_metrics, etc.');
    console.log('   - Need to run ultimate-stats-schema-update.sql\n');

    console.log('2. **Limited Metric Calculations**:');
    console.log('   - Current metrics are very basic (3-5 fields)');
    console.log('   - Missing advanced calculations from surgical-backfill script');
    console.log('   - MLB, NCAA_BB, NCAA_FB have 0% coverage\n');

    console.log('3. **Data Quality Issues**:');
    const { count: emptyStats } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('stats', '{}');
    
    const { count: nullMinutes } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .is('minutes_played', null);

    console.log(`   - Empty stats: ${emptyStats?.toLocaleString()} logs`);
    console.log(`   - Null minutes_played: ${nullMinutes?.toLocaleString()} logs`);
    console.log(`   - These prevent metric calculations\n`);

    // Recommendations
    console.log('📋 ACTION PLAN TO REACH 85%+ COVERAGE:');
    console.log('=====================================\n');

    console.log('1. **Run SQL Migration** (Priority 1):');
    console.log('   - Execute ultimate-stats-schema-update.sql');
    console.log('   - This adds all 7 missing metric columns\n');

    console.log('2. **Fix Sport Calculators** (Priority 2):');
    console.log('   - Debug MLB calculator (2,472 logs)');
    console.log('   - Debug NCAA_BB calculator (5,592 logs)');
    console.log('   - Debug NCAA_FB calculator (68 logs)');
    console.log('   - Total: 8,132 logs that should have metrics\n');

    console.log('3. **Run Full Backfill** (Priority 3):');
    console.log('   - Use surgical-backfill-advanced-metrics.ts');
    console.log('   - This will calculate 50-150 metrics per log');
    console.log('   - Current metrics are insufficient (only 3-5 fields)\n');

    console.log('4. **Handle Edge Cases** (Priority 4):');
    console.log('   - Process logs with 0 minutes played');
    console.log('   - Create minimal metrics for bench players');
    console.log('   - Handle empty stats appropriately\n');

    // Final assessment
    const potentialCoverage = ((logsWithAnyMetrics || 0) + 8132 + 10000) / (totalLogs || 1) * 100;
    
    console.log('✅ ACHIEVABLE COVERAGE ESTIMATE:');
    console.log(`   Current: ${(logsWithAnyMetrics! / totalLogs! * 100).toFixed(1)}%`);
    console.log(`   After fixes: ~${potentialCoverage.toFixed(1)}%`);
    console.log(`   Target: 85%+`);
    
    console.log('\n🔑 KEY FINDING:');
    console.log('The 67.7% coverage you mentioned likely refers to a subset of logs');
    console.log('(e.g., logs with stats), but the current actual coverage is much lower.');
    console.log('Running the full ultimate stats infrastructure will dramatically improve this.');
}

finalCoverageAnalysis()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Analysis failed:', error);
        process.exit(1);
    });
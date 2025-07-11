import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyActualCoverage() {
    console.log('🔍 VERIFYING ACTUAL ULTIMATE STATS COVERAGE');
    console.log('==========================================\n');

    // Check all possible metric columns
    const metricColumns = [
        'computed_metrics',
        'advanced_metrics', 
        'contextual_metrics',
        'performance_metrics',
        'efficiency_metrics',
        'impact_metrics',
        'predictive_metrics',
        'comparative_metrics'
    ];

    console.log('📊 Checking all metric columns...\n');

    for (const column of metricColumns) {
        try {
            // First check if column exists
            const { data: sample } = await supabase
                .from('player_game_logs')
                .select(`id, ${column}`)
                .limit(1);

            if (!sample) continue;

            // Count non-empty values
            const { count: totalLogs } = await supabase
                .from('player_game_logs')
                .select('*', { count: 'exact', head: true });

            const { count: nonEmpty } = await supabase
                .from('player_game_logs')
                .select('*', { count: 'exact', head: true })
                .not(column, 'eq', '{}')
                .not(column, 'is', null);

            if (nonEmpty && nonEmpty > 0) {
                const coverage = totalLogs ? (nonEmpty / totalLogs * 100) : 0;
                console.log(`✅ ${column}: ${nonEmpty.toLocaleString()} / ${totalLogs?.toLocaleString()} (${coverage.toFixed(1)}%)`);
            }
        } catch (error) {
            // Column doesn't exist
            console.log(`❌ ${column}: Column not found`);
        }
    }

    // Check the actual count you mentioned (54,857)
    console.log('\n📈 Checking specific count (54,857 logs)...\n');

    // Maybe it's filtered by certain conditions
    const conditions = [
        { name: 'With any stats', filter: { not: { stats: 'eq.{}' } } },
        { name: 'With minutes > 0', filter: { gt: { minutes_played: 0 } } },
        { name: 'With fantasy points', filter: { not: { fantasy_points: 'is.null' } } },
        { name: 'Recent games (2023-2024)', filter: { gte: { created_at: '2023-01-01' } } }
    ];

    for (const condition of conditions) {
        const query = supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true });

        // Apply filter
        if (condition.filter.not) {
            const [col, op] = Object.entries(condition.filter.not)[0];
            query.not(col, op as any);
        } else if (condition.filter.gt) {
            const [col, val] = Object.entries(condition.filter.gt)[0];
            query.gt(col, val);
        } else if (condition.filter.gte) {
            const [col, val] = Object.entries(condition.filter.gte)[0];
            query.gte(col, val);
        }

        const { count } = await query;
        console.log(`${condition.name}: ${count?.toLocaleString()}`);
    }

    // Check combined conditions that might give us 54,857
    console.log('\n🎯 Checking combined conditions...\n');

    // Logs with stats AND reasonable data
    const { count: validLogs } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .not('stats', 'eq', '{}')
        .gte('minutes_played', 0);

    console.log(`Logs with stats AND minutes_played >= 0: ${validLogs?.toLocaleString()}`);

    // Check by checking a specific metric field existence
    const { data: sampleWithMetrics } = await supabase
        .from('player_game_logs')
        .select('computed_metrics')
        .not('computed_metrics', 'is', null)
        .not('computed_metrics', 'eq', '{}')
        .limit(5);

    console.log('\n📋 Sample of logs with metrics:');
    sampleWithMetrics?.forEach((log, i) => {
        const metricKeys = Object.keys(log.computed_metrics || {});
        console.log(`  Sample ${i+1}: ${metricKeys.length} metric fields`);
        if (metricKeys.length > 0) {
            console.log(`    Keys: ${metricKeys.slice(0, 5).join(', ')}...`);
        }
    });

    // Final check - maybe it's counting unique game/player combinations
    console.log('\n🔍 Checking unique combinations...\n');

    const { data: uniqueGames } = await supabase
        .from('player_game_logs')
        .select('game_id')
        .not('computed_metrics', 'eq', '{}')
        .not('computed_metrics', 'is', null);

    const uniqueGameCount = new Set(uniqueGames?.map(g => g.game_id)).size;
    console.log(`Unique games with metrics: ${uniqueGameCount.toLocaleString()}`);

    // Check if 37,111 is the count with metrics
    const { count: exactMetricsCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .not('computed_metrics', 'eq', '{}')
        .not('computed_metrics', 'is', null);

    console.log(`\n✅ EXACT COUNT WITH METRICS: ${exactMetricsCount?.toLocaleString()}`);
    
    // Now find what gives us 54,857 total
    const possibleTotals = [
        { 
            name: 'Active players only',
            query: supabase.from('player_game_logs').select('*', { count: 'exact', head: true })
                .gt('minutes_played', 0)
        },
        {
            name: 'With any stats data',
            query: supabase.from('player_game_logs').select('*', { count: 'exact', head: true })
                .not('stats', 'eq', '{}')
        },
        {
            name: 'Specific sports only',
            query: supabase.from('player_game_logs').select('*', { count: 'exact', head: true })
                .in('game_id', (await supabase.from('games').select('id').in('sport', ['NBA', 'NFL', 'NHL'])).data?.map(g => g.id) || [])
        }
    ];

    console.log('\n🎯 Finding what gives us 54,857 total...\n');
    
    for (const test of possibleTotals) {
        const { count } = await test.query;
        console.log(`${test.name}: ${count?.toLocaleString()}`);
        if (count && Math.abs(count - 54857) < 1000) {
            console.log('  ^ This might be our denominator!');
        }
    }
}

verifyActualCoverage()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Verification failed:', error);
        process.exit(1);
    });
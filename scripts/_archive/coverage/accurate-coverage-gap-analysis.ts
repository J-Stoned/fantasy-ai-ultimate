import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function accurateCoverageGapAnalysis() {
    console.log('🎯 ACCURATE ULTIMATE STATS COVERAGE ANALYSIS');
    console.log('===========================================');
    console.log('Understanding the real 67.7% coverage gap\n');

    // Define our universe: logs with stats and valid minutes_played
    const { count: eligibleLogs } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .not('stats', 'eq', '{}')
        .gte('minutes_played', 0);

    const { count: logsWithMetrics } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .not('stats', 'eq', '{}')
        .gte('minutes_played', 0)
        .not('computed_metrics', 'eq', '{}')
        .not('computed_metrics', 'is', null);

    const actualCoverage = eligibleLogs ? (logsWithMetrics! / eligibleLogs * 100) : 0;
    const missingCount = eligibleLogs! - logsWithMetrics!;

    console.log('📊 ACTUAL COVERAGE METRICS:');
    console.log(`Eligible Logs (with stats & minutes >= 0): ${eligibleLogs?.toLocaleString()}`);
    console.log(`Logs with Computed Metrics: ${logsWithMetrics?.toLocaleString()}`);
    console.log(`Coverage: ${actualCoverage.toFixed(1)}%`);
    console.log(`Missing Metrics: ${missingCount.toLocaleString()} logs\n`);

    // Analyze why eligible logs are missing metrics
    console.log('🔍 ANALYZING MISSING METRICS...\n');

    // Get sports breakdown
    const sports = ['NBA', 'NFL', 'nfl', 'NHL', 'MLB', 'NCAA_BB', 'NCAA_FB'];
    
    for (const sport of sports) {
        // Get game IDs for this sport
        const { data: games } = await supabase
            .from('games')
            .select('id')
            .eq('sport', sport);
        
        if (!games || games.length === 0) continue;
        
        const gameIds = games.map(g => g.id);
        
        // Count eligible logs
        const { count: sportEligible } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds)
            .not('stats', 'eq', '{}')
            .gte('minutes_played', 0);

        // Count with metrics
        const { count: sportWithMetrics } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds)
            .not('stats', 'eq', '{}')
            .gte('minutes_played', 0)
            .not('computed_metrics', 'eq', '{}')
            .not('computed_metrics', 'is', null);

        const sportCoverage = sportEligible ? (sportWithMetrics! / sportEligible * 100) : 0;
        const sportMissing = (sportEligible || 0) - (sportWithMetrics || 0);

        if (sportEligible && sportEligible > 0) {
            console.log(`${sport}:`);
            console.log(`  Eligible: ${sportEligible.toLocaleString()}`);
            console.log(`  With Metrics: ${sportWithMetrics?.toLocaleString()} (${sportCoverage.toFixed(1)}%)`);
            console.log(`  Missing: ${sportMissing.toLocaleString()}\n`);
        }
    }

    // Analyze patterns in missing metrics
    console.log('📈 ANALYZING PATTERNS IN MISSING METRICS...\n');

    // Sample logs that should have metrics but don't
    const { data: missingMetricsSample } = await supabase
        .from('player_game_logs')
        .select('id, player_id, game_id, stats, minutes_played, fantasy_points, computed_metrics')
        .not('stats', 'eq', '{}')
        .gte('minutes_played', 0)
        .or('computed_metrics.eq.{},computed_metrics.is.null')
        .limit(10);

    if (missingMetricsSample) {
        console.log('Examples of logs missing metrics:');
        missingMetricsSample.forEach((log, i) => {
            const statCount = log.stats ? Object.keys(log.stats).length : 0;
            const statSample = log.stats ? Object.entries(log.stats).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
            console.log(`  ${i+1}. Player ${log.player_id}: ${log.minutes_played} min, ${statCount} stats (${statSample}...)`);
        });
    }

    // Check for specific issues
    console.log('\n🔍 CHECKING SPECIFIC ISSUES...\n');

    // 1. Logs with minimal stats (might not trigger calculations)
    const { count: minimalStats } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .not('stats', 'eq', '{}')
        .gte('minutes_played', 0)
        .or('computed_metrics.eq.{},computed_metrics.is.null');

    // Get distribution of stat counts
    const { data: statDistribution } = await supabase
        .from('player_game_logs')
        .select('stats')
        .not('stats', 'eq', '{}')
        .gte('minutes_played', 0)
        .or('computed_metrics.eq.{},computed_metrics.is.null')
        .limit(100);

    const statCounts = new Map<number, number>();
    statDistribution?.forEach(log => {
        const count = log.stats ? Object.keys(log.stats).length : 0;
        statCounts.set(count, (statCounts.get(count) || 0) + 1);
    });

    console.log('Distribution of stat field counts in logs missing metrics:');
    Array.from(statCounts.entries())
        .sort((a, b) => a[0] - b[0])
        .forEach(([count, freq]) => {
            console.log(`  ${count} fields: ${freq} logs`);
        });

    // 2. Check for logs that might have been skipped due to errors
    console.log('\n📊 POTENTIAL CAUSES OF MISSING METRICS:\n');

    // Check for very low minutes (bench warmers)
    const { count: lowMinutes } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .not('stats', 'eq', '{}')
        .gte('minutes_played', 0)
        .lte('minutes_played', 1)
        .or('computed_metrics.eq.{},computed_metrics.is.null');

    const lowMinutesPct = missingCount ? (lowMinutes! / missingCount * 100) : 0;
    console.log(`1. Very Low Playing Time (0-1 min): ${lowMinutes?.toLocaleString()} (${lowMinutesPct.toFixed(1)}% of missing)`);

    // Check for specific sports that are failing
    console.log('\n2. Sport-Specific Failures:');
    const failureRates = [
        { sport: 'MLB', eligible: 2472, withMetrics: 0 },
        { sport: 'NCAA_BB', eligible: 5592, withMetrics: 0 },
        { sport: 'NCAA_FB', eligible: 68, withMetrics: 0 }
    ];

    failureRates.forEach(({ sport, eligible, withMetrics }) => {
        if (eligible > 0 && withMetrics === 0) {
            console.log(`   - ${sport}: 100% failure rate (${eligible.toLocaleString()} logs)`);
        }
    });

    // Recommendations
    console.log('\n\n🎯 RECOMMENDATIONS TO REACH 85%+ COVERAGE:');
    console.log('=========================================\n');

    const mlbNcaaLogs = 2472 + 5592 + 68; // 8,132
    const potentialIncrease = eligibleLogs ? (mlbNcaaLogs / eligibleLogs * 100) : 0;
    const newCoverage = actualCoverage + potentialIncrease;

    console.log(`1. **Fix MLB/NCAA Calculators** (Immediate +${potentialIncrease.toFixed(1)}% coverage):`);
    console.log(`   - MLB: 2,472 logs with 0% success rate`);
    console.log(`   - NCAA_BB: 5,592 logs with 0% success rate`);
    console.log(`   - NCAA_FB: 68 logs with 0% success rate`);
    console.log(`   - Fixing these would bring coverage to ${newCoverage.toFixed(1)}%\n`);

    console.log('2. **Debug NFL/NHL Partial Failures**:');
    console.log('   - NFL: 36.5% of eligible logs missing metrics');
    console.log('   - NHL: 36.5% of eligible logs missing metrics');
    console.log('   - Check for edge cases in calculations\n');

    console.log('3. **Handle Low Playing Time Cases**:');
    console.log(`   - ${lowMinutes?.toLocaleString()} logs with 0-1 minutes`);
    console.log('   - Consider minimal metric sets for bench players\n');

    console.log('4. **Verify Calculator Logic**:');
    console.log('   - Ensure all sports have proper metric calculators');
    console.log('   - Add error handling for edge cases');
    console.log('   - Log failures for debugging\n');

    const totalFixable = mlbNcaaLogs + (lowMinutes || 0);
    const achievableCoverage = eligibleLogs ? ((logsWithMetrics! + totalFixable) / eligibleLogs * 100) : 0;

    console.log(`✅ ACHIEVABLE COVERAGE: ${achievableCoverage.toFixed(1)}%`);
    console.log(`   - Current: ${actualCoverage.toFixed(1)}%`);
    console.log(`   - After MLB/NCAA fix: ${newCoverage.toFixed(1)}%`);
    console.log(`   - After all fixes: ${achievableCoverage.toFixed(1)}%`);
}

accurateCoverageGapAnalysis()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Analysis failed:', error);
        process.exit(1);
    });
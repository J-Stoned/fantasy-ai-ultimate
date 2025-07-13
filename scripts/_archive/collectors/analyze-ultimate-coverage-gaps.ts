import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CoverageAnalysis {
    sport: string;
    totalLogs: number;
    logsWithMetrics: number;
    logsWithEmptyStats: number;
    logsWithStatsNoMetrics: number;
    benchPlayers: number;
    minimalPlayTime: number;
    missingKeyFields: number;
    averageStatsPerLog: number;
    coverage: number;
}

async function analyzeUltimateCoverageGaps() {
    console.log('🔍 ULTIMATE STATS COVERAGE GAP ANALYSIS');
    console.log('======================================');
    console.log('Finding why we only have 67.7% coverage\n');

    // First, get overall totals
    const { count: totalLogs } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });

    const { count: logsWithMetrics } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .not('computed_metrics', 'eq', '{}')
        .not('computed_metrics', 'is', null);

    const overallCoverage = totalLogs ? (logsWithMetrics! / totalLogs * 100) : 0;

    console.log('📊 OVERALL COVERAGE:');
    console.log(`Total Logs: ${totalLogs?.toLocaleString()}`);
    console.log(`Logs with Metrics: ${logsWithMetrics?.toLocaleString()} (${overallCoverage.toFixed(1)}%)`);
    console.log(`Missing Coverage: ${(totalLogs! - logsWithMetrics!).toLocaleString()} (${(100 - overallCoverage).toFixed(1)}%)\n`);

    // Analyze by sport
    const sports = ['NBA', 'NFL', 'nfl', 'NHL', 'MLB', 'NCAA_BB', 'NCAA_FB', 'MLS'];
    const analyses: CoverageAnalysis[] = [];

    for (const sport of sports) {
        console.log(`\n📈 Analyzing ${sport}...`);
        
        // Get game IDs for this sport
        const { data: games } = await supabase
            .from('games')
            .select('id')
            .eq('sport', sport);
        
        if (!games || games.length === 0) {
            console.log(`  No games found for ${sport}`);
            continue;
        }

        const gameIds = games.map(g => g.id);
        
        // Get various counts
        const { count: sportTotalLogs } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds);

        const { count: sportLogsWithMetrics } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds)
            .not('computed_metrics', 'eq', '{}')
            .not('computed_metrics', 'is', null);

        // Count logs with empty stats
        const { count: emptyStats } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds)
            .eq('stats', '{}');

        // Count logs with stats but no metrics
        const { count: statsNoMetrics } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds)
            .not('stats', 'eq', '{}')
            .or('computed_metrics.eq.{},computed_metrics.is.null');

        // Count minimal play time (0 minutes)
        const { count: zeroMinutes } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds)
            .eq('minutes_played', 0);

        // Sample logs to check data quality
        const { data: sampleLogs } = await supabase
            .from('player_game_logs')
            .select('stats, minutes_played, fantasy_points, computed_metrics')
            .in('game_id', gameIds)
            .limit(1000);

        // Analyze sample for patterns
        let benchCount = 0;
        let missingFields = 0;
        let totalStatFields = 0;
        let logCount = 0;

        if (sampleLogs) {
            for (const log of sampleLogs) {
                logCount++;
                
                // Check if likely bench player
                if (log.minutes_played === 0 && log.fantasy_points === 0) {
                    benchCount++;
                }
                
                // Count stat fields
                if (log.stats && typeof log.stats === 'object') {
                    const statKeys = Object.keys(log.stats);
                    totalStatFields += statKeys.length;
                    
                    // Check for missing key fields based on sport
                    if (sport === 'NBA' || sport === 'NCAA_BB') {
                        if (!log.stats.points && !log.stats.rebounds && !log.stats.assists) {
                            missingFields++;
                        }
                    } else if (sport === 'NFL' || sport === 'nfl' || sport === 'NCAA_FB') {
                        if (!log.stats.passing_yards && !log.stats.rushing_yards && 
                            !log.stats.receiving_yards && !log.stats.tackles) {
                            missingFields++;
                        }
                    }
                }
            }
        }

        const avgStatsPerLog = logCount > 0 ? totalStatFields / logCount : 0;
        const coverage = sportTotalLogs ? (sportLogsWithMetrics! / sportTotalLogs * 100) : 0;

        const analysis: CoverageAnalysis = {
            sport,
            totalLogs: sportTotalLogs || 0,
            logsWithMetrics: sportLogsWithMetrics || 0,
            logsWithEmptyStats: emptyStats || 0,
            logsWithStatsNoMetrics: statsNoMetrics || 0,
            benchPlayers: Math.round((benchCount / logCount) * (sportTotalLogs || 0)),
            minimalPlayTime: zeroMinutes || 0,
            missingKeyFields: Math.round((missingFields / logCount) * (sportTotalLogs || 0)),
            averageStatsPerLog: avgStatsPerLog,
            coverage
        };

        analyses.push(analysis);

        console.log(`  Total Logs: ${analysis.totalLogs.toLocaleString()}`);
        console.log(`  With Metrics: ${analysis.logsWithMetrics.toLocaleString()} (${coverage.toFixed(1)}%)`);
        console.log(`  Empty Stats: ${analysis.logsWithEmptyStats.toLocaleString()} (${(analysis.logsWithEmptyStats / analysis.totalLogs * 100).toFixed(1)}%)`);
        console.log(`  Stats but No Metrics: ${analysis.logsWithStatsNoMetrics.toLocaleString()}`);
        console.log(`  Zero Minutes Played: ${analysis.minimalPlayTime.toLocaleString()}`);
        console.log(`  Avg Stats/Log: ${avgStatsPerLog.toFixed(1)}`);
    }

    // Deep dive into gaps
    console.log('\n\n🎯 DETAILED GAP ANALYSIS:');
    console.log('========================\n');

    // Get specific examples of different gap types
    console.log('1️⃣ EMPTY STATS EXAMPLES (Bench/DNP):');
    const { data: emptyStatsExamples } = await supabase
        .from('player_game_logs')
        .select('id, player_id, game_id, minutes_played, fantasy_points, stats')
        .eq('stats', '{}')
        .limit(5);
    
    if (emptyStatsExamples) {
        emptyStatsExamples.forEach((log, i) => {
            console.log(`   Example ${i+1}: Player ${log.player_id}, ${log.minutes_played} min, ${log.fantasy_points} pts`);
        });
    }

    console.log('\n2️⃣ STATS BUT NO METRICS EXAMPLES:');
    const { data: statsNoMetricsExamples } = await supabase
        .from('player_game_logs')
        .select('id, player_id, stats, computed_metrics')
        .not('stats', 'eq', '{}')
        .or('computed_metrics.eq.{},computed_metrics.is.null')
        .limit(5);
    
    if (statsNoMetricsExamples) {
        statsNoMetricsExamples.forEach((log, i) => {
            const statCount = log.stats ? Object.keys(log.stats).length : 0;
            console.log(`   Example ${i+1}: Player ${log.player_id}, ${statCount} stats, metrics: ${JSON.stringify(log.computed_metrics)}`);
        });
    }

    // Summary and recommendations
    console.log('\n\n📊 COVERAGE GAP SUMMARY:');
    console.log('=======================\n');

    let totalEmptyStats = 0;
    let totalStatsNoMetrics = 0;
    let totalZeroMinutes = 0;

    analyses.forEach(a => {
        totalEmptyStats += a.logsWithEmptyStats;
        totalStatsNoMetrics += a.logsWithStatsNoMetrics;
        totalZeroMinutes += a.minimalPlayTime;
    });

    const emptyStatsPct = totalLogs ? (totalEmptyStats / totalLogs * 100) : 0;
    const statsNoMetricsPct = totalLogs ? (totalStatsNoMetrics / totalLogs * 100) : 0;
    const zeroMinutesPct = totalLogs ? (totalZeroMinutes / totalLogs * 100) : 0;

    console.log(`📌 Empty Stats (Bench/DNP): ${totalEmptyStats.toLocaleString()} (${emptyStatsPct.toFixed(1)}%)`);
    console.log(`📌 Stats but No Metrics: ${totalStatsNoMetrics.toLocaleString()} (${statsNoMetricsPct.toFixed(1)}%)`);
    console.log(`📌 Zero Minutes Played: ${totalZeroMinutes.toLocaleString()} (${zeroMinutesPct.toFixed(1)}%)`);

    console.log('\n\n🎯 RECOMMENDATIONS TO REACH 85%+ COVERAGE:');
    console.log('=========================================\n');

    console.log('1. **Handle Empty Stats Logs** (~' + emptyStatsPct.toFixed(0) + '% of total):');
    console.log('   - These are likely bench players or DNPs');
    console.log('   - Consider creating minimal metrics (all zeros) for completeness');
    console.log('   - Or exclude from coverage calculations if intentional\n');

    console.log('2. **Fix Stats→Metrics Conversion** (~' + statsNoMetricsPct.toFixed(0) + '% of total):');
    console.log('   - Debug why these logs have stats but no computed metrics');
    console.log('   - Check for edge cases in metric calculators');
    console.log('   - Ensure all sport-specific calculators handle all stat variations\n');

    console.log('3. **Sport-Specific Issues**:');
    analyses.sort((a, b) => a.coverage - b.coverage).forEach(a => {
        if (a.coverage < 70) {
            console.log(`   - ${a.sport}: Only ${a.coverage.toFixed(1)}% coverage`);
            console.log(`     • ${a.logsWithEmptyStats} empty stats`);
            console.log(`     • ${a.logsWithStatsNoMetrics} failed conversions`);
        }
    });

    console.log('\n4. **Quick Wins**:');
    console.log('   - Process the ' + totalStatsNoMetrics.toLocaleString() + ' logs that have stats but no metrics');
    console.log('   - This alone would increase coverage by ~' + statsNoMetricsPct.toFixed(0) + '%');
    console.log('   - Total potential coverage: ' + (overallCoverage + statsNoMetricsPct).toFixed(1) + '%');

    // Calculate achievable coverage
    const achievableCoverage = ((logsWithMetrics! + totalStatsNoMetrics) / totalLogs! * 100);
    console.log(`\n✅ ACHIEVABLE COVERAGE: ${achievableCoverage.toFixed(1)}%`);
    console.log('   (By processing all logs with stats but no metrics)');
}

analyzeUltimateCoverageGaps()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Analysis failed:', error);
        process.exit(1);
    });
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyFinalCoverage() {
    console.log('🏆 FINAL COVERAGE VERIFICATION');
    console.log('==============================\n');
    
    const sports = [
        { name: 'NBA', query: 'NBA' },
        { name: 'NFL', query: 'NFL' }, 
        { name: 'nfl', query: 'nfl' },
        { name: 'NHL', query: 'NHL' }
    ];
    
    let grandTotals = {
        totalLogs: 0,
        withStats: 0,
        withMetrics: 0,
        realisticLogs: 0,
        realisticWithMetrics: 0
    };
    
    console.log('📊 SPORT-BY-SPORT BREAKDOWN:');
    console.log('============================\n');
    
    for (const sport of sports) {
        const { data: games } = await supabase
            .from('games')
            .select('id')
            .eq('sport', sport.query);
        
        if (!games || games.length === 0) continue;
        const gameIds = games.map(g => g.id);
        
        // Total logs
        const { count: totalLogs } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds);
        
        // Logs with stats (realistic candidates for metrics)
        const { count: withStats } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds)
            .not('stats', 'eq', '{}')
            .not('stats', 'is', null);
        
        // Logs with metrics
        const { count: withMetrics } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds)
            .not('computed_metrics', 'eq', '{}')
            .not('computed_metrics', 'is', null);
        
        const overallCoverage = totalLogs ? (withMetrics / totalLogs * 100) : 0;
        const realisticCoverage = withStats ? (withMetrics / withStats * 100) : 0;
        
        console.log(`${sport.name}:`);
        console.log(`  Total Logs: ${totalLogs || 0}`);
        console.log(`  With Stats: ${withStats || 0} (${totalLogs ? (withStats / totalLogs * 100).toFixed(1) : 0}%)`);
        console.log(`  With Metrics: ${withMetrics || 0}`);
        console.log(`  Overall Coverage: ${overallCoverage.toFixed(1)}%`);
        console.log(`  Realistic Coverage: ${realisticCoverage.toFixed(1)}% (of logs with stats)`);
        console.log('');
        
        grandTotals.totalLogs += totalLogs || 0;
        grandTotals.withStats += withStats || 0;
        grandTotals.withMetrics += withMetrics || 0;
    }
    
    // Calculate final metrics
    const finalOverallCoverage = grandTotals.totalLogs ? 
        (grandTotals.withMetrics / grandTotals.totalLogs * 100) : 0;
    const finalRealisticCoverage = grandTotals.withStats ? 
        (grandTotals.withMetrics / grandTotals.withStats * 100) : 0;
    
    console.log('🏆 GRAND TOTALS:');
    console.log('================');
    console.log(`Total Logs: ${grandTotals.totalLogs}`);
    console.log(`With Stats (Realistic): ${grandTotals.withStats}`);
    console.log(`With Metrics: ${grandTotals.withMetrics}`);
    console.log(`\n📈 OVERALL COVERAGE: ${finalOverallCoverage.toFixed(1)}%`);
    console.log(`🎯 REALISTIC COVERAGE: ${finalRealisticCoverage.toFixed(1)}% (of logs with stats)`);
    
    // Achievement check
    console.log('\n✅ ACHIEVEMENT STATUS:');
    if (finalOverallCoverage >= 80) {
        console.log(`✅ OVERALL: Achieved ${finalOverallCoverage.toFixed(1)}% coverage (Target: 80%+)`);
    }
    if (finalRealisticCoverage >= 85) {
        console.log(`✅ REALISTIC: Achieved ${finalRealisticCoverage.toFixed(1)}% coverage of logs with stats (Target: 85%+)`);
    }
    
    // Sample some metrics to show quality
    console.log('\n📋 SAMPLE METRICS QUALITY CHECK:');
    
    const { data: nbaSample } = await supabase
        .from('player_game_logs')
        .select('stats, computed_metrics')
        .in('game_id', (await supabase.from('games').select('id').eq('sport', 'NBA')).data?.map(g => g.id) || [])
        .not('computed_metrics', 'eq', '{}')
        .gt('stats->points', '20')
        .limit(3);
    
    if (nbaSample && nbaSample.length > 0) {
        console.log('\n🏀 NBA High Scorers:');
        nbaSample.forEach((log, i) => {
            const pts = log.stats?.points || 0;
            const ts = log.computed_metrics?.true_shooting_pct;
            const usage = log.computed_metrics?.usage_rate;
            const gameScore = log.computed_metrics?.game_score;
            console.log(`  Player ${i+1}: ${pts} pts → TS%: ${ts}, Usage: ${usage}, GameScore: ${gameScore}`);
        });
    }
    
    console.log('\n🎉 FINAL COVERAGE VERIFICATION COMPLETE!');
}

verifyFinalCoverage()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Verification failed:', error);
        process.exit(1);
    });
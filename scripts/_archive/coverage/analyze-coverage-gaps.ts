import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeCoverageGaps() {
    console.log('🔍 COMPREHENSIVE COVERAGE GAP ANALYSIS');
    console.log('======================================\n');
    
    const sports = [
        { name: 'NBA', query: 'NBA' },
        { name: 'NFL', query: 'NFL' }, 
        { name: 'nfl', query: 'nfl' },
        { name: 'NHL', query: 'NHL' }
    ];
    
    let grandTotals = {
        totalLogs: 0,
        emptyStats: 0,
        nullStats: 0,
        withStats: 0,
        withMetrics: 0,
        statsButNoMetrics: 0,
        zeroMinutes: 0,
        lowMinutes: 0
    };
    
    for (const sport of sports) {
        console.log(`📊 Analyzing ${sport.name} (games.sport = "${sport.query}")...`);
        
        // Get game IDs for this sport
        const { data: games } = await supabase
            .from('games')
            .select('id')
            .eq('sport', sport.query);
        
        if (!games || games.length === 0) continue;
        const gameIds = games.map(g => g.id);
        
        // 1. Total logs for this sport
        const { count: totalLogs } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds);
        
        // 2. Logs with empty stats {}
        const { count: emptyStats } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds)
            .eq('stats', '{}');
        
        // 3. Logs with null stats
        const { count: nullStats } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds)
            .is('stats', null);
        
        // 4. Logs with actual stats data
        const { count: withStats } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds)
            .not('stats', 'eq', '{}')
            .not('stats', 'is', null);
        
        // 5. Logs with computed metrics
        const { count: withMetrics } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds)
            .not('computed_metrics', 'eq', '{}')
            .not('computed_metrics', 'is', null);
        
        // 6. KEY METRIC: Logs with stats but NO metrics (these should have been processed!)
        const statsButNoMetrics = (withStats || 0) - (withMetrics || 0);
        
        // 7. Sample analysis of playing time
        const { data: timeSample } = await supabase
            .from('player_game_logs')
            .select('minutes_played, stats')
            .in('game_id', gameIds)
            .not('stats', 'eq', '{}')
            .limit(100);
        
        let zeroMinutes = 0;
        let lowMinutes = 0; // < 5 minutes
        
        if (timeSample) {
            timeSample.forEach(log => {
                const minutes = parseFloat(log.minutes_played) || 0;
                // Also check stats for minutes field
                const statsMinutes = log.stats?.minutes_played || log.stats?.minutes || 0;
                const actualMinutes = minutes || parseFloat(statsMinutes) || 0;
                
                if (actualMinutes === 0) zeroMinutes++;
                else if (actualMinutes < 5) lowMinutes++;
            });
        }
        
        // Display results
        console.log(`  📈 Total Logs: ${totalLogs || 0}`);
        console.log(`  ❌ Empty Stats {}: ${emptyStats || 0} (${totalLogs ? ((emptyStats || 0) / totalLogs * 100).toFixed(1) : 0}%)`);
        console.log(`  ❌ Null Stats: ${nullStats || 0} (${totalLogs ? ((nullStats || 0) / totalLogs * 100).toFixed(1) : 0}%)`);
        console.log(`  ✅ With Stats Data: ${withStats || 0} (${totalLogs ? ((withStats || 0) / totalLogs * 100).toFixed(1) : 0}%)`);
        console.log(`  📊 With Metrics: ${withMetrics || 0} (${totalLogs ? ((withMetrics || 0) / totalLogs * 100).toFixed(1) : 0}%)`);
        console.log(`  🔥 STATS BUT NO METRICS: ${statsButNoMetrics} logs - THESE CAN BE FIXED!`);
        console.log(`  ⏱️  Playing Time Sample (100 logs): ${zeroMinutes} with 0 min, ${lowMinutes} with <5 min`);
        
        // Update grand totals
        grandTotals.totalLogs += totalLogs || 0;
        grandTotals.emptyStats += emptyStats || 0;
        grandTotals.nullStats += nullStats || 0;
        grandTotals.withStats += withStats || 0;
        grandTotals.withMetrics += withMetrics || 0;
        grandTotals.statsButNoMetrics += statsButNoMetrics;
        grandTotals.zeroMinutes += zeroMinutes;
        grandTotals.lowMinutes += lowMinutes;
        
        console.log('');
    }
    
    // Grand summary
    console.log('🏆 GRAND TOTALS ACROSS ALL SPORTS:');
    console.log('==================================');
    console.log(`📊 Total Logs: ${grandTotals.totalLogs}`);
    console.log(`❌ Empty/Null Stats: ${grandTotals.emptyStats + grandTotals.nullStats} (${((grandTotals.emptyStats + grandTotals.nullStats) / grandTotals.totalLogs * 100).toFixed(1)}%)`);
    console.log(`✅ With Stats Data: ${grandTotals.withStats} (${(grandTotals.withStats / grandTotals.totalLogs * 100).toFixed(1)}%)`);
    console.log(`📈 With Metrics: ${grandTotals.withMetrics} (${(grandTotals.withMetrics / grandTotals.totalLogs * 100).toFixed(1)}%)`);
    console.log(`\n🔥 BIGGEST OPPORTUNITY: ${grandTotals.statsButNoMetrics} logs have stats but NO metrics!`);
    console.log(`   This represents ${(grandTotals.statsButNoMetrics / grandTotals.totalLogs * 100).toFixed(1)}% potential coverage gain!`);
    
    // Deeper analysis of the gap
    console.log('\n📋 DETAILED GAP BREAKDOWN:');
    console.log('=========================');
    
    // Sample some logs with stats but no metrics
    const { data: gapSample } = await supabase
        .from('player_game_logs')
        .select('id, stats, computed_metrics, minutes_played')
        .not('stats', 'eq', '{}')
        .eq('computed_metrics', '{}')
        .limit(10);
    
    if (gapSample && gapSample.length > 0) {
        console.log('\n🔍 Sample logs with stats but NO metrics:');
        gapSample.forEach((log, i) => {
            const statKeys = Object.keys(log.stats || {});
            console.log(`  Log ${log.id}: ${statKeys.length} stat fields, minutes: ${log.minutes_played || 'null'}`);
            console.log(`    Stats preview: ${statKeys.slice(0, 5).join(', ')}...`);
        });
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS TO REACH 85%+ COVERAGE:');
    console.log('=========================================');
    console.log(`1. 🎯 Quick Win: Process ${grandTotals.statsButNoMetrics} logs with stats but no metrics`);
    console.log(`   Potential gain: +${(grandTotals.statsButNoMetrics / grandTotals.totalLogs * 100).toFixed(1)}% coverage`);
    console.log('\n2. 🏀 Smart Filtering: Exclude bench/DNP players from coverage calculation');
    console.log(`   Empty/null stats: ${grandTotals.emptyStats + grandTotals.nullStats} logs (${((grandTotals.emptyStats + grandTotals.nullStats) / grandTotals.totalLogs * 100).toFixed(1)}%)`);
    console.log('\n3. ⏱️  Minimum Playing Time: Skip players with <1 minute');
    console.log(`   Based on sample: ~${(grandTotals.zeroMinutes / 4).toFixed(0)}% have 0 minutes`);
    
    const realisticTotal = grandTotals.withStats;
    const currentMetrics = grandTotals.withMetrics;
    const potentialMetrics = currentMetrics + grandTotals.statsButNoMetrics;
    
    console.log('\n📈 COVERAGE PROJECTIONS:');
    console.log(`Current: ${currentMetrics}/${grandTotals.totalLogs} = ${(currentMetrics / grandTotals.totalLogs * 100).toFixed(1)}%`);
    console.log(`With Gap Fixed: ${potentialMetrics}/${grandTotals.totalLogs} = ${(potentialMetrics / grandTotals.totalLogs * 100).toFixed(1)}%`);
    console.log(`Realistic (stats only): ${currentMetrics}/${realisticTotal} = ${(currentMetrics / realisticTotal * 100).toFixed(1)}%`);
    console.log(`Realistic Potential: ${potentialMetrics}/${realisticTotal} = ${(potentialMetrics / realisticTotal * 100).toFixed(1)}%`);
}

analyzeCoverageGaps()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Coverage analysis failed:', error);
        process.exit(1);
    });
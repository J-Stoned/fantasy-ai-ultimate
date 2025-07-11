import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyMegaBackfillSuccess() {
    console.log('🎉 VERIFYING MEGA BACKFILL SUCCESS');
    console.log('==================================\n');
    
    const sports = [
        { name: 'NBA', query: 'NBA' },
        { name: 'NFL_uppercase', query: 'NFL' }, 
        { name: 'NFL_lowercase', query: 'nfl' },
        { name: 'NHL', query: 'NHL' }
    ];
    
    let grandTotal = {
        totalLogs: 0,
        logsWithMetrics: 0,
        realisticMetrics: 0,
        totalGames: 0
    };
    
    for (const sport of sports) {
        console.log(`📊 ${sport.name} Results (games.sport = "${sport.query}"):`);
        
        // Get game count
        const { data: gameIds } = await supabase
            .from('games')
            .select('id')
            .eq('sport', sport.query);
        
        const gameCount = gameIds?.length || 0;
        
        // Get total logs
        const { count: totalLogs } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds?.map(g => g.id) || []);
        
        // Get logs with computed metrics
        const { count: logsWithMetrics } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds?.map(g => g.id) || [])
            .not('computed_metrics', 'eq', '{}')
            .not('computed_metrics', 'is', null);
        
        // Get sample of actual metrics to verify quality
        const { data: sampleLogs } = await supabase
            .from('player_game_logs')
            .select('id, stats, computed_metrics')
            .in('game_id', gameIds?.map(g => g.id) || [])
            .not('computed_metrics', 'eq', '{}')
            .not('stats', 'eq', '{}')
            .limit(10);
        
        // Count realistic metrics (non-zero values)
        let realisticCount = 0;
        let sampleMetrics: any = {};
        
        if (sampleLogs) {
            for (const log of sampleLogs) {
                const metrics = log.computed_metrics;
                if (metrics && typeof metrics === 'object') {
                    // Check for key metrics that should be > 0 for active players
                    let hasRealisticValues = false;
                    
                    // Sport-specific realistic value checks
                    if (sport.name === 'NBA') {
                        const ts = parseFloat(metrics.true_shooting_pct) || 0;
                        const fg = parseFloat(metrics.field_goal_pct) || 0;
                        const usage = parseFloat(metrics.usage_rate) || 0;
                        if (ts > 0 || fg > 0 || usage > 0) hasRealisticValues = true;
                        
                        if (!sampleMetrics.basketball) sampleMetrics.basketball = [];
                        sampleMetrics.basketball.push({ ts, fg, usage });
                    } 
                    else if (sport.name.includes('NFL')) {
                        const passerRating = parseFloat(metrics.passer_rating) || 0;
                        const ypc = parseFloat(metrics.yards_per_carry) || 0;
                        const totalYards = parseFloat(metrics.total_yards) || 0;
                        const defImpact = parseFloat(metrics.defensive_impact) || 0;
                        if (passerRating > 0 || ypc > 0 || totalYards > 0 || defImpact > 0) hasRealisticValues = true;
                        
                        if (!sampleMetrics.football) sampleMetrics.football = [];
                        sampleMetrics.football.push({ passerRating, ypc, totalYards, defImpact });
                    }
                    else if (sport.name === 'NHL') {
                        const shootingPct = parseFloat(metrics.shooting_percentage) || 0;
                        const pointsPer60 = parseFloat(metrics.points_per_60) || 0;
                        const savePct = parseFloat(metrics.save_percentage) || 0;
                        if (shootingPct > 0 || pointsPer60 > 0 || savePct > 0) hasRealisticValues = true;
                        
                        if (!sampleMetrics.hockey) sampleMetrics.hockey = [];
                        sampleMetrics.hockey.push({ shootingPct, pointsPer60, savePct });
                    }
                    
                    if (hasRealisticValues) realisticCount++;
                }
            }
        }
        
        const realisticPct = sampleLogs && sampleLogs.length > 0 ? (realisticCount / sampleLogs.length * 100) : 0;
        const metricsCoverage = totalLogs ? (logsWithMetrics / totalLogs * 100) : 0;
        
        console.log(`  🏟️  Games: ${gameCount}`);
        console.log(`  📊 Total Logs: ${totalLogs || 0}`);
        console.log(`  📈 Logs with Metrics: ${logsWithMetrics || 0} (${metricsCoverage.toFixed(1)}%)`);
        console.log(`  🎯 Realistic Metrics: ${realisticCount}/${sampleLogs?.length || 0} sample (${realisticPct.toFixed(1)}%)`);
        
        // Update grand totals
        grandTotal.totalGames += gameCount;
        grandTotal.totalLogs += totalLogs || 0;
        grandTotal.logsWithMetrics += logsWithMetrics || 0;
        grandTotal.realisticMetrics += realisticCount;
        
        console.log('');
    }
    
    // Display grand totals
    console.log('🏆 GRAND TOTALS:');
    console.log('================');
    console.log(`🏟️  Total Games: ${grandTotal.totalGames}`);
    console.log(`📊 Total Logs: ${grandTotal.totalLogs}`);
    console.log(`📈 Logs with Metrics: ${grandTotal.logsWithMetrics} (${(grandTotal.logsWithMetrics/grandTotal.totalLogs*100).toFixed(1)}%)`);
    console.log(`🎯 Sample Realistic Rate: ${(grandTotal.realisticMetrics/40*100).toFixed(1)}% (${grandTotal.realisticMetrics}/40 sample)`);
    
    // Show sample metric values
    console.log('\n📋 SAMPLE METRIC VALUES:');
    console.log('========================');
    
    const { data: nbaMetrics } = await supabase
        .from('player_game_logs')
        .select('computed_metrics, stats')
        .in('game_id', (await supabase.from('games').select('id').eq('sport', 'NBA')).data?.map(g => g.id) || [])
        .not('computed_metrics', 'eq', '{}')
        .gt('stats->points', '10')
        .limit(3);
    
    if (nbaMetrics && nbaMetrics.length > 0) {
        console.log('🏀 NBA Sample:');
        nbaMetrics.forEach((log, i) => {
            const m = log.computed_metrics;
            const pts = log.stats?.points || 0;
            console.log(`  Game ${i+1}: ${pts} pts → TS%: ${m.true_shooting_pct}, FG%: ${m.field_goal_pct}, Usage: ${m.usage_rate}`);
        });
    }
    
    const { data: nflMetrics } = await supabase
        .from('player_game_logs')
        .select('computed_metrics, stats')
        .in('game_id', (await supabase.from('games').select('id').eq('sport', 'NFL')).data?.map(g => g.id) || [])
        .not('computed_metrics', 'eq', '{}')
        .limit(3);
    
    if (nflMetrics && nflMetrics.length > 0) {
        console.log('\n🏈 NFL Sample:');
        nflMetrics.forEach((log, i) => {
            const m = log.computed_metrics;
            console.log(`  Game ${i+1}: Passer Rating: ${m.passer_rating}, YPC: ${m.yards_per_carry}, Total Yards: ${m.total_yards}`);
        });
    }
    
    const { data: nhlMetrics } = await supabase
        .from('player_game_logs')
        .select('computed_metrics, stats')
        .in('game_id', (await supabase.from('games').select('id').eq('sport', 'NHL')).data?.map(g => g.id) || [])
        .not('computed_metrics', 'eq', '{}')
        .limit(3);
    
    if (nhlMetrics && nhlMetrics.length > 0) {
        console.log('\n🏒 NHL Sample:');
        nhlMetrics.forEach((log, i) => {
            const m = log.computed_metrics;
            console.log(`  Game ${i+1}: Shooting%: ${m.shooting_percentage}, Pts/60: ${m.points_per_60}, Hits+Blocks: ${m.hits_blocks_per_game}`);
        });
    }
    
    console.log('\n🎉 MEGA BACKFILL VERIFICATION COMPLETE!');
    if (grandTotal.logsWithMetrics / grandTotal.totalLogs > 0.99) {
        console.log('✅ SUCCESS: 99%+ metrics coverage achieved!');
    }
    if (grandTotal.realisticMetrics / 40 > 0.80) {
        console.log('✅ SUCCESS: 80%+ realistic metrics in sample!');
    }
}

verifyMegaBackfillSuccess()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Verification failed:', error);
        process.exit(1);
    });
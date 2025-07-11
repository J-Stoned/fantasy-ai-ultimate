import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyNBAMetrics() {
    console.log('🔍 VERIFYING NBA METRICS CALCULATION');
    console.log('=====================================\n');
    
    // Get NBA logs with actual stats
    const { data: logs, error } = await supabase
        .from('player_game_logs')
        .select(`
            id,
            stats,
            computed_metrics,
            players!inner(sport)
        `)
        .eq('players.sport', 'NBA')
        .gt('stats->points', '5')
        .limit(5);
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    if (!logs || logs.length === 0) {
        console.log('❌ No NBA logs found');
        return;
    }
    
    console.log(`Found ${logs.length} NBA logs with stats > 5 points\n`);
    
    logs.forEach((log, index) => {
        console.log(`--- LOG ${index + 1} (ID: ${log.id}) ---`);
        const stats = log.stats;
        const metrics = log.computed_metrics;
        
        console.log(`Points: ${stats.points}`);
        console.log(`FGA: ${stats.fieldGoalsAttempted}, FGM: ${stats.fieldGoalsMade}`);
        console.log(`FTA: ${stats.freeThrowsAttempted}, FTM: ${stats.freeThrowsMade}`);
        console.log(`Minutes: ${stats.minutes}`);
        
        console.log('\nCalculated Metrics:');
        console.log(`- True Shooting %: ${metrics.true_shooting_pct}`);
        console.log(`- Field Goal %: ${metrics.field_goal_pct}`);
        console.log(`- Usage Rate: ${metrics.usage_rate}`);
        console.log(`- Game Score: ${metrics.game_score}`);
        console.log(`- Points per Minute: ${metrics.points_per_minute}`);
        
        // Manual verification
        const pts = parseFloat(stats.points) || 0;
        const fga = parseFloat(stats.fieldGoalsAttempted) || 0;
        const fgm = parseFloat(stats.fieldGoalsMade) || 0;
        const fta = parseFloat(stats.freeThrowsAttempted) || 0;
        
        const manualFGPct = fga > 0 ? (fgm / fga) : 0;
        const tsa = fga + 0.44 * fta;
        const manualTSPct = tsa > 0 ? (pts / (2 * tsa)) : 0;
        
        console.log('\n✅ Manual Verification:');
        console.log(`- Manual FG%: ${manualFGPct.toFixed(3)} vs Calculated: ${metrics.field_goal_pct}`);
        console.log(`- Manual TS%: ${manualTSPct.toFixed(3)} vs Calculated: ${metrics.true_shooting_pct}`);
        
        console.log('\n' + '='.repeat(50) + '\n');
    });
    
    // Get aggregate stats
    console.log('📊 AGGREGATE NBA METRICS STATS');
    console.log('===============================\n');
    
    const { data: aggData } = await supabase
        .from('player_game_logs')
        .select(`
            computed_metrics,
            players!inner(sport)
        `)
        .eq('players.sport', 'NBA')
        .not('computed_metrics', 'eq', '{}');
    
    if (aggData && aggData.length > 0) {
        const nonZeroTS = aggData.filter(d => parseFloat(d.computed_metrics.true_shooting_pct) > 0).length;
        const nonZeroFG = aggData.filter(d => parseFloat(d.computed_metrics.field_goal_pct) > 0).length;
        const nonZeroUsage = aggData.filter(d => parseFloat(d.computed_metrics.usage_rate) > 0).length;
        
        const avgTS = aggData
            .map(d => parseFloat(d.computed_metrics.true_shooting_pct) || 0)
            .filter(val => val > 0)
            .reduce((sum, val, _, arr) => sum + val / arr.length, 0);
            
        const avgFG = aggData
            .map(d => parseFloat(d.computed_metrics.field_goal_pct) || 0)
            .filter(val => val > 0)
            .reduce((sum, val, _, arr) => sum + val / arr.length, 0);
        
        console.log(`Total NBA logs with computed metrics: ${aggData.length}`);
        console.log(`Non-zero True Shooting %: ${nonZeroTS} (${(nonZeroTS/aggData.length*100).toFixed(1)}%)`);
        console.log(`Non-zero Field Goal %: ${nonZeroFG} (${(nonZeroFG/aggData.length*100).toFixed(1)}%)`);
        console.log(`Non-zero Usage Rate: ${nonZeroUsage} (${(nonZeroUsage/aggData.length*100).toFixed(1)}%)`);
        console.log(`Average True Shooting % (non-zero): ${avgTS.toFixed(3)}`);
        console.log(`Average Field Goal % (non-zero): ${avgFG.toFixed(3)}`);
    }
}

verifyNBAMetrics()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Verification failed:', error);
        process.exit(1);
    });
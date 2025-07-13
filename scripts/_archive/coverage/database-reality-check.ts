import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function databaseRealityCheck() {
    console.log('🔍 DATABASE REALITY CHECK - WHAT\'S ACTUALLY IN SUPABASE?');
    console.log('========================================================\n');
    
    // 1. GRAND TOTAL CHECK
    const { count: totalLogs } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
    
    const { count: logsWithMetrics } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .not('computed_metrics', 'eq', '{}')
        .not('computed_metrics', 'is', null);
    
    console.log('📊 GRAND TOTAL IN DATABASE:');
    console.log(`   Total Logs: ${totalLogs || 0}`);
    console.log(`   Logs with Metrics: ${logsWithMetrics || 0}`);
    console.log(`   Coverage: ${totalLogs ? ((logsWithMetrics || 0) / totalLogs * 100).toFixed(1) : 0}%`);
    console.log('');
    
    // 2. CHECK EACH SPORT
    const sports = ['NBA', 'NFL', 'nfl', 'NHL'];
    
    console.log('📈 BREAKDOWN BY SPORT:');
    for (const sport of sports) {
        const { data: games } = await supabase
            .from('games')
            .select('id')
            .eq('sport', sport);
        
        if (games && games.length > 0) {
            const gameIds = games.map(g => g.id);
            
            const { count: sportLogs } = await supabase
                .from('player_game_logs')
                .select('*', { count: 'exact', head: true })
                .in('game_id', gameIds);
            
            const { count: sportMetrics } = await supabase
                .from('player_game_logs')
                .select('*', { count: 'exact', head: true })
                .in('game_id', gameIds)
                .not('computed_metrics', 'eq', '{}');
            
            console.log(`   ${sport}: ${sportLogs || 0} logs, ${sportMetrics || 0} with metrics (${sportLogs ? ((sportMetrics || 0) / sportLogs * 100).toFixed(1) : 0}%)`);
        }
    }
    
    // 3. SAMPLE SOME ACTUAL METRICS
    console.log('\n🎯 SAMPLE ACTUAL METRICS FROM DATABASE:');
    
    // NBA Sample
    const { data: nbaSample } = await supabase
        .from('player_game_logs')
        .select('id, stats, computed_metrics')
        .in('game_id', (await supabase.from('games').select('id').eq('sport', 'NBA')).data?.map(g => g.id) || [])
        .not('computed_metrics', 'eq', '{}')
        .limit(3);
    
    if (nbaSample && nbaSample.length > 0) {
        console.log('\n🏀 NBA ACTUAL DATABASE VALUES:');
        nbaSample.forEach((log, i) => {
            const pts = log.stats?.points || 0;
            const ts = log.computed_metrics?.true_shooting_pct;
            const fg = log.computed_metrics?.field_goal_pct;
            const usage = log.computed_metrics?.usage_rate;
            console.log(`   Log ${log.id}: ${pts} pts → TS%: ${ts}, FG%: ${fg}, Usage: ${usage}`);
        });
    }
    
    // NFL Sample
    const { data: nflSample } = await supabase
        .from('player_game_logs')
        .select('id, stats, computed_metrics')
        .in('game_id', (await supabase.from('games').select('id').eq('sport', 'NFL')).data?.map(g => g.id) || [])
        .not('computed_metrics', 'eq', '{}')
        .limit(3);
    
    if (nflSample && nflSample.length > 0) {
        console.log('\n🏈 NFL ACTUAL DATABASE VALUES:');
        nflSample.forEach((log, i) => {
            const metricKeys = Object.keys(log.computed_metrics || {});
            console.log(`   Log ${log.id}: Has ${metricKeys.length} metrics - ${metricKeys.slice(0, 5).join(', ')}...`);
        });
    }
    
    console.log('\n✅ THIS IS YOUR ACTUAL DATABASE STATE RIGHT NOW!');
}

databaseRealityCheck()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Reality check failed:', error);
        process.exit(1);
    });
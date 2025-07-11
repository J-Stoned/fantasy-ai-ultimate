import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deeperSportsAnalysis() {
    console.log('🔍 DEEPER SPORTS DATA ANALYSIS');
    console.log('==============================\n');
    
    const sports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAA_BB', 'NCAA_FB'];
    
    for (const sport of sports) {
        console.log(`📊 Deep analysis of ${sport}...`);
        
        // Check total logs for this sport
        const { count: totalLogs } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('player_id', 
                (await supabase.from('players').select('id').eq('sport', sport)).data?.map(p => p.id) || []
            );
        
        // Check logs with ANY stats (not empty)
        const { count: logsWithStats } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('player_id', 
                (await supabase.from('players').select('id').eq('sport', sport)).data?.map(p => p.id) || []
            )
            .not('stats', 'eq', '{}')
            .not('stats', 'is', null);
        
        // Check logs with computed metrics
        const { count: logsWithMetrics } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('player_id', 
                (await supabase.from('players').select('id').eq('sport', sport)).data?.map(p => p.id) || []
            )
            .not('computed_metrics', 'eq', '{}')
            .not('computed_metrics', 'is', null);
        
        console.log(`  Total logs: ${totalLogs || 0}`);
        console.log(`  Logs with stats: ${logsWithStats || 0} (${totalLogs ? ((logsWithStats || 0) / totalLogs * 100).toFixed(1) : 0}%)`);
        console.log(`  Logs with computed_metrics: ${logsWithMetrics || 0} (${totalLogs ? ((logsWithMetrics || 0) / totalLogs * 100).toFixed(1) : 0}%)`);
        
        if (logsWithStats && logsWithStats > 0) {
            // Get a sample of actual stats data
            const { data: sampleLogs } = await supabase
                .from('player_game_logs')
                .select(`
                    id,
                    stats,
                    computed_metrics,
                    players!inner(sport)
                `)
                .eq('players.sport', sport)
                .not('stats', 'eq', '{}')
                .not('stats', 'is', null)
                .limit(3);
            
            if (sampleLogs && sampleLogs.length > 0) {
                console.log(`\n  📋 Sample ${sport} stats structure:`);
                sampleLogs.forEach((log, i) => {
                    console.log(`    Log ${i + 1} (ID: ${log.id}):`);
                    if (log.stats && typeof log.stats === 'object') {
                        const fields = Object.keys(log.stats);
                        console.log(`      Fields (${fields.length}): ${fields.slice(0, 8).join(', ')}${fields.length > 8 ? '...' : ''}`);
                        
                        // Show a few sample values
                        fields.slice(0, 3).forEach(field => {
                            console.log(`      ${field}: ${log.stats[field]} (${typeof log.stats[field]})`);
                        });
                    } else {
                        console.log(`      Stats: ${JSON.stringify(log.stats)}`);
                    }
                    
                    console.log(`      Computed metrics: ${Object.keys(log.computed_metrics || {}).length} fields`);
                });
            }
        } else {
            // Check if stats are stored in different format
            const { data: rawSample } = await supabase
                .from('player_game_logs')
                .select(`
                    id,
                    stats,
                    raw_stats,
                    computed_metrics,
                    players!inner(sport)
                `)
                .eq('players.sport', sport)
                .limit(5);
            
            if (rawSample && rawSample.length > 0) {
                console.log(`\n  🔍 Checking alternative stats storage for ${sport}:`);
                rawSample.forEach((log, i) => {
                    console.log(`    Log ${i + 1}: stats=${JSON.stringify(log.stats)}, raw_stats=${JSON.stringify(log.raw_stats)}`);
                });
            }
        }
        
        console.log('\n' + '='.repeat(50) + '\n');
    }
    
    // Check if there are any logs without sport mapping
    console.log('🔍 CHECKING FOR UNMAPPED SPORTS...');
    
    const { data: unmappedLogs } = await supabase
        .from('player_game_logs')
        .select(`
            id,
            player_id,
            stats,
            players(sport)
        `)
        .is('players.sport', null)
        .limit(10);
    
    if (unmappedLogs && unmappedLogs.length > 0) {
        console.log(`❗ Found ${unmappedLogs.length} logs with NULL sport mapping`);
        unmappedLogs.forEach((log, i) => {
            console.log(`  Unmapped log ${i + 1}: ID=${log.id}, player_id=${log.player_id}, has_stats=${!!log.stats && Object.keys(log.stats).length > 0}`);
        });
    } else {
        console.log('✅ No unmapped sport logs found');
    }
    
    // Check games table for sport distribution
    console.log('\n🎯 GAMES TABLE SPORT DISTRIBUTION:');
    const { data: gamesSports } = await supabase
        .from('games')
        .select('sport')
        .not('sport', 'is', null);
    
    if (gamesSports) {
        const sportCounts = gamesSports.reduce((acc: any, game) => {
            acc[game.sport] = (acc[game.sport] || 0) + 1;
            return acc;
        }, {});
        
        Object.entries(sportCounts).forEach(([sport, count]) => {
            console.log(`  ${sport}: ${count} games`);
        });
    }
}

deeperSportsAnalysis()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Analysis failed:', error);
        process.exit(1);
    });
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugNBAStats() {
    console.log('🔍 DEBUGGING NBA STATS STRUCTURE');
    console.log('==================================\n');
    
    // Get a sample of NBA logs with stats
    const { data: logs, error } = await supabase
        .from('player_game_logs')
        .select(`
            id,
            stats,
            computed_metrics,
            minutes_played,
            players!inner(sport)
        `)
        .eq('players.sport', 'NBA')
        .not('stats', 'eq', '{}')
        .not('stats', 'is', null)
        .limit(5);
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    if (!logs || logs.length === 0) {
        console.log('❌ No NBA logs found with stats');
        return;
    }
    
    console.log(`Found ${logs.length} NBA logs with stats\n`);
    
    logs.forEach((log, index) => {
        console.log(`--- LOG ${index + 1} (ID: ${log.id}) ---`);
        console.log('Stats structure:', typeof log.stats);
        console.log('Stats content:', JSON.stringify(log.stats, null, 2));
        console.log('Minutes played column:', log.minutes_played);
        console.log('Current computed_metrics:', JSON.stringify(log.computed_metrics, null, 2));
        
        // Test manual calculation
        if (log.stats && typeof log.stats === 'object') {
            const stats = log.stats;
            console.log('\n🧮 Manual calculation test:');
            
            // Check different possible field names
            const possiblePointsFields = ['points', 'pts', 'PTS'];
            const possibleFGAFields = ['field_goals_attempted', 'fga', 'FGA'];
            const possibleFGMFields = ['field_goals_made', 'fgm', 'FGM'];
            
            console.log('Points fields check:');
            possiblePointsFields.forEach(field => {
                if (stats[field] !== undefined) {
                    console.log(`  ${field}: ${stats[field]} (${typeof stats[field]})`);
                }
            });
            
            console.log('FGA fields check:');
            possibleFGAFields.forEach(field => {
                if (stats[field] !== undefined) {
                    console.log(`  ${field}: ${stats[field]} (${typeof stats[field]})`);
                }
            });
            
            console.log('FGM fields check:');
            possibleFGMFields.forEach(field => {
                if (stats[field] !== undefined) {
                    console.log(`  ${field}: ${stats[field]} (${typeof stats[field]})`);
                }
            });
            
            // Show all available keys
            console.log('\nAll available stat keys:');
            console.log(Object.keys(stats).sort());
        }
        
        console.log('\n' + '='.repeat(50) + '\n');
    });
}

debugNBAStats()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Debug failed:', error);
        process.exit(1);
    });
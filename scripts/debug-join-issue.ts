import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugJoinIssue() {
    console.log('🔍 DEBUGGING JOIN ISSUE');
    console.log('=======================\n');
    
    // Test different query approaches
    const sports = ['NBA', 'NFL', 'nfl', 'NHL'];
    
    for (const sport of sports) {
        console.log(`Testing sport: "${sport}"`);
        
        // Method 1: Inner join with games (what we're using)
        const { count: innerJoinCount, error: innerError } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .eq('games.sport', sport);
        
        if (innerError) {
            console.log(`  ❌ Inner join error: ${innerError.message}`);
        } else {
            console.log(`  Inner join count: ${innerJoinCount || 0}`);
        }
        
        // Method 2: Manual join using game_id
        const { data: gameIds } = await supabase
            .from('games')
            .select('id')
            .eq('sport', sport);
        
        if (gameIds && gameIds.length > 0) {
            const { count: manualJoinCount } = await supabase
                .from('player_game_logs')
                .select('*', { count: 'exact', head: true })
                .in('game_id', gameIds.map(g => g.id));
            
            console.log(`  Manual join: ${gameIds.length} games, ${manualJoinCount || 0} logs`);
            
            // Test if any have stats
            const { count: withStats } = await supabase
                .from('player_game_logs')
                .select('*', { count: 'exact', head: true })
                .in('game_id', gameIds.map(g => g.id))
                .not('stats', 'eq', '{}')
                .not('stats', 'is', null);
            
            console.log(`  Logs with stats: ${withStats || 0}`);
        } else {
            console.log(`  No games found for sport "${sport}"`);
        }
        
        console.log('');
    }
    
    // Check if games table has foreign key properly linked
    console.log('🔗 CHECKING GAME_ID RELATIONSHIPS:');
    
    const { data: sampleLogs } = await supabase
        .from('player_game_logs')
        .select('id, game_id, stats')
        .not('stats', 'eq', '{}')
        .limit(5);
    
    if (sampleLogs) {
        console.log('Sample logs with stats:');
        for (const log of sampleLogs) {
            // Check if game exists
            const { data: game } = await supabase
                .from('games')
                .select('id, sport')
                .eq('id', log.game_id)
                .single();
            
            console.log(`  Log ${log.id}: game_id=${log.game_id}, game exists=${!!game}, game sport=${game?.sport || 'N/A'}`);
        }
    }
}

debugJoinIssue()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Debug failed:', error);
        process.exit(1);
    });
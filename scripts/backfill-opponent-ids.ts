import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function backfillOpponentIds() {
    console.log('🔧 BACKFILLING OPPONENT IDs');
    console.log('==========================\n');
    
    // First, count how many are missing
    const { count: missingCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .is('opponent_id', null);
        
    console.log(`Found ${missingCount || 0} logs with missing opponent_id\n`);
    
    if (missingCount === 0) {
        console.log('✅ All logs already have opponent_id!');
        return;
    }
    
    // Process in batches
    let offset = 0;
    let totalFixed = 0;
    const BATCH_SIZE = 1000;
    
    while (totalFixed < missingCount!) {
        // Get logs with missing opponent_id
        const { data: logs } = await supabase
            .from('player_game_logs')
            .select('id, game_id, is_home')
            .is('opponent_id', null)
            .range(offset, offset + BATCH_SIZE - 1);
            
        if (!logs || logs.length === 0) break;
        
        // Get unique game IDs
        const gameIds = [...new Set(logs.map(l => l.game_id))];
        
        // Fetch game data
        const { data: games } = await supabase
            .from('games')
            .select('id, home_team_id, away_team_id')
            .in('id', gameIds);
            
        if (!games) continue;
        
        // Create game lookup map
        const gameMap = new Map<number, { home_team_id: number, away_team_id: number }>();
        games.forEach(game => {
            gameMap.set(game.id, {
                home_team_id: game.home_team_id,
                away_team_id: game.away_team_id
            });
        });
        
        // Update logs with opponent_id
        const updates = logs.map(log => {
            const game = gameMap.get(log.game_id);
            if (!game) return null;
            
            const opponent_id = log.is_home ? game.away_team_id : game.home_team_id;
            
            return {
                id: log.id,
                opponent_id
            };
        }).filter(u => u !== null);
        
        // Batch update
        for (let i = 0; i < updates.length; i += 100) {
            const batch = updates.slice(i, i + 100);
            
            for (const update of batch) {
                await supabase
                    .from('player_game_logs')
                    .update({ opponent_id: update!.opponent_id })
                    .eq('id', update!.id);
            }
            
            totalFixed += batch.length;
        }
        
        console.log(`Fixed ${totalFixed}/${missingCount} logs...`);
        
        if (logs.length < BATCH_SIZE) break;
        offset += BATCH_SIZE;
    }
    
    // Verify
    const { count: stillMissing } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .is('opponent_id', null);
        
    console.log(`\n✅ Backfill complete!`);
    console.log(`   Fixed: ${totalFixed} logs`);
    console.log(`   Still missing: ${stillMissing || 0} logs`);
    
    // Check which sports have the most complete data
    console.log('\n📊 Opponent ID coverage by sport:');
    
    const sports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAA_BB', 'NCAA_FB'];
    
    for (const sport of sports) {
        // Get games for this sport
        const { data: sportGames } = await supabase
            .from('games')
            .select('id')
            .eq('sport', sport)
            .limit(100);
            
        if (!sportGames || sportGames.length === 0) continue;
        
        const gameIds = sportGames.map(g => g.id);
        
        // Count logs with and without opponent_id
        const { count: totalLogs } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds);
            
        const { count: withOpponent } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds)
            .not('opponent_id', 'is', null);
            
        const coverage = totalLogs ? ((withOpponent || 0) / totalLogs * 100).toFixed(1) : 0;
        console.log(`  ${sport}: ${withOpponent}/${totalLogs} (${coverage}%)`);
    }
}

// Also check is_home field
async function checkIsHomeField() {
    console.log('\n\n🏠 Checking is_home field coverage:');
    console.log('===================================');
    
    const { count: totalLogs } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    const { count: withIsHome } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .not('is_home', 'is', null);
        
    const coverage = totalLogs ? ((withIsHome || 0) / totalLogs * 100).toFixed(1) : 0;
    console.log(`Total coverage: ${withIsHome}/${totalLogs} (${coverage}%)`);
    
    if (coverage !== '100.0') {
        console.log('\n⚠️  Some logs missing is_home field!');
        console.log('This is needed for home/away splits and matchup analysis.');
    }
}

backfillOpponentIds()
    .then(() => checkIsHomeField())
    .catch(console.error);
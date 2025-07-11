import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function backfillOpponentIdsFast() {
    console.log('🚀 FAST BACKFILL OPPONENT IDs');
    console.log('=============================\n');
    
    // Get all games first
    const gameMap = new Map<number, { home_team_id: number, away_team_id: number }>();
    let gameOffset = 0;
    
    console.log('Loading all games...');
    while (true) {
        const { data: games } = await supabase
            .from('games')
            .select('id, home_team_id, away_team_id')
            .range(gameOffset, gameOffset + 999);
            
        if (!games || games.length === 0) break;
        
        games.forEach(game => {
            gameMap.set(game.id, {
                home_team_id: game.home_team_id,
                away_team_id: game.away_team_id
            });
        });
        
        if (games.length < 1000) break;
        gameOffset += 1000;
    }
    
    console.log(`✅ Loaded ${gameMap.size} games\n`);
    
    // Count missing
    const { count: missingCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .is('opponent_id', null);
        
    console.log(`Found ${missingCount || 0} logs with missing opponent_id\n`);
    
    if (missingCount === 0) {
        console.log('✅ All logs already have opponent_id!');
        return;
    }
    
    // Process in larger batches with parallel updates
    const BATCH_SIZE = 5000;
    const UPDATE_BATCH = 500;
    let totalFixed = 0;
    
    while (totalFixed < missingCount!) {
        // Get logs with missing opponent_id
        const { data: logs } = await supabase
            .from('player_game_logs')
            .select('id, game_id, is_home')
            .is('opponent_id', null)
            .limit(BATCH_SIZE);
            
        if (!logs || logs.length === 0) break;
        
        // Build updates
        const updates = logs.map(log => {
            const game = gameMap.get(log.game_id);
            if (!game || log.is_home === null) return null;
            
            const opponent_id = log.is_home ? game.away_team_id : game.home_team_id;
            
            return {
                id: log.id,
                opponent_id
            };
        }).filter(u => u !== null);
        
        // Parallel batch updates
        const updatePromises = [];
        for (let i = 0; i < updates.length; i += UPDATE_BATCH) {
            const batch = updates.slice(i, i + UPDATE_BATCH);
            
            updatePromises.push(
                supabase
                    .from('player_game_logs')
                    .upsert(batch.map(u => ({
                        id: u!.id,
                        opponent_id: u!.opponent_id
                    })), {
                        onConflict: 'id',
                        ignoreDuplicates: false
                    })
            );
        }
        
        // Wait for all updates
        await Promise.all(updatePromises);
        totalFixed += updates.length;
        
        console.log(`Fixed ${totalFixed}/${missingCount} logs (${(totalFixed/missingCount!*100).toFixed(1)}%)...`);
    }
    
    // Final check
    const { count: stillMissing } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .is('opponent_id', null);
        
    console.log(`\n✅ Backfill complete!`);
    console.log(`   Fixed: ${totalFixed} logs`);
    console.log(`   Still missing: ${stillMissing || 0} logs`);
    
    // Quick coverage check
    console.log('\n📊 Final opponent_id coverage:');
    
    const { count: total } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    const { count: withOpponent } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .not('opponent_id', 'is', null);
        
    console.log(`Total: ${withOpponent}/${total} (${(withOpponent!/total!*100).toFixed(1)}%)`);
}

// Also backfill is_home field where missing
async function backfillIsHome() {
    console.log('\n\n🏠 BACKFILLING is_home FIELD');
    console.log('============================');
    
    const { count: missingIsHome } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .is('is_home', null);
        
    if (!missingIsHome || missingIsHome === 0) {
        console.log('✅ All logs have is_home field!');
        return;
    }
    
    console.log(`Found ${missingIsHome} logs missing is_home\n`);
    
    // This is trickier - we need to match team_id with home_team_id or away_team_id
    let fixed = 0;
    const BATCH_SIZE = 1000;
    
    while (fixed < missingIsHome) {
        const { data: logs } = await supabase
            .from('player_game_logs')
            .select('id, game_id, team_id')
            .is('is_home', null)
            .limit(BATCH_SIZE);
            
        if (!logs || logs.length === 0) break;
        
        // Get unique game IDs
        const gameIds = [...new Set(logs.map(l => l.game_id))];
        
        // Fetch games
        const { data: games } = await supabase
            .from('games')
            .select('id, home_team_id, away_team_id')
            .in('id', gameIds);
            
        if (!games) break;
        
        const gameMap = new Map<number, { home_team_id: number, away_team_id: number }>();
        games.forEach(g => gameMap.set(g.id, g));
        
        // Update logs
        const updates = logs.map(log => {
            const game = gameMap.get(log.game_id);
            if (!game || !log.team_id) return null;
            
            return {
                id: log.id,
                is_home: log.team_id === game.home_team_id,
                opponent_id: log.team_id === game.home_team_id ? game.away_team_id : game.home_team_id
            };
        }).filter(u => u !== null);
        
        // Batch update
        if (updates.length > 0) {
            await supabase
                .from('player_game_logs')
                .upsert(updates.map(u => ({
                    id: u!.id,
                    is_home: u!.is_home,
                    opponent_id: u!.opponent_id
                })), {
                    onConflict: 'id',
                    ignoreDuplicates: false
                });
                
            fixed += updates.length;
            console.log(`Fixed ${fixed}/${missingIsHome} is_home fields...`);
        }
        
        if (logs.length < BATCH_SIZE) break;
    }
    
    console.log(`\n✅ Fixed ${fixed} is_home fields!`);
}

backfillOpponentIdsFast()
    .then(() => backfillIsHome())
    .catch(console.error);
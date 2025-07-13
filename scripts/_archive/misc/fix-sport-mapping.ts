import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixSportMapping() {
    console.log('🔧 FIXING SPORT MAPPING ISSUES');
    console.log('===============================\n');
    
    // 1. Check current sport distribution in players table
    console.log('📊 PLAYERS TABLE SPORT DISTRIBUTION:');
    const { data: playersSports } = await supabase
        .from('players')
        .select('sport')
        .not('sport', 'is', null);
    
    if (playersSports) {
        const playerSportCounts = playersSports.reduce((acc: any, player) => {
            acc[player.sport] = (acc[player.sport] || 0) + 1;
            return acc;
        }, {});
        
        Object.entries(playerSportCounts).forEach(([sport, count]) => {
            console.log(`  ${sport}: ${count} players`);
        });
    }
    
    // 2. Check current sport distribution in games table
    console.log('\n🎯 GAMES TABLE SPORT DISTRIBUTION:');
    const { data: gamesSports } = await supabase
        .from('games')
        .select('sport, id')
        .not('sport', 'is', null);
    
    if (gamesSports) {
        const gameSportCounts = gamesSports.reduce((acc: any, game) => {
            acc[game.sport] = (acc[game.sport] || 0) + 1;
            return acc;
        }, {});
        
        Object.entries(gameSportCounts).forEach(([sport, count]) => {
            console.log(`  ${sport}: ${count} games`);
        });
    }
    
    // 3. Find player_game_logs that don't match between players and games
    console.log('\n🔍 CHECKING SPORT MISMATCHES:');
    
    const { data: mismatchedLogs } = await supabase
        .from('player_game_logs')
        .select(`
            id,
            player_id,
            game_id,
            stats,
            players(sport),
            games(sport)
        `)
        .limit(100);
    
    if (mismatchedLogs) {
        const mismatches = mismatchedLogs.filter(log => 
            log.players?.sport !== log.games?.sport && 
            log.players?.sport && 
            log.games?.sport
        );
        
        console.log(`Found ${mismatches.length} logs with sport mismatches:`);
        
        const mismatchSummary: any = {};
        mismatches.forEach(log => {
            const key = `${log.players?.sport} → ${log.games?.sport}`;
            mismatchSummary[key] = (mismatchSummary[key] || 0) + 1;
        });
        
        Object.entries(mismatchSummary).forEach(([mismatch, count]) => {
            console.log(`  ${mismatch}: ${count} logs`);
        });
    }
    
    // 4. Find logs where we can get stats by joining properly
    console.log('\n🎯 ALTERNATIVE DATA ACCESS STRATEGY:');
    console.log('Testing direct game-based sport queries...\n');
    
    const testSports = ['NFL', 'nfl', 'NHL', 'MLB'];
    
    for (const sport of testSports) {
        console.log(`Testing sport: "${sport}"`);
        
        // Query logs by game sport instead of player sport
        const { data: gameLogs, error } = await supabase
            .from('player_game_logs')
            .select(`
                id,
                stats,
                computed_metrics,
                games!inner(sport)
            `)
            .eq('games.sport', sport)
            .not('stats', 'eq', '{}')
            .not('stats', 'is', null)
            .limit(3);
        
        if (error) {
            console.log(`  ❌ Error: ${error.message}`);
            continue;
        }
        
        if (gameLogs && gameLogs.length > 0) {
            console.log(`  ✅ Found ${gameLogs.length} logs with stats!`);
            
            // Show sample fields
            const sampleStats = gameLogs[0].stats;
            if (sampleStats && typeof sampleStats === 'object') {
                const fields = Object.keys(sampleStats);
                console.log(`     Fields (${fields.length}): ${fields.slice(0, 8).join(', ')}${fields.length > 8 ? '...' : ''}`);
                
                // Show sample values for key fields
                fields.slice(0, 3).forEach(field => {
                    console.log(`     ${field}: ${sampleStats[field]} (${typeof sampleStats[field]})`);
                });
            }
        } else {
            console.log(`  ❌ No stats found for sport "${sport}"`);
        }
        
        console.log('');
    }
    
    // 5. Generate comprehensive sport access strategy
    console.log('📋 RECOMMENDED SPORT ACCESS STRATEGY:');
    console.log('=====================================\n');
    
    for (const sport of testSports) {
        const { count } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .eq('games.sport', sport);
        
        const { count: withStats } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .eq('games.sport', sport)
            .not('stats', 'eq', '{}')
            .not('stats', 'is', null);
        
        if (count && count > 0) {
            console.log(`${sport}: ${count} total logs, ${withStats || 0} with stats (${withStats ? ((withStats / count) * 100).toFixed(1) : 0}%)`);
        }
    }
    
    console.log('\n🚀 UPDATED BACKFILL STRATEGY:');
    console.log('Use games.sport instead of players.sport for multi-sport queries!');
    console.log('This will unlock all the missing sports data.');
}

fixSportMapping()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Sport mapping analysis failed:', error);
        process.exit(1);
    });
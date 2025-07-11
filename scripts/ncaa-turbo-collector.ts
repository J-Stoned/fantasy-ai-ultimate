import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Caches for maximum speed
const playerIdCache = new Map<string, number>();
const teamIdCache = new Map<string, number>();

// TURBO SETTINGS
const TURBO_BATCH_SIZE = 100; // Process 100 games at once!
const PARALLEL_REQUESTS = 50; // 50 concurrent API requests
const INSERT_BATCH_SIZE = 1000; // Insert 1000 logs at once

async function preloadCaches() {
    console.log('⚡ Preloading caches for TURBO speed...');
    
    // Load all NCAA teams
    const { data: teams } = await supabase
        .from('teams')
        .select('id, external_id')
        .eq('sport_id', 'NCAA_BB');
        
    teams?.forEach(team => {
        if (team.external_id) teamIdCache.set(team.external_id, team.id);
    });
    
    // Load NCAA players in batches
    let offset = 0;
    while (true) {
        const { data: players } = await supabase
            .from('players')
            .select('id, external_id')
            .in('sport', ['Basketball'])
            .range(offset, offset + 9999);
            
        if (!players || players.length === 0) break;
        
        players.forEach(player => {
            playerIdCache.set(player.external_id, player.id);
        });
        
        offset += 10000;
    }
    
    console.log(`✅ Cached ${teamIdCache.size} teams and ${playerIdCache.size} players\n`);
}

async function processGameTurbo(game: any): Promise<any[]> {
    const logs: any[] = [];
    
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${game.external_id}`;
        const response = await axios.get(url, { timeout: 5000 }); // Faster timeout
        
        if (!response.data?.boxscore?.players) return logs;
        
        const gameDate = new Date(game.start_time).toISOString().split('T')[0];
        
        for (const teamPlayers of response.data.boxscore.players) {
            const teamId = teamIdCache.get(teamPlayers.team.id);
            if (!teamId) continue;
            
            if (teamPlayers.statistics?.[0]?.athletes) {
                for (const player of teamPlayers.statistics[0].athletes) {
                    if (!player.athlete || !player.stats || player.stats.length === 0) continue;
                    
                    const playerId = playerIdCache.get(player.athlete.id);
                    if (!playerId) continue;
                    
                    const minutesStr = player.stats[0] || '0:00';
                    const minutes = (minutesStr === 'DNP' || minutesStr === '0:00') ? 0 : (parseInt(minutesStr.split(':')[0]) || 0);
                    
                    // Simplified stats for speed
                    const stats = {
                        points: parseInt(player.stats[18]) || 0,
                        rebounds: parseInt(player.stats[12]) || 0,
                        assists: parseInt(player.stats[13]) || 0,
                        steals: parseInt(player.stats[14]) || 0,
                        blocks: parseInt(player.stats[15]) || 0,
                        turnovers: parseInt(player.stats[16]) || 0,
                        fg_made: parseInt(player.stats[1]) || 0,
                        fg_attempted: parseInt(player.stats[2]) || 0,
                        three_made: parseInt(player.stats[4]) || 0
                    };
                    
                    const fantasy_points = 
                        (stats.points * 1) +
                        (stats.rebounds * 1.25) +
                        (stats.assists * 1.5) +
                        (stats.steals * 2) +
                        (stats.blocks * 2) +
                        (stats.turnovers * -0.5) +
                        (stats.three_made * 0.5);
                    
                    logs.push({
                        player_id: playerId,
                        game_id: game.id,
                        team_id: teamId,
                        game_date: gameDate,
                        is_home: teamPlayers.homeAway === 'home',
                        minutes_played: minutes,
                        stats,
                        fantasy_points
                    });
                }
            }
        }
    } catch (error) {
        // Skip failed games silently for speed
    }
    
    return logs;
}

async function processInParallelBatches(games: any[], batchSize: number): Promise<any[]> {
    const allLogs: any[] = [];
    
    for (let i = 0; i < games.length; i += batchSize) {
        const batch = games.slice(i, i + batchSize);
        const results = await Promise.all(
            batch.map(game => processGameTurbo(game))
        );
        
        for (const gameLogs of results) {
            allLogs.push(...gameLogs);
        }
    }
    
    return allLogs;
}

async function ncaaTurboCollector() {
    console.log('🚀💨 NCAA TURBO COLLECTOR - MAXIMUM SPEED MODE!');
    console.log('==============================================\n');
    
    const { count: startCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log(`Starting: ${startCount?.toLocaleString()} logs`);
    console.log(`Target: 200,000 logs\n`);
    
    // Preload caches for speed
    await preloadCaches();
    
    // Get ALL unprocessed games at once
    console.log('📊 Loading all NCAA Basketball games...');
    const { data: allGames } = await supabase
        .from('games')
        .select('id, external_id, start_time')
        .eq('sport', 'NCAA_BB')
        .eq('status', 'STATUS_FINAL')
        .order('start_time', { ascending: false });
        
    if (!allGames) {
        console.log('No games found!');
        return;
    }
    
    console.log(`Found ${allGames.length.toLocaleString()} total games\n`);
    
    // Process in TURBO batches
    const startTime = Date.now();
    let totalNewLogs = 0;
    let gamesProcessed = 0;
    
    console.log('🔥 TURBO PROCESSING ENGAGED!\n');
    
    for (let i = 0; i < allGames.length && (startCount! + totalNewLogs) < 200000; i += TURBO_BATCH_SIZE) {
        const gameBatch = allGames.slice(i, i + TURBO_BATCH_SIZE);
        
        // Process games in parallel
        const batchLogs = await processInParallelBatches(gameBatch, PARALLEL_REQUESTS);
        
        // Insert logs in large batches
        if (batchLogs.length > 0) {
            for (let j = 0; j < batchLogs.length; j += INSERT_BATCH_SIZE) {
                const insertBatch = batchLogs.slice(j, j + INSERT_BATCH_SIZE);
                
                try {
                    const { data } = await supabase
                        .from('player_game_logs')
                        .upsert(insertBatch, {
                            onConflict: 'player_id,game_id',
                            ignoreDuplicates: true
                        })
                        .select();
                        
                    if (data) {
                        totalNewLogs += data.length;
                    }
                } catch (err) {
                    // Continue on error
                }
            }
        }
        
        gamesProcessed += gameBatch.length;
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = Math.round(totalNewLogs / elapsed * 60);
        const currentTotal = (startCount || 0) + totalNewLogs;
        
        console.log(`⚡ Batch ${Math.floor(i/TURBO_BATCH_SIZE) + 1}: ${gamesProcessed} games | +${totalNewLogs} logs | ${rate} logs/min | Total: ${currentTotal.toLocaleString()}`);
        
        if (currentTotal >= 200000) {
            console.log('\n🎯 200K TARGET REACHED!');
            break;
        }
        
        // Quick rate limit pause every 500 games
        if (i > 0 && i % 500 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // Final stats
    const { count: finalCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    const totalTime = (Date.now() - startTime) / 1000;
    const finalRate = Math.round(totalNewLogs / totalTime * 60);
    
    console.log('\n\n🏆 TURBO COLLECTION COMPLETE!');
    console.log('=============================');
    console.log(`Time: ${totalTime.toFixed(1)} seconds`);
    console.log(`Games processed: ${gamesProcessed.toLocaleString()}`);
    console.log(`New logs: ${totalNewLogs.toLocaleString()}`);
    console.log(`Speed: ${finalRate} logs/minute`);
    console.log(`Final total: ${finalCount?.toLocaleString()} logs`);
    console.log(`Progress to 600K: ${((finalCount || 0) / 600000 * 100).toFixed(1)}%`);
    
    if ((finalCount || 0) >= 200000) {
        console.log('\n🎉🎉🎉 200K LOGS MILESTONE ACHIEVED! 🎉🎉🎉');
        await fs.appendFile('master-collection.log', `\n${new Date().toISOString()} - 🎉 200K MILESTONE! Total: ${finalCount?.toLocaleString()} logs (TURBO MODE: ${finalRate} logs/min)`);
    }
}

ncaaTurboCollector();
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Caches
const playerIdCache = new Map<string, number>();
const teamIdCache = new Map<string, number>();

// ULTRA TURBO SETTINGS - MAXIMUM OVERDRIVE!
const ULTRA_BATCH_SIZE = 100; // Process 100 games at once!
const PARALLEL_REQUESTS = 100; // 100 concurrent ESPN requests!
const INSERT_BATCH_SIZE = 2000; // Insert 2000 logs at once

async function preloadEverything() {
    console.log('⚡⚡ ULTRA PRELOAD - Loading EVERYTHING into memory!');
    
    // Load ALL teams
    const { data: teams } = await supabase
        .from('teams')
        .select('id, external_id');
        
    teams?.forEach(team => {
        if (team.external_id) teamIdCache.set(team.external_id, team.id);
    });
    
    // Load ALL players with turbo pagination
    let totalPlayers = 0;
    let offset = 0;
    
    while (true) {
        const { data: players } = await supabase
            .from('players')
            .select('id, external_id')
            .range(offset, offset + 999);
            
        if (!players || players.length === 0) break;
        
        players.forEach(player => {
            if (player.external_id) {
                playerIdCache.set(player.external_id, player.id);
                totalPlayers++;
            }
        });
        
        if (totalPlayers % 10000 === 0) {
            process.stdout.write(`\r  ⚡ Loaded ${totalPlayers.toLocaleString()} players...`);
        }
        
        if (players.length < 1000) break;
        offset += 1000;
    }
    
    console.log(`\n✅ ULTRA CACHE: ${teamIdCache.size} teams, ${totalPlayers.toLocaleString()} players ready!\n`);
}

async function getUnprocessedGamesUltra(): Promise<any[]> {
    console.log('🔍 Finding ALL unprocessed games at ULTRA speed...');
    
    // Get processed game IDs in parallel batches
    const processedGameIds = new Set<number>();
    const batchPromises: Promise<any>[] = [];
    
    // Request 10 batches in parallel
    for (let i = 0; i < 10; i++) {
        batchPromises.push(
            supabase
                .from('player_game_logs')
                .select('game_id')
                .gte('game_id', 3500000)
                .range(i * 1000, (i + 1) * 1000 - 1)
        );
    }
    
    const results = await Promise.all(batchPromises);
    results.forEach(({ data }) => {
        if (data) {
            data.forEach(log => processedGameIds.add(log.game_id));
        }
    });
    
    // Continue loading processed games
    let offset = 10000;
    while (true) {
        const { data } = await supabase
            .from('player_game_logs')
            .select('game_id')
            .gte('game_id', 3500000)
            .range(offset, offset + 999);
            
        if (!data || data.length === 0) break;
        data.forEach(log => processedGameIds.add(log.game_id));
        if (data.length < 1000) break;
        offset += 1000;
    }
    
    console.log(`Found ${processedGameIds.size} already processed games`);
    
    // Get all NCAA games
    const allGames: any[] = [];
    offset = 0;
    
    while (true) {
        const { data } = await supabase
            .from('games')
            .select('id, external_id, start_time')
            .eq('sport', 'NCAA_BB')
            .eq('status', 'STATUS_FINAL')
            .order('start_time', { ascending: false })
            .range(offset, offset + 999);
            
        if (!data || data.length === 0) break;
        
        const unprocessed = data.filter(g => !processedGameIds.has(g.id));
        allGames.push(...unprocessed);
        
        if (data.length < 1000) break;
        offset += 1000;
    }
    
    console.log(`🎯 ${allGames.length} unprocessed games ready for ULTRA processing!\n`);
    return allGames;
}

async function processGameUltra(game: any): Promise<any[]> {
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${game.external_id}`;
        const response = await axios.get(url, { 
            timeout: 3000, // Even faster timeout
            validateStatus: (status) => status === 200 // Only accept 200
        });
        
        if (!response.data?.boxscore?.players) return [];
        
        const gameLogs: any[] = [];
        const gameDate = new Date(game.start_time).toISOString().split('T')[0];
        
        for (const teamPlayers of response.data.boxscore.players) {
            const teamId = teamIdCache.get(teamPlayers.team.id);
            if (!teamId) continue;
            
            if (teamPlayers.statistics?.[0]?.athletes) {
                for (const player of teamPlayers.statistics[0].athletes) {
                    if (!player.athlete || !player.stats) continue;
                    
                    const playerId = playerIdCache.get(player.athlete.id);
                    if (!playerId) continue;
                    
                    const minutesStr = player.stats[0] || '0';
                    const minutes = minutesStr === 'DNP' ? 0 : (parseInt(minutesStr) || 0);
                    
                    // Ultra-fast stats extraction
                    const pts = parseInt(player.stats[18]) || 0;
                    const reb = parseInt(player.stats[12]) || 0;
                    const ast = parseInt(player.stats[13]) || 0;
                    const stl = parseInt(player.stats[14]) || 0;
                    const blk = parseInt(player.stats[15]) || 0;
                    const to = parseInt(player.stats[16]) || 0;
                    const fg = parseInt(player.stats[1]) || 0;
                    const fga = parseInt(player.stats[2]) || 0;
                    const three = parseInt(player.stats[4]) || 0;
                    
                    gameLogs.push({
                        player_id: playerId,
                        game_id: game.id,
                        team_id: teamId,
                        game_date: gameDate,
                        is_home: teamPlayers.homeAway === 'home',
                        minutes_played: minutes,
                        stats: {
                            points: pts,
                            rebounds: reb,
                            assists: ast,
                            steals: stl,
                            blocks: blk,
                            turnovers: to,
                            fg_made: fg,
                            fg_attempted: fga,
                            three_made: three
                        },
                        fantasy_points: pts + (reb * 1.25) + (ast * 1.5) + (stl * 2) + (blk * 2) - (to * 0.5) + (three * 0.5)
                    });
                }
            }
        }
        
        return gameLogs;
    } catch (error) {
        return [];
    }
}

async function ncaaUltraTurbo() {
    console.log('🚀🔥💨 NCAA ULTRA TURBO - MAXIMUM OVERDRIVE MODE!');
    console.log('================================================\n');
    
    const { count: startCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log(`Starting: ${startCount?.toLocaleString()} logs`);
    console.log(`Target: 200,000 logs (${(200000 - (startCount || 0)).toLocaleString()} needed)\n`);
    
    // Preload everything
    await preloadEverything();
    
    // Get unprocessed games
    const unprocessedGames = await getUnprocessedGamesUltra();
    
    if (unprocessedGames.length === 0) {
        console.log('No unprocessed games found!');
        return;
    }
    
    // ULTRA TURBO PROCESSING
    const startTime = Date.now();
    let totalNewLogs = 0;
    let gamesProcessed = 0;
    let successfulGames = 0;
    
    console.log(`🔥🔥🔥 ULTRA TURBO ENGAGED! Processing ${ULTRA_BATCH_SIZE} games per batch!\n`);
    
    for (let i = 0; i < unprocessedGames.length && (startCount! + totalNewLogs) < 200000; i += ULTRA_BATCH_SIZE) {
        const gameBatch = unprocessedGames.slice(i, i + ULTRA_BATCH_SIZE);
        
        // Process ALL games in parallel
        const batchPromises = gameBatch.map(game => processGameUltra(game));
        const results = await Promise.all(batchPromises);
        
        // Collect all logs
        const batchLogs: any[] = [];
        results.forEach(logs => {
            if (logs.length > 0) {
                batchLogs.push(...logs);
                successfulGames++;
            }
        });
        
        // ULTRA insert
        if (batchLogs.length > 0) {
            // Split into chunks for insertion
            for (let j = 0; j < batchLogs.length; j += INSERT_BATCH_SIZE) {
                const insertChunk = batchLogs.slice(j, j + INSERT_BATCH_SIZE);
                
                try {
                    const { data } = await supabase
                        .from('player_game_logs')
                        .insert(insertChunk)
                        .select();
                        
                    if (data) {
                        totalNewLogs += data.length;
                    }
                } catch (err) {
                    // Try smaller chunks on error
                    for (let k = 0; k < insertChunk.length; k += 500) {
                        try {
                            const smallChunk = insertChunk.slice(k, k + 500);
                            const { data } = await supabase
                                .from('player_game_logs')
                                .insert(smallChunk)
                                .select();
                            if (data) totalNewLogs += data.length;
                        } catch (e) {
                            // Skip
                        }
                    }
                }
            }
        }
        
        gamesProcessed += gameBatch.length;
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = Math.round(totalNewLogs / elapsed * 60);
        const currentTotal = (startCount || 0) + totalNewLogs;
        const avgPerGame = successfulGames > 0 ? (totalNewLogs / successfulGames).toFixed(1) : '0';
        const successRate = ((successfulGames / gamesProcessed) * 100).toFixed(1);
        
        console.log(`⚡⚡ ${gamesProcessed}/${unprocessedGames.length} games | +${totalNewLogs} logs | ${rate} logs/min | ${avgPerGame} logs/game | ${successRate}% success | Total: ${currentTotal.toLocaleString()}`);
        
        if (currentTotal >= 200000) {
            console.log('\n🎯🎯🎯 200K TARGET SMASHED!');
            break;
        }
        
        // Quick pause every 500 games
        if (i > 0 && i % 500 === 0) {
            console.log('  💨 Quick cooldown...');
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    // Final stats
    const { count: finalCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    const totalTime = (Date.now() - startTime) / 1000;
    const finalRate = Math.round(totalNewLogs / totalTime * 60);
    
    console.log('\n\n🏆🔥 ULTRA TURBO COMPLETE!');
    console.log('=========================');
    console.log(`⚡ Time: ${totalTime.toFixed(1)} seconds (${(totalTime / 60).toFixed(1)} minutes)`);
    console.log(`⚡ Games processed: ${gamesProcessed.toLocaleString()}`);
    console.log(`⚡ Successful games: ${successfulGames.toLocaleString()}`);
    console.log(`⚡ New logs: ${totalNewLogs.toLocaleString()}`);
    console.log(`⚡ ULTRA SPEED: ${finalRate} logs/minute`);
    console.log(`⚡ Average: ${(totalNewLogs / successfulGames).toFixed(1)} logs per successful game`);
    console.log(`⚡ Final total: ${finalCount?.toLocaleString()} logs`);
    console.log(`⚡ Progress to 600K: ${((finalCount || 0) / 600000 * 100).toFixed(1)}%`);
    
    if ((finalCount || 0) >= 200000) {
        console.log('\n🎉🎉🎉 200K LOGS MILESTONE OBLITERATED! 🎉🎉🎉');
        console.log('🚀🚀🚀 ULTRA TURBO MODE SUCCESS! 🚀🚀🚀');
        await fs.appendFile('master-collection.log', `\n\n🎉 200K MILESTONE REACHED WITH ULTRA TURBO!\n${new Date().toISOString()} - Total: ${finalCount?.toLocaleString()} logs (ULTRA SPEED: ${finalRate} logs/min)`);
    }
}

ncaaUltraTurbo();
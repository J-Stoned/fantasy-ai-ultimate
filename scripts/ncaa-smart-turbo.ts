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

async function preloadCriticalData() {
    console.log('⚡ Loading teams and players...');
    
    // Load ALL teams
    const { data: teams } = await supabase
        .from('teams')
        .select('id, external_id');
        
    teams?.forEach(team => {
        if (team.external_id) teamIdCache.set(team.external_id, team.id);
    });
    
    // Load ALL players properly with pagination
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
        
        process.stdout.write(`\r  Loaded ${totalPlayers.toLocaleString()} players...`);
        
        if (players.length < 1000) break;
        offset += 1000;
    }
    
    console.log(`\n✅ Cached ${teamIdCache.size} teams and ${totalPlayers.toLocaleString()} players\n`);
}

async function getUnprocessedGames(): Promise<any[]> {
    console.log('🔍 Finding games that need processing...');
    
    // Get games with existing logs to skip them
    const processedGameIds = new Set<number>();
    let offset = 0;
    
    while (true) {
        const { data } = await supabase
            .from('player_game_logs')
            .select('game_id')
            .gte('game_id', 3500000) // NCAA games have high IDs
            .range(offset, offset + 999);
            
        if (!data || data.length === 0) break;
        
        data.forEach(log => processedGameIds.add(log.game_id));
        
        if (data.length < 1000) break;
        offset += 1000;
    }
    
    console.log(`Found ${processedGameIds.size} games already processed`);
    
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
        
        // Filter out processed games
        const unprocessed = data.filter(g => !processedGameIds.has(g.id));
        allGames.push(...unprocessed);
        
        if (data.length < 1000) break;
        offset += 1000;
    }
    
    console.log(`Found ${allGames.length} unprocessed games (skipping ${processedGameIds.size} already done)\n`);
    return allGames;
}

async function processGameBatch(games: any[]): Promise<any[]> {
    const allLogs: any[] = [];
    
    const results = await Promise.all(games.map(async (game) => {
        try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${game.external_id}`;
            const response = await axios.get(url, { timeout: 5000 });
            
            if (!response.data?.boxscore?.players) return [];
            
            const gameLogs: any[] = [];
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
                        
                        gameLogs.push({
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
            
            return gameLogs;
        } catch (error) {
            return [];
        }
    }));
    
    results.forEach(logs => allLogs.push(...logs));
    return allLogs;
}

async function ncaaSmartTurbo() {
    console.log('🚀💡 NCAA SMART TURBO - Skip processed, maximize new logs!');
    console.log('=======================================================\n');
    
    const { count: startCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log(`Starting: ${startCount?.toLocaleString()} logs`);
    console.log(`Target: 200,000 logs (${(200000 - (startCount || 0)).toLocaleString()} needed)\n`);
    
    // Load data
    await preloadCriticalData();
    
    // Get only unprocessed games
    const unprocessedGames = await getUnprocessedGames();
    
    if (unprocessedGames.length === 0) {
        console.log('No unprocessed games found!');
        return;
    }
    
    // Process in smart batches
    const BATCH_SIZE = 40; // Balanced for speed
    const startTime = Date.now();
    let totalNewLogs = 0;
    let gamesProcessed = 0;
    
    console.log('🔥 SMART TURBO PROCESSING!\n');
    
    for (let i = 0; i < unprocessedGames.length && (startCount! + totalNewLogs) < 200000; i += BATCH_SIZE) {
        const gameBatch = unprocessedGames.slice(i, i + BATCH_SIZE);
        
        // Process batch
        const batchLogs = await processGameBatch(gameBatch);
        
        // Insert logs
        if (batchLogs.length > 0) {
            try {
                const { data } = await supabase
                    .from('player_game_logs')
                    .insert(batchLogs)
                    .select();
                    
                if (data) {
                    totalNewLogs += data.length;
                }
            } catch (err) {
                // Try smaller batches on error
                for (let j = 0; j < batchLogs.length; j += 500) {
                    const smallBatch = batchLogs.slice(j, j + 500);
                    try {
                        const { data } = await supabase
                            .from('player_game_logs')
                            .insert(smallBatch)
                            .select();
                        if (data) totalNewLogs += data.length;
                    } catch (e) {
                        // Skip this batch
                    }
                }
            }
        }
        
        gamesProcessed += gameBatch.length;
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = Math.round(totalNewLogs / elapsed * 60);
        const currentTotal = (startCount || 0) + totalNewLogs;
        const avgPerGame = totalNewLogs > 0 ? (totalNewLogs / gamesProcessed).toFixed(1) : '0';
        
        console.log(`⚡ ${gamesProcessed}/${unprocessedGames.length} games | +${totalNewLogs} logs | ${rate} logs/min | ${avgPerGame} logs/game | Total: ${currentTotal.toLocaleString()}`);
        
        if (currentTotal >= 200000) {
            console.log('\n🎯 200K TARGET REACHED!');
            break;
        }
        
        // Rate limit
        if (i > 0 && i % 400 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // Final stats
    const { count: finalCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    const totalTime = (Date.now() - startTime) / 1000;
    
    console.log('\n\n🏆 SMART TURBO COMPLETE!');
    console.log('=======================');
    console.log(`Time: ${(totalTime / 60).toFixed(1)} minutes`);
    console.log(`Games processed: ${gamesProcessed.toLocaleString()}`);
    console.log(`New logs: ${totalNewLogs.toLocaleString()}`);
    console.log(`Speed: ${Math.round(totalNewLogs / totalTime * 60)} logs/minute`);
    console.log(`Average: ${(totalNewLogs / gamesProcessed).toFixed(1)} logs per game`);
    console.log(`Final total: ${finalCount?.toLocaleString()} logs`);
    console.log(`Progress to 600K: ${((finalCount || 0) / 600000 * 100).toFixed(1)}%`);
    
    if ((finalCount || 0) >= 200000) {
        console.log('\n🎉🎉🎉 200K LOGS MILESTONE ACHIEVED! 🎉🎉🎉');
        await fs.appendFile('master-collection.log', `\n\n🎉 200K MILESTONE REACHED!\n${new Date().toISOString()} - Total: ${finalCount?.toLocaleString()} logs`);
    }
}

ncaaSmartTurbo();
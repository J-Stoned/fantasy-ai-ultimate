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

async function preloadData() {
    console.log('⚡ Loading teams and players...');
    
    // Load teams
    const { data: teams } = await supabase
        .from('teams')
        .select('id, external_id');
        
    teams?.forEach(team => {
        if (team.external_id) teamIdCache.set(team.external_id, team.id);
    });
    
    // Load players
    let playerCount = 0;
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
                playerCount++;
            }
        });
        
        if (players.length < 1000) break;
        offset += 1000;
    }
    
    console.log(`✅ Loaded ${teamIdCache.size} teams and ${playerCount} players\n`);
}

async function getCompletelyNewGames(): Promise<any[]> {
    console.log('🔍 Finding games with ZERO logs...');
    
    // First, get ALL game IDs that have ANY logs
    const processedGameIds = new Set<number>();
    let offset = 0;
    
    console.log('  Loading processed game IDs...');
    while (true) {
        const { data } = await supabase
            .from('player_game_logs')
            .select('game_id')
            .range(offset, offset + 999);
            
        if (!data || data.length === 0) break;
        
        data.forEach(log => processedGameIds.add(log.game_id));
        
        if (data.length < 1000) break;
        offset += 1000;
        
        if (processedGameIds.size % 10000 === 0) {
            process.stdout.write(`\r  Found ${processedGameIds.size} games with logs...`);
        }
    }
    
    console.log(`\n  Total games with logs: ${processedGameIds.size}`);
    
    // Now get NCAA games that are NOT in that set
    console.log('\n  Finding unprocessed games...');
    const newGames: any[] = [];
    offset = 0;
    
    while (true) {
        const { data } = await supabase
            .from('games')
            .select('id, external_id, start_time, home_team_id, away_team_id')
            .eq('sport', 'NCAA_BB')
            .eq('status', 'STATUS_FINAL')
            .order('start_time', { ascending: false })
            .range(offset, offset + 999);
            
        if (!data || data.length === 0) break;
        
        // Only add games that have NEVER been processed
        const unprocessed = data.filter(g => !processedGameIds.has(g.id));
        newGames.push(...unprocessed);
        
        if (data.length < 1000) break;
        offset += 1000;
    }
    
    console.log(`✅ Found ${newGames.length} games with ZERO logs!\n`);
    return newGames;
}

async function processNewGame(game: any): Promise<any[]> {
    const logs: any[] = [];
    
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${game.external_id}`;
        const { data } = await axios.get(url, { timeout: 10000 });
        
        if (!data?.boxscore?.players) return logs;
        
        const gameDate = new Date(game.start_time).toISOString().split('T')[0];
        
        for (const teamPlayers of data.boxscore.players) {
            const teamId = teamIdCache.get(teamPlayers.team.id);
            if (!teamId) continue;
            
            const isHome = teamPlayers.homeAway === 'home';
            const opponentId = isHome ? game.away_team_id : game.home_team_id;
            
            if (teamPlayers.statistics?.[0]?.athletes) {
                for (const player of teamPlayers.statistics[0].athletes) {
                    if (!player.athlete || !player.stats || player.stats.length === 0) continue;
                    
                    const playerId = playerIdCache.get(player.athlete.id);
                    if (!playerId) continue;
                    
                    const minutesStr = player.stats[0] || '0';
                    const minutes = (minutesStr === 'DNP' || minutesStr === '0:00') ? 0 : (parseInt(minutesStr.split(':')[0]) || 0);
                    
                    const stats = {
                        points: parseInt(player.stats[18]) || 0,
                        rebounds: parseInt(player.stats[12]) || 0,
                        assists: parseInt(player.stats[13]) || 0,
                        steals: parseInt(player.stats[14]) || 0,
                        blocks: parseInt(player.stats[15]) || 0,
                        turnovers: parseInt(player.stats[16]) || 0,
                        fouls: parseInt(player.stats[17]) || 0,
                        fg_made: parseInt(player.stats[1]) || 0,
                        fg_attempted: parseInt(player.stats[2]) || 0,
                        three_made: parseInt(player.stats[4]) || 0,
                        ft_made: parseInt(player.stats[7]) || 0,
                        ft_attempted: parseInt(player.stats[8]) || 0
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
                        opponent_id: opponentId,
                        is_home: isHome,
                        minutes_played: minutes,
                        stats,
                        fantasy_points
                    });
                }
            }
        }
    } catch (error) {
        // Skip failed games
    }
    
    return logs;
}

async function ncaaNewGamesOnly() {
    console.log('🆕 NCAA NEW GAMES ONLY - No duplicates, no repeats!');
    console.log('==================================================\n');
    
    const { count: startCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log(`Starting: ${startCount?.toLocaleString()} logs`);
    console.log(`Target: 200,000 logs (${(200000 - (startCount || 0)).toLocaleString()} needed)\n`);
    
    // Load data
    await preloadData();
    
    // Get ONLY completely new games
    const newGames = await getCompletelyNewGames();
    
    if (newGames.length === 0) {
        console.log('❌ No new games found! All games have been processed.');
        return;
    }
    
    // Process new games ONLY
    const BATCH_SIZE = 50;
    const startTime = Date.now();
    let totalNewLogs = 0;
    let gamesProcessed = 0;
    let successfulGames = 0;
    
    console.log('🚀 Processing NEW games only!\n');
    
    for (let i = 0; i < newGames.length && (startCount! + totalNewLogs) < 200000; i += BATCH_SIZE) {
        const batch = newGames.slice(i, i + BATCH_SIZE);
        
        // Process batch
        const results = await Promise.all(
            batch.map(game => processNewGame(game))
        );
        
        // Collect logs
        const batchLogs: any[] = [];
        results.forEach(logs => {
            if (logs.length > 0) {
                batchLogs.push(...logs);
                successfulGames++;
            }
        });
        
        // Insert logs
        if (batchLogs.length > 0) {
            for (let j = 0; j < batchLogs.length; j += 500) {
                const chunk = batchLogs.slice(j, j + 500);
                
                try {
                    const { error } = await supabase
                        .from('player_game_logs')
                        .insert(chunk);
                        
                    if (!error) {
                        totalNewLogs += chunk.length;
                    }
                } catch (err) {
                    // Continue
                }
            }
        }
        
        gamesProcessed += batch.length;
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = Math.round(totalNewLogs / elapsed * 60);
        const currentTotal = (startCount || 0) + totalNewLogs;
        const avgLogsPerGame = successfulGames > 0 ? (totalNewLogs / successfulGames).toFixed(1) : '0';
        
        console.log(`🆕 ${gamesProcessed}/${newGames.length} new games | +${totalNewLogs} logs | ${rate} logs/min | ${avgLogsPerGame} logs/game | Total: ${currentTotal.toLocaleString()}`);
        
        if (currentTotal >= 200000) {
            console.log('\n🎯 200K TARGET REACHED!');
            break;
        }
    }
    
    // Final stats
    const { count: finalCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    const totalTime = (Date.now() - startTime) / 1000;
    
    console.log('\n\n🏆 NEW GAMES COLLECTION COMPLETE!');
    console.log('=================================');
    console.log(`Time: ${(totalTime / 60).toFixed(1)} minutes`);
    console.log(`New games processed: ${gamesProcessed}`);
    console.log(`Successful games: ${successfulGames}`);
    console.log(`New logs: ${totalNewLogs.toLocaleString()}`);
    console.log(`Speed: ${Math.round(totalNewLogs / totalTime * 60)} logs/minute`);
    console.log(`Final total: ${finalCount?.toLocaleString()} logs`);
    console.log(`Progress to 600K: ${((finalCount || 0) / 600000 * 100).toFixed(1)}%`);
    
    if ((finalCount || 0) >= 200000) {
        console.log('\n🎉🎉🎉 200K LOGS MILESTONE ACHIEVED! 🎉🎉🎉');
        await fs.appendFile('master-collection.log', 
            `\n\n🎉 200K MILESTONE REACHED (NEW GAMES ONLY)!\n` +
            `${new Date().toISOString()} - Total: ${finalCount?.toLocaleString()} logs`
        );
    }
}

ncaaNewGamesOnly();
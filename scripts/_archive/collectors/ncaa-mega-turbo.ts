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

async function preloadAllData() {
    console.log('⚡ Loading ALL teams and players for maximum speed...');
    
    // Load ALL teams
    const { data: teams } = await supabase
        .from('teams')
        .select('id, external_id');
        
    teams?.forEach(team => {
        if (team.external_id) teamIdCache.set(team.external_id, team.id);
    });
    
    // Load ALL players (no filter to get everyone)
    let playerCount = 0;
    let offset = 0;
    const playerLimit = 1000; // Supabase limit
    
    while (true) {
        const { data: players, error } = await supabase
            .from('players')
            .select('id, external_id')
            .range(offset, offset + playerLimit - 1);
            
        if (error) {
            console.error('Error loading players:', error);
            break;
        }
            
        if (!players || players.length === 0) break;
        
        players.forEach(player => {
            if (player.external_id) {
                playerIdCache.set(player.external_id, player.id);
                playerCount++;
            }
        });
        
        if (playerCount % 10000 === 0) {
            process.stdout.write(`\r  Loaded ${playerCount.toLocaleString()} players...`);
        }
        
        if (players.length < playerLimit) break;
        offset += playerLimit;
    }
    
    console.log(`\n✅ Cached ${teamIdCache.size} teams and ${playerIdCache.size.toLocaleString()} players\n`);
}

async function getAllNCAAGames(): Promise<any[]> {
    console.log('📊 Loading ALL NCAA Basketball games (handling Supabase 1000 limit)...');
    const allGames: any[] = [];
    let offset = 0;
    const limit = 1000;
    
    while (true) {
        const { data, error } = await supabase
            .from('games')
            .select('id, external_id, start_time')
            .eq('sport', 'NCAA_BB')
            .eq('status', 'STATUS_FINAL')
            .order('start_time', { ascending: false })
            .range(offset, offset + limit - 1);
            
        if (error) {
            console.error('Error fetching games:', error);
            break;
        }
            
        if (!data || data.length === 0) break;
        
        allGames.push(...data);
        console.log(`  Loaded ${allGames.length} games so far...`);
        
        // If we got less than the limit, we've reached the end
        if (data.length < limit) break;
        
        // Move to next batch
        offset += limit;
    }
    
    console.log(`✅ Loaded ${allGames.length.toLocaleString()} NCAA Basketball games total`);
    return allGames;
}

async function checkGameStats(game: any) {
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${game.external_id}`;
        const response = await axios.get(url, { timeout: 5000 });
        
        let playerCount = 0;
        let teamCount = 0;
        
        if (response.data?.boxscore?.players) {
            for (const teamPlayers of response.data.boxscore.players) {
                teamCount++;
                if (teamPlayers.statistics?.[0]?.athletes) {
                    playerCount += teamPlayers.statistics[0].athletes.length;
                }
            }
        }
        
        return { playerCount, teamCount };
    } catch (error) {
        return { playerCount: 0, teamCount: 0 };
    }
}

async function processGameMegaTurbo(game: any): Promise<any[]> {
    const logs: any[] = [];
    
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${game.external_id}`;
        const response = await axios.get(url, { timeout: 5000 });
        
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
                    
                    // Include ALL players, even with 0 minutes
                    const stats = {
                        points: parseInt(player.stats[18]) || 0,
                        rebounds: parseInt(player.stats[12]) || 0,
                        assists: parseInt(player.stats[13]) || 0,
                        steals: parseInt(player.stats[14]) || 0,
                        blocks: parseInt(player.stats[15]) || 0,
                        turnovers: parseInt(player.stats[16]) || 0,
                        fg_made: parseInt(player.stats[1]) || 0,
                        fg_attempted: parseInt(player.stats[2]) || 0,
                        three_made: parseInt(player.stats[4]) || 0,
                        ft_made: parseInt(player.stats[7]) || 0,
                        ft_attempted: parseInt(player.stats[8]) || 0,
                        fouls: parseInt(player.stats[17]) || 0
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
        // Skip failed games
    }
    
    return logs;
}

async function ncaaMegaTurbo() {
    console.log('🚀🔥 NCAA MEGA TURBO COLLECTOR - ALL GAMES, ALL STATS!');
    console.log('====================================================\n');
    
    const { count: startCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log(`Starting: ${startCount?.toLocaleString()} logs`);
    console.log(`Target: 200,000 logs (${(200000 - (startCount || 0)).toLocaleString()} needed)\n`);
    
    // Load everything
    await preloadAllData();
    
    // Get ALL games
    const allGames = await getAllNCAAGames();
    console.log(`Found ${allGames.length.toLocaleString()} NCAA Basketball games total\n`);
    
    // Check a sample game first
    console.log('🔍 Checking sample game stats...');
    const sampleGame = allGames[100]; // Pick a game that's not too recent
    const sampleStats = await checkGameStats(sampleGame);
    console.log(`Sample game has ${sampleStats.playerCount} players across ${sampleStats.teamCount} teams`);
    console.log(`Expected: ~${sampleStats.playerCount / 2} logs per game (players who actually played)\n`);
    
    // Process in MEGA batches
    const MEGA_BATCH = 50; // Process 50 games at once
    const startTime = Date.now();
    let totalNewLogs = 0;
    let gamesProcessed = 0;
    let gamesWithLogs = 0;
    
    console.log('🔥 MEGA TURBO PROCESSING STARTING!\n');
    
    for (let i = 0; i < allGames.length && (startCount! + totalNewLogs) < 200000; i += MEGA_BATCH) {
        const gameBatch = allGames.slice(i, i + MEGA_BATCH);
        
        // Process all games in parallel
        const results = await Promise.all(
            gameBatch.map(game => processGameMegaTurbo(game))
        );
        
        // Collect all logs
        const batchLogs: any[] = [];
        for (const gameLogs of results) {
            if (gameLogs.length > 0) {
                batchLogs.push(...gameLogs);
                gamesWithLogs++;
            }
        }
        
        // Insert if we have logs
        if (batchLogs.length > 0) {
            try {
                const { data } = await supabase
                    .from('player_game_logs')
                    .upsert(batchLogs, {
                        onConflict: 'player_id,game_id',
                        ignoreDuplicates: true
                    })
                    .select();
                    
                if (data) {
                    totalNewLogs += data.length;
                }
            } catch (err) {
                // Continue
            }
        }
        
        gamesProcessed += gameBatch.length;
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = Math.round(totalNewLogs / elapsed * 60);
        const avgLogsPerGame = gamesWithLogs > 0 ? (totalNewLogs / gamesWithLogs).toFixed(1) : '0';
        const currentTotal = (startCount || 0) + totalNewLogs;
        
        console.log(`⚡ ${gamesProcessed}/${allGames.length} games | +${totalNewLogs} logs | ${rate} logs/min | ${avgLogsPerGame} logs/game | Total: ${currentTotal.toLocaleString()}`);
        
        if (currentTotal >= 200000) {
            console.log('\n🎯 200K TARGET REACHED!');
            break;
        }
        
        // Rate limit every 500 games
        if (i > 0 && i % 500 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }
    
    // Final stats
    const { count: finalCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    const totalTime = (Date.now() - startTime) / 1000;
    const finalRate = Math.round(totalNewLogs / totalTime * 60);
    
    console.log('\n\n🏆 MEGA TURBO COMPLETE!');
    console.log('======================');
    console.log(`Time: ${(totalTime / 60).toFixed(1)} minutes`);
    console.log(`Games processed: ${gamesProcessed.toLocaleString()}`);
    console.log(`Games with logs: ${gamesWithLogs.toLocaleString()}`);
    console.log(`New logs: ${totalNewLogs.toLocaleString()}`);
    console.log(`Speed: ${finalRate} logs/minute`);
    console.log(`Average: ${(totalNewLogs / gamesWithLogs).toFixed(1)} logs per game`);
    console.log(`Final total: ${finalCount?.toLocaleString()} logs`);
    console.log(`Progress to 600K: ${((finalCount || 0) / 600000 * 100).toFixed(1)}%`);
}

ncaaMegaTurbo();
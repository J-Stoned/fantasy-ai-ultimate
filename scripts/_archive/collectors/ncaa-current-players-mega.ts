import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Caches
const playerIdCache = new Map<string, number>();
const teamIdCache = new Map<string, number>();

async function loadCurrentPlayersAndTeams() {
    console.log('⚡ Loading ALL current/active players and teams...');
    
    // Load ALL teams
    const { data: teams } = await supabase
        .from('teams')
        .select('id, external_id');
        
    teams?.forEach(team => {
        if (team.external_id) teamIdCache.set(team.external_id, team.id);
    });
    
    // Load ALL players - focus on active ones
    let totalPlayers = 0;
    let offset = 0;
    
    while (true) {
        const { data: players } = await supabase
            .from('players')
            .select('id, external_id, status, sport')
            .range(offset, offset + 999);
            
        if (!players || players.length === 0) break;
        
        players.forEach(player => {
            if (player.external_id) {
                playerIdCache.set(player.external_id, player.id);
                totalPlayers++;
            }
        });
        
        if (totalPlayers % 10000 === 0) {
            process.stdout.write(`\r  Loaded ${totalPlayers.toLocaleString()} players...`);
        }
        
        if (players.length < 1000) break;
        offset += 1000;
    }
    
    console.log(`\n✅ Loaded ${teamIdCache.size} teams and ${totalPlayers.toLocaleString()} players\n`);
}

async function getAllNCAAGamesForCurrentPlayers() {
    console.log('📊 Getting ALL NCAA games (including recent seasons)...');
    const allGames: any[] = [];
    let offset = 0;
    
    // Get ALL games from recent seasons (2022-2025)
    while (true) {
        const { data } = await supabase
            .from('games')
            .select('id, external_id, start_time')
            .eq('sport', 'NCAA_BB')
            .eq('status', 'STATUS_FINAL')
            .gte('start_time', '2022-01-01') // Get 3+ years of data!
            .order('start_time', { ascending: false })
            .range(offset, offset + 999);
            
        if (!data || data.length === 0) break;
        
        allGames.push(...data);
        console.log(`  Loaded ${allGames.length} games...`);
        
        if (data.length < 1000) break;
        offset += 1000;
    }
    
    return allGames;
}

async function processGameForAllPlayers(game: any): Promise<{ logs: any[], playersFound: number }> {
    const logs: any[] = [];
    let playersFound = 0;
    
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${game.external_id}`;
        const { data } = await axios.get(url, { timeout: 5000 });
        
        if (!data?.boxscore?.players) return { logs, playersFound };
        
        const gameDate = new Date(game.start_time).toISOString().split('T')[0];
        
        for (const teamPlayers of data.boxscore.players) {
            const teamId = teamIdCache.get(teamPlayers.team.id);
            if (!teamId) continue;
            
            if (teamPlayers.statistics?.[0]?.athletes) {
                for (const player of teamPlayers.statistics[0].athletes) {
                    if (!player.athlete) continue;
                    
                    const playerId = playerIdCache.get(player.athlete.id);
                    if (!playerId) {
                        // Player not in our DB - might need to add them!
                        continue;
                    }
                    
                    playersFound++;
                    
                    // Get ALL stats, even DNP players
                    if (player.stats && player.stats.length > 0) {
                        const minutesStr = player.stats[0] || '0';
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
                            fg_percentage: parseFloat(player.stats[3]) || 0,
                            three_made: parseInt(player.stats[4]) || 0,
                            three_attempted: parseInt(player.stats[5]) || 0,
                            three_percentage: parseFloat(player.stats[6]) || 0,
                            ft_made: parseInt(player.stats[7]) || 0,
                            ft_attempted: parseInt(player.stats[8]) || 0,
                            ft_percentage: parseFloat(player.stats[9]) || 0,
                            offensive_rebounds: parseInt(player.stats[10]) || 0,
                            defensive_rebounds: parseInt(player.stats[11]) || 0,
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
        }
    } catch (error) {
        // Skip failed games
    }
    
    return { logs, playersFound };
}

async function ncaaCurrentPlayersMega() {
    console.log('🔥💯 NCAA CURRENT PLAYERS MEGA COLLECTION!');
    console.log('==========================================');
    console.log('Getting ALL stats for ALL current players!\n');
    
    const { count: startCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log(`Starting: ${startCount?.toLocaleString()} logs\n`);
    
    // Load all data
    await loadCurrentPlayersAndTeams();
    
    // Get ALL games from recent seasons
    const allGames = await getAllNCAAGamesForCurrentPlayers();
    console.log(`\n📊 Found ${allGames.length.toLocaleString()} NCAA games from recent seasons\n`);
    
    // Process ALL games with maximum efficiency
    const MEGA_BATCH = 100;
    const startTime = Date.now();
    let totalNewLogs = 0;
    let gamesProcessed = 0;
    let totalPlayersFound = 0;
    let gamesWithPlayers = 0;
    
    console.log('🚀 PROCESSING ALL GAMES FOR CURRENT PLAYERS!\n');
    
    for (let i = 0; i < allGames.length; i += MEGA_BATCH) {
        const batch = allGames.slice(i, i + MEGA_BATCH);
        
        // Process all games in parallel
        const results = await Promise.all(
            batch.map(game => processGameForAllPlayers(game))
        );
        
        // Collect all logs
        const batchLogs: any[] = [];
        let batchPlayersFound = 0;
        
        results.forEach(result => {
            if (result.logs.length > 0) {
                batchLogs.push(...result.logs);
                gamesWithPlayers++;
            }
            batchPlayersFound += result.playersFound;
        });
        
        totalPlayersFound += batchPlayersFound;
        
        // Insert logs
        if (batchLogs.length > 0) {
            // Insert in chunks
            for (let j = 0; j < batchLogs.length; j += 1000) {
                const chunk = batchLogs.slice(j, j + 1000);
                
                try {
                    const { data, error } = await supabase
                        .from('player_game_logs')
                        .upsert(chunk, {
                            onConflict: 'player_id,game_id',
                            ignoreDuplicates: true
                        })
                        .select();
                        
                    if (data) {
                        totalNewLogs += data.length;
                    }
                } catch (err) {
                    // Try smaller chunks
                    for (let k = 0; k < chunk.length; k += 250) {
                        try {
                            const smallChunk = chunk.slice(k, k + 250);
                            const { data } = await supabase
                                .from('player_game_logs')
                                .upsert(smallChunk, {
                                    onConflict: 'player_id,game_id',
                                    ignoreDuplicates: true
                                })
                                .select();
                            if (data) totalNewLogs += data.length;
                        } catch (e) {
                            // Skip
                        }
                    }
                }
            }
        }
        
        gamesProcessed += batch.length;
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = Math.round(totalNewLogs / elapsed * 60);
        const currentTotal = (startCount || 0) + totalNewLogs;
        const avgPlayersPerGame = gamesWithPlayers > 0 ? (totalPlayersFound / gamesWithPlayers).toFixed(1) : '0';
        const avgLogsPerGame = gamesWithPlayers > 0 ? (totalNewLogs / gamesWithPlayers).toFixed(1) : '0';
        
        console.log(`⚡ ${gamesProcessed}/${allGames.length} games | +${totalNewLogs} new logs | ${rate} logs/min | ${avgPlayersPerGame} players/game | ${avgLogsPerGame} logs/game | Total: ${currentTotal.toLocaleString()}`);
        
        // Pause every 500 games
        if (i > 0 && i % 500 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // Final stats
    const { count: finalCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    const totalTime = (Date.now() - startTime) / 1000;
    
    console.log('\n\n🏆 MEGA COLLECTION COMPLETE!');
    console.log('============================');
    console.log(`Time: ${(totalTime / 60).toFixed(1)} minutes`);
    console.log(`Games processed: ${gamesProcessed.toLocaleString()}`);
    console.log(`Games with current players: ${gamesWithPlayers.toLocaleString()}`);
    console.log(`Total players found: ${totalPlayersFound.toLocaleString()}`);
    console.log(`New logs added: ${totalNewLogs.toLocaleString()}`);
    console.log(`Speed: ${Math.round(totalNewLogs / totalTime * 60)} logs/minute`);
    console.log(`Final total: ${finalCount?.toLocaleString()} logs`);
    console.log(`Progress to 600K: ${((finalCount || 0) / 600000 * 100).toFixed(1)}%`);
    
    if ((finalCount || 0) > 200000) {
        console.log('\n🎉 BLOWN PAST 200K!');
    }
    if ((finalCount || 0) > 250000) {
        console.log('🚀 QUARTER MILLION LOGS!');
    }
    if ((finalCount || 0) > 300000) {
        console.log('🔥 300K - HALFWAY TO 600K!');
    }
}

ncaaCurrentPlayersMega();
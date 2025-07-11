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

async function quickLoad() {
    // Load teams
    const { data: teams } = await supabase
        .from('teams')
        .select('id, external_id');
        
    teams?.forEach(team => {
        if (team.external_id) teamIdCache.set(team.external_id, team.id);
    });
    
    // Load players with external_id
    let offset = 0;
    while (true) {
        const { data: players } = await supabase
            .from('players')
            .select('id, external_id')
            .not('external_id', 'is', null)
            .range(offset, offset + 999);
            
        if (!players || players.length === 0) break;
        
        players.forEach(player => {
            if (player.external_id) {
                playerIdCache.set(player.external_id, player.id);
            }
        });
        
        if (players.length < 1000) break;
        offset += 1000;
    }
    
    console.log(`✅ Loaded ${teamIdCache.size} teams and ${playerIdCache.size} players\n`);
}

async function processGames(games: any[]): Promise<number> {
    let newLogs = 0;
    
    const results = await Promise.all(games.map(async (game) => {
        try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${game.external_id}`;
            const { data } = await axios.get(url, { timeout: 10000 }); // Longer timeout
            
            if (!data?.boxscore?.players) return [];
            
            const logs: any[] = [];
            const gameDate = new Date(game.start_time).toISOString().split('T')[0];
            
            for (const teamPlayers of data.boxscore.players) {
                const teamId = teamIdCache.get(teamPlayers.team.id);
                if (!teamId) continue;
                
                if (teamPlayers.statistics?.[0]?.athletes) {
                    for (const player of teamPlayers.statistics[0].athletes) {
                        if (!player.athlete || !player.stats) continue;
                        
                        const playerId = playerIdCache.get(player.athlete.id);
                        if (!playerId) continue;
                        
                        const minutesStr = player.stats[0] || '0';
                        const minutes = minutesStr === 'DNP' ? 0 : parseInt(minutesStr) || 0;
                        
                        logs.push({
                            player_id: playerId,
                            game_id: game.id,
                            team_id: teamId,
                            game_date: gameDate,
                            opponent_id: teamPlayers.homeAway === 'home' ? game.away_team_id : game.home_team_id,
                            is_home: teamPlayers.homeAway === 'home',
                            minutes_played: minutes,
                            stats: {
                                points: parseInt(player.stats[18]) || 0,
                                rebounds: parseInt(player.stats[12]) || 0,
                                assists: parseInt(player.stats[13]) || 0,
                                steals: parseInt(player.stats[14]) || 0,
                                blocks: parseInt(player.stats[15]) || 0,
                                turnovers: parseInt(player.stats[16]) || 0,
                                fg_made: parseInt(player.stats[1]) || 0,
                                fg_attempted: parseInt(player.stats[2]) || 0,
                                three_made: parseInt(player.stats[4]) || 0
                            },
                            fantasy_points: 
                                (parseInt(player.stats[18]) || 0) +
                                ((parseInt(player.stats[12]) || 0) * 1.25) +
                                ((parseInt(player.stats[13]) || 0) * 1.5) +
                                ((parseInt(player.stats[14]) || 0) * 2) +
                                ((parseInt(player.stats[15]) || 0) * 2) -
                                ((parseInt(player.stats[16]) || 0) * 0.5) +
                                ((parseInt(player.stats[4]) || 0) * 0.5)
                        });
                    }
                }
            }
            
            return logs;
        } catch (error) {
            return [];
        }
    }));
    
    // Collect and insert all logs
    const allLogs: any[] = [];
    results.forEach(logs => allLogs.push(...logs));
    
    if (allLogs.length > 0) {
        // Insert in chunks
        for (let i = 0; i < allLogs.length; i += 500) {
            const chunk = allLogs.slice(i, i + 500);
            
            try {
                const { error } = await supabase
                    .from('player_game_logs')
                    .upsert(chunk, {
                        onConflict: 'player_id,game_id',
                        ignoreDuplicates: true
                    });
                    
                if (!error) {
                    newLogs += chunk.length;
                }
            } catch (err) {
                // Continue
            }
        }
    }
    
    return newLogs;
}

async function ncaaLongRunner() {
    console.log('🏃‍♂️ NCAA LONG RUNNER - Running until 200K!');
    console.log('=========================================\n');
    
    const { count: startCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log(`Starting: ${startCount?.toLocaleString()} logs`);
    console.log(`Target: 200,000 logs\n`);
    
    await quickLoad();
    
    // Get ALL games
    const allGames: any[] = [];
    let offset = 0;
    
    while (true) {
        const { data } = await supabase
            .from('games')
            .select('id, external_id, start_time, home_team_id, away_team_id')
            .eq('sport', 'NCAA_BB')
            .eq('status', 'STATUS_FINAL')
            .order('start_time', { ascending: false })
            .range(offset, offset + 999);
            
        if (!data || data.length === 0) break;
        allGames.push(...data);
        if (data.length < 1000) break;
        offset += 1000;
    }
    
    console.log(`Found ${allGames.length} NCAA games to process\n`);
    
    // Process in batches
    const BATCH_SIZE = 25; // Smaller batches for stability
    let totalNewLogs = 0;
    let gamesProcessed = 0;
    const startTime = Date.now();
    
    for (let i = 0; i < allGames.length && (startCount! + totalNewLogs) < 200000; i += BATCH_SIZE) {
        const batch = allGames.slice(i, i + BATCH_SIZE);
        
        const newLogs = await processGames(batch);
        totalNewLogs += newLogs;
        gamesProcessed += batch.length;
        
        const currentTotal = (startCount || 0) + totalNewLogs;
        const remaining = 200000 - currentTotal;
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = Math.round(totalNewLogs / elapsed * 60);
        
        console.log(`Progress: ${gamesProcessed}/${allGames.length} games | +${totalNewLogs} new | ${rate} logs/min | Total: ${currentTotal.toLocaleString()} | ${remaining > 0 ? remaining.toLocaleString() + ' to 200K' : '🎯 REACHED 200K!'}`);
        
        if (currentTotal >= 200000) {
            console.log('\n🎉 200K MILESTONE REACHED!');
            break;
        }
        
        // Save progress periodically
        if (gamesProcessed % 500 === 0) {
            await fs.appendFile('ncaa-progress.log', 
                `${new Date().toISOString()} - Processed ${gamesProcessed} games, added ${totalNewLogs} logs, total: ${currentTotal}\n`
            );
        }
    }
    
    // Final check
    const { count: finalCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    const totalTime = (Date.now() - startTime) / 1000;
    
    console.log('\n\n🏁 LONG RUN COMPLETE!');
    console.log('====================');
    console.log(`Time: ${(totalTime / 60).toFixed(1)} minutes`);
    console.log(`Games processed: ${gamesProcessed}`);
    console.log(`New logs: ${totalNewLogs}`);
    console.log(`Final total: ${finalCount?.toLocaleString()} logs`);
    console.log(`Progress to 600K: ${((finalCount || 0) / 600000 * 100).toFixed(1)}%`);
    
    if ((finalCount || 0) >= 200000) {
        await fs.appendFile('master-collection.log', 
            `\n\n🎉 200K MILESTONE REACHED!\n` +
            `${new Date().toISOString()} - Total: ${finalCount?.toLocaleString()} logs\n` +
            `Time to milestone: ${(totalTime / 60).toFixed(1)} minutes`
        );
    }
}

ncaaLongRunner();
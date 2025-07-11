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

async function getPlayerId(externalId: string): Promise<number | null> {
    if (playerIdCache.has(externalId)) {
        return playerIdCache.get(externalId)!;
    }
    
    const { data } = await supabase
        .from('players')
        .select('id')
        .eq('external_id', externalId)
        .single();
        
    if (data) {
        playerIdCache.set(externalId, data.id);
        return data.id;
    }
    return null;
}

async function getTeamId(externalId: string): Promise<number | null> {
    if (teamIdCache.has(externalId)) {
        return teamIdCache.get(externalId)!;
    }
    
    const { data } = await supabase
        .from('teams')
        .select('id')
        .eq('external_id', externalId)
        .single();
        
    if (data) {
        teamIdCache.set(externalId, data.id);
        return data.id;
    }
    return null;
}

async function updateMasterLog(newLogs: number) {
    const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    const progress = ((count || 0) / 600000 * 100).toFixed(1);
    const logEntry = `NCAA Basketball Mega V2: +${newLogs.toLocaleString()} logs | Total: ${count?.toLocaleString()} (${progress}% of 600K)`;
    
    await supabase
        .from('system_logs')
        .insert({
            log_type: 'collection',
            message: logEntry,
            metadata: { sport: 'NCAA_BB', new_logs: newLogs, total_logs: count }
        });
        
    // Also append to file
    const fs = await import('fs/promises');
    await fs.appendFile('master-collection.log', `\n${new Date().toISOString()} - ${logEntry}`);
}

async function processGame(game: any): Promise<{ logs: any[], playersNotInDB: number }> {
    const logs: any[] = [];
    let playersNotInDB = 0;
    
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${game.external_id}`;
        const response = await axios.get(url, { timeout: 10000 });
        
        if (!response.data?.boxscore?.players) {
            return { logs, playersNotInDB };
        }
        
        const gameDate = new Date(game.start_time).toISOString().split('T')[0];
        
        for (const teamPlayers of response.data.boxscore.players) {
            const espnTeamId = teamPlayers.team.id;
            const teamId = await getTeamId(espnTeamId);
            
            if (!teamId) {
                continue; // Skip if team not in DB
            }
            
            if (teamPlayers.statistics?.[0]?.athletes) {
                for (const player of teamPlayers.statistics[0].athletes) {
                    if (!player.athlete) continue;
                    
                    // Include ALL players with any stats
                    if (player.stats && player.stats.length > 0) {
                        const playerId = await getPlayerId(player.athlete.id);
                        if (!playerId) {
                            playersNotInDB++;
                            continue;
                        }
                        
                        const minutesStr = player.stats[0] || '0:00';
                        const minutes = (minutesStr === 'DNP' || minutesStr === '0:00') ? 0 : (parseInt(minutesStr.split(':')[0]) || 0);
                        
                        // Include even players with 0 minutes if they have other stats
                        const log = {
                            player_id: playerId,
                            game_id: game.id,
                            team_id: teamId,
                            game_date: gameDate,
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
                            },
                            fantasy_points: 0
                        };
                        
                        // Calculate DraftKings fantasy points
                        log.fantasy_points = 
                            (log.stats.points * 1) +
                            (log.stats.rebounds * 1.25) +
                            (log.stats.assists * 1.5) +
                            (log.stats.steals * 2) +
                            (log.stats.blocks * 2) +
                            (log.stats.turnovers * -0.5) +
                            (log.stats.three_made * 0.5);
                        
                        // Double-double/triple-double bonuses
                        const doubleDigitCats = [
                            log.stats.points >= 10,
                            log.stats.rebounds >= 10,
                            log.stats.assists >= 10,
                            log.stats.steals >= 10,
                            log.stats.blocks >= 10
                        ].filter(Boolean).length;
                        
                        if (doubleDigitCats >= 2) log.fantasy_points += 1.5;
                        if (doubleDigitCats >= 3) log.fantasy_points += 3;
                        
                        logs.push(log);
                    }
                }
            }
        }
    } catch (error) {
        // Skip failed games
    }
    
    return { logs, playersNotInDB };
}

async function ncaaMegaCollectorV2() {
    console.log('🚀 NCAA MEGA COLLECTOR V2 - GETTING EVERYTHING!');
    console.log('==============================================\n');
    
    const { count: startCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log(`Starting with ${startCount?.toLocaleString()} logs`);
    console.log(`Target: 600,000 logs (${((startCount || 0) / 600000 * 100).toFixed(1)}% complete)\n`);
    
    // Get ALL NCAA Basketball games
    console.log('Fetching ALL NCAA Basketball games...');
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
            
        if (error || !data || data.length === 0) break;
        
        allGames.push(...data);
        console.log(`  Fetched ${allGames.length} games...`);
        
        if (data.length < limit) break;
        offset += limit;
    }
    
    console.log(`\nTotal NCAA Basketball games: ${allGames.length.toLocaleString()}\n`);
    
    // Process in batches
    const BATCH_SIZE = 10;
    let totalNewLogs = 0;
    let totalPlayersNotInDB = 0;
    let gamesProcessed = 0;
    
    for (let i = 0; i < allGames.length; i += BATCH_SIZE) {
        const batch = allGames.slice(i, i + BATCH_SIZE);
        const batchLogs: any[] = [];
        let batchPlayersNotInDB = 0;
        
        // Process games in parallel
        const results = await Promise.all(
            batch.map(game => processGame(game))
        );
        
        for (const result of results) {
            batchLogs.push(...result.logs);
            batchPlayersNotInDB += result.playersNotInDB;
        }
        
        // Insert logs if we have any
        if (batchLogs.length > 0) {
            try {
                const { data, error } = await supabase
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
                // Continue on error
            }
        }
        
        totalPlayersNotInDB += batchPlayersNotInDB;
        gamesProcessed += batch.length;
        
        const progress = (gamesProcessed / allGames.length * 100).toFixed(1);
        const rate = Math.round(totalNewLogs / (gamesProcessed / 60)); // logs per minute estimate
        
        console.log(`Progress: ${gamesProcessed}/${allGames.length} games (${progress}%) | +${totalNewLogs} new logs | ${batchPlayersNotInDB} players not in DB | ~${rate} logs/min`);
        
        // Milestone updates
        if (totalNewLogs > 0 && totalNewLogs % 10000 === 0) {
            await updateMasterLog(totalNewLogs);
            const { count } = await supabase
                .from('player_game_logs')
                .select('*', { count: 'exact', head: true });
            console.log(`\n🎯 MILESTONE: ${count?.toLocaleString()} total logs! Path to 600K: ${((count || 0) / 600000 * 100).toFixed(1)}%\n`);
        }
        
        // Rate limiting
        if (i > 0 && i % 200 === 0) {
            console.log('Pausing for rate limit...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    // Final summary
    const { count: finalCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    await updateMasterLog(totalNewLogs);
    
    console.log('\n\n🏆 MEGA COLLECTION COMPLETE!');
    console.log('============================');
    console.log(`Started: ${startCount?.toLocaleString()} logs`);
    console.log(`Final: ${finalCount?.toLocaleString()} logs`);
    console.log(`New logs added: ${totalNewLogs.toLocaleString()}`);
    console.log(`Players not in DB: ${totalPlayersNotInDB.toLocaleString()}`);
    console.log(`\n📈 Progress to 600K: ${((finalCount || 0) / 600000 * 100).toFixed(1)}%`);
    
    const milestones = [
        { threshold: 150000, message: '🎉 150K LOGS! Quarter way to goal!' },
        { threshold: 200000, message: '🎉🎉 200K LOGS! One-third complete!' },
        { threshold: 250000, message: '🚀🚀 QUARTER MILLION LOGS!' },
        { threshold: 300000, message: '🔥🔥 300K LOGS! HALFWAY TO GOAL!' },
        { threshold: 400000, message: '💎💎 400K LOGS! Two-thirds done!' },
        { threshold: 500000, message: '🏆🏆 HALF MILLION LOGS! Almost there!' }
    ];
    
    for (const milestone of milestones) {
        if ((startCount || 0) < milestone.threshold && (finalCount || 0) >= milestone.threshold) {
            console.log(`\n${milestone.message}`);
        }
    }
}

ncaaMegaCollectorV2();
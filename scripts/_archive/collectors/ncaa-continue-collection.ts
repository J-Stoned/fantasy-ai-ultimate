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

async function processGame(game: any): Promise<{ logs: any[], teamsNotInDB: Set<string> }> {
    const logs: any[] = [];
    const teamsNotInDB = new Set<string>();
    
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${game.external_id}`;
        const response = await axios.get(url, { timeout: 10000 });
        
        if (!response.data?.boxscore?.players) {
            return { logs, teamsNotInDB };
        }
        
        const gameDate = new Date(game.start_time).toISOString().split('T')[0];
        
        for (const teamPlayers of response.data.boxscore.players) {
            const espnTeamId = teamPlayers.team.id;
            const teamId = await getTeamId(espnTeamId);
            
            if (!teamId) {
                teamsNotInDB.add(`${espnTeamId}:${teamPlayers.team.displayName}`);
                continue;
            }
            
            if (teamPlayers.statistics?.[0]?.athletes) {
                for (const player of teamPlayers.statistics[0].athletes) {
                    if (!player.athlete || !player.stats || player.stats.length === 0) continue;
                    
                    const playerId = await getPlayerId(player.athlete.id);
                    if (!playerId) continue;
                    
                    const minutesStr = player.stats[0] || '0:00';
                    const minutes = (minutesStr === 'DNP' || minutesStr === '0:00') ? 0 : (parseInt(minutesStr.split(':')[0]) || 0);
                    
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
                            three_made: parseInt(player.stats[4]) || 0,
                            ft_made: parseInt(player.stats[7]) || 0,
                            ft_attempted: parseInt(player.stats[8]) || 0,
                            fouls: parseInt(player.stats[17]) || 0
                        },
                        fantasy_points: 0
                    };
                    
                    // Calculate fantasy points
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
    } catch (error) {
        // Skip failed games
    }
    
    return { logs, teamsNotInDB };
}

async function continueNCAACollection() {
    console.log('🏀 CONTINUING NCAA COLLECTION');
    console.log('============================\n');
    
    const { count: startCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log(`Starting with ${startCount?.toLocaleString()} logs`);
    console.log(`Target: 200,000 logs (next milestone)\n`);
    
    // Get unprocessed games
    console.log('Finding unprocessed games...');
    
    // First, get games that already have logs
    const { data: processedGames } = await supabase
        .from('player_game_logs')
        .select('game_id')
        .gte('game_id', 3500000) // NCAA game IDs typically start high
        .limit(10000);
        
    const processedGameIds = new Set(processedGames?.map(g => g.game_id) || []);
    console.log(`Found ${processedGameIds.size} games with existing logs`);
    
    // Get all NCAA games
    const allGames: any[] = [];
    let offset = 0;
    const limit = 1000;
    
    while (true) {
        const { data } = await supabase
            .from('games')
            .select('id, external_id, start_time')
            .eq('sport', 'NCAA_BB')
            .eq('status', 'STATUS_FINAL')
            .order('start_time', { ascending: false })
            .range(offset, offset + limit - 1);
            
        if (!data || data.length === 0) break;
        allGames.push(...data);
        if (data.length < limit) break;
        offset += limit;
    }
    
    // Filter unprocessed games
    const unprocessedGames = allGames.filter(g => !processedGameIds.has(g.id));
    console.log(`Total games: ${allGames.length}, Unprocessed: ${unprocessedGames.length}\n`);
    
    // Track unique teams not in DB
    const allTeamsNotInDB = new Set<string>();
    
    // Process in batches
    const BATCH_SIZE = 20;
    const TARGET_LOGS = 200000;
    let totalNewLogs = 0;
    let gamesProcessed = 0;
    
    for (let i = 0; i < unprocessedGames.length && (startCount! + totalNewLogs) < TARGET_LOGS; i += BATCH_SIZE) {
        const batch = unprocessedGames.slice(i, i + BATCH_SIZE);
        const batchLogs: any[] = [];
        
        // Process games in parallel
        const results = await Promise.all(
            batch.map(game => processGame(game))
        );
        
        for (const result of results) {
            batchLogs.push(...result.logs);
            result.teamsNotInDB.forEach(team => allTeamsNotInDB.add(team));
        }
        
        // Insert logs
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
                // Continue on error
            }
        }
        
        gamesProcessed += batch.length;
        const currentTotal = (startCount || 0) + totalNewLogs;
        const progress = (currentTotal / TARGET_LOGS * 100).toFixed(1);
        
        console.log(`Progress: ${gamesProcessed}/${unprocessedGames.length} games | +${totalNewLogs} logs | Total: ${currentTotal.toLocaleString()} (${progress}% to 200K)`);
        
        // Stop if we hit the target
        if (currentTotal >= TARGET_LOGS) {
            console.log('\n🎯 TARGET REACHED! Stopping collection.');
            break;
        }
        
        // Rate limiting
        if (i > 0 && i % 200 === 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    // Final summary
    const { count: finalCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log('\n\n🏆 COLLECTION SUMMARY');
    console.log('====================');
    console.log(`Started: ${startCount?.toLocaleString()} logs`);
    console.log(`Final: ${finalCount?.toLocaleString()} logs`);
    console.log(`New logs: ${totalNewLogs.toLocaleString()}`);
    console.log(`Progress to 600K: ${((finalCount || 0) / 600000 * 100).toFixed(1)}%`);
    
    if ((finalCount || 0) >= 200000) {
        console.log('\n🎉🎉🎉 200K LOGS MILESTONE ACHIEVED! 🎉🎉🎉');
        await fs.appendFile('master-collection.log', `\n${new Date().toISOString()} - 🎉 200K MILESTONE! Total: ${finalCount?.toLocaleString()} logs`);
    }
    
    // Show missing teams
    if (allTeamsNotInDB.size > 0) {
        console.log(`\n⚠️  ${allTeamsNotInDB.size} teams not in database:`);
        const teamsList = Array.from(allTeamsNotInDB).slice(0, 10);
        teamsList.forEach(team => {
            const [id, name] = team.split(':');
            console.log(`   - ${name} (ID: ${id})`);
        });
        if (allTeamsNotInDB.size > 10) {
            console.log(`   ... and ${allTeamsNotInDB.size - 10} more`);
        }
    }
}

continueNCAACollection();
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cache for player mappings
const playerIdCache = new Map<string, number>();
const processedGames = new Set<number>();

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

async function getUnprocessedGames(sport: string, limit: number = 1000): Promise<any[]> {
    console.log(`\nFinding unprocessed ${sport} games...`);
    
    // Get all games
    const { data: allGames } = await supabase
        .from('games')
        .select('id, external_id, start_time')
        .eq('sport', sport)
        .eq('status', 'STATUS_FINAL')
        .order('start_time', { ascending: false })
        .limit(limit);
        
    if (!allGames || allGames.length === 0) return [];
    
    // Get games that already have logs
    const gameIds = allGames.map(g => g.id);
    const { data: processedGameIds } = await supabase
        .from('player_game_logs')
        .select('game_id')
        .in('game_id', gameIds);
        
    const processedSet = new Set(processedGameIds?.map(g => g.game_id) || []);
    const unprocessedGames = allGames.filter(g => !processedSet.has(g.id));
    
    console.log(`Found ${unprocessedGames.length} games without logs (out of ${allGames.length} total)`);
    return unprocessedGames;
}

async function processGame(game: any, sport: string): Promise<{ logs: any[], errors: string[] }> {
    const logs: any[] = [];
    const errors: string[] = [];
    
    try {
        const sportPath = sport === 'NCAA_FB' ? 'football/college-football' : 'basketball/mens-college-basketball';
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/summary?event=${game.external_id}`;
        const response = await axios.get(url, { timeout: 10000 });
        
        if (!response.data?.boxscore?.players) {
            errors.push(`No boxscore for game ${game.external_id}`);
            return { logs, errors };
        }
        
        const gameDate = new Date(game.start_time).toISOString().split('T')[0];
        
        for (const teamPlayers of response.data.boxscore.players) {
            const teamId = parseInt(teamPlayers.team.id);
            
            if (sport === 'NCAA_BB' && teamPlayers.statistics?.[0]?.athletes) {
                for (const player of teamPlayers.statistics[0].athletes) {
                    if (!player.athlete || player.didNotPlay || !player.stats || player.stats[0] === '0:00') continue;
                    
                    const playerId = await getPlayerId(player.athlete.id);
                    if (!playerId) {
                        errors.push(`Player ${player.athlete.id} not in DB`);
                        continue;
                    }
                    
                    const log = {
                        player_id: playerId,
                        game_id: game.id,
                        team_id: teamId,
                        game_date: gameDate,
                        is_home: teamPlayers.homeAway === 'home',
                        minutes_played: parseInt(player.stats[0]?.split(':')[0]) || 0,
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
                            ft_attempted: parseInt(player.stats[8]) || 0
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
                    
                    logs.push(log);
                }
            } else if (sport === 'NCAA_FB' && teamPlayers.statistics) {
                // Process football stats
                for (const statCategory of teamPlayers.statistics) {
                    if (statCategory.athletes) {
                        for (const player of statCategory.athletes) {
                            if (!player.athlete || !player.stats) continue;
                            
                            const playerId = await getPlayerId(player.athlete.id);
                            if (!playerId) continue;
                            
                            const baseLog = {
                                player_id: playerId,
                                game_id: game.id,
                                team_id: teamId,
                                game_date: gameDate,
                                is_home: teamPlayers.homeAway === 'home',
                                stats: {},
                                fantasy_points: 0
                            };
                            
                            if (statCategory.name === 'passing' && parseInt(player.stats[1]) > 0) {
                                const log = {
                                    ...baseLog,
                                    stats: {
                                        pass_completions: parseInt(player.stats[0]) || 0,
                                        pass_attempts: parseInt(player.stats[1]) || 0,
                                        pass_yards: parseInt(player.stats[2]) || 0,
                                        pass_tds: parseInt(player.stats[4]) || 0,
                                        interceptions: parseInt(player.stats[5]) || 0
                                    }
                                };
                                
                                log.fantasy_points = 
                                    (log.stats.pass_yards * 0.04) +
                                    (log.stats.pass_tds * 4) -
                                    (log.stats.interceptions * 2);
                                    
                                logs.push(log);
                            }
                        }
                    }
                }
            }
        }
    } catch (error: any) {
        errors.push(`API error for game ${game.external_id}: ${error.message}`);
    }
    
    return { logs, errors };
}

async function ncaaSmartCollector() {
    console.log('🧠 NCAA SMART COLLECTOR - Processing unprocessed games only');
    console.log('==========================================================\n');
    
    const { count: startCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log(`Starting with ${startCount?.toLocaleString()} logs`);
    
    let totalNewLogs = 0;
    let totalErrors = 0;
    
    // Process NCAA Basketball
    const bbGames = await getUnprocessedGames('NCAA_BB', 2000);
    
    if (bbGames.length > 0) {
        console.log('\n🏀 Processing NCAA Basketball...\n');
        
        const BATCH_SIZE = 10;
        for (let i = 0; i < bbGames.length; i += BATCH_SIZE) {
            const batch = bbGames.slice(i, i + BATCH_SIZE);
            const batchLogs: any[] = [];
            let batchErrors = 0;
            
            // Process games in parallel
            const results = await Promise.all(
                batch.map(game => processGame(game, 'NCAA_BB'))
            );
            
            for (const result of results) {
                batchLogs.push(...result.logs);
                batchErrors += result.errors.length;
            }
            
            // Insert logs if we have any
            if (batchLogs.length > 0) {
                try {
                    const { data, error } = await supabase
                        .from('player_game_logs')
                        .insert(batchLogs)
                        .select();
                        
                    if (data) {
                        totalNewLogs += data.length;
                    }
                    if (error) {
                        console.error('Insert error:', error);
                    }
                } catch (err) {
                    console.error('Batch insert failed:', err);
                }
            }
            
            totalErrors += batchErrors;
            
            const progress = ((i + BATCH_SIZE) / bbGames.length * 100).toFixed(1);
            console.log(`Progress: ${i + BATCH_SIZE}/${bbGames.length} games (${progress}%) | +${batchLogs.length} logs | ${batchErrors} errors`);
            
            // Show milestone
            if (totalNewLogs > 0 && totalNewLogs % 5000 === 0) {
                const { count } = await supabase
                    .from('player_game_logs')
                    .select('*', { count: 'exact', head: true });
                console.log(`\n🎯 MILESTONE: ${count?.toLocaleString()} total logs!\n`);
            }
            
            // Rate limit pause
            if (i > 0 && i % 100 === 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    
    // Process NCAA Football
    const fbGames = await getUnprocessedGames('NCAA_FB', 500);
    
    if (fbGames.length > 0) {
        console.log('\n\n🏈 Processing NCAA Football...\n');
        
        const BATCH_SIZE = 5;
        for (let i = 0; i < fbGames.length; i += BATCH_SIZE) {
            const batch = fbGames.slice(i, i + BATCH_SIZE);
            const batchLogs: any[] = [];
            
            const results = await Promise.all(
                batch.map(game => processGame(game, 'NCAA_FB'))
            );
            
            for (const result of results) {
                batchLogs.push(...result.logs);
            }
            
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
                    // Continue on error
                }
            }
            
            const progress = ((i + BATCH_SIZE) / fbGames.length * 100).toFixed(1);
            console.log(`Progress: ${i + BATCH_SIZE}/${fbGames.length} games (${progress}%) | +${batchLogs.length} logs`);
        }
    }
    
    // Final summary
    const { count: finalCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log('\n\n🏆 COLLECTION COMPLETE!');
    console.log('======================');
    console.log(`Started: ${startCount?.toLocaleString()} logs`);
    console.log(`Final: ${finalCount?.toLocaleString()} logs`);
    console.log(`New logs: ${totalNewLogs.toLocaleString()}`);
    console.log(`Errors encountered: ${totalErrors}`);
    console.log(`\n📈 Progress to 600K: ${((finalCount || 0) / 600000 * 100).toFixed(1)}%`);
    
    if ((finalCount || 0) > 200000) {
        console.log('\n🎉🎉🎉 200K+ LOGS MILESTONE! 🎉🎉🎉');
    }
}

ncaaSmartCollector();
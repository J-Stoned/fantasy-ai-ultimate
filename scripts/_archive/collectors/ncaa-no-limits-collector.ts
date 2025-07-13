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

async function getAllGames(sport: string): Promise<any[]> {
    console.log(`Fetching ALL ${sport} games...`);
    const allGames: any[] = [];
    let offset = 0;
    const limit = 1000;
    
    while (true) {
        const { data, error } = await supabase
            .from('games')
            .select('id, external_id, start_time')
            .eq('sport', sport)
            .eq('status', 'STATUS_FINAL')
            .order('start_time', { ascending: false })
            .range(offset, offset + limit - 1);
            
        if (error) {
            console.error('Error fetching games:', error);
            break;
        }
        
        if (!data || data.length === 0) break;
        
        allGames.push(...data);
        console.log(`  Fetched ${allGames.length} games so far...`);
        
        if (data.length < limit) break;
        offset += limit;
    }
    
    return allGames;
}

async function processGame(game: any, sport: string): Promise<any[]> {
    const logs: any[] = [];
    
    try {
        const sportPath = sport === 'NCAA_FB' ? 'football/college-football' : 'basketball/mens-college-basketball';
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/summary?event=${game.external_id}`;
        const response = await axios.get(url, { timeout: 10000 });
        
        if (response.data?.boxscore?.players) {
            const gameDate = new Date(game.start_time).toISOString().split('T')[0];
            
            for (const teamPlayers of response.data.boxscore.players) {
                const teamId = parseInt(teamPlayers.team.id);
                
                if (teamPlayers.statistics?.[0]?.athletes) {
                    for (const player of teamPlayers.statistics[0].athletes) {
                        if (!player.athlete || player.didNotPlay || !player.stats) continue;
                        
                        // Basketball specific check
                        if (sport === 'NCAA_BB' && player.stats[0] === '0:00') continue;
                        
                        const playerId = await getPlayerId(player.athlete.id);
                        if (!playerId) continue;
                        
                        const log = {
                            player_id: playerId,
                            game_id: game.id,
                            team_id: teamId,
                            game_date: gameDate,
                            is_home: teamPlayers.homeAway === 'home',
                            minutes_played: sport === 'NCAA_BB' ? (parseInt(player.stats[0]?.split(':')[0]) || 0) : 0,
                            stats: {},
                            fantasy_points: 0
                        };
                        
                        if (sport === 'NCAA_BB') {
                            log.stats = {
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
                            
                            log.fantasy_points = 
                                (log.stats.points * 1) +
                                (log.stats.rebounds * 1.25) +
                                (log.stats.assists * 1.5) +
                                (log.stats.steals * 2) +
                                (log.stats.blocks * 2) +
                                (log.stats.turnovers * -0.5) +
                                (log.stats.three_made * 0.5);
                        }
                        
                        logs.push(log);
                    }
                }
            }
        }
    } catch (error) {
        // Skip failed games
    }
    
    return logs;
}

async function ncaaNoLimitsCollector() {
    console.log('🚀 NCAA NO LIMITS COLLECTOR - GETTING EVERYTHING!');
    console.log('================================================\n');
    
    const { count: startCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log(`Starting with ${startCount?.toLocaleString()} logs\n`);
    
    // Get ALL NCAA Basketball games
    const bbGames = await getAllGames('NCAA_BB');
    console.log(`\nTotal NCAA Basketball games: ${bbGames.length.toLocaleString()}\n`);
    
    if (bbGames.length === 0) {
        console.log('No games found!');
        return;
    }
    
    // Process in smaller batches to avoid memory issues
    const BATCH_SIZE = 20;
    let totalInserted = 0;
    let gamesProcessed = 0;
    
    console.log('Processing games...\n');
    
    for (let i = 0; i < bbGames.length; i += BATCH_SIZE) {
        const batch = bbGames.slice(i, i + BATCH_SIZE);
        const batchLogs: any[] = [];
        
        // Process batch in parallel
        await Promise.all(batch.map(async (game) => {
            const gameLogs = await processGame(game, 'NCAA_BB');
            batchLogs.push(...gameLogs);
        }));
        
        // Insert logs if we have any
        if (batchLogs.length > 0) {
            try {
                // Insert in chunks to avoid size limits
                const CHUNK_SIZE = 500;
                for (let j = 0; j < batchLogs.length; j += CHUNK_SIZE) {
                    const chunk = batchLogs.slice(j, j + CHUNK_SIZE);
                    
                    const { data, error } = await supabase
                        .from('player_game_logs')
                        .upsert(chunk, { 
                            onConflict: 'player_id,game_id',
                            ignoreDuplicates: true 
                        })
                        .select();
                        
                    if (data) {
                        totalInserted += data.length;
                    }
                }
            } catch (err) {
                console.error('Insert error:', err);
            }
        }
        
        gamesProcessed += batch.length;
        const progress = (gamesProcessed / bbGames.length * 100).toFixed(1);
        
        console.log(`Progress: ${gamesProcessed}/${bbGames.length} games (${progress}%) | Total logs: ${totalInserted}`);
        
        // Milestone check
        if (totalInserted > 0 && totalInserted % 25000 === 0) {
            const { count } = await supabase
                .from('player_game_logs')
                .select('*', { count: 'exact', head: true });
            console.log(`\n🎯 MILESTONE: ${count?.toLocaleString()} total logs in database!\n`);
        }
        
        // Small delay to avoid rate limits
        if (i > 0 && i % 200 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // Final summary
    const { count: finalCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log('\n\n🏆 NO LIMITS COLLECTION COMPLETE!');
    console.log('=================================');
    console.log(`Started: ${startCount?.toLocaleString()} logs`);
    console.log(`Final: ${finalCount?.toLocaleString()} logs`);
    console.log(`New logs: ${(finalCount || 0) - (startCount || 0)}`);
    console.log(`\n📈 Progress to 600K: ${((finalCount || 0) / 600000 * 100).toFixed(1)}%`);
    
    if ((finalCount || 0) > 200000) {
        console.log('\n🎉🎉🎉 200K+ LOGS ACHIEVED! 🎉🎉🎉');
    }
}

ncaaNoLimitsCollector();
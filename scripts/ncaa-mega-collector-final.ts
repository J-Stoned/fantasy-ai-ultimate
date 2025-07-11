import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cache for player ID mappings
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

async function processGameBatch(games: any[], sport: string) {
    let successfulInserts = 0;
    const allLogs: any[] = [];
    
    await Promise.all(games.map(async (game) => {
        try {
            const sportPath = sport === 'NCAA_FB' ? 'football/college-football' : 'basketball/mens-college-basketball';
            const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/summary?event=${game.external_id}`;
            const response = await axios.get(url);
            
            if (response.data?.boxscore?.players) {
                const gameDate = new Date(game.start_time).toISOString().split('T')[0];
                
                for (const teamPlayers of response.data.boxscore.players) {
                    const teamId = parseInt(teamPlayers.team.id);
                    
                    if (sport === 'NCAA_BB' && teamPlayers.statistics?.[0]?.athletes) {
                        for (const player of teamPlayers.statistics[0].athletes) {
                            if (!player.athlete || player.didNotPlay || !player.stats || player.stats[0] === '0:00') continue;
                            
                            const playerId = await getPlayerId(player.athlete.id);
                            if (!playerId) continue;
                            
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
                            
                            log.fantasy_points = 
                                (log.stats.points * 1) +
                                (log.stats.rebounds * 1.25) +
                                (log.stats.assists * 1.5) +
                                (log.stats.steals * 2) +
                                (log.stats.blocks * 2) +
                                (log.stats.turnovers * -0.5) +
                                (log.stats.three_made * 0.5);
                            
                            allLogs.push(log);
                        }
                    } else if (sport === 'NCAA_FB' && teamPlayers.statistics) {
                        // Process all football stat categories
                        for (const statCategory of teamPlayers.statistics) {
                            if (statCategory.athletes) {
                                for (const player of statCategory.athletes) {
                                    if (!player.athlete || !player.stats) continue;
                                    
                                    const playerId = await getPlayerId(player.athlete.id);
                                    if (!playerId) continue;
                                    
                                    const log: any = {
                                        player_id: playerId,
                                        game_id: game.id,
                                        team_id: teamId,
                                        game_date: gameDate,
                                        is_home: teamPlayers.homeAway === 'home',
                                        stats: { category: statCategory.name },
                                        fantasy_points: 0
                                    };
                                    
                                    if (statCategory.name === 'passing' && parseInt(player.stats[1]) > 0) {
                                        log.stats.pass_completions = parseInt(player.stats[0]) || 0;
                                        log.stats.pass_attempts = parseInt(player.stats[1]) || 0;
                                        log.stats.pass_yards = parseInt(player.stats[2]) || 0;
                                        log.stats.pass_tds = parseInt(player.stats[4]) || 0;
                                        log.stats.interceptions = parseInt(player.stats[5]) || 0;
                                        
                                        log.fantasy_points = 
                                            (log.stats.pass_yards * 0.04) +
                                            (log.stats.pass_tds * 4) -
                                            (log.stats.interceptions * 2);
                                            
                                        allLogs.push(log);
                                    } else if (statCategory.name === 'rushing' && parseInt(player.stats[0]) > 0) {
                                        log.stats.rush_attempts = parseInt(player.stats[0]) || 0;
                                        log.stats.rush_yards = parseInt(player.stats[1]) || 0;
                                        log.stats.rush_tds = parseInt(player.stats[3]) || 0;
                                        
                                        log.fantasy_points = 
                                            (log.stats.rush_yards * 0.1) +
                                            (log.stats.rush_tds * 6);
                                            
                                        allLogs.push(log);
                                    } else if (statCategory.name === 'receiving' && parseInt(player.stats[0]) > 0) {
                                        log.stats.receptions = parseInt(player.stats[0]) || 0;
                                        log.stats.rec_yards = parseInt(player.stats[1]) || 0;
                                        log.stats.rec_tds = parseInt(player.stats[3]) || 0;
                                        
                                        log.fantasy_points = 
                                            (log.stats.receptions * 1) +
                                            (log.stats.rec_yards * 0.1) +
                                            (log.stats.rec_tds * 6);
                                            
                                        allLogs.push(log);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            // Skip failed games
        }
    }));
    
    // Bulk insert all logs
    if (allLogs.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < allLogs.length; i += batchSize) {
            const batch = allLogs.slice(i, i + batchSize);
            
            const { data, error } = await supabase
                .from('player_game_logs')
                .insert(batch)
                .select();
                
            if (!error && data) {
                successfulInserts += data.length;
            }
        }
    }
    
    return { successfulInserts, attempted: allLogs.length };
}

async function ncaaMegaCollectorFinal() {
    console.log('🚀 NCAA MEGA COLLECTOR FINAL VERSION');
    console.log('=====================================\n');
    
    const { count: startCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log(`Starting with ${startCount?.toLocaleString()} logs\n`);
    
    let grandTotalInserted = 0;
    
    // Process each sport
    for (const sport of ['NCAA_BB', 'NCAA_FB']) {
        console.log(`\n🏆 Processing ${sport}...`);
        
        const { data: games } = await supabase
            .from('games')
            .select('id, external_id, start_time')
            .eq('sport', sport)
            .eq('status', 'STATUS_FINAL')
            .order('start_time', { ascending: false })
            .limit(1000); // Process 1000 games per sport
            
        if (!games || games.length === 0) continue;
        
        console.log(`Found ${games.length} completed ${sport} games\n`);
        
        let totalInserted = 0;
        const BATCH_SIZE = 20;
        
        for (let i = 0; i < games.length; i += BATCH_SIZE) {
            const batch = games.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            
            const { successfulInserts, attempted } = await processGameBatch(batch, sport);
            totalInserted += successfulInserts;
            
            process.stdout.write(`\rBatch ${batchNum}/${Math.ceil(games.length / BATCH_SIZE)}: ${successfulInserts}/${attempted} logs | Total: ${totalInserted}`);
            
            // Progress milestone
            if (totalInserted > 0 && totalInserted % 5000 === 0) {
                const { count } = await supabase
                    .from('player_game_logs')
                    .select('*', { count: 'exact', head: true });
                console.log(`\n\n🎯 MILESTONE: ${count?.toLocaleString()} total logs!\n`);
            }
        }
        
        console.log(`\n\n✅ ${sport} Complete: ${totalInserted} logs inserted`);
        grandTotalInserted += totalInserted;
    }
    
    // Final summary
    const { count: finalCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log('\n\n🏆 FINAL RESULTS:');
    console.log('==================');
    console.log(`Started with: ${startCount?.toLocaleString()} logs`);
    console.log(`Ended with: ${finalCount?.toLocaleString()} logs`);
    console.log(`Added this run: ${grandTotalInserted.toLocaleString()} logs`);
    console.log(`\n📈 Progress to 600K: ${((finalCount || 0) / 600000 * 100).toFixed(1)}%`);
    
    if ((finalCount || 0) > 200000) {
        console.log('\n🎉 CROSSED 200K LOGS! MASSIVE MILESTONE!');
    }
}

ncaaMegaCollectorFinal();
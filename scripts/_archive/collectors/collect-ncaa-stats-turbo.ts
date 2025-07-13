import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Process games in parallel
async function processGameBatch(games: any[], sport: string, batchId: number) {
    let successfulInserts = 0;
    let totalLogs = 0;
    
    const promises = games.map(async (game) => {
        try {
            const sportPath = sport === 'NCAA_FB' ? 'football/college-football' : 'basketball/mens-college-basketball';
            const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/summary?event=${game.external_id}`;
            const response = await axios.get(url);
            
            if (response.data?.boxscore?.players) {
                const gameDate = new Date(game.start_time).toISOString().split('T')[0];
                const logsToInsert = [];
                
                for (const teamPlayers of response.data.boxscore.players) {
                    const teamId = parseInt(teamPlayers.team.id);
                    
                    if (teamPlayers.statistics) {
                        for (const statCategory of teamPlayers.statistics) {
                            if (statCategory.athletes) {
                                for (const player of statCategory.athletes) {
                                    if (!player.athlete || (sport === 'NCAA_BB' && player.didNotPlay)) continue;
                                    
                                    const log: any = {
                                        player_id: parseInt(player.athlete.id),
                                        game_id: game.id,
                                        team_id: teamId,
                                        game_date: gameDate,
                                        is_home: teamPlayers.homeAway === 'home',
                                        stats: {},
                                        fantasy_points: 0
                                    };
                                    
                                    if (sport === 'NCAA_BB' && player.stats && player.stats[0] !== '0:00') {
                                        // Basketball stats
                                        log.minutes_played = parseInt(player.stats[0]?.split(':')[0]) || 0;
                                        log.stats = {
                                            points: parseInt(player.stats[18]) || 0,
                                            rebounds: parseInt(player.stats[12]) || 0,
                                            assists: parseInt(player.stats[13]) || 0,
                                            steals: parseInt(player.stats[14]) || 0,
                                            blocks: parseInt(player.stats[15]) || 0,
                                            turnovers: parseInt(player.stats[16]) || 0,
                                            fg_made: parseInt(player.stats[1]) || 0,
                                            fg_attempted: parseInt(player.stats[2]) || 0,
                                            three_made: parseInt(player.stats[4]) || 0,
                                            three_attempted: parseInt(player.stats[5]) || 0
                                        };
                                        
                                        log.fantasy_points = 
                                            (log.stats.points * 1) +
                                            (log.stats.rebounds * 1.25) +
                                            (log.stats.assists * 1.5) +
                                            (log.stats.steals * 2) +
                                            (log.stats.blocks * 2) +
                                            (log.stats.turnovers * -0.5);
                                            
                                        if (log.minutes_played > 0) logsToInsert.push(log);
                                        
                                    } else if (sport === 'NCAA_FB' && statCategory.name === 'passing' && player.stats) {
                                        // Football passing stats
                                        log.stats.completions = parseInt(player.stats[0]) || 0;
                                        log.stats.attempts = parseInt(player.stats[1]) || 0;
                                        log.stats.passing_yards = parseInt(player.stats[2]) || 0;
                                        log.stats.passing_tds = parseInt(player.stats[4]) || 0;
                                        log.stats.interceptions = parseInt(player.stats[5]) || 0;
                                        
                                        log.fantasy_points += 
                                            (log.stats.passing_yards * 0.04) +
                                            (log.stats.passing_tds * 4) -
                                            (log.stats.interceptions * 2);
                                            
                                        if (log.stats.attempts > 0) logsToInsert.push(log);
                                    }
                                }
                            }
                        }
                    }
                }
                
                // Bulk insert for this game
                if (logsToInsert.length > 0) {
                    const { data, error } = await supabase
                        .from('player_game_logs')
                        .insert(logsToInsert)
                        .select();
                        
                    if (!error && data) {
                        successfulInserts += data.length;
                        totalLogs += logsToInsert.length;
                    }
                }
            }
        } catch (error) {
            // Skip failed games
        }
    });
    
    await Promise.all(promises);
    
    return { successfulInserts, totalLogs };
}

async function collectNCAAStatsTurbo() {
    console.log('🚀 NCAA STATS COLLECTOR TURBO MODE');
    console.log('==================================\n');
    
    const startingLogs = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log(`Starting logs: ${startingLogs.count?.toLocaleString()}\n`);
    
    // Process both sports
    for (const sport of ['NCAA_FB', 'NCAA_BB']) {
        console.log(`\n📊 Processing ${sport}...`);
        
        const { data: games } = await supabase
            .from('games')
            .select('id, external_id, start_time')
            .eq('sport', sport)
            .order('start_time', { ascending: false })
            .limit(200); // Process most recent games first
            
        if (!games || games.length === 0) continue;
        
        let totalSuccess = 0;
        let totalAttempted = 0;
        const BATCH_SIZE = 10;
        
        for (let i = 0; i < games.length; i += BATCH_SIZE) {
            const batch = games.slice(i, i + BATCH_SIZE);
            const { successfulInserts, totalLogs } = await processGameBatch(batch, sport, i / BATCH_SIZE);
            
            totalSuccess += successfulInserts;
            totalAttempted += totalLogs;
            
            console.log(`Batch ${i/BATCH_SIZE + 1}: ${successfulInserts}/${totalLogs} logs inserted`);
            
            // Quick progress check
            if (i === 50) {
                const { count } = await supabase
                    .from('player_game_logs')
                    .select('*', { count: 'exact', head: true });
                    
                console.log(`\nProgress check - Total logs now: ${count?.toLocaleString()}`);
            }
        }
        
        console.log(`\n${sport} Complete: ${totalSuccess} logs inserted`);
    }
    
    // Final count
    const { count: finalCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log(`\n\n🎯 FINAL TOTAL: ${finalCount?.toLocaleString()} logs`);
    console.log(`📈 Logs added this run: ${(finalCount || 0) - (startingLogs.count || 0)}`);
    console.log(`🎯 Progress to 600K: ${((finalCount || 0) / 600000 * 100).toFixed(1)}%`);
}

collectNCAAStatsTurbo();
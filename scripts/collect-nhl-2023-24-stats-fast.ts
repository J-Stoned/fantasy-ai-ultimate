import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Process multiple games in parallel
async function processGameBatch(games: any[], batchId: number) {
    const batchLogs: any[] = [];
    let batchGamesWithStats = 0;
    
    await Promise.all(games.map(async (game) => {
        try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${game.external_id}`;
            const response = await axios.get(url);
            
            if (response.data?.boxscore?.players) {
                const players = response.data.boxscore.players;
                const gameDate = new Date(game.start_time).toISOString().split('T')[0];
                let hasStats = false;
                
                for (const teamPlayers of players) {
                    const teamId = teamPlayers.team.id;
                    
                    // Process skaters
                    if (teamPlayers.statistics?.[0]?.athletes) {
                        for (const player of teamPlayers.statistics[0].athletes) {
                            try {
                                const playerLog = {
                                    player_id: player.athlete.id,
                                    game_id: game.id,
                                    team_id: teamId,
                                    game_date: gameDate,
                                    is_home: teamPlayers.homeAway === 'home',
                                    minutes_played: parseInt(player.stats[3]) || 0,
                                    stats: {
                                        goals: parseInt(player.stats[0]) || 0,
                                        assists: parseInt(player.stats[1]) || 0,
                                        points: parseInt(player.stats[2]) || 0,
                                        plus_minus: parseInt(player.stats[4]) || 0,
                                        penalty_minutes: parseInt(player.stats[5]) || 0,
                                        shots: parseInt(player.stats[8]) || 0,
                                        hits: parseInt(player.stats[11]) || 0,
                                        blocked_shots: parseInt(player.stats[10]) || 0,
                                        power_play_goals: parseInt(player.stats[6]) || 0,
                                        power_play_assists: parseInt(player.stats[7]) || 0,
                                        faceoff_wins: parseInt(player.stats[13]) || 0,
                                        faceoff_losses: parseInt(player.stats[14]) || 0,
                                        position: player.athlete.position?.abbreviation || 'F'
                                    },
                                    fantasy_points: 0
                                };
                                
                                playerLog.fantasy_points = 
                                    (playerLog.stats.goals * 3) +
                                    (playerLog.stats.assists * 2) +
                                    (playerLog.stats.shots * 0.5) +
                                    (playerLog.stats.blocked_shots * 0.5) +
                                    (playerLog.stats.hits * 0.3);
                                
                                batchLogs.push(playerLog);
                                hasStats = true;
                            } catch (err) {
                                continue;
                            }
                        }
                    }
                    
                    // Process goalies
                    if (teamPlayers.statistics?.[1]?.athletes) {
                        for (const goalie of teamPlayers.statistics[1].athletes) {
                            try {
                                const playerLog = {
                                    player_id: goalie.athlete.id,
                                    game_id: game.id,
                                    team_id: teamId,
                                    game_date: gameDate,
                                    is_home: teamPlayers.homeAway === 'home',
                                    minutes_played: parseInt(goalie.stats[0]) || 0,
                                    stats: {
                                        saves: parseInt(goalie.stats[4]) || 0,
                                        goals_against: parseInt(goalie.stats[3]) || 0,
                                        shots_against: parseInt(goalie.stats[5]) || 0,
                                        save_percentage: parseFloat(goalie.stats[6]) || 0,
                                        wins: goalie.stats[1] === 'W' ? 1 : 0,
                                        losses: goalie.stats[1] === 'L' ? 1 : 0,
                                        overtime_losses: goalie.stats[1] === 'OTL' ? 1 : 0,
                                        position: 'G'
                                    },
                                    fantasy_points: 0
                                };
                                
                                playerLog.fantasy_points = 
                                    (playerLog.stats.wins * 5) +
                                    (playerLog.stats.saves * 0.2) -
                                    (playerLog.stats.goals_against * 1);
                                
                                batchLogs.push(playerLog);
                                hasStats = true;
                            } catch (err) {
                                continue;
                            }
                        }
                    }
                }
                
                if (hasStats) batchGamesWithStats++;
            }
        } catch (error) {
            // Skip failed games
        }
    }));
    
    return { logs: batchLogs, gamesWithStats: batchGamesWithStats };
}

async function collectNHL2023StatsFast() {
    console.log('🏒 NHL 2023-24 STATS COLLECTOR (FAST MODE)');
    console.log('==========================================\n');

    try {
        // Get all NHL 2023-24 games with pagination
        let allGames: any[] = [];
        let offset = 0;
        const limit = 1000;
        
        while (true) {
            const { data: batch, error: gamesError } = await supabase
                .from('games')
                .select('id, external_id, metadata, start_time')
                .eq('sport', 'NHL')
                .gte('start_time', '2023-10-01')
                .lte('start_time', '2024-06-30')
                .order('start_time', { ascending: true })
                .range(offset, offset + limit - 1);
                
            if (gamesError) throw gamesError;
            if (!batch || batch.length === 0) break;
            
            allGames = allGames.concat(batch);
            
            if (batch.length < limit) break;
            offset += limit;
        }
        
        console.log(`Found ${allGames.length} NHL 2023-24 games\n`);

        // Check which games we've already processed
        const { data: existingLogs } = await supabase
            .from('player_game_logs')
            .select('game_id')
            .in('game_id', allGames.map(g => g.id));
            
        const processedGameIds = new Set(existingLogs?.map(log => log.game_id) || []);
        const gamesToProcess = allGames.filter(g => !processedGameIds.has(g.id));
        
        console.log(`Already processed: ${processedGameIds.size} games`);
        console.log(`Games to process: ${gamesToProcess.length}\n`);

        // Process games in parallel batches
        const BATCH_SIZE = 20; // Process 20 games at once
        let totalLogs = 0;
        let totalGamesWithStats = 0;
        
        for (let i = 0; i < gamesToProcess.length; i += BATCH_SIZE) {
            const batch = gamesToProcess.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(gamesToProcess.length / BATCH_SIZE);
            
            console.log(`Processing batch ${batchNum}/${totalBatches}...`);
            
            const { logs, gamesWithStats } = await processGameBatch(batch, batchNum);
            
            // Insert logs in chunks
            if (logs.length > 0) {
                const INSERT_CHUNK_SIZE = 100;
                for (let j = 0; j < logs.length; j += INSERT_CHUNK_SIZE) {
                    const chunk = logs.slice(j, j + INSERT_CHUNK_SIZE);
                    const { error: insertError } = await supabase
                        .from('player_game_logs')
                        .insert(chunk);
                    
                    if (insertError) {
                        console.error(`Error inserting chunk: ${insertError.message}`);
                    }
                }
            }
            
            totalLogs += logs.length;
            totalGamesWithStats += gamesWithStats;
            
            console.log(`Batch ${batchNum} complete: ${logs.length} logs from ${gamesWithStats} games`);
            console.log(`Total progress: ${totalLogs} logs from ${totalGamesWithStats} games\n`);
        }
        
        console.log(`✅ COMPLETE! Collected ${totalLogs} player logs from ${totalGamesWithStats} games`);
        
        // Get final count
        const { count } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .gte('game_date', '2023-10-01')
            .lte('game_date', '2024-06-30');
            
        console.log(`\nTotal NHL 2023-24 logs in database: ${count}`);
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

collectNHL2023StatsFast();
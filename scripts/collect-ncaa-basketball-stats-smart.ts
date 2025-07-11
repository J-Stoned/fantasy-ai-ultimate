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
    let successfulInserts = 0;
    
    await Promise.all(games.map(async (game) => {
        try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${game.external_id}`;
            const response = await axios.get(url);
            
            if (response.data?.boxscore?.players) {
                const players = response.data.boxscore.players;
                const gameDate = new Date(game.start_time).toISOString().split('T')[0];
                let hasStats = false;
                const gameLogs: any[] = [];
                
                for (const teamPlayers of players) {
                    const teamId = teamPlayers.team.id;
                    
                    // Process each player
                    if (teamPlayers.statistics?.[0]?.athletes) {
                        for (const player of teamPlayers.statistics[0].athletes) {
                            try {
                                // Skip if player didn't play (DNP)
                                if (!player.stats || player.stats[0] === '0:00' || player.didNotPlay) {
                                    continue;
                                }
                                
                                const playerLog: any = {
                                    player_id: parseInt(player.athlete.id),
                                    game_id: game.id,
                                    team_id: parseInt(teamId),
                                    game_date: gameDate,
                                    is_home: teamPlayers.homeAway === 'home',
                                    minutes_played: parseInt(player.stats[0]?.split(':')[0]) || 0,
                                    stats: {
                                        minutes: player.stats[0] || '0:00',
                                        field_goals_made: parseInt(player.stats[1]) || 0,
                                        field_goals_attempted: parseInt(player.stats[2]) || 0,
                                        three_pointers_made: parseInt(player.stats[4]) || 0,
                                        three_pointers_attempted: parseInt(player.stats[5]) || 0,
                                        free_throws_made: parseInt(player.stats[7]) || 0,
                                        free_throws_attempted: parseInt(player.stats[8]) || 0,
                                        offensive_rebounds: parseInt(player.stats[10]) || 0,
                                        defensive_rebounds: parseInt(player.stats[11]) || 0,
                                        total_rebounds: parseInt(player.stats[12]) || 0,
                                        assists: parseInt(player.stats[13]) || 0,
                                        steals: parseInt(player.stats[14]) || 0,
                                        blocks: parseInt(player.stats[15]) || 0,
                                        turnovers: parseInt(player.stats[16]) || 0,
                                        personal_fouls: parseInt(player.stats[17]) || 0,
                                        points: parseInt(player.stats[18]) || 0,
                                        position: player.athlete.position?.abbreviation || 'Unknown'
                                    },
                                    fantasy_points: 0
                                };
                                
                                // Calculate fantasy points (DraftKings scoring)
                                playerLog.fantasy_points = 
                                    (playerLog.stats.points * 1) +
                                    (playerLog.stats.total_rebounds * 1.25) +
                                    (playerLog.stats.assists * 1.5) +
                                    (playerLog.stats.steals * 2) +
                                    (playerLog.stats.blocks * 2) +
                                    (playerLog.stats.turnovers * -0.5) +
                                    (playerLog.stats.three_pointers_made * 0.5);
                                    
                                // Double-double bonus
                                const doubleDigitCats = [
                                    playerLog.stats.points >= 10,
                                    playerLog.stats.total_rebounds >= 10,
                                    playerLog.stats.assists >= 10,
                                    playerLog.stats.steals >= 10,
                                    playerLog.stats.blocks >= 10
                                ].filter(Boolean).length;
                                
                                if (doubleDigitCats >= 2) playerLog.fantasy_points += 1.5;
                                if (doubleDigitCats >= 3) playerLog.fantasy_points += 3;
                                
                                gameLogs.push(playerLog);
                                hasStats = true;
                            } catch (err) {
                                continue;
                            }
                        }
                    }
                }
                
                if (hasStats && gameLogs.length > 0) {
                    batchGamesWithStats++;
                    
                    // Try to insert logs individually to handle duplicates
                    for (const log of gameLogs) {
                        try {
                            const { error } = await supabase
                                .from('player_game_logs')
                                .insert(log);
                                
                            if (!error) {
                                successfulInserts++;
                                batchLogs.push(log);
                            }
                        } catch (err) {
                            // Skip duplicates silently
                        }
                    }
                }
            }
        } catch (error) {
            // Skip failed games
        }
    }));
    
    return { logs: batchLogs, gamesWithStats: batchGamesWithStats, successfulInserts };
}

async function collectNCAABasketballStats() {
    console.log('🏀 NCAA BASKETBALL STATS COLLECTOR (SMART)');
    console.log('=========================================\n');

    try {
        // Get all NCAA Basketball games
        const { data: games, error: gamesError } = await supabase
            .from('games')
            .select('id, external_id, metadata, start_time')
            .eq('sport', 'NCAA_BB')
            .gte('start_time', '2024-11-01')
            .lte('start_time', '2025-04-10')
            .order('start_time', { ascending: true });

        if (gamesError) throw gamesError;

        console.log(`Found ${games?.length || 0} NCAA Basketball games to process\n`);

        // Process games in parallel batches
        const BATCH_SIZE = 5; // Smaller batches due to more data per game
        let totalLogs = 0;
        let totalGamesWithStats = 0;
        let totalSuccessfulInserts = 0;
        
        for (let i = 0; i < (games?.length || 0); i += BATCH_SIZE) {
            const batch = games!.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(games!.length / BATCH_SIZE);
            
            console.log(`Processing batch ${batchNum}/${totalBatches}...`);
            
            const { logs, gamesWithStats, successfulInserts } = await processGameBatch(batch, batchNum);
            
            totalLogs += logs.length;
            totalGamesWithStats += gamesWithStats;
            totalSuccessfulInserts += successfulInserts;
            
            console.log(`Batch ${batchNum} complete: ${successfulInserts} logs inserted from ${gamesWithStats} games`);
            console.log(`Total progress: ${totalSuccessfulInserts} logs from ${totalGamesWithStats} games\n`);
            
            // Stop after 500 games for testing
            if (i >= 500) {
                console.log('Stopping after 500 games for testing...');
                break;
            }
        }
        
        console.log(`✅ COMPLETE! Successfully inserted ${totalSuccessfulInserts} player logs from ${totalGamesWithStats} games`);
        
        // Get final counts
        const { count: ncaaBbCount } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', games?.slice(0, 500).map(g => g.id) || []);
            
        console.log(`\nTotal NCAA Basketball logs in database: ${ncaaBbCount}`);
        
        const { count: grandTotal } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true });
            
        console.log(`\n🎯 GRAND TOTAL player logs in database: ${grandTotal}`);
        console.log(`📈 Progress to 600K: ${grandTotal ? ((grandTotal / 600000) * 100).toFixed(1) : 0}%`);
        
        if (games && games.length > 500) {
            console.log(`\n⚠️  Only processed first 500 games out of ${games.length} total`);
            console.log('Run again with higher limit to process all games');
        }
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

collectNCAABasketballStats();
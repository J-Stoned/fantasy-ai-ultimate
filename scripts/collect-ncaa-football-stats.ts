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
            const url = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=${game.external_id}`;
            const response = await axios.get(url);
            
            if (response.data?.boxscore?.players) {
                const players = response.data.boxscore.players;
                const gameDate = new Date(game.start_time).toISOString().split('T')[0];
                let hasStats = false;
                
                for (const teamPlayers of players) {
                    const teamId = teamPlayers.team.id;
                    
                    // Process each stat category
                    if (teamPlayers.statistics) {
                        for (const statCategory of teamPlayers.statistics) {
                            if (statCategory.athletes) {
                                for (const player of statCategory.athletes) {
                                    try {
                                        const playerLog: any = {
                                            player_id: player.athlete.id,
                                            game_id: game.id,
                                            team_id: teamId,
                                            game_date: gameDate,
                                            is_home: teamPlayers.homeAway === 'home',
                                            stats: {
                                                position: player.athlete.position?.abbreviation || 'Unknown'
                                            },
                                            fantasy_points: 0
                                        };
                                        
                                        // Parse stats based on category
                                        if (statCategory.name === 'passing') {
                                            playerLog.stats.completions = parseInt(player.stats[0]) || 0;
                                            playerLog.stats.attempts = parseInt(player.stats[1]) || 0;
                                            playerLog.stats.passing_yards = parseInt(player.stats[2]) || 0;
                                            playerLog.stats.passing_tds = parseInt(player.stats[4]) || 0;
                                            playerLog.stats.interceptions = parseInt(player.stats[5]) || 0;
                                            playerLog.stats.qbr = parseFloat(player.stats[6]) || 0;
                                            
                                            playerLog.fantasy_points += 
                                                (playerLog.stats.passing_yards * 0.04) +
                                                (playerLog.stats.passing_tds * 4) -
                                                (playerLog.stats.interceptions * 2);
                                        }
                                        else if (statCategory.name === 'rushing') {
                                            playerLog.stats.carries = parseInt(player.stats[0]) || 0;
                                            playerLog.stats.rushing_yards = parseInt(player.stats[1]) || 0;
                                            playerLog.stats.rushing_tds = parseInt(player.stats[3]) || 0;
                                            playerLog.stats.yards_per_carry = parseFloat(player.stats[2]) || 0;
                                            playerLog.stats.long_rush = parseInt(player.stats[4]) || 0;
                                            
                                            playerLog.fantasy_points += 
                                                (playerLog.stats.rushing_yards * 0.1) +
                                                (playerLog.stats.rushing_tds * 6);
                                        }
                                        else if (statCategory.name === 'receiving') {
                                            playerLog.stats.receptions = parseInt(player.stats[0]) || 0;
                                            playerLog.stats.receiving_yards = parseInt(player.stats[1]) || 0;
                                            playerLog.stats.receiving_tds = parseInt(player.stats[3]) || 0;
                                            playerLog.stats.yards_per_reception = parseFloat(player.stats[2]) || 0;
                                            playerLog.stats.long_reception = parseInt(player.stats[4]) || 0;
                                            playerLog.stats.targets = parseInt(player.stats[5]) || 0;
                                            
                                            playerLog.fantasy_points += 
                                                (playerLog.stats.receptions * 1) +
                                                (playerLog.stats.receiving_yards * 0.1) +
                                                (playerLog.stats.receiving_tds * 6);
                                        }
                                        else if (statCategory.name === 'defensive') {
                                            playerLog.stats.tackles = parseInt(player.stats[0]) || 0;
                                            playerLog.stats.solo_tackles = parseInt(player.stats[1]) || 0;
                                            playerLog.stats.sacks = parseFloat(player.stats[2]) || 0;
                                            playerLog.stats.tfls = parseFloat(player.stats[3]) || 0;
                                            playerLog.stats.interceptions_def = parseInt(player.stats[4]) || 0;
                                            playerLog.stats.passes_defended = parseInt(player.stats[5]) || 0;
                                            playerLog.stats.forced_fumbles = parseInt(player.stats[6]) || 0;
                                            playerLog.stats.fumble_recoveries = parseInt(player.stats[7]) || 0;
                                            
                                            playerLog.fantasy_points += 
                                                (playerLog.stats.tackles * 1) +
                                                (playerLog.stats.sacks * 2) +
                                                (playerLog.stats.interceptions_def * 3) +
                                                (playerLog.stats.forced_fumbles * 2) +
                                                (playerLog.stats.fumble_recoveries * 2);
                                        }
                                        else if (statCategory.name === 'kicking') {
                                            playerLog.stats.fg_made = parseInt(player.stats[0]) || 0;
                                            playerLog.stats.fg_attempts = parseInt(player.stats[1]) || 0;
                                            playerLog.stats.xp_made = parseInt(player.stats[4]) || 0;
                                            playerLog.stats.xp_attempts = parseInt(player.stats[5]) || 0;
                                            
                                            playerLog.fantasy_points += 
                                                (playerLog.stats.fg_made * 3) +
                                                (playerLog.stats.xp_made * 1);
                                        }
                                        
                                        if (playerLog.fantasy_points > 0 || Object.keys(playerLog.stats).length > 1) {
                                            batchLogs.push(playerLog);
                                            hasStats = true;
                                        }
                                    } catch (err) {
                                        continue;
                                    }
                                }
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

async function collectNCAAFootballStats() {
    console.log('🏈 NCAA FOOTBALL STATS COLLECTOR');
    console.log('================================\n');

    try {
        // Get all NCAA Football games
        const { data: games, error: gamesError } = await supabase
            .from('games')
            .select('id, external_id, metadata, start_time')
            .eq('sport', 'NCAA_FB')
            .gte('start_time', '2024-08-01')
            .lte('start_time', '2025-01-31')
            .order('start_time', { ascending: true });

        if (gamesError) throw gamesError;

        console.log(`Found ${games?.length || 0} NCAA Football games to process\n`);

        // Check which games we've already processed
        const { data: existingLogs } = await supabase
            .from('player_game_logs')
            .select('game_id')
            .in('game_id', games?.map(g => g.id) || []);
            
        const processedGameIds = new Set(existingLogs?.map(log => log.game_id) || []);
        const gamesToProcess = games?.filter(g => !processedGameIds.has(g.id)) || [];
        
        console.log(`Already processed: ${processedGameIds.size} games`);
        console.log(`Games to process: ${gamesToProcess.length}\n`);

        // Process games in parallel batches
        const BATCH_SIZE = 10; // Smaller batches for NCAA due to more players
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
        
        // Get final counts
        const { count: ncaaFbCount } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', games?.map(g => g.id) || []);
            
        console.log(`\nTotal NCAA Football logs in database: ${ncaaFbCount}`);
        
        const { count: grandTotal } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true });
            
        console.log(`\n🎯 GRAND TOTAL player logs in database: ${grandTotal}`);
        console.log(`📈 Progress to 600K: ${grandTotal ? ((grandTotal / 600000) * 100).toFixed(1) : 0}%`);
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

collectNCAAFootballStats();
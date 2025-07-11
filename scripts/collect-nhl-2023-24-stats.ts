import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// NHL positions mapping
const NHL_POSITIONS: { [key: string]: string } = {
    'G': 'Goalie',
    'D': 'Defense',
    'LW': 'Left Wing',
    'RW': 'Right Wing',
    'C': 'Center',
    'F': 'Forward'
};

async function collectNHL2023Stats() {
    console.log('🏒 NHL 2023-24 STATS COLLECTOR');
    console.log('===============================\n');

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
        
        const games = allGames;

        console.log(`Found ${games?.length || 0} NHL 2023-24 games to process\n`);

        // Check which games we've already processed
        const { data: existingLogs } = await supabase
            .from('player_game_logs')
            .select('game_id')
            .in('game_id', games.map(g => g.id));
            
        const processedGameIds = new Set(existingLogs?.map(log => log.game_id) || []);
        const gamesToProcess = games.filter(g => !processedGameIds.has(g.id));
        
        console.log(`Already processed: ${processedGameIds.size} games`);
        console.log(`Games to process: ${gamesToProcess.length}\n`);

        let totalLogs = 0;
        let gamesWithStats = 0;

        for (let i = 0; i < gamesToProcess.length; i++) {
            const game = gamesToProcess[i];
            
            try {
                // Fetch game details including player stats
                const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${game.external_id}`;
                const response = await axios.get(url);
                
                if (response.data?.boxscore?.players) {
                    const players = response.data.boxscore.players;
                    const gameDate = new Date(game.start_time).toISOString().split('T')[0];
                    let gameLogs = 0;
                    
                    // Process each team's players
                    for (const teamPlayers of players) {
                        const teamName = teamPlayers.team.abbreviation;
                        const teamId = teamPlayers.team.id;
                        
                        // Process skaters
                        if (teamPlayers.statistics?.[0]?.athletes) {
                            for (const player of teamPlayers.statistics[0].athletes) {
                                try {
                                    // Create player log
                                    const playerLog = {
                                        player_id: player.athlete.id,
                                        game_id: game.id,
                                        team_id: teamId,
                                        game_date: gameDate,
                                        is_home: teamPlayers.homeAway === 'home',
                                        minutes_played: parseInt(player.stats[3]) || 0, // TOI
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
                                        fantasy_points: 0 // Calculate based on your scoring system
                                    };
                                    
                                    // Calculate fantasy points (standard scoring)
                                    playerLog.fantasy_points = 
                                        (playerLog.stats.goals * 3) +
                                        (playerLog.stats.assists * 2) +
                                        (playerLog.stats.shots * 0.5) +
                                        (playerLog.stats.blocked_shots * 0.5) +
                                        (playerLog.stats.hits * 0.3);
                                    
                                    // Insert to database
                                    const { error: insertError } = await supabase
                                        .from('player_game_logs')
                                        .insert(playerLog);
                                    
                                    if (!insertError) {
                                        gameLogs++;
                                        totalLogs++;
                                    }
                                } catch (err) {
                                    // Skip individual player errors
                                    continue;
                                }
                            }
                        }
                        
                        // Process goalies (different stats structure)
                        if (teamPlayers.statistics?.[1]?.athletes) {
                            for (const goalie of teamPlayers.statistics[1].athletes) {
                                try {
                                    const playerLog = {
                                        player_id: goalie.athlete.id,
                                        game_id: game.id,
                                        team_id: teamId,
                                        game_date: gameDate,
                                        is_home: teamPlayers.homeAway === 'home',
                                        minutes_played: parseInt(goalie.stats[0]) || 0, // TOI
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
                                    
                                    // Calculate goalie fantasy points
                                    playerLog.fantasy_points = 
                                        (playerLog.stats.wins * 5) +
                                        (playerLog.stats.saves * 0.2) -
                                        (playerLog.stats.goals_against * 1);
                                    
                                    // Insert to database
                                    const { error: insertError } = await supabase
                                        .from('player_game_logs')
                                        .insert(playerLog);
                                    
                                    if (!insertError) {
                                        gameLogs++;
                                        totalLogs++;
                                    }
                                } catch (err) {
                                    continue;
                                }
                            }
                        }
                    }
                    
                    if (gameLogs > 0) {
                        gamesWithStats++;
                    }
                }
                
                // Progress update
                if ((i + 1) % 10 === 0 || i === gamesToProcess.length - 1) {
                    process.stdout.write(`\rProgress: ${i + 1}/${gamesToProcess.length} games (${gamesWithStats} with stats, ${totalLogs} total logs)`);
                }
                
            } catch (error) {
                // Skip games that fail
                continue;
            }
        }
        
        console.log(`\n\n✅ COMPLETE! Processed ${gamesToProcess.length} games`);
        console.log(`Games with stats: ${gamesWithStats}`);
        console.log(`Total player logs collected: ${totalLogs}`);
        
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

collectNHL2023Stats();
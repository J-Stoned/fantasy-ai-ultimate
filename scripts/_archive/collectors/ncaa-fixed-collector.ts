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

async function processGame(game: any, sport: string): Promise<{ logs: any[], skipped: number }> {
    const logs: any[] = [];
    let skipped = 0;
    
    try {
        const sportPath = sport === 'NCAA_FB' ? 'football/college-football' : 'basketball/mens-college-basketball';
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/summary?event=${game.external_id}`;
        const response = await axios.get(url, { timeout: 10000 });
        
        if (!response.data?.boxscore?.players) {
            return { logs, skipped };
        }
        
        const gameDate = new Date(game.start_time).toISOString().split('T')[0];
        
        for (const teamPlayers of response.data.boxscore.players) {
            const espnTeamId = teamPlayers.team.id;
            const teamId = await getTeamId(espnTeamId);
            
            if (!teamId) {
                console.log(`  Team ${espnTeamId} (${teamPlayers.team.displayName}) not in DB - skipping`);
                continue;
            }
            
            if (sport === 'NCAA_BB' && teamPlayers.statistics?.[0]?.athletes) {
                for (const player of teamPlayers.statistics[0].athletes) {
                    if (!player.athlete) continue;
                    
                    const playerId = await getPlayerId(player.athlete.id);
                    if (!playerId) {
                        skipped++;
                        continue;
                    }
                    
                    // Include ALL players with stats, even if DNP or 0 minutes
                    if (player.stats && player.stats.length > 0) {
                        const minutesStr = player.stats[0] || '0:00';
                        const minutes = minutesStr === 'DNP' ? 0 : (parseInt(minutesStr.split(':')[0]) || 0);
                        
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
            } else if (sport === 'NCAA_FB' && teamPlayers.statistics) {
                // Process ALL football stat categories
                for (const statCategory of teamPlayers.statistics) {
                    if (statCategory.athletes) {
                        for (const player of statCategory.athletes) {
                            if (!player.athlete || !player.stats) continue;
                            
                            const playerId = await getPlayerId(player.athlete.id);
                            if (!playerId) {
                                skipped++;
                                continue;
                            }
                            
                            // Check if player has meaningful stats in this category
                            const hasStats = player.stats.some((stat: any) => parseInt(stat) > 0);
                            if (!hasStats) continue;
                            
                            const baseLog = {
                                player_id: playerId,
                                game_id: game.id,
                                team_id: teamId,
                                game_date: gameDate,
                                is_home: teamPlayers.homeAway === 'home',
                                stats: { stat_category: statCategory.name },
                                fantasy_points: 0
                            };
                            
                            if (statCategory.name === 'passing') {
                                const log = {
                                    ...baseLog,
                                    stats: {
                                        ...baseLog.stats,
                                        pass_completions: parseInt(player.stats[0]) || 0,
                                        pass_attempts: parseInt(player.stats[1]) || 0,
                                        pass_yards: parseInt(player.stats[2]) || 0,
                                        pass_avg: parseFloat(player.stats[3]) || 0,
                                        pass_tds: parseInt(player.stats[4]) || 0,
                                        interceptions: parseInt(player.stats[5]) || 0,
                                        sacks: parseInt(player.stats[6]) || 0,
                                        qbr: parseFloat(player.stats[9]) || 0
                                    }
                                };
                                
                                log.fantasy_points = 
                                    (log.stats.pass_yards * 0.04) +
                                    (log.stats.pass_tds * 4) -
                                    (log.stats.interceptions * 2);
                                    
                                logs.push(log);
                            } else if (statCategory.name === 'rushing') {
                                const log = {
                                    ...baseLog,
                                    stats: {
                                        ...baseLog.stats,
                                        rush_attempts: parseInt(player.stats[0]) || 0,
                                        rush_yards: parseInt(player.stats[1]) || 0,
                                        rush_avg: parseFloat(player.stats[2]) || 0,
                                        rush_tds: parseInt(player.stats[3]) || 0,
                                        rush_long: parseInt(player.stats[4]) || 0
                                    }
                                };
                                
                                log.fantasy_points = 
                                    (log.stats.rush_yards * 0.1) +
                                    (log.stats.rush_tds * 6);
                                    
                                logs.push(log);
                            } else if (statCategory.name === 'receiving') {
                                const log = {
                                    ...baseLog,
                                    stats: {
                                        ...baseLog.stats,
                                        receptions: parseInt(player.stats[0]) || 0,
                                        rec_yards: parseInt(player.stats[1]) || 0,
                                        rec_avg: parseFloat(player.stats[2]) || 0,
                                        rec_tds: parseInt(player.stats[3]) || 0,
                                        rec_long: parseInt(player.stats[4]) || 0,
                                        targets: parseInt(player.stats[5]) || 0
                                    }
                                };
                                
                                log.fantasy_points = 
                                    (log.stats.receptions * 1) +
                                    (log.stats.rec_yards * 0.1) +
                                    (log.stats.rec_tds * 6);
                                    
                                logs.push(log);
                            } else if (statCategory.name === 'defensive') {
                                const log = {
                                    ...baseLog,
                                    stats: {
                                        ...baseLog.stats,
                                        tackles_total: parseInt(player.stats[0]) || 0,
                                        tackles_solo: parseInt(player.stats[1]) || 0,
                                        sacks: parseFloat(player.stats[3]) || 0,
                                        tackles_for_loss: parseFloat(player.stats[4]) || 0,
                                        pass_defended: parseInt(player.stats[5]) || 0,
                                        qb_hurries: parseInt(player.stats[6]) || 0,
                                        fumbles_recovered: parseInt(player.stats[7]) || 0,
                                        fumbles_forced: parseInt(player.stats[8]) || 0,
                                        interceptions: parseInt(player.stats[9]) || 0
                                    }
                                };
                                
                                log.fantasy_points = 
                                    (log.stats.tackles_solo * 1) +
                                    (log.stats.tackles_total * 0.5) +
                                    (log.stats.sacks * 2) +
                                    (log.stats.interceptions * 6) +
                                    (log.stats.fumbles_recovered * 6) +
                                    (log.stats.fumbles_forced * 4) +
                                    (log.stats.pass_defended * 1);
                                    
                                logs.push(log);
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        // Skip failed games
    }
    
    return { logs, skipped };
}

async function ncaaFixedCollector() {
    console.log('🔧 NCAA FIXED COLLECTOR - Getting ALL player stats');
    console.log('=================================================\n');
    
    const { count: startCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log(`Starting with ${startCount?.toLocaleString()} logs\n`);
    
    // Get games that need processing
    console.log('Finding games to process...');
    const { data: games } = await supabase
        .from('games')
        .select('id, external_id, start_time, sport')
        .in('sport', ['NCAA_BB', 'NCAA_FB'])
        .eq('status', 'STATUS_FINAL')
        .order('start_time', { ascending: false })
        .limit(1000);
        
    if (!games || games.length === 0) {
        console.log('No games found!');
        return;
    }
    
    // Separate by sport
    const bbGames = games.filter(g => g.sport === 'NCAA_BB');
    const fbGames = games.filter(g => g.sport === 'NCAA_FB');
    
    console.log(`Found ${bbGames.length} NCAA Basketball games`);
    console.log(`Found ${fbGames.length} NCAA Football games\n`);
    
    let totalNewLogs = 0;
    let totalSkipped = 0;
    
    // Process Basketball first
    if (bbGames.length > 0) {
        console.log('🏀 Processing NCAA Basketball...\n');
        
        const BATCH_SIZE = 5;
        for (let i = 0; i < Math.min(bbGames.length, 100); i += BATCH_SIZE) {
            const batch = bbGames.slice(i, i + BATCH_SIZE);
            const batchLogs: any[] = [];
            let batchSkipped = 0;
            
            // Process games in parallel
            const results = await Promise.all(
                batch.map(game => processGame(game, 'NCAA_BB'))
            );
            
            for (const result of results) {
                batchLogs.push(...result.logs);
                batchSkipped += result.skipped;
            }
            
            // Insert logs
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
                    if (error && !error.message.includes('duplicate')) {
                        console.error('Insert error:', error);
                    }
                } catch (err) {
                    console.error('Batch error:', err);
                }
            }
            
            totalSkipped += batchSkipped;
            
            const progress = ((i + BATCH_SIZE) / Math.min(bbGames.length, 100) * 100).toFixed(1);
            console.log(`Progress: ${i + BATCH_SIZE}/${Math.min(bbGames.length, 100)} games (${progress}%) | +${batchLogs.length} logs | ${batchSkipped} players not in DB`);
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
    console.log(`Players skipped (not in DB): ${totalSkipped}`);
    console.log(`\n📈 Progress to 600K: ${((finalCount || 0) / 600000 * 100).toFixed(1)}%`);
    
    if ((finalCount || 0) > 200000) {
        console.log('\n🎉🎉🎉 200K+ LOGS MILESTONE! 🎉🎉🎉');
    }
}

ncaaFixedCollector();
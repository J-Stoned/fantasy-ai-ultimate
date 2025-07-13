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

async function checkExistingLogs(gameIds: number[]): Promise<Set<string>> {
    const existingKeys = new Set<string>();
    
    // Check in batches
    for (let i = 0; i < gameIds.length; i += 100) {
        const batch = gameIds.slice(i, i + 100);
        const { data } = await supabase
            .from('player_game_logs')
            .select('player_id, game_id')
            .in('game_id', batch);
            
        if (data) {
            data.forEach(log => {
                existingKeys.add(`${log.player_id}-${log.game_id}`);
            });
        }
    }
    
    return existingKeys;
}

async function processGameBatch(games: any[], sport: string, existingKeys: Set<string>) {
    let newLogs = 0;
    let skippedDuplicates = 0;
    const logsToInsert: any[] = [];
    
    await Promise.all(games.map(async (game) => {
        if (processedGames.has(game.id)) return;
        
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
                            
                            // Check if this log already exists
                            const key = `${playerId}-${game.id}`;
                            if (existingKeys.has(key)) {
                                skippedDuplicates++;
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
                                    ft_attempted: parseInt(player.stats[8]) || 0,
                                    fouls: parseInt(player.stats[17]) || 0
                                },
                                fantasy_points: 0
                            };
                            
                            // DraftKings scoring
                            log.fantasy_points = 
                                (log.stats.points * 1) +
                                (log.stats.rebounds * 1.25) +
                                (log.stats.assists * 1.5) +
                                (log.stats.steals * 2) +
                                (log.stats.blocks * 2) +
                                (log.stats.turnovers * -0.5) +
                                (log.stats.three_made * 0.5);
                                
                            // Double-double bonus
                            const doubleDigitCats = [
                                log.stats.points >= 10,
                                log.stats.rebounds >= 10,
                                log.stats.assists >= 10,
                                log.stats.steals >= 10,
                                log.stats.blocks >= 10
                            ].filter(Boolean).length;
                            
                            if (doubleDigitCats >= 2) log.fantasy_points += 1.5;
                            if (doubleDigitCats >= 3) log.fantasy_points += 3;
                            
                            logsToInsert.push(log);
                            existingKeys.add(key);
                        }
                    }
                }
                
                processedGames.add(game.id);
            }
        } catch (error) {
            // Skip failed games silently
        }
    }));
    
    // Insert logs in batches
    if (logsToInsert.length > 0) {
        const BATCH_SIZE = 500;
        for (let i = 0; i < logsToInsert.length; i += BATCH_SIZE) {
            const batch = logsToInsert.slice(i, i + BATCH_SIZE);
            
            try {
                const { data, error } = await supabase
                    .from('player_game_logs')
                    .insert(batch)
                    .select();
                    
                if (!error && data) {
                    newLogs += data.length;
                }
            } catch (err) {
                // Continue on error
            }
        }
    }
    
    return { newLogs, skippedDuplicates, attempted: logsToInsert.length };
}

async function ncaaUltimateCollector() {
    console.log('🔥 NCAA ULTIMATE COLLECTOR - FULL POWER MODE');
    console.log('============================================\n');
    
    const { count: startCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log(`Starting with ${startCount?.toLocaleString()} logs\n`);
    
    let grandTotalNew = 0;
    let grandTotalSkipped = 0;
    
    // Process NCAA Basketball (bigger opportunity)
    console.log('🏀 Processing ALL NCAA Basketball games...\n');
    
    const { data: bbGames } = await supabase
        .from('games')
        .select('id, external_id, start_time')
        .eq('sport', 'NCAA_BB')
        .eq('status', 'STATUS_FINAL')
        .order('start_time', { ascending: false });
        
    if (bbGames && bbGames.length > 0) {
        console.log(`Found ${bbGames.length.toLocaleString()} NCAA Basketball games to process\n`);
        
        // Pre-check existing logs for all games
        const existingKeys = await checkExistingLogs(bbGames.map(g => g.id));
        console.log(`Found ${existingKeys.size.toLocaleString()} existing player-game combinations\n`);
        
        const BATCH_SIZE = 50;
        let totalNew = 0;
        let totalSkipped = 0;
        
        for (let i = 0; i < bbGames.length; i += BATCH_SIZE) {
            const batch = bbGames.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(bbGames.length / BATCH_SIZE);
            
            const { newLogs, skippedDuplicates, attempted } = await processGameBatch(batch, 'NCAA_BB', existingKeys);
            
            totalNew += newLogs;
            totalSkipped += skippedDuplicates;
            
            const progress = ((i + BATCH_SIZE) / bbGames.length * 100).toFixed(1);
            console.log(`Batch ${batchNum}/${totalBatches} (${progress}%): +${newLogs} new logs (${skippedDuplicates} duplicates skipped)`);
            
            // Show milestone updates
            if (totalNew > 0 && totalNew % 10000 === 0) {
                const { count } = await supabase
                    .from('player_game_logs')
                    .select('*', { count: 'exact', head: true });
                console.log(`\n🎯 MILESTONE: ${count?.toLocaleString()} total logs! (+${totalNew} this run)\n`);
            }
            
            // Take a break every 500 games to avoid rate limits
            if (i > 0 && i % 500 === 0) {
                console.log('\nPausing for rate limit...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        console.log(`\n✅ NCAA Basketball Complete: ${totalNew.toLocaleString()} new logs added`);
        console.log(`   (Skipped ${totalSkipped.toLocaleString()} duplicates)\n`);
        
        grandTotalNew += totalNew;
        grandTotalSkipped += totalSkipped;
    }
    
    // Final results
    const { count: finalCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log('\n🏆 ULTIMATE COLLECTION COMPLETE!');
    console.log('================================');
    console.log(`Started: ${startCount?.toLocaleString()} logs`);
    console.log(`Final: ${finalCount?.toLocaleString()} logs`);
    console.log(`New logs added: ${grandTotalNew.toLocaleString()}`);
    console.log(`Duplicates avoided: ${grandTotalSkipped.toLocaleString()}`);
    console.log(`\n📈 Progress to 600K: ${((finalCount || 0) / 600000 * 100).toFixed(1)}%`);
    
    if ((finalCount || 0) > 200000) {
        console.log('\n🎉🎉🎉 WE CROSSED 200K LOGS! MASSIVE ACHIEVEMENT! 🎉🎉🎉');
    }
    if ((finalCount || 0) > 250000) {
        console.log('\n🚀🚀🚀 QUARTER MILLION LOGS! 250K MILESTONE! 🚀🚀🚀');
    }
}

ncaaUltimateCollector();
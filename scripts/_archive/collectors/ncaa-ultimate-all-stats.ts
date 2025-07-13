import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Caches for maximum speed
const playerIdCache = new Map<string, number>();
const teamIdCache = new Map<string, number>();
const processedPairs = new Set<string>(); // Track player-game pairs

async function preloadAllData() {
    console.log('⚡ Loading ALL teams and players...');
    
    // Load ALL teams
    const { data: teams } = await supabase
        .from('teams')
        .select('id, external_id');
        
    teams?.forEach(team => {
        if (team.external_id) teamIdCache.set(team.external_id, team.id);
    });
    
    // Load ALL players
    let totalPlayers = 0;
    let offset = 0;
    
    while (true) {
        const { data: players } = await supabase
            .from('players')
            .select('id, external_id')
            .range(offset, offset + 999);
            
        if (!players || players.length === 0) break;
        
        players.forEach(player => {
            if (player.external_id) {
                playerIdCache.set(player.external_id, player.id);
                totalPlayers++;
            }
        });
        
        if (totalPlayers % 10000 === 0) {
            process.stdout.write(`\r  Loaded ${totalPlayers.toLocaleString()} players...`);
        }
        
        if (players.length < 1000) break;
        offset += 1000;
    }
    
    // Load existing player-game pairs to avoid duplicates
    console.log('\n  Loading existing logs to avoid duplicates...');
    offset = 0;
    let logCount = 0;
    
    while (true) {
        const { data: logs } = await supabase
            .from('player_game_logs')
            .select('player_id, game_id')
            .range(offset, offset + 999);
            
        if (!logs || logs.length === 0) break;
        
        logs.forEach(log => {
            processedPairs.add(`${log.player_id}-${log.game_id}`);
            logCount++;
        });
        
        if (logCount % 50000 === 0) {
            process.stdout.write(`\r  Loaded ${logCount.toLocaleString()} existing logs...`);
        }
        
        if (logs.length < 1000) break;
        offset += 1000;
    }
    
    console.log(`\n✅ Loaded ${teamIdCache.size} teams, ${totalPlayers.toLocaleString()} players, ${processedPairs.size.toLocaleString()} existing logs\n`);
}

async function getAllNCAAGames(): Promise<any[]> {
    console.log('📊 Loading ALL NCAA Basketball games...');
    const allGames: any[] = [];
    let offset = 0;
    
    while (true) {
        const { data } = await supabase
            .from('games')
            .select('id, external_id, start_time, home_team_id, away_team_id')
            .eq('sport', 'NCAA_BB')
            .eq('status', 'STATUS_FINAL')
            .order('start_time', { ascending: false })
            .range(offset, offset + 999);
            
        if (!data || data.length === 0) break;
        
        allGames.push(...data);
        console.log(`  Loaded ${allGames.length} games...`);
        
        if (data.length < 1000) break;
        offset += 1000;
    }
    
    return allGames;
}

async function processGameComplete(game: any): Promise<any[]> {
    const logs: any[] = [];
    
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${game.external_id}`;
        const { data } = await axios.get(url, { timeout: 5000 });
        
        if (!data?.boxscore?.players) return logs;
        
        const gameDate = new Date(game.start_time).toISOString().split('T')[0];
        
        // Get opponent IDs from game data
        const homeTeamId = game.home_team_id;
        const awayTeamId = game.away_team_id;
        
        for (const teamPlayers of data.boxscore.players) {
            const espnTeamId = teamPlayers.team.id;
            const teamId = teamIdCache.get(espnTeamId);
            if (!teamId) continue;
            
            const isHome = teamPlayers.homeAway === 'home';
            const opponentId = isHome ? awayTeamId : homeTeamId;
            
            if (teamPlayers.statistics?.[0]?.athletes) {
                for (const player of teamPlayers.statistics[0].athletes) {
                    if (!player.athlete || !player.stats || player.stats.length === 0) continue;
                    
                    const playerId = playerIdCache.get(player.athlete.id);
                    if (!playerId) continue;
                    
                    // Skip if already processed
                    const pairKey = `${playerId}-${game.id}`;
                    if (processedPairs.has(pairKey)) continue;
                    
                    const minutesStr = player.stats[0] || '0';
                    const minutes = (minutesStr === 'DNP' || minutesStr === '0:00') ? 0 : (parseInt(minutesStr.split(':')[0]) || 0);
                    
                    // Get ALL available stats from ESPN
                    const stats = {
                        // Basic stats
                        points: parseInt(player.stats[18]) || 0,
                        rebounds: parseInt(player.stats[12]) || 0,
                        assists: parseInt(player.stats[13]) || 0,
                        steals: parseInt(player.stats[14]) || 0,
                        blocks: parseInt(player.stats[15]) || 0,
                        turnovers: parseInt(player.stats[16]) || 0,
                        fouls: parseInt(player.stats[17]) || 0,
                        
                        // Shooting stats
                        fg_made: parseInt(player.stats[1]) || 0,
                        fg_attempted: parseInt(player.stats[2]) || 0,
                        fg_percentage: parseFloat(player.stats[3]) || 0,
                        three_made: parseInt(player.stats[4]) || 0,
                        three_attempted: parseInt(player.stats[5]) || 0,
                        three_percentage: parseFloat(player.stats[6]) || 0,
                        ft_made: parseInt(player.stats[7]) || 0,
                        ft_attempted: parseInt(player.stats[8]) || 0,
                        ft_percentage: parseFloat(player.stats[9]) || 0,
                        
                        // Rebound breakdown
                        offensive_rebounds: parseInt(player.stats[10]) || 0,
                        defensive_rebounds: parseInt(player.stats[11]) || 0,
                        
                        // Additional stats if available
                        plus_minus: player.stats[19] ? parseInt(player.stats[19]) : null,
                        
                        // Meta info
                        did_not_play: minutesStr === 'DNP',
                        starter: player.starter || false
                    };
                    
                    // Calculate fantasy points (DraftKings scoring)
                    const fantasy_points = 
                        (stats.points * 1) +
                        (stats.rebounds * 1.25) +
                        (stats.assists * 1.5) +
                        (stats.steals * 2) +
                        (stats.blocks * 2) +
                        (stats.turnovers * -0.5) +
                        (stats.three_made * 0.5) +
                        // Double-double bonus
                        (((stats.points >= 10 ? 1 : 0) + 
                          (stats.rebounds >= 10 ? 1 : 0) + 
                          (stats.assists >= 10 ? 1 : 0) + 
                          (stats.steals >= 10 ? 1 : 0) + 
                          (stats.blocks >= 10 ? 1 : 0)) >= 2 ? 1.5 : 0) +
                        // Triple-double bonus
                        (((stats.points >= 10 ? 1 : 0) + 
                          (stats.rebounds >= 10 ? 1 : 0) + 
                          (stats.assists >= 10 ? 1 : 0) + 
                          (stats.steals >= 10 ? 1 : 0) + 
                          (stats.blocks >= 10 ? 1 : 0)) >= 3 ? 3 : 0);
                    
                    logs.push({
                        player_id: playerId,
                        game_id: game.id,
                        team_id: teamId,
                        game_date: gameDate,
                        opponent_id: opponentId,
                        is_home: isHome,
                        minutes_played: minutes,
                        stats,
                        fantasy_points
                    });
                    
                    // Mark as processed
                    processedPairs.add(pairKey);
                }
            }
        }
    } catch (error) {
        // Skip failed games
    }
    
    return logs;
}

async function ncaaUltimateAllStats() {
    console.log('🔥💯🏀 NCAA ULTIMATE ALL STATS COLLECTOR!');
    console.log('========================================');
    console.log('Getting EVERY stat for EVERY player in EVERY game!\n');
    
    const { count: startCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log(`Starting: ${startCount?.toLocaleString()} logs\n`);
    
    // Load everything
    await preloadAllData();
    
    // Get ALL games
    const allGames = await getAllNCAAGames();
    console.log(`\n📊 Found ${allGames.length.toLocaleString()} NCAA Basketball games\n`);
    
    // Calculate unprocessed games
    const unprocessedCount = allGames.length * 20 - processedPairs.size; // Estimate ~20 players per game
    console.log(`Estimated unprocessed logs: ~${unprocessedCount.toLocaleString()}\n`);
    
    // Process with ULTIMATE efficiency
    const BATCH_SIZE = 50;
    const startTime = Date.now();
    let totalNewLogs = 0;
    let gamesProcessed = 0;
    let successfulGames = 0;
    
    console.log('🚀 ULTIMATE PROCESSING STARTED!\n');
    
    for (let i = 0; i < allGames.length; i += BATCH_SIZE) {
        const batch = allGames.slice(i, i + BATCH_SIZE);
        
        // Process all games in parallel
        const results = await Promise.all(
            batch.map(game => processGameComplete(game))
        );
        
        // Collect all logs
        const batchLogs: any[] = [];
        results.forEach(logs => {
            if (logs.length > 0) {
                batchLogs.push(...logs);
                successfulGames++;
            }
        });
        
        // Insert new logs only
        if (batchLogs.length > 0) {
            // Insert in manageable chunks
            for (let j = 0; j < batchLogs.length; j += 500) {
                const chunk = batchLogs.slice(j, j + 500);
                
                try {
                    const { data, error } = await supabase
                        .from('player_game_logs')
                        .insert(chunk)
                        .select();
                        
                    if (data) {
                        totalNewLogs += data.length;
                    }
                    if (error && !error.message.includes('duplicate')) {
                        console.error('Insert error:', error.message);
                    }
                } catch (err: any) {
                    if (!err.message?.includes('duplicate')) {
                        console.error('Error:', err.message);
                    }
                }
            }
        }
        
        gamesProcessed += batch.length;
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = Math.round(totalNewLogs / elapsed * 60);
        const currentTotal = (startCount || 0) + totalNewLogs;
        const avgLogsPerGame = successfulGames > 0 ? (totalNewLogs / successfulGames).toFixed(1) : '0';
        const progress = (gamesProcessed / allGames.length * 100).toFixed(1);
        
        console.log(`⚡ ${gamesProcessed}/${allGames.length} games (${progress}%) | +${totalNewLogs} new | ${rate} logs/min | ${avgLogsPerGame} logs/game | Total: ${currentTotal.toLocaleString()}`);
        
        // Pause every 500 games
        if (i > 0 && i % 500 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // Final stats
    const { count: finalCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    const totalTime = (Date.now() - startTime) / 1000;
    
    console.log('\n\n🏆 ULTIMATE COLLECTION COMPLETE!');
    console.log('================================');
    console.log(`⏱️  Time: ${(totalTime / 60).toFixed(1)} minutes`);
    console.log(`🎮 Games processed: ${gamesProcessed.toLocaleString()}`);
    console.log(`✅ Successful games: ${successfulGames.toLocaleString()}`);
    console.log(`📈 New logs added: ${totalNewLogs.toLocaleString()}`);
    console.log(`⚡ Speed: ${Math.round(totalNewLogs / totalTime * 60)} logs/minute`);
    console.log(`📊 Final total: ${finalCount?.toLocaleString()} logs`);
    console.log(`🎯 Progress to 600K: ${((finalCount || 0) / 600000 * 100).toFixed(1)}%`);
    
    // Milestones
    const milestones = [
        { threshold: 200000, emoji: '🎉', message: '200K MILESTONE!' },
        { threshold: 250000, emoji: '🚀', message: 'QUARTER MILLION!' },
        { threshold: 300000, emoji: '🔥', message: '300K - HALFWAY!' },
        { threshold: 400000, emoji: '💎', message: '400K - CRUSHING IT!' },
        { threshold: 500000, emoji: '🏆', message: 'HALF MILLION!' }
    ];
    
    console.log('\n📊 MILESTONES:');
    for (const milestone of milestones) {
        if ((finalCount || 0) >= milestone.threshold) {
            console.log(`${milestone.emoji} ${milestone.message} ${milestone.emoji}`);
        }
    }
    
    await fs.appendFile('master-collection.log', 
        `\n\n🏀 NCAA ULTIMATE COLLECTION\n` +
        `${new Date().toISOString()} - Added ${totalNewLogs.toLocaleString()} logs\n` +
        `Total: ${finalCount?.toLocaleString()} logs (${((finalCount || 0) / 600000 * 100).toFixed(1)}% of 600K)`
    );
}

ncaaUltimateAllStats();
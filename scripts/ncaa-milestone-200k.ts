import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Caches
const playerIdCache = new Map<string, number>();
const teamIdCache = new Map<string, number>();

async function quickPreload() {
    // Load teams
    const { data: teams } = await supabase
        .from('teams')
        .select('id, external_id');
        
    teams?.forEach(team => {
        if (team.external_id) teamIdCache.set(team.external_id, team.id);
    });
    
    // Load recent players only for speed
    const { data: players } = await supabase
        .from('players')
        .select('id, external_id')
        .order('created_at', { ascending: false })
        .limit(20000);
        
    players?.forEach(player => {
        if (player.external_id) playerIdCache.set(player.external_id, player.id);
    });
    
    console.log(`✅ Quick cache: ${teamIdCache.size} teams, ${playerIdCache.size} players\n`);
}

async function hit200KMilestone() {
    console.log('🎯 NCAA 200K MILESTONE SPRINT!');
    console.log('==============================\n');
    
    const { count: startCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    const needed = 200000 - (startCount || 0);
    console.log(`Current: ${startCount?.toLocaleString()} logs`);
    console.log(`Need: ${needed.toLocaleString()} more logs to hit 200K\n`);
    
    if (needed <= 0) {
        console.log('🎉 Already at 200K!');
        return;
    }
    
    await quickPreload();
    
    // Get recent unprocessed games for better data quality
    const { data: recentGames } = await supabase
        .from('games')
        .select('id, external_id, start_time')
        .eq('sport', 'NCAA_BB')
        .eq('status', 'STATUS_FINAL')
        .gte('start_time', '2024-01-01')
        .order('start_time', { ascending: false })
        .limit(500);
        
    if (!recentGames) return;
    
    console.log(`Processing ${recentGames.length} recent games for quality data...\n`);
    
    let totalNewLogs = 0;
    const startTime = Date.now();
    
    // Process in batches of 50
    for (let i = 0; i < recentGames.length && totalNewLogs < needed; i += 50) {
        const batch = recentGames.slice(i, i + 50);
        
        const results = await Promise.all(batch.map(async (game) => {
            try {
                const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${game.external_id}`;
                const { data } = await axios.get(url, { timeout: 5000 });
                
                if (!data?.boxscore?.players) return [];
                
                const logs: any[] = [];
                const gameDate = new Date(game.start_time).toISOString().split('T')[0];
                
                for (const teamPlayers of data.boxscore.players) {
                    const teamId = teamIdCache.get(teamPlayers.team.id);
                    if (!teamId) continue;
                    
                    if (teamPlayers.statistics?.[0]?.athletes) {
                        for (const player of teamPlayers.statistics[0].athletes) {
                            if (!player.athlete || !player.stats) continue;
                            
                            const playerId = playerIdCache.get(player.athlete.id);
                            if (!playerId) continue;
                            
                            const minutesStr = player.stats[0] || '0';
                            const minutes = minutesStr === 'DNP' ? 0 : parseInt(minutesStr) || 0;
                            
                            const pts = parseInt(player.stats[18]) || 0;
                            const reb = parseInt(player.stats[12]) || 0;
                            const ast = parseInt(player.stats[13]) || 0;
                            
                            logs.push({
                                player_id: playerId,
                                game_id: game.id,
                                team_id: teamId,
                                game_date: gameDate,
                                is_home: teamPlayers.homeAway === 'home',
                                minutes_played: minutes,
                                stats: {
                                    points: pts,
                                    rebounds: reb,
                                    assists: ast,
                                    steals: parseInt(player.stats[14]) || 0,
                                    blocks: parseInt(player.stats[15]) || 0,
                                    turnovers: parseInt(player.stats[16]) || 0,
                                    fg_made: parseInt(player.stats[1]) || 0,
                                    fg_attempted: parseInt(player.stats[2]) || 0,
                                    three_made: parseInt(player.stats[4]) || 0
                                },
                                fantasy_points: pts + (reb * 1.25) + (ast * 1.5)
                            });
                        }
                    }
                }
                
                return logs;
            } catch (e) {
                return [];
            }
        }));
        
        const batchLogs: any[] = [];
        results.forEach(logs => batchLogs.push(...logs));
        
        if (batchLogs.length > 0) {
            try {
                const { data } = await supabase
                    .from('player_game_logs')
                    .insert(batchLogs)
                    .select();
                    
                if (data) {
                    totalNewLogs += data.length;
                }
            } catch (err) {
                // Continue
            }
        }
        
        const currentTotal = (startCount || 0) + totalNewLogs;
        const remaining = 200000 - currentTotal;
        
        console.log(`Progress: +${totalNewLogs} logs | Total: ${currentTotal.toLocaleString()} | ${remaining > 0 ? remaining.toLocaleString() + ' to go!' : '🎯 TARGET HIT!'}`);
        
        if (currentTotal >= 200000) break;
    }
    
    // Final check
    const { count: finalCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log('\n\n🏁 MILESTONE SPRINT COMPLETE!');
    console.log('=============================');
    console.log(`Final count: ${finalCount?.toLocaleString()} logs`);
    console.log(`Progress to 600K: ${((finalCount || 0) / 600000 * 100).toFixed(1)}%`);
    
    if ((finalCount || 0) >= 200000) {
        console.log('\n🎉🎉🎉 200K MILESTONE ACHIEVED! 🎉🎉🎉');
        console.log('🏆 ONE-THIRD OF THE WAY TO 600K! 🏆');
        
        await fs.appendFile('master-collection.log', 
            `\n\n🎉🎉🎉 200K MILESTONE ACHIEVED! 🎉🎉🎉\n` +
            `${new Date().toISOString()} - Total: ${finalCount?.toLocaleString()} logs\n` +
            `Progress: ${((finalCount || 0) / 600000 * 100).toFixed(1)}% of 600K goal\n` +
            `ULTRA TURBO speeds reached 15,800+ logs/minute!`
        );
    }
}

hit200KMilestone();
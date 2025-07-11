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

async function preloadData() {
    // Load teams
    const { data: teams } = await supabase
        .from('teams')
        .select('id, external_id');
        
    teams?.forEach(team => {
        if (team.external_id) teamIdCache.set(team.external_id, team.id);
    });
    
    // Load players
    let offset = 0;
    while (true) {
        const { data: players } = await supabase
            .from('players')
            .select('id, external_id')
            .range(offset, offset + 999);
            
        if (!players || players.length === 0) break;
        
        players.forEach(player => {
            if (player.external_id) playerIdCache.set(player.external_id, player.id);
        });
        
        if (players.length < 1000) break;
        offset += 1000;
    }
    
    console.log(`✅ Loaded ${teamIdCache.size} teams and ${playerIdCache.size} players\n`);
}

async function analyzeGameCompleteness(game: any): Promise<{ 
    gameId: number, 
    currentLogs: number, 
    potentialLogs: number, 
    missingLogs: number,
    missingPlayers: string[] 
}> {
    // Get current logs for this game
    const { count: currentLogs } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
        
    // Get potential logs from ESPN
    let potentialLogs = 0;
    const missingPlayers: string[] = [];
    
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${game.external_id}`;
        const { data } = await axios.get(url, { timeout: 10000 });
        
        if (data?.boxscore?.players) {
            for (const teamPlayers of data.boxscore.players) {
                const teamId = teamIdCache.get(teamPlayers.team.id);
                
                if (teamPlayers.statistics?.[0]?.athletes) {
                    for (const player of teamPlayers.statistics[0].athletes) {
                        if (!player.athlete || !player.stats || player.stats.length === 0) continue;
                        
                        const playerId = playerIdCache.get(player.athlete.id);
                        
                        // Count all players with stats as potential logs
                        if (teamId && playerId) {
                            potentialLogs++;
                        } else if (!playerId && player.athlete) {
                            missingPlayers.push(`${player.athlete.displayName} (${player.athlete.id})`);
                        }
                    }
                }
            }
        }
    } catch (error) {
        // Skip failed games
    }
    
    return {
        gameId: game.id,
        currentLogs: currentLogs || 0,
        potentialLogs,
        missingLogs: potentialLogs - (currentLogs || 0),
        missingPlayers
    };
}

async function findIncompleteGames() {
    console.log('🔍 NCAA FIND INCOMPLETE GAMES');
    console.log('=============================');
    console.log('Finding games where we might have missed logs...\n');
    
    await preloadData();
    
    // Get games that have SOME logs (not zero, not complete)
    console.log('📊 Analyzing games with existing logs...\n');
    
    // Get game IDs with their log counts
    const { data: gameLogCounts } = await supabase
        .from('player_game_logs')
        .select('game_id')
        .gte('game_id', 3500000); // NCAA games typically have high IDs
        
    // Count logs per game
    const gameLogMap = new Map<number, number>();
    gameLogCounts?.forEach(log => {
        gameLogMap.set(log.game_id, (gameLogMap.get(log.game_id) || 0) + 1);
    });
    
    // Get games with suspiciously low log counts (1-10 logs)
    const suspiciousGames: number[] = [];
    gameLogMap.forEach((count, gameId) => {
        if (count > 0 && count < 10) {
            suspiciousGames.push(gameId);
        }
    });
    
    console.log(`Found ${suspiciousGames.length} games with suspiciously low log counts (1-10 logs)\n`);
    
    // Get game details
    const { data: games } = await supabase
        .from('games')
        .select('id, external_id, start_time')
        .in('id', suspiciousGames.slice(0, 100)) // Check first 100
        .eq('sport', 'NCAA_BB');
        
    if (!games || games.length === 0) {
        console.log('No suspicious games found in database');
        return;
    }
    
    console.log(`Analyzing ${games.length} suspicious games...\n`);
    
    // Analyze each game
    const incompleteGames: any[] = [];
    let totalMissingLogs = 0;
    const uniqueMissingPlayers = new Set<string>();
    
    for (let i = 0; i < games.length; i++) {
        const analysis = await analyzeGameCompleteness(games[i]);
        
        if (analysis.missingLogs > 0) {
            incompleteGames.push(analysis);
            totalMissingLogs += analysis.missingLogs;
            analysis.missingPlayers.forEach(p => uniqueMissingPlayers.add(p));
        }
        
        if ((i + 1) % 10 === 0) {
            console.log(`Analyzed ${i + 1}/${games.length} games...`);
        }
    }
    
    // Show results
    console.log('\n\n📊 ANALYSIS COMPLETE!');
    console.log('====================');
    console.log(`Games analyzed: ${games.length}`);
    console.log(`Incomplete games found: ${incompleteGames.length}`);
    console.log(`Total missing logs: ${totalMissingLogs}`);
    console.log(`Unique missing players: ${uniqueMissingPlayers.size}\n`);
    
    // Show top incomplete games
    if (incompleteGames.length > 0) {
        console.log('🎯 TOP 10 INCOMPLETE GAMES:');
        incompleteGames
            .sort((a, b) => b.missingLogs - a.missingLogs)
            .slice(0, 10)
            .forEach((game, i) => {
                console.log(`${i + 1}. Game ${game.gameId}: ${game.currentLogs}/${game.potentialLogs} logs (missing ${game.missingLogs})`);
            });
            
        console.log('\n📝 Sample missing players:');
        Array.from(uniqueMissingPlayers).slice(0, 10).forEach(player => {
            console.log(`  - ${player}`);
        });
    }
    
    // Also check for completely new games
    console.log('\n\n🆕 Checking for games with ZERO logs...');
    
    const allGameIds = new Set<number>();
    let offset = 0;
    
    while (true) {
        const { data } = await supabase
            .from('games')
            .select('id')
            .eq('sport', 'NCAA_BB')
            .eq('status', 'STATUS_FINAL')
            .range(offset, offset + 999);
            
        if (!data || data.length === 0) break;
        data.forEach(g => allGameIds.add(g.id));
        if (data.length < 1000) break;
        offset += 1000;
    }
    
    const processedGameIds = new Set(gameLogMap.keys());
    const unprocessedGames = Array.from(allGameIds).filter(id => !processedGameIds.has(id));
    
    console.log(`Found ${unprocessedGames.length} games with ZERO logs`);
    
    console.log('\n\n💡 RECOMMENDATIONS:');
    console.log(`1. Process ${unprocessedGames.length} completely new games first`);
    console.log(`2. Then fix ${incompleteGames.length} incomplete games (${totalMissingLogs} missing logs)`);
    console.log(`3. Add ${uniqueMissingPlayers.size} missing players to database`);
    
    const estimatedNewLogs = (unprocessedGames.length * 15) + totalMissingLogs; // Assume ~15 logs per new game
    console.log(`\n📈 Estimated new logs available: ${estimatedNewLogs.toLocaleString()}`);
}

findIncompleteGames();
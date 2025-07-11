import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugNCAACollection() {
    console.log('🔍 NCAA DEBUG COLLECTOR - Finding the issue');
    console.log('==========================================\n');
    
    // Get a sample game to debug
    const { data: sampleGame } = await supabase
        .from('games')
        .select('id, external_id, start_time')
        .eq('sport', 'NCAA_BB')
        .eq('status', 'STATUS_FINAL')
        .order('start_time', { ascending: false })
        .limit(1)
        .single();
        
    if (!sampleGame) {
        console.log('❌ No NCAA Basketball games found!');
        return;
    }
    
    console.log('Testing with game:', sampleGame);
    
    // Check if this game already has logs
    const { count: existingLogs } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', sampleGame.id);
        
    console.log(`Existing logs for this game: ${existingLogs || 0}\n`);
    
    // Fetch game data from ESPN
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${sampleGame.external_id}`;
    console.log('Fetching from:', url);
    
    try {
        const response = await axios.get(url);
        console.log('\n✅ ESPN API responded successfully');
        
        if (!response.data?.boxscore?.players) {
            console.log('❌ No boxscore data in response');
            return;
        }
        
        const teams = response.data.boxscore.players;
        console.log(`Found ${teams.length} teams in boxscore\n`);
        
        let totalPlayers = 0;
        let playersWithStats = 0;
        let playersInDB = 0;
        let logsToInsert = 0;
        
        for (const teamPlayers of teams) {
            console.log(`\nTeam: ${teamPlayers.team.displayName} (${teamPlayers.team.id})`);
            
            if (!teamPlayers.statistics?.[0]?.athletes) {
                console.log('  ❌ No athlete statistics found');
                continue;
            }
            
            const athletes = teamPlayers.statistics[0].athletes;
            console.log(`  Found ${athletes.length} athletes`);
            
            for (const player of athletes) {
                totalPlayers++;
                
                if (!player.athlete) {
                    console.log('  - Player missing athlete data');
                    continue;
                }
                
                const playerInfo = `${player.athlete.displayName} (${player.athlete.id})`;
                
                if (player.didNotPlay) {
                    console.log(`  - ${playerInfo}: DNP`);
                    continue;
                }
                
                if (!player.stats || player.stats[0] === '0:00') {
                    console.log(`  - ${playerInfo}: No minutes played`);
                    continue;
                }
                
                playersWithStats++;
                
                // Check if player exists in our database
                const { data: dbPlayer } = await supabase
                    .from('players')
                    .select('id, name')
                    .eq('external_id', player.athlete.id)
                    .single();
                    
                if (!dbPlayer) {
                    console.log(`  - ${playerInfo}: ❌ NOT IN DATABASE`);
                    continue;
                }
                
                playersInDB++;
                console.log(`  - ${playerInfo}: ✅ In DB as ID ${dbPlayer.id}`);
                
                // Check if log already exists
                const { data: existingLog } = await supabase
                    .from('player_game_logs')
                    .select('id')
                    .eq('player_id', dbPlayer.id)
                    .eq('game_id', sampleGame.id)
                    .single();
                    
                if (existingLog) {
                    console.log(`    Already has log (ID: ${existingLog.id})`);
                } else {
                    console.log(`    No existing log - would insert`);
                    logsToInsert++;
                }
            }
        }
        
        console.log('\n📊 SUMMARY:');
        console.log(`Total players: ${totalPlayers}`);
        console.log(`Players with stats: ${playersWithStats}`);
        console.log(`Players in our DB: ${playersInDB}`);
        console.log(`New logs to insert: ${logsToInsert}`);
        
        if (logsToInsert > 0) {
            console.log('\n🎯 Attempting to insert one log as a test...');
            
            // Find first player to insert
            for (const teamPlayers of teams) {
                if (!teamPlayers.statistics?.[0]?.athletes) continue;
                
                for (const player of teamPlayers.statistics[0].athletes) {
                    if (!player.athlete || player.didNotPlay || !player.stats || player.stats[0] === '0:00') continue;
                    
                    const { data: dbPlayer } = await supabase
                        .from('players')
                        .select('id')
                        .eq('external_id', player.athlete.id)
                        .single();
                        
                    if (!dbPlayer) continue;
                    
                    const { data: existingLog } = await supabase
                        .from('player_game_logs')
                        .select('id')
                        .eq('player_id', dbPlayer.id)
                        .eq('game_id', sampleGame.id)
                        .single();
                        
                    if (existingLog) continue;
                    
                    // This is a new log we can insert
                    const testLog = {
                        player_id: dbPlayer.id,
                        game_id: sampleGame.id,
                        team_id: parseInt(teamPlayers.team.id),
                        game_date: new Date(sampleGame.start_time).toISOString().split('T')[0],
                        is_home: teamPlayers.homeAway === 'home',
                        minutes_played: parseInt(player.stats[0]?.split(':')[0]) || 0,
                        stats: {
                            points: parseInt(player.stats[18]) || 0,
                            rebounds: parseInt(player.stats[12]) || 0,
                            assists: parseInt(player.stats[13]) || 0
                        },
                        fantasy_points: parseInt(player.stats[18]) || 0
                    };
                    
                    console.log('\nInserting test log:', testLog);
                    
                    const { data, error } = await supabase
                        .from('player_game_logs')
                        .insert(testLog)
                        .select();
                        
                    if (error) {
                        console.log('❌ Insert failed:', error);
                    } else {
                        console.log('✅ Insert successful!', data);
                    }
                    
                    break;
                }
                break;
            }
        }
        
    } catch (error: any) {
        console.log('❌ ESPN API error:', error.message);
    }
}

debugNCAACollection();
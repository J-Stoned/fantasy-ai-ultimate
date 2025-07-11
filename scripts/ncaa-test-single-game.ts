import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testSingleGame() {
    // Get a completed NCAA BB game
    const { data: game } = await supabase
        .from('games')
        .select('id, external_id, sport, metadata')
        .eq('sport', 'NCAA_BB')
        .eq('status', 'STATUS_FINAL')
        .limit(1)
        .single();
        
    console.log('Testing game:', game);
    
    if (game) {
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${game.external_id}`;
        
        try {
            const response = await axios.get(url);
            console.log('\nAPI Response status:', response.status);
            console.log('Has boxscore?', !!response.data?.boxscore);
            console.log('Has players?', !!response.data?.boxscore?.players);
            
            if (response.data?.boxscore?.players?.[0]) {
                const teamPlayers = response.data.boxscore.players[0];
                console.log('\nTeam:', teamPlayers.team.displayName);
                console.log('Players:', teamPlayers.statistics?.[0]?.athletes?.length);
                
                // Try to insert one player's stats
                if (teamPlayers.statistics?.[0]?.athletes?.[0]) {
                    const player = teamPlayers.statistics[0].athletes[0];
                    console.log('\nSample player:', player.athlete.displayName);
                    console.log('Player ID:', player.athlete.id);
                    console.log('Stats:', player.stats);
                    
                    // Check if player exists
                    const { data: existingPlayer } = await supabase
                        .from('players')
                        .select('id, external_id')
                        .eq('external_id', player.athlete.id)
                        .single();
                        
                    console.log('\nPlayer in DB?', !!existingPlayer);
                    
                    if (existingPlayer && player.stats && player.stats[0] !== '0:00') {
                        const log = {
                            player_id: existingPlayer.id,
                            game_id: game.id,
                            team_id: parseInt(teamPlayers.team.id),
                            game_date: '2025-01-01',
                            is_home: teamPlayers.homeAway === 'home',
                            minutes_played: parseInt(player.stats[0]?.split(':')[0]) || 0,
                            stats: {
                                points: parseInt(player.stats[18]) || 0,
                                rebounds: parseInt(player.stats[12]) || 0,
                                assists: parseInt(player.stats[13]) || 0
                            },
                            fantasy_points: parseInt(player.stats[18]) || 0
                        };
                        
                        console.log('\nAttempting to insert log:', log);
                        
                        const { data, error } = await supabase
                            .from('player_game_logs')
                            .insert(log)
                            .select();
                            
                        if (error) {
                            console.error('Insert error:', error);
                        } else {
                            console.log('SUCCESS! Inserted:', data);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('API Error:', err.message);
        }
    }
}

testSingleGame();
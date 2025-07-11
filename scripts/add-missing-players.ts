import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function addMissingPlayers() {
    console.log('🏃 MISSING PLAYERS COLLECTOR');
    console.log('============================\n');
    
    try {
        // Get sample of games from each sport
        const sports = [
            { name: 'NHL', url: 'hockey/nhl', path: 'hockey/nhl' },
            { name: 'NCAA_FB', url: 'football/college-football', path: 'football/college-football' },
            { name: 'NCAA_BB', url: 'basketball/mens-college-basketball', path: 'basketball/mens-college-basketball' }
        ];
        
        let totalPlayersAdded = 0;
        
        for (const sport of sports) {
            console.log(`\n📊 Processing ${sport.name} players...`);
            
            // Get some games to extract players from
            const { data: games } = await supabase
                .from('games')
                .select('external_id')
                .eq('sport', sport.name)
                .limit(50);
                
            if (!games || games.length === 0) continue;
            
            const playersToAdd = new Map();
            let gamesProcessed = 0;
            
            // Process games to find players
            for (const game of games) {
                try {
                    const url = `https://site.api.espn.com/apis/site/v2/sports/${sport.url}/summary?event=${game.external_id}`;
                    const response = await axios.get(url);
                    
                    if (response.data?.boxscore?.players) {
                        for (const teamPlayers of response.data.boxscore.players) {
                            const team = teamPlayers.team;
                            
                            // Get athletes from all statistics categories
                            const allStats = teamPlayers.statistics || [];
                            for (const statCategory of allStats) {
                                if (statCategory.athletes) {
                                    for (const athlete of statCategory.athletes) {
                                        if (athlete.athlete && !playersToAdd.has(athlete.athlete.id)) {
                                            playersToAdd.set(athlete.athlete.id, {
                                                external_id: athlete.athlete.id,
                                                name: athlete.athlete.displayName || athlete.athlete.fullName || 'Unknown',
                                                firstname: athlete.athlete.firstName || athlete.athlete.displayName?.split(' ')[0] || 'Unknown',
                                                lastname: athlete.athlete.lastName || athlete.athlete.displayName?.split(' ').slice(1).join(' ') || 'Unknown',
                                                position: [athlete.athlete.position?.abbreviation || 'Unknown'],
                                                jersey_number: parseInt(athlete.athlete.jersey) || null,
                                                team: team.displayName || team.name,
                                                team_abbreviation: team.abbreviation,
                                                sport: sport.name === 'NCAA_FB' ? 'Football' : sport.name === 'NCAA_BB' ? 'Basketball' : sport.name,
                                                status: 'Active',
                                                metadata: {
                                                    team_id: team.id,
                                                    sport_path: sport.path
                                                }
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    gamesProcessed++;
                    if (gamesProcessed % 10 === 0) {
                        process.stdout.write(`\rProcessed ${gamesProcessed}/${games.length} games, found ${playersToAdd.size} unique players`);
                    }
                    
                } catch (error) {
                    // Skip failed games
                    continue;
                }
            }
            
            console.log(`\n\nFound ${playersToAdd.size} unique ${sport.name} players to add`);
            
            // Check which players already exist
            const playerIds = Array.from(playersToAdd.keys());
            const { data: existingPlayers } = await supabase
                .from('players')
                .select('external_id')
                .in('external_id', playerIds);
                
            const existingIds = new Set(existingPlayers?.map(p => p.external_id) || []);
            const newPlayers = Array.from(playersToAdd.values()).filter(p => !existingIds.has(p.external_id));
            
            console.log(`${newPlayers.length} are new players`);
            
            // Insert new players in batches
            if (newPlayers.length > 0) {
                const batchSize = 100;
                let inserted = 0;
                
                for (let i = 0; i < newPlayers.length; i += batchSize) {
                    const batch = newPlayers.slice(i, i + batchSize);
                    
                    const { error } = await supabase
                        .from('players')
                        .insert(batch);
                        
                    if (error) {
                        console.error(`Error inserting batch: ${error.message}`);
                    } else {
                        inserted += batch.length;
                        console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(newPlayers.length / batchSize)}`);
                    }
                }
                
                console.log(`✅ Added ${inserted} ${sport.name} players`);
                totalPlayersAdded += inserted;
            }
        }
        
        console.log(`\n\n🎉 TOTAL PLAYERS ADDED: ${totalPlayersAdded}`);
        
        // Get final player count
        const { count } = await supabase
            .from('players')
            .select('*', { count: 'exact', head: true });
            
        console.log(`Total players in database: ${count?.toLocaleString()}`);
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

addMissingPlayers();
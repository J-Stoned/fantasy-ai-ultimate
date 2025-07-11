import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fetchNHL2023Games() {
    console.log('🏒 NHL 2023 GAMES FETCHER');
    console.log('========================\n');

    try {
        // Check existing NHL games
        const { data: existingGames, error: checkError } = await supabase
            .from('games')
            .select('external_id')
            .eq('sport', 'NHL')
            .gte('start_time', '2023-10-01')
            .lte('start_time', '2024-06-30');

        if (checkError) throw checkError;

        console.log(`Found ${existingGames?.length || 0} existing NHL 2023-24 games\n`);

        // NHL 2023-24 season runs from October 2023 to June 2024
        const startDate = new Date('2023-10-10'); // NHL season start
        const endDate = new Date('2024-06-24'); // Stanley Cup Finals end
        
        const gamesToAdd = [];
        let totalGamesFound = 0;
        
        // Fetch games day by day
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
            
            try {
                const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${dateStr}`;
                const response = await axios.get(url);
                
                if (response.data?.events && response.data.events.length > 0) {
                    for (const event of response.data.events) {
                        totalGamesFound++;
                        
                        const homeTeam = event.competitions[0].competitors.find((c: any) => c.homeAway === 'home');
                        const awayTeam = event.competitions[0].competitors.find((c: any) => c.homeAway === 'away');
                        
                        const gameData = {
                            external_id: event.id,
                            sport: 'NHL',
                            start_time: event.date,
                            status: event.status.type.name,
                            home_score: parseInt(homeTeam.score) || 0,
                            away_score: parseInt(awayTeam.score) || 0,
                            venue: event.competitions[0].venue?.fullName || 'Unknown',
                            metadata: {
                                home_team: homeTeam.team.abbreviation,
                                away_team: awayTeam.team.abbreviation,
                                home_team_id: homeTeam.team.id,
                                away_team_id: awayTeam.team.id,
                                attendance: event.competitions[0].attendance || 0
                            }
                        };
                        
                        // Check if game already exists
                        const exists = existingGames?.some(g => g.external_id === gameData.external_id);
                        
                        if (!exists) {
                            gamesToAdd.push(gameData);
                        }
                    }
                    
                    process.stdout.write(`\rScanning ${date.toISOString().split('T')[0]}: Found ${totalGamesFound} total games, ${gamesToAdd.length} new`);
                }
            } catch (error) {
                // Skip errors for individual dates
                continue;
            }
        }
        
        console.log(`\n\nTotal games found: ${totalGamesFound}`);
        console.log(`New games to add: ${gamesToAdd.length}`);
        
        if (gamesToAdd.length > 0) {
            // Insert in batches of 100
            const batchSize = 100;
            for (let i = 0; i < gamesToAdd.length; i += batchSize) {
                const batch = gamesToAdd.slice(i, i + batchSize);
                
                const { error: insertError } = await supabase
                    .from('games')
                    .insert(batch);
                
                if (insertError) {
                    console.error(`Error inserting batch: ${insertError.message}`);
                } else {
                    console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(gamesToAdd.length / batchSize)}`);
                }
            }
            
            console.log(`\n✅ Successfully added ${gamesToAdd.length} NHL 2023-24 games!`);
        } else {
            console.log('\n✅ All NHL 2023-24 games already in database!');
        }
        
        // Final count
        const { count } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true })
            .eq('sport', 'NHL')
            .gte('start_time', '2023-10-01')
            .lte('start_time', '2024-06-30');
            
        console.log(`\nTotal NHL 2023-24 games in database: ${count}`);
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fetchNHL2023Games();
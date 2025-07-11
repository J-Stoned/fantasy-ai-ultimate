import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fetchNCAAFootballGames() {
    console.log('🏈 NCAA FOOTBALL GAMES FETCHER');
    console.log('==============================\n');

    try {
        // Check existing NCAA Football games
        const { data: existingGames, error: checkError } = await supabase
            .from('games')
            .select('external_id')
            .eq('sport', 'NCAA_FB')
            .gte('start_time', '2024-08-01')
            .lte('start_time', '2025-01-31');

        if (checkError) throw checkError;

        console.log(`Found ${existingGames?.length || 0} existing NCAA Football 2024 games\n`);

        // NCAA Football season runs from August to January
        const startDate = new Date('2024-08-24'); // Season start
        const endDate = new Date('2025-01-20'); // National Championship
        
        const gamesToAdd = [];
        let totalGamesFound = 0;
        
        // Fetch games week by week
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 7)) {
            const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
            
            // Add a few days to get the full week
            const endDateStr = new Date(date.getTime() + 6 * 24 * 60 * 60 * 1000)
                .toISOString().split('T')[0].replace(/-/g, '');
            
            try {
                // NCAA Football uses group 80 on ESPN
                const url = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${dateStr}-${endDateStr}&groups=80&limit=500`;
                const response = await axios.get(url);
                
                if (response.data?.events && response.data.events.length > 0) {
                    for (const event of response.data.events) {
                        totalGamesFound++;
                        
                        const homeTeam = event.competitions[0].competitors.find((c: any) => c.homeAway === 'home');
                        const awayTeam = event.competitions[0].competitors.find((c: any) => c.homeAway === 'away');
                        
                        const gameData = {
                            external_id: event.id,
                            sport: 'NCAA_FB',
                            start_time: event.date,
                            status: event.status.type.name,
                            home_score: parseInt(homeTeam.score) || 0,
                            away_score: parseInt(awayTeam.score) || 0,
                            venue: event.competitions[0].venue?.fullName || 'Unknown',
                            metadata: {
                                home_team: homeTeam.team.displayName,
                                away_team: awayTeam.team.displayName,
                                home_team_id: homeTeam.team.id,
                                away_team_id: awayTeam.team.id,
                                home_team_abbr: homeTeam.team.abbreviation,
                                away_team_abbr: awayTeam.team.abbreviation,
                                conference: event.competitions[0].conferenceCompetition ? 'Conference' : 'Non-Conference',
                                attendance: event.competitions[0].attendance || 0,
                                week: event.week?.number || 0
                            }
                        };
                        
                        // Check if game already exists
                        const exists = existingGames?.some(g => g.external_id === gameData.external_id);
                        
                        if (!exists) {
                            gamesToAdd.push(gameData);
                        }
                    }
                    
                    process.stdout.write(`\rScanning week of ${date.toISOString().split('T')[0]}: Found ${totalGamesFound} total games, ${gamesToAdd.length} new`);
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
            
            console.log(`\n✅ Successfully added ${gamesToAdd.length} NCAA Football 2024 games!`);
        } else {
            console.log('\n✅ All NCAA Football 2024 games already in database!');
        }
        
        // Final count
        const { count } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true })
            .eq('sport', 'NCAA_FB')
            .gte('start_time', '2024-08-01')
            .lte('start_time', '2025-01-31');
            
        console.log(`\nTotal NCAA Football 2024 games in database: ${count}`);
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fetchNCAAFootballGames();
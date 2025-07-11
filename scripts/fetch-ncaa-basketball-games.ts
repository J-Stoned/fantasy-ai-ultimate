import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fetchNCAABasketballGames() {
    console.log('🏀 NCAA BASKETBALL GAMES FETCHER');
    console.log('================================\n');

    try {
        // Check existing NCAA Basketball games
        const { data: existingGames, error: checkError } = await supabase
            .from('games')
            .select('external_id')
            .eq('sport', 'NCAA_BB')
            .gte('start_time', '2024-11-01')
            .lte('start_time', '2025-04-10');

        if (checkError) throw checkError;

        console.log(`Found ${existingGames?.length || 0} existing NCAA Basketball 2024-25 games\n`);

        // NCAA Basketball season runs from November to April
        const startDate = new Date('2024-11-04'); // Season start
        const endDate = new Date('2025-04-07'); // National Championship
        
        const gamesToAdd = [];
        let totalGamesFound = 0;
        let requestCount = 0;
        
        // Fetch games day by day (NCAA Basketball has many more games)
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
            
            try {
                // NCAA Basketball uses groups 50 (Men's Division I)
                const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${dateStr}&groups=50&limit=500`;
                const response = await axios.get(url);
                requestCount++;
                
                if (response.data?.events && response.data.events.length > 0) {
                    for (const event of response.data.events) {
                        totalGamesFound++;
                        
                        const homeTeam = event.competitions[0].competitors.find((c: any) => c.homeAway === 'home');
                        const awayTeam = event.competitions[0].competitors.find((c: any) => c.homeAway === 'away');
                        
                        const gameData = {
                            external_id: event.id,
                            sport: 'NCAA_BB',
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
                                tournament: event.season?.slug?.includes('tournament') || false
                            }
                        };
                        
                        // Check if game already exists
                        const exists = existingGames?.some(g => g.external_id === gameData.external_id);
                        
                        if (!exists) {
                            gamesToAdd.push(gameData);
                        }
                    }
                    
                    process.stdout.write(`\rScanning ${date.toISOString().split('T')[0]}: Found ${totalGamesFound} total games, ${gamesToAdd.length} new | Requests: ${requestCount}`);
                }
                
                // Rate limiting - pause every 50 requests
                if (requestCount % 50 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
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
            let insertedCount = 0;
            
            for (let i = 0; i < gamesToAdd.length; i += batchSize) {
                const batch = gamesToAdd.slice(i, i + batchSize);
                
                const { error: insertError } = await supabase
                    .from('games')
                    .insert(batch);
                
                if (insertError) {
                    console.error(`Error inserting batch: ${insertError.message}`);
                } else {
                    insertedCount += batch.length;
                    console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(gamesToAdd.length / batchSize)} (${insertedCount}/${gamesToAdd.length})`);
                }
            }
            
            console.log(`\n✅ Successfully added ${insertedCount} NCAA Basketball 2024-25 games!`);
        } else {
            console.log('\n✅ All NCAA Basketball 2024-25 games already in database!');
        }
        
        // Final count
        const { count } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true })
            .eq('sport', 'NCAA_BB')
            .gte('start_time', '2024-11-01')
            .lte('start_time', '2025-04-10');
            
        console.log(`\nTotal NCAA Basketball 2024-25 games in database: ${count}`);
        console.log('\n🏀 NCAA Basketball has 350+ Division I teams playing ~30 games each');
        console.log('📊 That\'s ~10,000+ games per season with ~15 players per team = 150K+ potential logs!');
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fetchNCAABasketballGames();
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function addAllNCAAPlayers() {
    console.log('🏃 MASSIVE NCAA PLAYER COLLECTION');
    console.log('=================================\n');
    
    const sports = [
        { name: 'NCAA_FB', url: 'football/college-football' },
        { name: 'NCAA_BB', url: 'basketball/mens-college-basketball' }
    ];
    
    let grandTotal = 0;
    
    for (const sport of sports) {
        console.log(`\n📊 Processing ALL ${sport.name} players...`);
        
        // Get MORE games to extract players from
        const { data: games } = await supabase
            .from('games')
            .select('external_id')
            .eq('sport', sport.name)
            .eq('status', 'STATUS_FINAL')
            .limit(500); // Process 500 games per sport
            
        if (!games || games.length === 0) continue;
        
        const playersMap = new Map();
        let gamesProcessed = 0;
        
        // Process games in batches
        const BATCH_SIZE = 10;
        
        for (let i = 0; i < games.length; i += BATCH_SIZE) {
            const batch = games.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(async (game) => {
                try {
                    const url = `https://site.api.espn.com/apis/site/v2/sports/${sport.url}/summary?event=${game.external_id}`;
                    const response = await axios.get(url);
                    
                    if (response.data?.boxscore?.players) {
                        for (const teamPlayers of response.data.boxscore.players) {
                            const team = teamPlayers.team;
                            
                            // Get ALL athletes from ALL stat categories
                            const allStats = teamPlayers.statistics || [];
                            for (const statCategory of allStats) {
                                if (statCategory.athletes) {
                                    for (const athlete of statCategory.athletes) {
                                        if (athlete.athlete && !playersMap.has(athlete.athlete.id)) {
                                            const player = {
                                                external_id: athlete.athlete.id,
                                                name: athlete.athlete.displayName || 'Unknown',
                                                firstname: athlete.athlete.firstName || athlete.athlete.displayName?.split(' ')[0] || '',
                                                lastname: athlete.athlete.lastName || athlete.athlete.displayName?.split(' ').slice(1).join(' ') || '',
                                                position: [athlete.athlete.position?.abbreviation || 'Unknown'],
                                                jersey_number: parseInt(athlete.athlete.jersey) || null,
                                                team: team.displayName || team.name,
                                                team_abbreviation: team.abbreviation || team.displayName?.substring(0, 5) || 'UNK',
                                                sport: sport.name === 'NCAA_FB' ? 'Football' : 'Basketball',
                                                status: 'Active',
                                                metadata: {
                                                    team_id: team.id,
                                                    sport_path: sport.url,
                                                    added_from: 'ncaa_mega_collection'
                                                }
                                            };
                                            
                                            // Ensure team_abbreviation is max 5 chars
                                            if (player.team_abbreviation.length > 5) {
                                                player.team_abbreviation = player.team_abbreviation.substring(0, 5);
                                            }
                                            
                                            playersMap.set(athlete.athlete.id, player);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    gamesProcessed++;
                } catch (error) {
                    // Skip failed games
                }
            }));
            
            process.stdout.write(`\rProcessed ${Math.min(i + BATCH_SIZE, games.length)}/${games.length} games | Found ${playersMap.size} unique players`);
        }
        
        console.log(`\n\nFound ${playersMap.size} unique ${sport.name} players`);
        
        // Check existing players in smaller batches
        const allPlayerIds = Array.from(playersMap.keys());
        const existingIds = new Set<string>();
        
        for (let i = 0; i < allPlayerIds.length; i += 1000) {
            const batch = allPlayerIds.slice(i, i + 1000);
            const { data } = await supabase
                .from('players')
                .select('external_id')
                .in('external_id', batch);
                
            if (data) {
                data.forEach(p => existingIds.add(p.external_id));
            }
        }
        
        const newPlayers = Array.from(playersMap.values()).filter(p => !existingIds.has(p.external_id));
        console.log(`${newPlayers.length} are new players to add`);
        
        // Insert in batches
        if (newPlayers.length > 0) {
            let inserted = 0;
            const INSERT_SIZE = 100;
            
            for (let i = 0; i < newPlayers.length; i += INSERT_SIZE) {
                const batch = newPlayers.slice(i, i + INSERT_SIZE);
                
                try {
                    const { error } = await supabase
                        .from('players')
                        .insert(batch);
                        
                    if (!error) {
                        inserted += batch.length;
                        process.stdout.write(`\rInserted ${inserted}/${newPlayers.length} players`);
                    }
                } catch (err) {
                    // Skip batch errors
                }
            }
            
            console.log(`\n✅ Added ${inserted} ${sport.name} players`);
            grandTotal += inserted;
        }
    }
    
    console.log(`\n\n🎉 GRAND TOTAL: ${grandTotal} NCAA players added!`);
    
    // Final count
    const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true });
        
    console.log(`Total players in database: ${count?.toLocaleString()}`);
}

addAllNCAAPlayers();
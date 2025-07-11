import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function addNCAATeams() {
    console.log('🏀🏈 ADDING ALL NCAA TEAMS TO DATABASE');
    console.log('=====================================\n');
    
    // Get unique team IDs from games
    const { data: games } = await supabase
        .from('games')
        .select('home_team_id, away_team_id, sport')
        .in('sport', ['NCAA_BB', 'NCAA_FB']);
        
    if (!games) {
        console.log('No NCAA games found');
        return;
    }
    
    // Collect unique team IDs
    const teamIds = new Set<number>();
    games.forEach(game => {
        if (game.home_team_id) teamIds.add(game.home_team_id);
        if (game.away_team_id) teamIds.add(game.away_team_id);
    });
    
    console.log(`Found ${teamIds.size} unique NCAA team IDs in games\n`);
    
    // Check which teams already exist
    const { data: existingTeams } = await supabase
        .from('teams')
        .select('external_id')
        .in('external_id', Array.from(teamIds).map(String));
        
    const existingIds = new Set(existingTeams?.map(t => parseInt(t.external_id)) || []);
    const newTeamIds = Array.from(teamIds).filter(id => !existingIds.has(id));
    
    console.log(`${newTeamIds.length} teams need to be added\n`);
    
    if (newTeamIds.length === 0) {
        console.log('All teams already exist!');
        return;
    }
    
    // Fetch team info from ESPN for each sport
    const teamsToAdd: any[] = [];
    let processed = 0;
    
    // Basketball teams
    console.log('Fetching NCAA Basketball teams...');
    for (const teamId of newTeamIds) {
        try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}`;
            const response = await axios.get(url);
            
            if (response.data?.team) {
                const team = response.data.team;
                teamsToAdd.push({
                    external_id: String(teamId),
                    name: team.displayName || team.name,
                    abbreviation: team.abbreviation || team.displayName?.substring(0, 5).toUpperCase() || 'UNK',
                    location: team.location || '',
                    conference: team.groups?.[0]?.name || 'Independent',
                    sport: 'Basketball',
                    league: 'NCAA'
                });
                processed++;
                
                if (processed % 10 === 0) {
                    process.stdout.write(`\rProcessed ${processed}/${newTeamIds.length} teams`);
                }
            }
        } catch (error) {
            // Try football if basketball fails
            try {
                const url = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/${teamId}`;
                const response = await axios.get(url);
                
                if (response.data?.team) {
                    const team = response.data.team;
                    teamsToAdd.push({
                        external_id: String(teamId),
                        name: team.displayName || team.name,
                        abbreviation: team.abbreviation || team.displayName?.substring(0, 5).toUpperCase() || 'UNK',
                        location: team.location || '',
                        conference: team.groups?.[0]?.name || 'Independent',
                        sport: 'Football',
                        league: 'NCAA'
                    });
                    processed++;
                    
                    if (processed % 10 === 0) {
                        process.stdout.write(`\rProcessed ${processed}/${newTeamIds.length} teams`);
                    }
                }
            } catch (err) {
                // Skip if both fail
            }
        }
    }
    
    console.log(`\n\nFetched data for ${teamsToAdd.length} teams`);
    
    // Insert teams in batches
    if (teamsToAdd.length > 0) {
        const BATCH_SIZE = 50;
        let inserted = 0;
        
        for (let i = 0; i < teamsToAdd.length; i += BATCH_SIZE) {
            const batch = teamsToAdd.slice(i, i + BATCH_SIZE);
            
            try {
                const { data, error } = await supabase
                    .from('teams')
                    .insert(batch)
                    .select();
                    
                if (data) {
                    inserted += data.length;
                }
                if (error) {
                    console.error('Insert error:', error);
                }
            } catch (err) {
                console.error('Batch error:', err);
            }
        }
        
        console.log(`\n✅ Successfully added ${inserted} NCAA teams!`);
    }
    
    // Final count
    const { count } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true });
        
    console.log(`\nTotal teams in database: ${count}`);
}

addNCAATeams();
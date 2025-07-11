import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function addMLSTeams() {
    console.log('⚽ ADDING MLS TEAMS TO DATABASE');
    console.log('===============================\n');
    
    try {
        // Get MLS teams from ESPN API
        const url = 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/teams';
        const { data } = await axios.get(url);
        
        if (!data.sports?.[0]?.leagues?.[0]?.teams) {
            console.log('❌ No teams found in API response');
            return;
        }
        
        const teams = data.sports[0].leagues[0].teams;
        console.log(`Found ${teams.length} MLS teams\n`);
        
        const teamsToInsert = [];
        
        for (const teamData of teams) {
            const team = teamData.team;
            
            const teamRecord = {
                external_id: team.id,
                sport: 'MLS',
                sport_id: 'mls',
                name: team.displayName,
                full_name: team.name,
                abbreviation: team.abbreviation,
                location: team.location,
                color: team.color,
                alternate_color: team.alternateColor,
                logo_url: team.logos?.[0]?.href,
                venue: team.venue?.fullName || null,
                conference: team.groups?.id || null
            };
            
            teamsToInsert.push(teamRecord);
            console.log(`  ✅ ${team.displayName} (${team.abbreviation})`);
        }
        
        // Insert teams
        const { data: inserted, error } = await supabase
            .from('teams')
            .upsert(teamsToInsert, {
                onConflict: 'external_id'
            })
            .select();
            
        if (error) {
            console.error('\n❌ Error inserting teams:', error);
        } else {
            console.log(`\n✅ Successfully added/updated ${inserted?.length || 0} MLS teams!`);
            
            // Show team IDs for verification
            console.log('\nTeam IDs in database:');
            const { data: allMLSTeams } = await supabase
                .from('teams')
                .select('id, name, external_id')
                .eq('sport', 'MLS')
                .order('name');
                
            allMLSTeams?.forEach(team => {
                console.log(`  ID: ${team.id} - ${team.name} (ESPN: ${team.external_id})`);
            });
        }
        
    } catch (error) {
        console.error('Error fetching MLS teams:', error);
    }
}

// Also add a function to check MLS data coverage
async function checkMLSCoverage() {
    console.log('\n\n📊 MLS DATA COVERAGE CHECK');
    console.log('=========================');
    
    // Count MLS games
    const { count: gameCount } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport', 'MLS');
        
    console.log(`MLS Games: ${gameCount || 0}`);
    
    // Count MLS players
    const { count: playerCount } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('sport', 'MLS');
        
    console.log(`MLS Players: ${playerCount || 0}`);
    
    // Count MLS logs
    const { data: mlsGameIds } = await supabase
        .from('games')
        .select('id')
        .eq('sport', 'MLS');
        
    if (mlsGameIds && mlsGameIds.length > 0) {
        const gameIds = mlsGameIds.map(g => g.id);
        
        const { count: logCount } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds.slice(0, 1000));
            
        console.log(`MLS Player Logs: ${logCount || 0}`);
    } else {
        console.log(`MLS Player Logs: 0`);
    }
}

addMLSTeams()
    .then(() => checkMLSCoverage())
    .catch(console.error);
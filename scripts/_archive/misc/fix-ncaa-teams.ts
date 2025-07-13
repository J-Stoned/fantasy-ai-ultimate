import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixNCAATeams() {
    console.log('🏀🏈 FIXING NCAA TEAMS IN DATABASE');
    console.log('==================================\n');
    
    // Check current state
    const { data: teams, count } = await supabase
        .from('teams')
        .select('*', { count: 'exact' })
        .eq('league', 'NCAA');
        
    console.log(`Found ${count} NCAA teams in database`);
    
    // Group by sport and check external_id
    const byState = {
        withExternalId: 0,
        withoutExternalId: 0,
        bySport: {} as any
    };
    
    teams?.forEach(team => {
        if (team.external_id) {
            byState.withExternalId++;
        } else {
            byState.withoutExternalId++;
        }
        
        if (!byState.bySport[team.sport]) {
            byState.bySport[team.sport] = { total: 0, withId: 0 };
        }
        byState.bySport[team.sport].total++;
        if (team.external_id) {
            byState.bySport[team.sport].withId++;
        }
    });
    
    console.log(`\nBreakdown:`);
    console.log(`- With external_id: ${byState.withExternalId}`);
    console.log(`- Without external_id: ${byState.withoutExternalId}`);
    
    console.log(`\nBy Sport:`);
    Object.entries(byState.bySport).forEach(([sport, stats]: any) => {
        console.log(`- ${sport}: ${stats.total} teams (${stats.withId} with external_id)`);
    });
    
    // Get team IDs from games to understand what we need
    console.log('\nChecking team IDs from games...');
    
    const { data: games } = await supabase
        .from('games')
        .select('home_team_id, away_team_id')
        .in('sport', ['NCAA_BB', 'NCAA_FB'])
        .not('home_team_id', 'is', null)
        .limit(100);
        
    const gameTeamIds = new Set<number>();
    games?.forEach(game => {
        if (game.home_team_id) gameTeamIds.add(game.home_team_id);
        if (game.away_team_id) gameTeamIds.add(game.away_team_id);
    });
    
    console.log(`Found ${gameTeamIds.size} unique team IDs in NCAA games`);
    
    // Check if these IDs exist as external_ids
    const teamIdStrings = Array.from(gameTeamIds).map(String);
    const { data: existingTeams } = await supabase
        .from('teams')
        .select('id, external_id, name')
        .in('external_id', teamIdStrings)
        .limit(10);
        
    console.log(`\nFound ${existingTeams?.length || 0} teams with matching external_ids`);
    
    if (existingTeams && existingTeams.length > 0) {
        console.log('\nSample matches:');
        existingTeams.slice(0, 5).forEach(team => {
            console.log(`- ${team.name} (external_id: ${team.external_id})`);
        });
    }
    
    // Now let's update Basketball teams with correct external_ids
    console.log('\n\nUpdating NCAA Basketball teams with ESPN IDs...');
    
    const ncaaBasketballMapping = {
        'Duke Blue Devils': '150',
        'North Carolina Tar Heels': '153',
        'UCLA Bruins': '26',
        'Michigan State Spartans': '127',
        'Michigan Wolverines': '130',
        'Gonzaga Bulldogs': '2250',
        'Kansas Jayhawks': '2305',
        'Purdue Boilermakers': '2509',
        'Arizona Wildcats': '12',
        'Houston Cougars': '248',
        'Tennessee Volunteers': '2633',
        'Alabama Crimson Tide': '333',
        'Baylor Bears': '239',
        'Auburn Tigers': '2',
        'Texas Tech Red Raiders': '2641',
        'Creighton Bluejays': '156',
        'Marquette Golden Eagles': '269',
        'Illinois Fighting Illini': '356',
        'Wisconsin Badgers': '275',
        'Xavier Musketeers': '2752',
        'BYU Cougars': '252',
        'Oregon Ducks': '2483',
        'Arkansas Razorbacks': '8',
        'Memphis Tigers': '235',
        'Ole Miss Rebels': '145',
        'Clemson Tigers': '228',
        'Nebraska Cornhuskers': '158',
        'UCF Knights': '2116',
        'Villanova Wildcats': '222',
        'Butler Bulldogs': '2086',
        'Cincinnati Bearcats': '2132',
        'USC Trojans': '30',
        'Maryland Terrapins': '120',
        'Oklahoma State Cowboys': '197',
        // Add more as needed
    };
    
    let updated = 0;
    for (const [name, externalId] of Object.entries(ncaaBasketballMapping)) {
        const { error } = await supabase
            .from('teams')
            .update({ external_id: externalId })
            .eq('name', name)
            .eq('league', 'NCAA');
            
        if (!error) {
            updated++;
        }
    }
    
    console.log(`Updated ${updated} NCAA Basketball teams with external IDs`);
    
    // Verify the fix
    const { count: finalCount } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('league', 'NCAA')
        .not('external_id', 'is', null);
        
    console.log(`\nFinal: ${finalCount} NCAA teams have external_ids`);
}

fixNCAATeams();
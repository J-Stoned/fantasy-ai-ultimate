import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function addMoreNCAATeams() {
    console.log('🏀 ADDING MORE NCAA TEAMS');
    console.log('========================\n');
    
    // Additional NCAA Basketball teams
    const moreTeams = [
        // Teams that were missing from games
        { external_id: '2309', name: 'Kent State Golden Flashes', abbreviation: 'KENT', city: 'Kent', metadata: { conference: 'MAC' } },
        { external_id: '2916', name: 'Incarnate Word Cardinals', abbreviation: 'UIW', city: 'San Antonio', metadata: { conference: 'Southland' } },
        { external_id: '2511', name: 'Queens University Royals', abbreviation: 'QU', city: 'Charlotte', metadata: { conference: 'ASUN' } },
        { external_id: '55', name: 'Jacksonville State Gamecocks', abbreviation: 'JVST', city: 'Jacksonville', metadata: { conference: 'ASUN' } },
        { external_id: '294', name: 'Jacksonville Dolphins', abbreviation: 'JAC', city: 'Jacksonville', metadata: { conference: 'ASUN' } },
        { external_id: '349', name: 'Army Black Knights', abbreviation: 'ARMY', city: 'West Point', metadata: { conference: 'Patriot' } },
        { external_id: '2541', name: 'Santa Clara Broncos', abbreviation: 'SCU', city: 'Santa Clara', metadata: { conference: 'WCC' } },
        { external_id: '2032', name: 'Arkansas State Red Wolves', abbreviation: 'ARST', city: 'Jonesboro', metadata: { conference: 'Sun Belt' } },
        { external_id: '2506', name: 'Presbyterian Blue Hose', abbreviation: 'PRES', city: 'Clinton', metadata: { conference: 'Big South' } },
        { external_id: '2464', name: 'Northern Arizona Lumberjacks', abbreviation: 'NAU', city: 'Flagstaff', metadata: { conference: 'Big Sky' } },
        { external_id: '2539', name: 'San Francisco Dons', abbreviation: 'SF', city: 'San Francisco', metadata: { conference: 'WCC' } },
        { external_id: '2363', name: 'Manhattan Jaspers', abbreviation: 'MANH', city: 'Riverdale', metadata: { conference: 'MAAC' } },
        { external_id: '2567', name: 'SMU Mustangs', abbreviation: 'SMU', city: 'Dallas', metadata: { conference: 'AAC' } },
        { external_id: '2210', name: 'Elon Phoenix', abbreviation: 'ELON', city: 'Elon', metadata: { conference: 'CAA' } },
        { external_id: '2244', name: 'George Mason Patriots', abbreviation: 'GMU', city: 'Fairfax', metadata: { conference: 'A-10' } },
        { external_id: '2377', name: 'McNeese Cowboys', abbreviation: 'MCN', city: 'Lake Charles', metadata: { conference: 'Southland' } },
        { external_id: '2335', name: 'Liberty Flames', abbreviation: 'LIB', city: 'Lynchburg', metadata: { conference: 'ASUN' } },
        { external_id: '2006', name: 'Akron Zips', abbreviation: 'AKR', city: 'Akron', metadata: { conference: 'MAC' } },
        { external_id: '2803', name: 'Bryant Bulldogs', abbreviation: 'BRY', city: 'Smithfield', metadata: { conference: 'NEC' } },
        { external_id: '2653', name: 'Troy Trojans', abbreviation: 'TROY', city: 'Troy', metadata: { conference: 'Sun Belt' } },
        { external_id: '2450', name: 'Norfolk State Spartans', abbreviation: 'NSU', city: 'Norfolk', metadata: { conference: 'MEAC' } },
        { external_id: '2253', name: 'Grand Canyon Lopes', abbreviation: 'GCU', city: 'Phoenix', metadata: { conference: 'WAC' } },
        { external_id: '238', name: 'Vanderbilt Commodores', abbreviation: 'VAN', city: 'Nashville', metadata: { conference: 'SEC' } },
        { external_id: '116', name: 'Mount St. Mary\'s Mountaineers', abbreviation: 'MSM', city: 'Emmitsburg', metadata: { conference: 'NEC' } },
        { external_id: '288', name: 'Lipscomb Bisons', abbreviation: 'LIP', city: 'Nashville', metadata: { conference: 'ASUN' } },
        { external_id: '2523', name: 'Robert Morris Colonials', abbreviation: 'RMU', city: 'Moon Township', metadata: { conference: 'Horizon' } },
        { external_id: '350', name: 'UNC Wilmington Seahawks', abbreviation: 'UNCW', city: 'Wilmington', metadata: { conference: 'CAA' } },
        { external_id: '28', name: 'UC San Diego Tritons', abbreviation: 'UCSD', city: 'La Jolla', metadata: { conference: 'Big West' } },
        { external_id: '2437', name: 'Omaha Mavericks', abbreviation: 'UNO', city: 'Omaha', metadata: { conference: 'Summit' } },
        { external_id: '2747', name: 'Wofford Terriers', abbreviation: 'WOF', city: 'Spartanburg', metadata: { conference: 'Southern' } },
        { external_id: '2011', name: 'Alabama State Hornets', abbreviation: 'ALST', city: 'Montgomery', metadata: { conference: 'SWAC' } },
        { external_id: '2565', name: 'SIU Edwardsville Cougars', abbreviation: 'SIUE', city: 'Edwardsville', metadata: { conference: 'OVC' } },
        { external_id: '149', name: 'Montana Grizzlies', abbreviation: 'MONT', city: 'Missoula', metadata: { conference: 'Big Sky' } },
        // Power 5 teams we might have missed
        { external_id: '57', name: 'Florida Gators', abbreviation: 'FLA', city: 'Gainesville', metadata: { conference: 'SEC' } },
        { external_id: '96', name: 'Kentucky Wildcats', abbreviation: 'UK', city: 'Lexington', metadata: { conference: 'SEC' } },
        { external_id: '221', name: 'Virginia Cavaliers', abbreviation: 'UVA', city: 'Charlottesville', metadata: { conference: 'ACC' } },
        { external_id: '259', name: 'Virginia Tech Hokies', abbreviation: 'VT', city: 'Blacksburg', metadata: { conference: 'ACC' } },
        { external_id: '277', name: 'West Virginia Mountaineers', abbreviation: 'WVU', city: 'Morgantown', metadata: { conference: 'Big 12' } },
        { external_id: '194', name: 'Ohio State Buckeyes', abbreviation: 'OSU', city: 'Columbus', metadata: { conference: 'Big Ten' } },
        { external_id: '84', name: 'Indiana Hoosiers', abbreviation: 'IND', city: 'Bloomington', metadata: { conference: 'Big Ten' } },
        { external_id: '164', name: 'Rutgers Scarlet Knights', abbreviation: 'RUTG', city: 'Piscataway', metadata: { conference: 'Big Ten' } },
        { external_id: '99', name: 'LSU Tigers', abbreviation: 'LSU', city: 'Baton Rouge', metadata: { conference: 'SEC' } },
        { external_id: '38', name: 'Colorado Buffaloes', abbreviation: 'COLO', city: 'Boulder', metadata: { conference: 'Pac-12' } },
        { external_id: '264', name: 'Washington Huskies', abbreviation: 'WASH', city: 'Seattle', metadata: { conference: 'Pac-12' } },
        { external_id: '25', name: 'California Golden Bears', abbreviation: 'CAL', city: 'Berkeley', metadata: { conference: 'Pac-12' } },
        { external_id: '87', name: 'Iowa Hawkeyes', abbreviation: 'IOWA', city: 'Iowa City', metadata: { conference: 'Big Ten' } },
        { external_id: '77', name: 'Iowa State Cyclones', abbreviation: 'ISU', city: 'Ames', metadata: { conference: 'Big 12' } },
        { external_id: '251', name: 'Texas Longhorns', abbreviation: 'TEX', city: 'Austin', metadata: { conference: 'Big 12' } },
        { external_id: '2628', name: 'TCU Horned Frogs', abbreviation: 'TCU', city: 'Fort Worth', metadata: { conference: 'Big 12' } },
        { external_id: '61', name: 'Georgia Bulldogs', abbreviation: 'UGA', city: 'Athens', metadata: { conference: 'SEC' } },
        { external_id: '59', name: 'Georgia Tech Yellow Jackets', abbreviation: 'GT', city: 'Atlanta', metadata: { conference: 'ACC' } },
        { external_id: '52', name: 'Florida State Seminoles', abbreviation: 'FSU', city: 'Tallahassee', metadata: { conference: 'ACC' } },
        { external_id: '2390', name: 'Miami Hurricanes', abbreviation: 'MIA', city: 'Coral Gables', metadata: { conference: 'ACC' } },
        { external_id: '135', name: 'Minnesota Golden Gophers', abbreviation: 'MINN', city: 'Minneapolis', metadata: { conference: 'Big Ten' } },
        { external_id: '147', name: 'Northwestern Wildcats', abbreviation: 'NW', city: 'Evanston', metadata: { conference: 'Big Ten' } },
        { external_id: '213', name: 'Penn State Nittany Lions', abbreviation: 'PSU', city: 'University Park', metadata: { conference: 'Big Ten' } },
        { external_id: '152', name: 'NC State Wolfpack', abbreviation: 'NCST', city: 'Raleigh', metadata: { conference: 'ACC' } },
        { external_id: '103', name: 'Louisville Cardinals', abbreviation: 'LOU', city: 'Louisville', metadata: { conference: 'ACC' } },
        { external_id: '258', name: 'Pittsburgh Panthers', abbreviation: 'PITT', city: 'Pittsburgh', metadata: { conference: 'ACC' } },
        { external_id: '183', name: 'Syracuse Orange', abbreviation: 'SYR', city: 'Syracuse', metadata: { conference: 'ACC' } },
        { external_id: '193', name: 'Notre Dame Fighting Irish', abbreviation: 'ND', city: 'Notre Dame', metadata: { conference: 'ACC' } },
        { external_id: '154', name: 'Wake Forest Demon Deacons', abbreviation: 'WAKE', city: 'Winston-Salem', metadata: { conference: 'ACC' } },
        { external_id: '23', name: 'Boston College Eagles', abbreviation: 'BC', city: 'Chestnut Hill', metadata: { conference: 'ACC' } },
    ];
    
    // Add all teams with proper structure
    const teamsToAdd = moreTeams.map(team => ({
        external_id: team.external_id,
        name: team.name,
        abbreviation: team.abbreviation,
        city: team.city,
        sport: 'Basketball',
        sport_id: 'NCAA_BB',
        league_id: 'NCAA',
        metadata: {
            ...team.metadata,
            league: 'NCAA'
        }
    }));
    
    console.log(`Adding ${teamsToAdd.length} more NCAA Basketball teams...`);
    
    // Insert in batches
    const BATCH_SIZE = 10;
    let inserted = 0;
    
    for (let i = 0; i < teamsToAdd.length; i += BATCH_SIZE) {
        const batch = teamsToAdd.slice(i, i + BATCH_SIZE);
        
        const { data, error } = await supabase
            .from('teams')
            .upsert(batch, {
                onConflict: 'external_id'
            })
            .select();
            
        if (data) {
            inserted += data.length;
        }
        if (error) {
            console.error(`Batch error:`, error.message);
        }
        
        process.stdout.write(`\rProgress: ${Math.min(i + BATCH_SIZE, teamsToAdd.length)}/${teamsToAdd.length} teams`);
    }
    
    console.log(`\n\n✅ Successfully added/updated ${inserted} teams!`);
    
    // Final count
    const { count } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('sport_id', 'NCAA_BB');
        
    console.log(`Total NCAA Basketball teams: ${count}`);
}

addMoreNCAATeams();
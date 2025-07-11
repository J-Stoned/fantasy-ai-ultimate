import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function addNCAATeamsFixed() {
    console.log('🏀🏈 ADDING NCAA TEAMS TO DATABASE (FIXED)');
    console.log('=========================================\n');
    
    // Major NCAA Basketball teams with their ESPN IDs
    const ncaaBasketballTeams = [
        { external_id: '150', name: 'Duke Blue Devils', abbreviation: 'DUKE', city: 'Durham', metadata: { conference: 'ACC' } },
        { external_id: '153', name: 'North Carolina Tar Heels', abbreviation: 'UNC', city: 'Chapel Hill', metadata: { conference: 'ACC' } },
        { external_id: '26', name: 'UCLA Bruins', abbreviation: 'UCLA', city: 'Los Angeles', metadata: { conference: 'Pac-12' } },
        { external_id: '127', name: 'Michigan State Spartans', abbreviation: 'MSU', city: 'East Lansing', metadata: { conference: 'Big Ten' } },
        { external_id: '130', name: 'Michigan Wolverines', abbreviation: 'MICH', city: 'Ann Arbor', metadata: { conference: 'Big Ten' } },
        { external_id: '2250', name: 'Gonzaga Bulldogs', abbreviation: 'GONZ', city: 'Spokane', metadata: { conference: 'WCC' } },
        { external_id: '2305', name: 'Kansas Jayhawks', abbreviation: 'KU', city: 'Lawrence', metadata: { conference: 'Big 12' } },
        { external_id: '2509', name: 'Purdue Boilermakers', abbreviation: 'PUR', city: 'West Lafayette', metadata: { conference: 'Big Ten' } },
        { external_id: '12', name: 'Arizona Wildcats', abbreviation: 'ARIZ', city: 'Tucson', metadata: { conference: 'Pac-12' } },
        { external_id: '248', name: 'Houston Cougars', abbreviation: 'HOU', city: 'Houston', metadata: { conference: 'AAC' } },
        { external_id: '2633', name: 'Tennessee Volunteers', abbreviation: 'TENN', city: 'Knoxville', metadata: { conference: 'SEC' } },
        { external_id: '333', name: 'Alabama Crimson Tide', abbreviation: 'ALA', city: 'Tuscaloosa', metadata: { conference: 'SEC' } },
        { external_id: '239', name: 'Baylor Bears', abbreviation: 'BAY', city: 'Waco', metadata: { conference: 'Big 12' } },
        { external_id: '2', name: 'Auburn Tigers', abbreviation: 'AUB', city: 'Auburn', metadata: { conference: 'SEC' } },
        { external_id: '2641', name: 'Texas Tech Red Raiders', abbreviation: 'TTU', city: 'Lubbock', metadata: { conference: 'Big 12' } },
        { external_id: '156', name: 'Creighton Bluejays', abbreviation: 'CREI', city: 'Omaha', metadata: { conference: 'Big East' } },
        { external_id: '269', name: 'Marquette Golden Eagles', abbreviation: 'MARQ', city: 'Milwaukee', metadata: { conference: 'Big East' } },
        { external_id: '356', name: 'Illinois Fighting Illini', abbreviation: 'ILL', city: 'Champaign', metadata: { conference: 'Big Ten' } },
        { external_id: '275', name: 'Wisconsin Badgers', abbreviation: 'WIS', city: 'Madison', metadata: { conference: 'Big Ten' } },
        { external_id: '2752', name: 'Xavier Musketeers', abbreviation: 'XAV', city: 'Cincinnati', metadata: { conference: 'Big East' } },
        { external_id: '252', name: 'BYU Cougars', abbreviation: 'BYU', city: 'Provo', metadata: { conference: 'WCC' } },
        { external_id: '2483', name: 'Oregon Ducks', abbreviation: 'ORE', city: 'Eugene', metadata: { conference: 'Pac-12' } },
        { external_id: '8', name: 'Arkansas Razorbacks', abbreviation: 'ARK', city: 'Fayetteville', metadata: { conference: 'SEC' } },
        { external_id: '235', name: 'Memphis Tigers', abbreviation: 'MEM', city: 'Memphis', metadata: { conference: 'AAC' } },
        { external_id: '145', name: 'Ole Miss Rebels', abbreviation: 'MISS', city: 'Oxford', metadata: { conference: 'SEC' } },
        { external_id: '228', name: 'Clemson Tigers', abbreviation: 'CLEM', city: 'Clemson', metadata: { conference: 'ACC' } },
        { external_id: '158', name: 'Nebraska Cornhuskers', abbreviation: 'NEB', city: 'Lincoln', metadata: { conference: 'Big Ten' } },
        { external_id: '2116', name: 'UCF Knights', abbreviation: 'UCF', city: 'Orlando', metadata: { conference: 'AAC' } },
        { external_id: '222', name: 'Villanova Wildcats', abbreviation: 'VILL', city: 'Villanova', metadata: { conference: 'Big East' } },
        { external_id: '2086', name: 'Butler Bulldogs', abbreviation: 'BUT', city: 'Indianapolis', metadata: { conference: 'Big East' } },
        { external_id: '2132', name: 'Cincinnati Bearcats', abbreviation: 'CIN', city: 'Cincinnati', metadata: { conference: 'AAC' } },
        { external_id: '30', name: 'USC Trojans', abbreviation: 'USC', city: 'Los Angeles', metadata: { conference: 'Pac-12' } },
        { external_id: '120', name: 'Maryland Terrapins', abbreviation: 'MD', city: 'College Park', metadata: { conference: 'Big Ten' } },
        { external_id: '197', name: 'Oklahoma State Cowboys', abbreviation: 'OKST', city: 'Stillwater', metadata: { conference: 'Big 12' } },
        { external_id: '2599', name: 'St. John\'s Red Storm', abbreviation: 'SJU', city: 'Queens', metadata: { conference: 'Big East' } },
        { external_id: '201', name: 'Oklahoma Sooners', abbreviation: 'OU', city: 'Norman', metadata: { conference: 'Big 12' } },
        { external_id: '9', name: 'Arizona State Sun Devils', abbreviation: 'ASU', city: 'Tempe', metadata: { conference: 'Pac-12' } },
        { external_id: '245', name: 'Texas A&M Aggies', abbreviation: 'TAMU', city: 'College Station', metadata: { conference: 'SEC' } },
        { external_id: '142', name: 'Missouri Tigers', abbreviation: 'MIZ', city: 'Columbia', metadata: { conference: 'SEC' } },
        { external_id: '300', name: 'UC Irvine Anteaters', abbreviation: 'UCI', city: 'Irvine', metadata: { conference: 'Big West' } },
        { external_id: '2350', name: 'Loyola Chicago Ramblers', abbreviation: 'LUC', city: 'Chicago', metadata: { conference: 'A-10' } },
        { external_id: '2168', name: 'Dayton Flyers', abbreviation: 'DAY', city: 'Dayton', metadata: { conference: 'A-10' } },
        { external_id: '254', name: 'Utah Utes', abbreviation: 'UTAH', city: 'Salt Lake City', metadata: { conference: 'Pac-12' } },
        { external_id: '328', name: 'Utah State Aggies', abbreviation: 'USU', city: 'Logan', metadata: { conference: 'Mountain West' } },
        { external_id: '305', name: 'DePaul Blue Demons', abbreviation: 'DEP', city: 'Chicago', metadata: { conference: 'Big East' } },
        { external_id: '236', name: 'Chattanooga Mocs', abbreviation: 'CHAT', city: 'Chattanooga', metadata: { conference: 'Southern' } },
        { external_id: '2608', name: 'Saint Mary\'s Gaels', abbreviation: 'SMC', city: 'Moraga', metadata: { conference: 'WCC' } },
        { external_id: '167', name: 'New Mexico Lobos', abbreviation: 'UNM', city: 'Albuquerque', metadata: { conference: 'Mountain West' } },
        { external_id: '5', name: 'UAB Blazers', abbreviation: 'UAB', city: 'Birmingham', metadata: { conference: 'C-USA' } },
        { external_id: '249', name: 'North Texas Mean Green', abbreviation: 'UNT', city: 'Denton', metadata: { conference: 'C-USA' } },
        { external_id: '2655', name: 'Tulane Green Wave', abbreviation: 'TUL', city: 'New Orleans', metadata: { conference: 'AAC' } },
        { external_id: '265', name: 'Washington State Cougars', abbreviation: 'WSU', city: 'Pullman', metadata: { conference: 'Pac-12' } },
        { external_id: '204', name: 'Oregon State Beavers', abbreviation: 'ORST', city: 'Corvallis', metadata: { conference: 'Pac-12' } },
        { external_id: '344', name: 'Mississippi State Bulldogs', abbreviation: 'MSST', city: 'Starkville', metadata: { conference: 'SEC' } },
        { external_id: '2287', name: 'Illinois State Redbirds', abbreviation: 'ILST', city: 'Normal', metadata: { conference: 'MVC' } },
        { external_id: '2181', name: 'Drake Bulldogs', abbreviation: 'DRAK', city: 'Des Moines', metadata: { conference: 'MVC' } },
        { external_id: '325', name: 'Cleveland State Vikings', abbreviation: 'CLEV', city: 'Cleveland', metadata: { conference: 'Horizon' } },
        { external_id: '526', name: 'Florida Gulf Coast Eagles', abbreviation: 'FGCU', city: 'Fort Myers', metadata: { conference: 'ASUN' } },
        { external_id: '2670', name: 'VCU Rams', abbreviation: 'VCU', city: 'Richmond', metadata: { conference: 'A-10' } },
        { external_id: '24', name: 'Stanford Cardinal', abbreviation: 'STAN', city: 'Stanford', metadata: { conference: 'Pac-12' } },
    ];
    
    // Add all teams with proper structure
    const teamsToAdd = ncaaBasketballTeams.map(team => ({
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
    
    console.log(`Preparing to add ${teamsToAdd.length} NCAA Basketball teams...`);
    
    // Insert in batches
    const BATCH_SIZE = 10;
    let inserted = 0;
    let errors = 0;
    
    for (let i = 0; i < teamsToAdd.length; i += BATCH_SIZE) {
        const batch = teamsToAdd.slice(i, i + BATCH_SIZE);
        
        try {
            const { data, error } = await supabase
                .from('teams')
                .upsert(batch, {
                    onConflict: 'external_id'
                })
                .select();
                
            if (data) {
                inserted += data.length;
                console.log(`✅ Batch ${Math.floor(i/BATCH_SIZE) + 1}: Added ${data.length} teams`);
            }
            if (error) {
                errors++;
                console.error(`❌ Batch ${Math.floor(i/BATCH_SIZE) + 1} error:`, error.message);
            }
        } catch (err: any) {
            errors++;
            console.error(`❌ Batch ${Math.floor(i/BATCH_SIZE) + 1} exception:`, err.message);
        }
    }
    
    console.log(`\n📊 Results:`);
    console.log(`- Successfully added/updated: ${inserted} teams`);
    console.log(`- Errors: ${errors} batches`);
    
    // Verify specific teams
    console.log('\nVerifying key teams:');
    const keyTeams = ['150', '153', '26', '127', '248', '2633'];
    
    for (const extId of keyTeams) {
        const { data } = await supabase
            .from('teams')
            .select('name, external_id')
            .eq('external_id', extId)
            .single();
            
        if (data) {
            console.log(`✅ ${data.name} (${data.external_id})`);
        } else {
            console.log(`❌ Team ${extId} not found`);
        }
    }
    
    // Final count
    const { count } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('sport_id', 'NCAA_BB');
        
    console.log(`\nTotal NCAA Basketball teams in database: ${count}`);
}

addNCAATeamsFixed();
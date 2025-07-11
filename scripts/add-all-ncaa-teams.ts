import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function addAllNCAATeams() {
    console.log('🏀🏈 ADDING ALL NCAA TEAMS TO DATABASE');
    console.log('=====================================\n');
    
    // Major NCAA Basketball teams with their ESPN IDs
    const ncaaBasketballTeams = [
        { external_id: '150', name: 'Duke Blue Devils', abbreviation: 'DUKE', location: 'Durham', conference: 'ACC' },
        { external_id: '153', name: 'North Carolina Tar Heels', abbreviation: 'UNC', location: 'Chapel Hill', conference: 'ACC' },
        { external_id: '26', name: 'UCLA Bruins', abbreviation: 'UCLA', location: 'Los Angeles', conference: 'Pac-12' },
        { external_id: '127', name: 'Michigan State Spartans', abbreviation: 'MSU', location: 'East Lansing', conference: 'Big Ten' },
        { external_id: '130', name: 'Michigan Wolverines', abbreviation: 'MICH', location: 'Ann Arbor', conference: 'Big Ten' },
        { external_id: '2250', name: 'Gonzaga Bulldogs', abbreviation: 'GONZ', location: 'Spokane', conference: 'WCC' },
        { external_id: '2305', name: 'Kansas Jayhawks', abbreviation: 'KU', location: 'Lawrence', conference: 'Big 12' },
        { external_id: '2509', name: 'Purdue Boilermakers', abbreviation: 'PUR', location: 'West Lafayette', conference: 'Big Ten' },
        { external_id: '12', name: 'Arizona Wildcats', abbreviation: 'ARIZ', location: 'Tucson', conference: 'Pac-12' },
        { external_id: '248', name: 'Houston Cougars', abbreviation: 'HOU', location: 'Houston', conference: 'AAC' },
        { external_id: '2633', name: 'Tennessee Volunteers', abbreviation: 'TENN', location: 'Knoxville', conference: 'SEC' },
        { external_id: '333', name: 'Alabama Crimson Tide', abbreviation: 'ALA', location: 'Tuscaloosa', conference: 'SEC' },
        { external_id: '239', name: 'Baylor Bears', abbreviation: 'BAY', location: 'Waco', conference: 'Big 12' },
        { external_id: '2', name: 'Auburn Tigers', abbreviation: 'AUB', location: 'Auburn', conference: 'SEC' },
        { external_id: '2641', name: 'Texas Tech Red Raiders', abbreviation: 'TTU', location: 'Lubbock', conference: 'Big 12' },
        { external_id: '156', name: 'Creighton Bluejays', abbreviation: 'CREI', location: 'Omaha', conference: 'Big East' },
        { external_id: '269', name: 'Marquette Golden Eagles', abbreviation: 'MARQ', location: 'Milwaukee', conference: 'Big East' },
        { external_id: '356', name: 'Illinois Fighting Illini', abbreviation: 'ILL', location: 'Champaign', conference: 'Big Ten' },
        { external_id: '275', name: 'Wisconsin Badgers', abbreviation: 'WIS', location: 'Madison', conference: 'Big Ten' },
        { external_id: '2752', name: 'Xavier Musketeers', abbreviation: 'XAV', location: 'Cincinnati', conference: 'Big East' },
        { external_id: '252', name: 'BYU Cougars', abbreviation: 'BYU', location: 'Provo', conference: 'WCC' },
        { external_id: '2483', name: 'Oregon Ducks', abbreviation: 'ORE', location: 'Eugene', conference: 'Pac-12' },
        { external_id: '8', name: 'Arkansas Razorbacks', abbreviation: 'ARK', location: 'Fayetteville', conference: 'SEC' },
        { external_id: '235', name: 'Memphis Tigers', abbreviation: 'MEM', location: 'Memphis', conference: 'AAC' },
        { external_id: '145', name: 'Ole Miss Rebels', abbreviation: 'MISS', location: 'Oxford', conference: 'SEC' },
        { external_id: '228', name: 'Clemson Tigers', abbreviation: 'CLEM', location: 'Clemson', conference: 'ACC' },
        { external_id: '158', name: 'Nebraska Cornhuskers', abbreviation: 'NEB', location: 'Lincoln', conference: 'Big Ten' },
        { external_id: '2116', name: 'UCF Knights', abbreviation: 'UCF', location: 'Orlando', conference: 'AAC' },
        { external_id: '222', name: 'Villanova Wildcats', abbreviation: 'VILL', location: 'Villanova', conference: 'Big East' },
        { external_id: '2086', name: 'Butler Bulldogs', abbreviation: 'BUT', location: 'Indianapolis', conference: 'Big East' },
        { external_id: '2132', name: 'Cincinnati Bearcats', abbreviation: 'CIN', location: 'Cincinnati', conference: 'AAC' },
        { external_id: '30', name: 'USC Trojans', abbreviation: 'USC', location: 'Los Angeles', conference: 'Pac-12' },
        { external_id: '120', name: 'Maryland Terrapins', abbreviation: 'MD', location: 'College Park', conference: 'Big Ten' },
        { external_id: '197', name: 'Oklahoma State Cowboys', abbreviation: 'OKST', location: 'Stillwater', conference: 'Big 12' },
        { external_id: '2599', name: 'St. John\'s Red Storm', abbreviation: 'SJU', location: 'Queens', conference: 'Big East' },
        { external_id: '201', name: 'Oklahoma Sooners', abbreviation: 'OU', location: 'Norman', conference: 'Big 12' },
        { external_id: '9', name: 'Arizona State Sun Devils', abbreviation: 'ASU', location: 'Tempe', conference: 'Pac-12' },
        { external_id: '245', name: 'Texas A&M Aggies', abbreviation: 'TAMU', location: 'College Station', conference: 'SEC' },
        { external_id: '142', name: 'Missouri Tigers', abbreviation: 'MIZ', location: 'Columbia', conference: 'SEC' },
        { external_id: '300', name: 'UC Irvine Anteaters', abbreviation: 'UCI', location: 'Irvine', conference: 'Big West' },
        { external_id: '2350', name: 'Loyola Chicago Ramblers', abbreviation: 'LUC', location: 'Chicago', conference: 'A-10' },
        { external_id: '2168', name: 'Dayton Flyers', abbreviation: 'DAY', location: 'Dayton', conference: 'A-10' },
        { external_id: '254', name: 'Utah Utes', abbreviation: 'UTAH', location: 'Salt Lake City', conference: 'Pac-12' },
        { external_id: '328', name: 'Utah State Aggies', abbreviation: 'USU', location: 'Logan', conference: 'Mountain West' },
        { external_id: '305', name: 'DePaul Blue Demons', abbreviation: 'DEP', location: 'Chicago', conference: 'Big East' },
        { external_id: '236', name: 'Chattanooga Mocs', abbreviation: 'CHAT', location: 'Chattanooga', conference: 'Southern' },
        { external_id: '2608', name: 'Saint Mary\'s Gaels', abbreviation: 'SMC', location: 'Moraga', conference: 'WCC' },
        { external_id: '167', name: 'New Mexico Lobos', abbreviation: 'UNM', location: 'Albuquerque', conference: 'Mountain West' },
        { external_id: '5', name: 'UAB Blazers', abbreviation: 'UAB', location: 'Birmingham', conference: 'C-USA' },
        { external_id: '249', name: 'North Texas Mean Green', abbreviation: 'UNT', location: 'Denton', conference: 'C-USA' },
        { external_id: '2655', name: 'Tulane Green Wave', abbreviation: 'TUL', location: 'New Orleans', conference: 'AAC' },
        { external_id: '265', name: 'Washington State Cougars', abbreviation: 'WSU', location: 'Pullman', conference: 'Pac-12' },
        { external_id: '204', name: 'Oregon State Beavers', abbreviation: 'ORST', location: 'Corvallis', conference: 'Pac-12' },
        { external_id: '344', name: 'Mississippi State Bulldogs', abbreviation: 'MSST', location: 'Starkville', conference: 'SEC' },
        { external_id: '2287', name: 'Illinois State Redbirds', abbreviation: 'ILST', location: 'Normal', conference: 'MVC' },
        { external_id: '2181', name: 'Drake Bulldogs', abbreviation: 'DRAK', location: 'Des Moines', conference: 'MVC' },
        { external_id: '325', name: 'Cleveland State Vikings', abbreviation: 'CLEV', location: 'Cleveland', conference: 'Horizon' },
        { external_id: '526', name: 'Florida Gulf Coast Eagles', abbreviation: 'FGCU', location: 'Fort Myers', conference: 'ASUN' },
    ];
    
    // Add all teams
    const teamsToAdd = ncaaBasketballTeams.map(team => ({
        ...team,
        sport: 'Basketball',
        league: 'NCAA'
    }));
    
    console.log(`Adding ${teamsToAdd.length} NCAA Basketball teams...`);
    
    // Insert in batches
    const BATCH_SIZE = 20;
    let inserted = 0;
    
    for (let i = 0; i < teamsToAdd.length; i += BATCH_SIZE) {
        const batch = teamsToAdd.slice(i, i + BATCH_SIZE);
        
        try {
            const { data, error } = await supabase
                .from('teams')
                .upsert(batch, {
                    onConflict: 'external_id',
                    ignoreDuplicates: true
                })
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
        
        console.log(`Progress: ${Math.min(i + BATCH_SIZE, teamsToAdd.length)}/${teamsToAdd.length} teams`);
    }
    
    console.log(`\n✅ Successfully added/updated ${inserted} NCAA teams!`);
    
    // Verify
    const { count } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('league', 'NCAA');
        
    console.log(`\nTotal NCAA teams in database: ${count}`);
}

addAllNCAATeams();
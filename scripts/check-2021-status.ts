import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkGames() {
  // First check a sample game to see structure
  const { data: sample, error: sampleError } = await supabase
    .from('games')
    .select('*')
    .limit(1);
    
  if (sample && sample[0]) {
    console.log('Sample game:', sample[0]);
    console.log('Available columns:', Object.keys(sample[0]));
  }
  
  // Get all games to analyze
  const { data, error } = await supabase
    .from('games')
    .select('sport, external_id, metadata')
    .limit(50000);  // Get all games
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  // Filter 2021 season games by checking metadata.season or external_id
  const season2021Games = data.filter((game: any) => {
    // Check metadata season first
    if (game.metadata?.season === 2021) return true;
    
    // Check external_id patterns
    const externalId = String(game.external_id || '');
    if (externalId.includes('_2021')) return true; // NFL format
    if (externalId.includes('_401358')) return true; // NBA 2021-22 IDs
    if (externalId.includes('_401354')) return true; // MLB 2021
    if (externalId.includes('_401349')) return true; // NHL 2021-22
    
    return false;
  });
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  const sportCounts: Record<string, number> = {};
  season2021Games.forEach((game: any) => {
    sportCounts[game.sport] = (sportCounts[game.sport] || 0) + 1;
  });
  
  console.log('2021 Season Games by Sport:');
  Object.entries(sportCounts).forEach(([sport, count]) => {
    console.log(`${sport}: ${count} games`);
  });
  
  console.log('\nTotal 2021 season games:', season2021Games.length);
  console.log('Total games in database:', data.length);
  
  const allSports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB'];
  const missingSports = allSports.filter(sport => {
    return !sportCounts[sport] || sportCounts[sport] === 0;
  });
  
  if (missingSports.length > 0) {
    console.log('\nSports missing 2021 data:', missingSports.join(', '));
  }
}

checkGames();
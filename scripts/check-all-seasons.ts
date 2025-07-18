import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSeasons() {
  const { data, error } = await supabase
    .from('games')
    .select('sport, metadata, external_id')
    .limit(50000);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  const seasonsBySport: Record<string, Set<number>> = {};
  
  data.forEach((game: any) => {
    const sport = game.sport;
    const season = game.metadata?.season;
    
    if (sport && season) {
      if (!seasonsBySport[sport]) {
        seasonsBySport[sport] = new Set();
      }
      seasonsBySport[sport].add(season);
    }
  });
  
  console.log('Seasons available by sport:');
  Object.entries(seasonsBySport).forEach(([sport, seasons]) => {
    const seasonList = Array.from(seasons).sort();
    console.log(`\n${sport}: ${seasonList.join(', ')}`);
  });
  
  console.log('\nTotal games:', data.length);
  
  // Count games by year
  const gamesByYear: Record<number, number> = {};
  data.forEach((game: any) => {
    const season = game.metadata?.season;
    if (season) {
      gamesByYear[season] = (gamesByYear[season] || 0) + 1;
    }
  });
  
  console.log('\nGames by season:');
  Object.entries(gamesByYear).sort().forEach(([year, count]) => {
    console.log(`${year}: ${count} games`);
  });
}

checkSeasons();
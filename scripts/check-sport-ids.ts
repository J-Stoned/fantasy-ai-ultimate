import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkSportIds() {
  // Check games table sport_id values
  const { data: games } = await supabase
    .from('games')
    .select('sport_id')
    .not('sport_id', 'is', null)
    .limit(1000);

  const sportCounts: Record<string, number> = {};
  games?.forEach(g => {
    if (g.sport_id) {
      sportCounts[g.sport_id] = (sportCounts[g.sport_id] || 0) + 1;
    }
  });

  console.log('Sport IDs in games table:');
  console.log('=========================');
  Object.entries(sportCounts).forEach(([sport, count]) => {
    console.log(`${sport}: ${count} games`);
  });

  // Check team names
  const { data: teamGames } = await supabase
    .from('games')
    .select('home_team, away_team, sport_id')
    .not('home_team', 'is', null)
    .limit(10);

  console.log('\nSample games with team names:');
  teamGames?.forEach(g => {
    console.log(`- ${g.home_team} vs ${g.away_team} (${g.sport_id})`);
  });
}

checkSportIds();
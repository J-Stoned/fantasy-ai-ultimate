import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeAndFixNFLSportField() {
  console.log('🔧 Analyzing games with sport_id vs sport field...\n');

  // 1. Check games with sport_id = 'nfl' but sport is NULL
  const { data: nflGamesWithNull, count: nullCount } = await supabase
    .from('games')
    .select('*', { count: 'exact' })
    .eq('sport_id', 'nfl')
    .is('sport', null)
    .limit(10);

  console.log(`Games with sport_id='nfl' but sport=NULL: ${nullCount || 0}`);
  
  if (nflGamesWithNull && nflGamesWithNull.length > 0) {
    console.log('\nSample games:');
    nflGamesWithNull.forEach(game => {
      console.log(`  - ${game.start_time}: Teams ${game.home_team_id} vs ${game.away_team_id}`);
      console.log(`    Score: ${game.home_score} - ${game.away_score}`);
    });
  }

  // 2. Check all distinct sport_id values
  const { data: sportIds } = await supabase
    .from('games')
    .select('sport_id')
    .not('sport_id', 'is', null);

  if (sportIds) {
    const uniqueSportIds = [...new Set(sportIds.map(g => g.sport_id))];
    console.log('\n\nDistinct sport_id values:', uniqueSportIds);
  }

  // 3. Count games by sport_id
  const sportIdCounts: Record<string, number> = {};
  if (sportIds) {
    sportIds.forEach(game => {
      sportIdCounts[game.sport_id] = (sportIdCounts[game.sport_id] || 0) + 1;
    });
    console.log('\nGames by sport_id:');
    Object.entries(sportIdCounts).forEach(([id, count]) => {
      console.log(`  - ${id}: ${count}`);
    });
  }

  // 4. Fix the issue - update sport field based on sport_id
  console.log('\n\n🔧 Fixing sport field based on sport_id...');
  
  const sportsMap: Record<string, string> = {
    'nfl': 'NFL',
    'nba': 'NBA',
    'mlb': 'MLB',
    'nhl': 'NHL',
    'ncaa': 'NCAA'
  };

  for (const [sportId, sportName] of Object.entries(sportsMap)) {
    const { data, error, count } = await supabase
      .from('games')
      .update({ sport: sportName })
      .eq('sport_id', sportId)
      .is('sport', null)
      .select('id', { count: 'exact' });

    if (error) {
      console.error(`Error updating ${sportId}:`, error);
    } else {
      console.log(`Updated ${count || 0} ${sportName} games`);
    }
  }

  // 5. Verify the fix
  console.log('\n\n✅ Verifying the fix...');
  
  const { count: fixedNFL } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL');

  const { count: withScores } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL')
    .not('home_score', 'is', null);

  console.log(`Total NFL games (after fix): ${fixedNFL || 0}`);
  console.log(`NFL games with scores: ${withScores || 0}`);

  // 6. Check stats coverage again
  const { data: nflGamesWithScores } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'NFL')
    .not('home_score', 'is', null)
    .limit(10);

  if (nflGamesWithScores && nflGamesWithScores.length > 0) {
    const gameIds = nflGamesWithScores.map(g => g.id);
    const { count: statsCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .in('game_id', gameIds);

    console.log(`\nStats found for sample NFL games: ${statsCount || 0}`);
  }
}

analyzeAndFixNFLSportField().catch(console.error);
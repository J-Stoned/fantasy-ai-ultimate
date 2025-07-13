import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNFLGamesStatus() {
  console.log('🏈 Checking NFL games status...\n');

  // 1. Count all NFL games
  const { count: totalNFL } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL');

  console.log(`Total NFL games: ${totalNFL || 0}`);

  // 2. Count NFL games with scores
  const { count: withScores } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL')
    .not('home_score', 'is', null);

  console.log(`NFL games with scores: ${withScores || 0}`);

  // 3. Get sample of NFL games
  const { data: nflGames } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NFL')
    .order('game_date', { ascending: false })
    .limit(10);

  if (nflGames && nflGames.length > 0) {
    console.log('\nSample NFL games:');
    nflGames.forEach(game => {
      console.log(`  - ${game.game_date}: ${game.home_team} vs ${game.away_team}`);
      console.log(`    Scores: ${game.home_score || 'null'} - ${game.away_score || 'null'}`);
      console.log(`    ID: ${game.id}, Season: ${game.season}`);
    });
  }

  // 4. Check if the collector might have inserted games without sport
  const { data: recentGames } = await supabase
    .from('games')
    .select('*')
    .is('sport', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (recentGames && recentGames.length > 0) {
    console.log('\n\nFound games with NULL sport:');
    recentGames.forEach(game => {
      console.log(`  - ${game.game_date}: ${game.home_team} vs ${game.away_team}`);
      console.log(`    Scores: ${game.home_score || 'null'} - ${game.away_score || 'null'}`);
    });
  }

  // 5. Check the specific game referenced in stats
  const gameId = 3184045; // From the stats we saw
  const { data: specificGame } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (specificGame) {
    console.log('\n\nGame 3184045 details:');
    console.log(JSON.stringify(specificGame, null, 2));
  }

  // 6. Count games by sport
  const { data: sportCounts } = await supabase
    .from('games')
    .select('sport');

  if (sportCounts) {
    const counts: Record<string, number> = {};
    sportCounts.forEach(game => {
      const sport = game.sport || 'NULL';
      counts[sport] = (counts[sport] || 0) + 1;
    });
    
    console.log('\n\nGames by sport:');
    Object.entries(counts).forEach(([sport, count]) => {
      console.log(`  - ${sport}: ${count}`);
    });
  }

  // 7. Check if player_game_logs has NFL data
  const { data: nflLogSample } = await supabase
    .from('player_game_logs')
    .select('*')
    .limit(5);

  if (nflLogSample && nflLogSample.length > 0) {
    console.log('\n\nChecking player_game_logs for NFL indicators:');
    nflLogSample.forEach(log => {
      const stats = log.stats || {};
      const isNFL = 'passingYards' in stats || 'rushingYards' in stats || 'receivingYards' in stats;
      console.log(`  - Game ${log.game_id}: ${isNFL ? 'Looks like NFL' : 'Not NFL'} (has: ${Object.keys(stats).slice(0, 3).join(', ')})`);
    });
  }
}

checkNFLGamesStatus().catch(console.error);
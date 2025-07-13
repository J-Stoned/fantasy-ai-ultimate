import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugUpdateIssue() {
  console.log('🔍 Debugging update issue...\n');

  // 1. Check current state
  const { data: sample } = await supabase
    .from('games')
    .select('id, sport, sport_id')
    .or('sport_id.eq.nfl,sport.eq.NFL')
    .limit(10);

  console.log('Sample of games:');
  if (sample) {
    sample.forEach(game => {
      console.log(`  - ID: ${game.id}, sport: "${game.sport}", sport_id: "${game.sport_id}"`);
    });
  }

  // 2. Count by combinations
  const { data: allGames } = await supabase
    .from('games')
    .select('sport, sport_id')
    .limit(2000);

  if (allGames) {
    const combinations: Record<string, number> = {};
    allGames.forEach(game => {
      const key = `sport="${game.sport || 'null'}" sport_id="${game.sport_id || 'null'}"`;
      combinations[key] = (combinations[key] || 0) + 1;
    });

    console.log('\n\nCombinations of sport and sport_id:');
    Object.entries(combinations)
      .sort((a, b) => b[1] - a[1])
      .forEach(([combo, count]) => {
        console.log(`  - ${combo}: ${count} games`);
      });
  }

  // 3. It seems the update might have already happened, let's verify coverage now
  console.log('\n\n📊 Checking stats coverage after fix...');
  
  const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
  
  for (const sport of sports) {
    // Count games with scores
    const { count: gamesWithScores } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .not('home_score', 'is', null);

    // Get sample of game IDs
    const { data: sampleGames } = await supabase
      .from('games')
      .select('id')
      .eq('sport', sport)
      .not('home_score', 'is', null)
      .limit(100);

    let statsCount = 0;
    if (sampleGames && sampleGames.length > 0) {
      const gameIds = sampleGames.map(g => g.id);
      const { count } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .in('game_id', gameIds);
      statsCount = count || 0;
    }

    console.log(`\n${sport}:`);
    console.log(`  - Games with scores: ${gamesWithScores || 0}`);
    console.log(`  - Sample games checked: ${sampleGames?.length || 0}`);
    console.log(`  - Stats found: ${statsCount}`);
    console.log(`  - Coverage: ${sampleGames?.length ? (statsCount > 0 ? 'YES' : 'NO') : 'N/A'}`);
  }
}

debugUpdateIssue().catch(console.error);
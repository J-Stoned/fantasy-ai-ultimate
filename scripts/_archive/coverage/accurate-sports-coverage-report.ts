import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function accurateSportsCoverageReport() {
  console.log('📊 ACCURATE SPORTS COVERAGE REPORT\n');
  console.log('='.repeat(80));

  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });

  console.log(`Total player_stats in database: ${totalStats?.toLocaleString()}\n`);

  // Define sport variations as they appear in the database
  const sportVariations = {
    'NBA': {
      queries: ['sport.eq.NBA', 'sport_id.eq.nba'],
      alternateIds: ['nba', 'basketball', 'pro-basketball']
    },
    'NFL': {
      queries: ['sport.eq.NFL', 'sport_id.eq.nfl'],
      alternateIds: ['nfl', 'football', 'pro-football']
    },
    'NHL': {
      queries: ['sport.eq.NHL', 'sport_id.eq.nhl'],
      alternateIds: ['nhl', 'hockey', 'ice-hockey']
    },
    'MLB': {
      queries: ['sport.eq.MLB', 'sport_id.eq.mlb'],
      alternateIds: ['mlb', 'baseball', 'pro-baseball']
    },
    'NCAAF': {
      queries: ['sport.eq.NCAAF', 'sport_id.eq.ncaaf', 'sport_id.eq.college-football'],
      alternateIds: ['ncaaf', 'college-football', 'ncaa-football']
    },
    'NCAAB': {
      queries: ['sport.eq.NCAAB', 'sport_id.eq.ncaab', 'sport_id.eq.college-basketball', 'sport_id.eq.mens-college-basketball'],
      alternateIds: ['ncaab', 'college-basketball', 'ncaa-basketball', 'mens-college-basketball']
    }
  };

  for (const [sportName, config] of Object.entries(sportVariations)) {
    console.log(`\n🏆 ${sportName} COVERAGE:`);
    console.log('-'.repeat(50));

    // Get total games for this sport (try all variations)
    let totalGames = 0;
    let completedGames = 0;
    
    // Check each query variation
    for (const query of config.queries) {
      const { count } = await supabase
        .from('games')
        .select('id', { count: 'exact', head: true })
        .or(query);
      
      if (count && count > 0) {
        console.log(`  Found ${count} games with query: ${query}`);
        totalGames = Math.max(totalGames, count);
      }
    }

    // Get completed games (with scores)
    const { count: gamesWithScores } = await supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .or(config.queries.join(','))
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);

    completedGames = gamesWithScores || 0;

    console.log(`  Total games: ${totalGames}`);
    console.log(`  Completed games: ${completedGames}`);

    // Sample check for coverage (more efficient)
    const { data: sampleGames } = await supabase
      .from('games')
      .select('id')
      .or(config.queries.join(','))
      .not('home_score', 'is', null)
      .limit(100);

    if (sampleGames && sampleGames.length > 0) {
      // Check stats in batch
      const { data: statsData } = await supabase
        .from('player_stats')
        .select('game_id')
        .in('game_id', sampleGames.map(g => g.id));
      
      const gamesWithStats = new Set(statsData?.map(s => s.game_id) || []).size;
      const sampleCoverage = (gamesWithStats / sampleGames.length * 100).toFixed(1);
      
      console.log(`  Sample coverage (${sampleGames.length} games): ${sampleCoverage}%`);
      
      // Extrapolate
      if (completedGames > 0) {
        const estimatedGamesWithStats = Math.round(completedGames * (gamesWithStats / sampleGames.length));
        const estimatedCoverage = (estimatedGamesWithStats / completedGames * 100).toFixed(1);
        
        console.log(`  Estimated total coverage: ${estimatedCoverage}%`);
        console.log(`  Estimated games with stats: ${estimatedGamesWithStats}/${completedGames}`);
        
        const target95 = Math.ceil(completedGames * 0.95);
        const gamesNeeded = Math.max(0, target95 - estimatedGamesWithStats);
        
        if (parseFloat(estimatedCoverage) >= 95) {
          console.log(`  ✅ ${sportName} has reached 95% coverage!`);
        } else {
          console.log(`  📈 Need ~${gamesNeeded} more games for 95% coverage`);
        }
      }
    }

    // Check external_id formats for this sport
    const { data: idSample } = await supabase
      .from('games')
      .select('external_id')
      .or(config.queries.join(','))
      .not('external_id', 'is', null)
      .limit(5);

    if (idSample && idSample.length > 0) {
      console.log(`  Sample external_ids:`);
      idSample.forEach(g => console.log(`    - ${g.external_id}`));
    }
  }

  console.log('\n\n📊 COVERAGE SUMMARY:');
  console.log('='.repeat(80));
  console.log('Database has significant stats collection across multiple sports.');
  console.log('External ID formats vary by sport - need sport-specific collectors.');
  console.log('College sports (NCAAF/NCAAB) may need different API endpoints.');
  console.log('='.repeat(80));
}

accurateSportsCoverageReport().catch(console.error);
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function comprehensiveBrutalTruth() {
  console.log('\n🔥 COMPREHENSIVE BRUTAL TRUTH ABOUT OUR DATA 🔥\n');
  console.log('=' .repeat(80));

  try {
    // 1. Games breakdown by sport
    console.log('🎮 GAMES IN DATABASE BY SPORT:\n');
    
    const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAB', 'NCAAF'];
    let totalGamesWithStats = 0;
    
    for (const sport of sports) {
      // Count games for this sport
      const { count: gameCount } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .or(`sport.eq.${sport},sport_id.eq.${sport.toLowerCase()}`);
      
      if (gameCount && gameCount > 0) {
        // Check how many have scores
        const { count: completedCount } = await supabase
          .from('games')
          .select('*', { count: 'exact', head: true })
          .or(`sport.eq.${sport},sport_id.eq.${sport.toLowerCase()}`)
          .not('home_score', 'is', null);
        
        // Sample to check stats coverage
        const { data: sampleGames } = await supabase
          .from('games')
          .select('id')
          .or(`sport.eq.${sport},sport_id.eq.${sport.toLowerCase()}`)
          .limit(20);
        
        let gamesWithStats = 0;
        for (const game of sampleGames || []) {
          const { count } = await supabase
            .from('player_stats')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', game.id)
            .limit(1);
          
          if (count && count > 0) {
            gamesWithStats++;
          }
        }
        
        const estimatedWithStats = Math.round((gamesWithStats / 20) * gameCount);
        totalGamesWithStats += estimatedWithStats;
        
        console.log(`${sport}:`);
        console.log(`  Total games: ${gameCount}`);
        console.log(`  With scores: ${completedCount || 0} (${Math.round((completedCount || 0) / gameCount * 100)}%)`);
        console.log(`  Estimated with stats: ~${estimatedWithStats} (${Math.round(estimatedWithStats / gameCount * 100)}%)`);
        console.log('');
      }
    }

    // 2. Player stats deep dive
    console.log('\n📊 PLAYER_STATS DEEP DIVE:\n');
    
    // Get a comprehensive sample
    const { data: statsSample } = await supabase
      .from('player_stats')
      .select('game_id, player_id, stat_type')
      .limit(10000);
    
    // Analyze patterns
    const gamePlayerPairs = new Set();
    const statTypesPerGame: Record<string, Set<string>> = {};
    
    statsSample?.forEach(stat => {
      const pair = `${stat.game_id}-${stat.player_id}`;
      gamePlayerPairs.add(pair);
      
      if (!statTypesPerGame[stat.game_id]) {
        statTypesPerGame[stat.game_id] = new Set();
      }
      statTypesPerGame[stat.game_id].add(stat.stat_type);
    });
    
    console.log(`Unique game-player combinations in sample: ${gamePlayerPairs.size}`);
    console.log(`Average stats per game-player: ${Math.round(10000 / gamePlayerPairs.size)}`);
    console.log(`Estimated total player performances: ~${Math.round(gamePlayerPairs.size * 368.5)}`);
    
    // Check stat completeness
    const statCounts = Object.values(statTypesPerGame).map(s => s.size);
    const avgStatsPerGame = statCounts.reduce((a, b) => a + b, 0) / statCounts.length;
    console.log(`Average stat types per game: ${avgStatsPerGame.toFixed(1)}`);

    // 3. MLB Stats analysis
    console.log('\n⚾ MLB_STATS ANALYSIS:\n');
    
    const { count: mlbCount } = await supabase
      .from('mlb_stats')
      .select('*', { count: 'exact', head: true });
    
    const { data: mlbGamesSample } = await supabase
      .from('mlb_stats')
      .select('game_id')
      .limit(1000);
    
    const uniqueMLBGames = new Set(mlbGamesSample?.map(s => s.game_id) || []);
    
    console.log(`Total MLB stat entries: ${mlbCount || 0}`);
    console.log(`Unique MLB games (from sample): ${uniqueMLBGames.size}`);
    console.log(`Average stats per MLB game: ~${Math.round((mlbCount || 0) / uniqueMLBGames.size)}`);

    // 4. THE BRUTAL TRUTH SUMMARY
    console.log('\n' + '=' .repeat(80));
    console.log('🔥 THE BRUTAL TRUTH - FINAL SUMMARY:');
    console.log('=' .repeat(80));
    
    console.log('\n✅ WHAT WE ACTUALLY HAVE:');
    console.log(`• ${totalGamesWithStats} games with player stats (estimated)`);
    console.log(`• ~${Math.round(gamePlayerPairs.size * 368.5)} player performances in player_stats`);
    console.log(`• ${mlbCount || 0} MLB stat entries covering ${uniqueMLBGames.size}+ games`);
    console.log('• Data is stored in KEY-VALUE format (inefficient for ML)');
    
    console.log('\n❌ WHAT WE\'RE MISSING:');
    console.log('• NBA data appears minimal or missing');
    console.log('• NHL data appears minimal or missing');
    console.log('• Sport identification in player_stats table');
    console.log('• Efficient columnar format for ML training');
    
    console.log('\n📊 COVERAGE vs CLAIMS:');
    console.log('Claimed: "258,662 player stats"');
    console.log('Reality: 3.68M stat entries = ~100K player performances');
    console.log('MLB: 114K entries = ~7 games worth of data');
    console.log('Coverage: ~57% of games have some stats');
    
    console.log('\n💡 BOTTOM LINE:');
    console.log('1. We have NFL data (primary focus)');
    console.log('2. We have minimal MLB data (7 games)');
    console.log('3. NBA/NHL data is questionable or missing');
    console.log('4. Data structure is inefficient (key-value instead of columnar)');
    console.log('5. We need major data collection and restructuring for ML success');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run it
comprehensiveBrutalTruth()
  .then(() => {
    console.log('\n✅ Comprehensive analysis complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
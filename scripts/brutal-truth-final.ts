import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getBrutalTruth() {
  console.log('\n🔥 FANTASY AI DATABASE - THE BRUTAL TRUTH 🔥\n');
  console.log('=' .repeat(80));

  try {
    // 1. Player Stats Analysis (Key-Value Structure)
    console.log('\n📊 PLAYER_STATS ANALYSIS (Key-Value Structure):');
    
    // Get unique games with stats
    const { data: uniqueGames } = await supabase
      .from('player_stats')
      .select('game_id')
      .limit(50000); // Sample to avoid timeout
    
    const uniqueGameIds = new Set(uniqueGames?.map(s => s.game_id) || []);
    console.log(`Estimated unique games with player_stats: ~${uniqueGameIds.size * (3684677 / 50000)}`);

    // Get unique players
    const { data: uniquePlayers } = await supabase
      .from('player_stats')
      .select('player_id')
      .limit(50000);
    
    const uniquePlayerIds = new Set(uniquePlayers?.map(s => s.player_id) || []);
    console.log(`Estimated unique players with stats: ~${uniquePlayerIds.size * (3684677 / 50000)}`);

    // Get stat types distribution
    const { data: statTypes } = await supabase
      .from('player_stats')
      .select('stat_type')
      .limit(10000);
    
    const statTypeCounts: Record<string, number> = {};
    statTypes?.forEach(s => {
      statTypeCounts[s.stat_type] = (statTypeCounts[s.stat_type] || 0) + 1;
    });
    
    console.log('\nTop stat types collected:');
    Object.entries(statTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count} (estimated total: ~${count * 368})`);
      });

    // 2. MLB Stats Analysis
    console.log('\n⚾ MLB_STATS ANALYSIS:');
    
    // Get unique MLB games
    const { data: mlbGames } = await supabase
      .from('mlb_stats')
      .select('game_id')
      .limit(10000);
    
    const uniqueMLBGames = new Set(mlbGames?.map(s => s.game_id) || []);
    console.log(`Unique MLB games with stats: ${uniqueMLBGames.size}`);

    // Get unique MLB players
    const { data: mlbPlayers } = await supabase
      .from('mlb_stats')
      .select('mlb_player_id')
      .limit(10000);
    
    const uniqueMLBPlayers = new Set(mlbPlayers?.map(s => s.mlb_player_id) || []);
    console.log(`Unique MLB players with stats: ${uniqueMLBPlayers.size}`);

    // 3. Games Coverage by Sport
    console.log('\n🎮 GAMES BY SPORT:');
    const { data: gamesBySport } = await supabase
      .from('games')
      .select('sport, sport_id')
      .limit(10000);
    
    const sportCounts: Record<string, number> = {};
    gamesBySport?.forEach(game => {
      const sport = game.sport || game.sport_id || 'Unknown';
      sportCounts[sport] = (sportCounts[sport] || 0) + 1;
    });
    
    Object.entries(sportCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([sport, count]) => {
        const estimated = Math.round(count * 3.06); // 30597 / 10000
        console.log(`  ${sport}: ~${estimated} games`);
      });

    // 4. Check which games have stats
    console.log('\n📈 STATS COVERAGE CHECK:');
    
    // Sample games to check coverage
    const { data: sampleGames } = await supabase
      .from('games')
      .select('id')
      .limit(100);
    
    let gamesWithStats = 0;
    for (const game of sampleGames || []) {
      const { count } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (count && count > 0) {
        gamesWithStats++;
      }
    }
    
    console.log(`Sample coverage: ${gamesWithStats}/100 games have player_stats`);
    console.log(`Estimated total coverage: ~${Math.round(gamesWithStats * 306)} games with stats`);

    // 5. Data Quality Check
    console.log('\n🔍 DATA QUALITY CHECK:');
    
    // Check for actual numeric values
    const { data: sampleStats } = await supabase
      .from('player_stats')
      .select('stat_type, stat_value')
      .limit(100);
    
    let numericCount = 0;
    let nonNumericCount = 0;
    
    sampleStats?.forEach(stat => {
      if (!isNaN(Number(stat.stat_value))) {
        numericCount++;
      } else {
        nonNumericCount++;
      }
    });
    
    console.log(`Numeric stat values: ${numericCount}/100`);
    console.log(`Non-numeric stat values: ${nonNumericCount}/100`);

    // 6. THE BRUTAL TRUTH SUMMARY
    console.log('\n' + '=' .repeat(80));
    console.log('🔥 THE BRUTAL TRUTH - WHAT WE REALLY HAVE:');
    console.log('=' .repeat(80));
    
    console.log('\n✅ WHAT\'S REAL:');
    console.log('• 3.68 MILLION player_stats records (key-value pairs)');
    console.log('• 114K MLB stats records (separate table)');
    console.log('• 30K games in database');
    console.log('• 94% of games have scores (completed)');
    console.log('• Data exists but in KEY-VALUE format (stat_type, stat_value)');
    
    console.log('\n❌ THE PROBLEMS:');
    console.log('• Player stats are in KEY-VALUE format, not columnar');
    console.log('• Each stat (points, rebounds, etc.) is a separate row');
    console.log('• 3.68M records might only represent ~100K actual game performances');
    console.log('• No sport field in player_stats - can\'t distinguish NBA/NFL/NHL');
    console.log('• MLB is isolated in its own table');
    
    console.log('\n📊 ESTIMATED REAL COVERAGE:');
    const avgStatsPerPlayer = 37; // Rough estimate
    const estimatedGamePerformances = 3684677 / avgStatsPerPlayer;
    console.log(`• ~${Math.round(estimatedGamePerformances)} actual player game performances`);
    console.log(`• ~${Math.round(gamesWithStats * 306)} games with stats`);
    console.log(`• Coverage: ~${Math.round((gamesWithStats * 306) / 30597 * 100)}% of games have stats`);
    
    console.log('\n💡 BOTTOM LINE:');
    console.log('We have data, but it\'s poorly organized. The 3.68M records are');
    console.log('individual stat entries (points, rebounds, etc.), not player performances.');
    console.log('We need to restructure this data for ML training!');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run it
getBrutalTruth()
  .then(() => {
    console.log('\n✅ Analysis complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
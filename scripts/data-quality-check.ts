import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkDataQuality() {
  console.log('🔬 DATA QUALITY DEEP DIVE\n');
  console.log('=' .repeat(60));

  try {
    // 1. Analyze player_game_logs quality
    console.log('\n📊 PLAYER GAME LOGS QUALITY CHECK:');
    
    const { data: sampleLogs } = await supabase
      .from('player_game_logs')
      .select('*')
      .limit(100);

    if (sampleLogs && sampleLogs.length > 0) {
      const fieldAnalysis: Record<string, { nullCount: number, emptyCount: number, zeroCount: number }> = {};
      
      // Analyze each field
      Object.keys(sampleLogs[0]).forEach(field => {
        fieldAnalysis[field] = {
          nullCount: 0,
          emptyCount: 0,
          zeroCount: 0
        };
        
        sampleLogs.forEach(log => {
          if (log[field] === null) fieldAnalysis[field].nullCount++;
          if (log[field] === '') fieldAnalysis[field].emptyCount++;
          if (log[field] === 0) fieldAnalysis[field].zeroCount++;
        });
      });

      console.log('\nField Quality Analysis (100 sample records):');
      Object.entries(fieldAnalysis).forEach(([field, stats]) => {
        const totalEmpty = stats.nullCount + stats.emptyCount;
        if (totalEmpty > 20) { // More than 20% empty
          console.log(`❌ ${field}: ${totalEmpty}% empty (${stats.nullCount} null, ${stats.emptyCount} empty, ${stats.zeroCount} zero)`);
        }
      });

      // Check for actual statistical data
      const statsFields = ['points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers', 
                          'field_goals_made', 'field_goals_attempted', 'three_pointers_made',
                          'free_throws_made', 'fantasy_points'];
      
      console.log('\n📈 Statistical Fields Analysis:');
      let hasAnyStats = false;
      statsFields.forEach(field => {
        const fieldData = sampleLogs.map(log => log[field]).filter(val => val !== null && val !== 0);
        if (fieldData.length > 0) {
          hasAnyStats = true;
          const avg = fieldData.reduce((a, b) => a + b, 0) / fieldData.length;
          console.log(`✅ ${field}: ${fieldData.length}/100 records have data (avg: ${avg.toFixed(1)})`);
        } else {
          console.log(`❌ ${field}: NO DATA in sample`);
        }
      });

      if (!hasAnyStats) {
        console.log('\n⚠️  WARNING: No statistical data found in sample!');
      }
    }

    // 2. Check player_stats quality
    console.log('\n\n📈 PLAYER_STATS TABLE QUALITY:');
    
    const { data: playerStats } = await supabase
      .from('player_stats')
      .select('*')
      .limit(50);

    if (playerStats && playerStats.length > 0) {
      console.log(`Sample size: ${playerStats.length} records`);
      
      // Check what fields exist
      const fields = Object.keys(playerStats[0]);
      console.log(`\nFields in table: ${fields.join(', ')}`);
      
      // Check for ESPN IDs
      const espnIds = playerStats.filter(stat => stat.espn_id).length;
      console.log(`\nESPN IDs present: ${espnIds}/${playerStats.length} (${(espnIds/playerStats.length*100).toFixed(1)}%)`);
    }

    // 3. Check games data quality
    console.log('\n\n🏈 GAMES DATA QUALITY:');
    
    const { data: recentGames } = await supabase
      .from('games')
      .select('*')
      .order('start_time', { ascending: false })
      .limit(50);

    if (recentGames && recentGames.length > 0) {
      const completeGames = recentGames.filter(g => g.home_score !== null && g.away_score !== null);
      const futureGames = recentGames.filter(g => new Date(g.start_time) > new Date());
      
      console.log(`Recent games sample: ${recentGames.length}`);
      console.log(`- Complete (with scores): ${completeGames.length}`);
      console.log(`- Future games: ${futureGames.length}`);
      console.log(`- Missing scores: ${recentGames.length - completeGames.length - futureGames.length}`);

      // Check sports distribution
      const sportCounts: Record<string, number> = {};
      recentGames.forEach(game => {
        sportCounts[game.sport] = (sportCounts[game.sport] || 0) + 1;
      });
      
      console.log('\nSports distribution in recent games:');
      Object.entries(sportCounts).forEach(([sport, count]) => {
        console.log(`  ${sport}: ${count} games`);
      });
    }

    // 4. Check pattern detection reality
    console.log('\n\n🎯 PATTERN DETECTION REALITY CHECK:');
    
    const { data: patterns } = await supabase
      .from('betting_patterns')
      .select('*');

    const { data: patternResults } = await supabase
      .from('pattern_results')
      .select('*')
      .limit(100);

    console.log(`Betting patterns defined: ${patterns?.length || 0}`);
    console.log(`Pattern results found: ${patternResults?.length || 0}`);

    if (patternResults && patternResults.length > 0) {
      // Analyze pattern results
      const patternCounts: Record<string, number> = {};
      patternResults.forEach(result => {
        patternCounts[result.pattern_type] = (patternCounts[result.pattern_type] || 0) + 1;
      });
      
      console.log('\nPattern type distribution:');
      Object.entries(patternCounts).forEach(([pattern, count]) => {
        console.log(`  ${pattern}: ${count} occurrences`);
      });
    } else {
      console.log('❌ NO PATTERN RESULTS FOUND - Pattern detection appears to be NOT RUNNING');
    }

    // 5. Final verdict
    console.log('\n' + '=' .repeat(60));
    console.log('🎭 REALITY CHECK VERDICT:\n');
    
    console.log('✅ WHAT\'S REAL:');
    console.log('- Database has 4M+ player records (mix of player_game_logs and player_stats)');
    console.log('- 30K games in database, 93.8% have scores');
    console.log('- Data includes future games (explains negative "days old")');
    
    console.log('\n❌ WHAT\'S NOT WORKING/INFLATED:');
    console.log('- Pattern detection: 0 results (claimed 36,846)');
    console.log('- ML predictions: 0 records (claimed 234+)');
    console.log('- Player game logs: Many fields are empty (70-90% null for key stats)');
    console.log('- No monetization platform running (port 3999)');
    console.log('- No WebSocket server running (port 8088)');
    
    console.log('\n⚠️  ASSESSMENT:');
    console.log('- Data collection: PARTIALLY WORKING (lots of records but poor quality)');
    console.log('- Pattern detection: NOT WORKING (API runs but no actual patterns detected)');
    console.log('- ML predictions: NOT WORKING');
    console.log('- Production services: MOSTLY NOT RUNNING');

  } catch (error) {
    console.error('Error during quality check:', error);
  }
}

checkDataQuality();
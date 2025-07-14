import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigate3PercentIssue() {
  console.log('🔍 INVESTIGATING THE 3% USABILITY ISSUE\n');
  console.log('='.repeat(80));

  try {
    // 1. PLAYER_STATS TABLE ANALYSIS
    console.log('\n📊 PLAYER_STATS TABLE ANALYSIS:');
    
    const { count: totalPlayerStats } = await supabase
      .from('player_stats')
      .select('id', { count: 'exact', head: true });
    
    console.log(`Total records: ${totalPlayerStats?.toLocaleString()}`);
    
    // Check the structure of player_stats
    const { data: statsSample } = await supabase
      .from('player_stats')
      .select('*')
      .limit(100);
    
    if (statsSample && statsSample.length > 0) {
      console.log(`\nTable structure: ${Object.keys(statsSample[0]).join(', ')}`);
      
      // Analyze how data is stored
      const statTypes = new Map<string, number>();
      let recordsWithValue = 0;
      let recordsWithFantasyPoints = 0;
      
      statsSample.forEach(stat => {
        statTypes.set(stat.stat_type, (statTypes.get(stat.stat_type) || 0) + 1);
        if (stat.stat_value !== null && stat.stat_value !== 0) recordsWithValue++;
        if (stat.fantasy_points !== null && stat.fantasy_points !== 0) recordsWithFantasyPoints++;
      });
      
      console.log(`\nStat types in sample:`);
      Array.from(statTypes.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([type, count]) => {
          console.log(`  - ${type}: ${count} records`);
        });
      
      console.log(`\nData completeness in sample:`);
      console.log(`  - Records with stat_value: ${recordsWithValue}/${statsSample.length} (${(recordsWithValue/statsSample.length*100).toFixed(1)}%)`);
      console.log(`  - Records with fantasy_points: ${recordsWithFantasyPoints}/${statsSample.length} (${(recordsWithFantasyPoints/statsSample.length*100).toFixed(1)}%)`);
    }
    
    // 2. PLAYER_GAME_LOGS TABLE ANALYSIS
    console.log('\n\n📊 PLAYER_GAME_LOGS TABLE ANALYSIS:');
    
    const { count: totalGameLogs } = await supabase
      .from('player_game_logs')
      .select('id', { count: 'exact', head: true });
    
    console.log(`Total records: ${totalGameLogs?.toLocaleString()}`);
    
    // Check what's actually in game logs
    const { data: logsSample } = await supabase
      .from('player_game_logs')
      .select('*')
      .limit(100);
    
    if (logsSample && logsSample.length > 0) {
      console.log(`\nTable structure: ${Object.keys(logsSample[0]).join(', ')}`);
      
      // Check for actual stats in game logs
      const statsFields = ['points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers',
                          'field_goals_made', 'field_goals_attempted', 'three_pointers_made',
                          'free_throws_made', 'free_throws_attempted', 'minutes_played'];
      
      console.log('\nStats fields completeness:');
      statsFields.forEach(field => {
        if (field in logsSample[0]) {
          const withData = logsSample.filter(log => log[field] !== null && log[field] !== 0).length;
          console.log(`  - ${field}: ${withData}/${logsSample.length} records (${(withData/logsSample.length*100).toFixed(1)}%)`);
        } else {
          console.log(`  - ${field}: FIELD NOT FOUND`);
        }
      });
    }
    
    // 3. CHECK DATA LINKAGE
    console.log('\n\n🔗 DATA LINKAGE ANALYSIS:');
    
    // Check if game logs have proper game_id references
    const { data: recentLogs } = await supabase
      .from('player_game_logs')
      .select('game_id, player_id')
      .not('game_id', 'is', null)
      .limit(100);
    
    if (recentLogs && recentLogs.length > 0) {
      const gameIds = [...new Set(recentLogs.map(log => log.game_id))];
      
      // Check if these games exist
      const { count: validGames } = await supabase
        .from('games')
        .select('id', { count: 'exact', head: true })
        .in('id', gameIds);
      
      console.log(`Game linkage: ${validGames}/${gameIds.length} game references are valid`);
    }
    
    // 4. INVESTIGATE THE 3% CLAIM
    console.log('\n\n🎯 INVESTIGATING THE 3% CLAIM:');
    
    // Theory 1: Only 3% of records have complete data
    const { data: completeDataSample } = await supabase
      .from('player_game_logs')
      .select('*')
      .not('points', 'is', null)
      .not('rebounds', 'is', null)
      .not('assists', 'is', null)
      .not('minutes_played', 'is', null)
      .limit(100);
    
    console.log(`\nTheory 1 - Complete records:`);
    console.log(`  Records with all basic stats: ${completeDataSample?.length || 0}/100`);
    
    // Theory 2: Only 3% of games have associated stats
    const { data: sampleGames } = await supabase
      .from('games')
      .select('id')
      .limit(100);
    
    if (sampleGames) {
      let gamesWithStats = 0;
      let gamesWithLogs = 0;
      
      for (const game of sampleGames) {
        const { count: statsCount } = await supabase
          .from('player_stats')
          .select('id', { count: 'exact', head: true })
          .eq('game_id', game.id);
        
        const { count: logsCount } = await supabase
          .from('player_game_logs')
          .select('id', { count: 'exact', head: true })
          .eq('game_id', game.id);
        
        if (statsCount && statsCount > 0) gamesWithStats++;
        if (logsCount && logsCount > 0) gamesWithLogs++;
      }
      
      console.log(`\nTheory 2 - Games with data:`);
      console.log(`  Games with player_stats: ${gamesWithStats}/100 (${gamesWithStats}%)`);
      console.log(`  Games with player_game_logs: ${gamesWithLogs}/100 (${gamesWithLogs}%)`);
    }
    
    // 5. FINAL DIAGNOSIS
    console.log('\n\n' + '='.repeat(80));
    console.log('📋 DIAGNOSIS OF THE 3% ISSUE:\n');
    
    console.log('The "3% usability" likely refers to one of these issues:');
    console.log('1. Only 3% of player_game_logs have complete statistical data');
    console.log('2. Only 3% of games have associated player statistics');
    console.log('3. The player_stats table uses a key-value structure (stat_type/stat_value)');
    console.log('   which makes it harder to use for traditional analysis');
    console.log('4. Data collection may have failed for 97% of attempted records');
    console.log('\nThe root cause appears to be incomplete data collection or parsing failures.');
    
  } catch (error) {
    console.error('Error during investigation:', error);
  }
}

investigate3PercentIssue().catch(console.error);
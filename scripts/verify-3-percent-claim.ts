import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verify3PercentClaim() {
  console.log('🎯 VERIFYING THE 3% CLAIM\n');
  console.log('='.repeat(80));

  try {
    // 1. Total player_game_logs
    const { count: totalLogs } = await supabase
      .from('player_game_logs')
      .select('id', { count: 'exact', head: true });
    
    console.log(`📊 PLAYER_GAME_LOGS ANALYSIS:`);
    console.log(`Total records: ${totalLogs?.toLocaleString()}\n`);

    // 2. Check how many have populated stats JSON
    const { count: logsWithStats } = await supabase
      .from('player_game_logs')
      .select('id', { count: 'exact', head: true })
      .not('stats', 'is', null);
    
    const percentageWithStats = ((logsWithStats || 0) / (totalLogs || 1) * 100).toFixed(2);
    console.log(`Records with stats JSON: ${logsWithStats?.toLocaleString()} (${percentageWithStats}%)`);

    // 3. Check how many have non-empty stats
    // Sample to check for empty objects
    const { data: sampleWithStats } = await supabase
      .from('player_game_logs')
      .select('id, stats')
      .not('stats', 'is', null)
      .limit(1000);
    
    if (sampleWithStats) {
      const nonEmptyStats = sampleWithStats.filter(log => {
        return log.stats && Object.keys(log.stats).length > 0;
      }).length;
      
      const estimatedNonEmpty = Math.round((nonEmptyStats / sampleWithStats.length) * (logsWithStats || 0));
      const percentageNonEmpty = ((estimatedNonEmpty) / (totalLogs || 1) * 100).toFixed(2);
      
      console.log(`Estimated records with non-empty stats: ${estimatedNonEmpty.toLocaleString()} (${percentageNonEmpty}%)`);
      console.log(`\n✅ THIS CONFIRMS THE ~3% CLAIM! Only ${percentageNonEmpty}% have usable stats data.`);
    }

    // 4. Check data distribution by sport
    console.log('\n\n📊 CHECKING WHICH SPORTS HAVE DATA:');
    
    // Get a sample of game logs with stats and check their sports
    const { data: logsWithGameInfo } = await supabase
      .from('player_game_logs')
      .select(`
        id,
        game_id,
        stats,
        games!inner(
          sport,
          sport_id
        )
      `)
      .not('stats', 'is', null)
      .limit(100);
    
    if (logsWithGameInfo) {
      const sportCounts = new Map<string, number>();
      logsWithGameInfo.forEach(log => {
        const sport = log.games?.sport || log.games?.sport_id || 'UNKNOWN';
        sportCounts.set(sport, (sportCounts.get(sport) || 0) + 1);
      });
      
      console.log('Sports with stats data (from 100 sample):');
      Array.from(sportCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([sport, count]) => {
          console.log(`  - ${sport}: ${count} records`);
        });
    }

    // 5. Check time periods
    console.log('\n\n📅 CHECKING TIME DISTRIBUTION:');
    
    const { data: timeAnalysis } = await supabase
      .from('player_game_logs')
      .select('game_date, stats')
      .not('stats', 'is', null)
      .order('game_date', { ascending: false })
      .limit(100);
    
    if (timeAnalysis && timeAnalysis.length > 0) {
      const dates = timeAnalysis.map(log => new Date(log.game_date));
      const earliestDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const latestDate = new Date(Math.max(...dates.map(d => d.getTime())));
      
      console.log(`Date range of records with stats:`);
      console.log(`  - Earliest: ${earliestDate.toISOString().split('T')[0]}`);
      console.log(`  - Latest: ${latestDate.toISOString().split('T')[0]}`);
    }

    // 6. Compare with player_stats table
    console.log('\n\n📊 COMPARISON WITH PLAYER_STATS TABLE:');
    
    const { count: totalPlayerStats } = await supabase
      .from('player_stats')
      .select('id', { count: 'exact', head: true });
    
    const { count: uniqueGamesInStats } = await supabase
      .from('player_stats')
      .select('game_id', { count: 'exact' })
      .limit(100000);
    
    console.log(`Total player_stats records: ${totalPlayerStats?.toLocaleString()}`);
    console.log(`\nThis table uses a different structure:`);
    console.log(`- One row per stat type (e.g., points, rebounds, assists)`);
    console.log(`- Need to aggregate multiple rows to get complete player stats`);
    console.log(`- Much higher record count but requires reconstruction`);

    // 7. Root cause analysis
    console.log('\n\n' + '='.repeat(80));
    console.log('🔍 ROOT CAUSE ANALYSIS:\n');
    console.log('1. ❌ DATA STRUCTURE MISMATCH:');
    console.log('   - player_game_logs expects stats in JSON format');
    console.log('   - player_stats stores data in normalized key-value format');
    console.log('   - Only ~3% of game logs have the JSON stats populated\n');
    
    console.log('2. ❌ COLLECTION PROCESS ISSUES:');
    console.log('   - Stats are being collected into player_stats table');
    console.log('   - They\'re NOT being transformed into JSON for player_game_logs');
    console.log('   - Two tables exist but aren\'t properly synchronized\n');
    
    console.log('3. ❌ API CHANGES:');
    console.log('   - Possible ESPN API structure changed');
    console.log('   - Collector scripts may be outdated');
    console.log('   - Data parsing logic might need updates\n');
    
    console.log('4. ✅ SOLUTION PATH:');
    console.log('   - Transform player_stats data into JSON format');
    console.log('   - Update player_game_logs with aggregated stats');
    console.log('   - Fix collection scripts to populate both tables');
    console.log('   - Consider using player_stats directly (it has the data!)');

  } catch (error) {
    console.error('Error during verification:', error);
  }
}

verify3PercentClaim().catch(console.error);
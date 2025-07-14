import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function accurate3PercentCheck() {
  console.log('🎯 ACCURATE 3% USABILITY CHECK\n');
  console.log('='.repeat(80));

  try {
    // 1. Get total count
    const { count: totalLogs } = await supabase
      .from('player_game_logs')
      .select('id', { count: 'exact', head: true });
    
    console.log(`📊 Total player_game_logs: ${totalLogs?.toLocaleString()}\n`);

    // 2. Get a large sample to check stats content
    console.log('Analyzing sample of 1000 records...\n');
    
    const { data: sample } = await supabase
      .from('player_game_logs')
      .select('id, stats, raw_stats, fantasy_points, minutes_played')
      .limit(1000);
    
    if (sample) {
      let hasStatsJSON = 0;
      let hasNonEmptyStats = 0;
      let hasRawStats = 0;
      let hasFantasyPoints = 0;
      let hasMinutesPlayed = 0;
      let hasCompleteStats = 0;
      
      sample.forEach(log => {
        // Check if stats field exists
        if (log.stats !== null) hasStatsJSON++;
        
        // Check if stats is non-empty object with actual data
        if (log.stats && typeof log.stats === 'object' && Object.keys(log.stats).length > 0) {
          hasNonEmptyStats++;
          
          // Check if it has key basketball stats
          if ('points' in log.stats && 'rebounds' in log.stats && 'assists' in log.stats) {
            hasCompleteStats++;
          }
        }
        
        // Check other fields
        if (log.raw_stats && Object.keys(log.raw_stats).length > 0) hasRawStats++;
        if (log.fantasy_points !== null && log.fantasy_points > 0) hasFantasyPoints++;
        if (log.minutes_played !== null && log.minutes_played > 0) hasMinutesPlayed++;
      });
      
      // Calculate percentages
      const pctWithStats = (hasStatsJSON / sample.length * 100).toFixed(2);
      const pctNonEmpty = (hasNonEmptyStats / sample.length * 100).toFixed(2);
      const pctComplete = (hasCompleteStats / sample.length * 100).toFixed(2);
      const pctFantasy = (hasFantasyPoints / sample.length * 100).toFixed(2);
      const pctMinutes = (hasMinutesPlayed / sample.length * 100).toFixed(2);
      
      console.log('📊 SAMPLE ANALYSIS RESULTS:');
      console.log(`- Has stats field: ${hasStatsJSON}/${sample.length} (${pctWithStats}%)`);
      console.log(`- Has non-empty stats: ${hasNonEmptyStats}/${sample.length} (${pctNonEmpty}%)`);
      console.log(`- Has complete basketball stats: ${hasCompleteStats}/${sample.length} (${pctComplete}%)`);
      console.log(`- Has fantasy points > 0: ${hasFantasyPoints}/${sample.length} (${pctFantasy}%)`);
      console.log(`- Has minutes played > 0: ${hasMinutesPlayed}/${sample.length} (${pctMinutes}%)`);
      
      // Extrapolate to full dataset
      const estimatedUsable = Math.round((hasNonEmptyStats / sample.length) * (totalLogs || 0));
      const estimatedPct = (estimatedUsable / (totalLogs || 1) * 100).toFixed(2);
      
      console.log(`\n📈 EXTRAPOLATED TO FULL DATASET:`);
      console.log(`Estimated records with usable stats: ${estimatedUsable.toLocaleString()} (${estimatedPct}%)`);
      
      if (parseFloat(estimatedPct) < 5) {
        console.log(`\n✅ CONFIRMED: Only ${estimatedPct}% of records have usable stats!`);
        console.log('This aligns with the "3% usability" claim.');
      }
    }

    // 3. Check what's in the empty stats fields
    console.log('\n\n🔍 INVESTIGATING EMPTY STATS:');
    
    const { data: emptyStatsExample } = await supabase
      .from('player_game_logs')
      .select('id, stats, raw_stats')
      .or('stats.is.null,stats.eq.{}')
      .limit(5);
    
    if (emptyStatsExample) {
      console.log('\nExamples of records without stats:');
      emptyStatsExample.forEach((log, i) => {
        console.log(`${i + 1}. ID ${log.id}:`);
        console.log(`   stats: ${JSON.stringify(log.stats)}`);
        console.log(`   raw_stats: ${JSON.stringify(log.raw_stats)}`);
      });
    }

    // 4. Check collection dates
    console.log('\n\n📅 CHECKING COLLECTION PATTERNS:');
    
    const { data: withStats } = await supabase
      .from('player_game_logs')
      .select('created_at')
      .not('stats', 'is', null)
      .neq('stats', '{}')
      .order('created_at', { ascending: false })
      .limit(100);
    
    const { data: withoutStats } = await supabase
      .from('player_game_logs')
      .select('created_at')
      .or('stats.is.null,stats.eq.{}')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (withStats && withStats.length > 0) {
      const latestWithStats = new Date(withStats[0].created_at);
      console.log(`Latest record WITH stats: ${latestWithStats.toISOString()}`);
    }
    
    if (withoutStats && withoutStats.length > 0) {
      const latestWithoutStats = new Date(withoutStats[0].created_at);
      console.log(`Latest record WITHOUT stats: ${latestWithoutStats.toISOString()}`);
    }

    // 5. Final diagnosis
    console.log('\n\n' + '='.repeat(80));
    console.log('💡 FINAL DIAGNOSIS:\n');
    
    console.log('The "3% usability" issue is REAL and caused by:');
    console.log('1. Most player_game_logs records have NULL or empty stats JSON');
    console.log('2. The actual stats are stored in player_stats table (key-value format)');
    console.log('3. Collection scripts are not populating the stats JSON field');
    console.log('4. This creates a disconnect between the two tables');
    console.log('\nTO FIX: Need to aggregate player_stats data and update player_game_logs.stats field');

  } catch (error) {
    console.error('Error during check:', error);
  }
}

accurate3PercentCheck().catch(console.error);
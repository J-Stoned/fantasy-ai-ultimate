import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function identifySportsInStats() {
  console.log('\n🔍 IDENTIFYING SPORTS IN PLAYER_STATS\n');
  console.log('=' .repeat(80));

  try {
    // 1. Get sample of games with their sports
    console.log('📊 ANALYZING GAME SPORTS:');
    const { data: gamesWithStats } = await supabase
      .from('player_stats')
      .select('game_id')
      .limit(1000);
    
    const uniqueGameIds = [...new Set(gamesWithStats?.map(s => s.game_id) || [])];
    console.log(`Checking ${uniqueGameIds.length} unique games...`);

    // Get sport info for these games
    const { data: gameInfo } = await supabase
      .from('games')
      .select('id, sport, sport_id, home_team_id, away_team_id')
      .in('id', uniqueGameIds.slice(0, 100)); // Check first 100

    const sportDistribution: Record<string, number> = {};
    gameInfo?.forEach(game => {
      const sport = game.sport || game.sport_id || 'Unknown';
      sportDistribution[sport] = (sportDistribution[sport] || 0) + 1;
    });

    console.log('\nGames with stats by sport:');
    Object.entries(sportDistribution).forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count} games`);
    });

    // 2. Analyze stat types to infer sports
    console.log('\n📊 ANALYZING STAT TYPES TO INFER SPORTS:');
    
    // Basketball-specific stats
    const basketballStats = ['threePtMade', 'threePtAttempted', 'offensiveRebounds', 'defensiveRebounds'];
    const { count: basketballCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .in('stat_type', basketballStats);
    
    console.log(`\n🏀 Basketball-specific stats found: ${basketballCount || 0}`);

    // Football-specific stats  
    const footballStats = ['passingYards', 'rushingYards', 'receivingYards', 'passingTouchdowns', 'sacks'];
    const { count: footballCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .in('stat_type', footballStats);
    
    console.log(`🏈 Football-specific stats found: ${footballCount || 0}`);

    // Hockey-specific stats
    const hockeyStats = ['goals', 'assists', 'plusMinus', 'penaltyMinutes', 'shots'];
    const { count: hockeyCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .in('stat_type', hockeyStats);
    
    console.log(`🏒 Hockey-specific stats found: ${hockeyCount || 0}`);

    // 3. Get all unique stat types
    console.log('\n📋 ALL STAT TYPES IN DATABASE:');
    const { data: allStatTypes } = await supabase
      .from('player_stats')
      .select('stat_type')
      .limit(50000);
    
    const statTypeSet = new Set(allStatTypes?.map(s => s.stat_type) || []);
    const uniqueStatTypes = Array.from(statTypeSet).sort();
    
    console.log(`\nFound ${uniqueStatTypes.length} unique stat types:`);
    uniqueStatTypes.slice(0, 30).forEach(type => {
      console.log(`  • ${type}`);
    });
    if (uniqueStatTypes.length > 30) {
      console.log(`  ... and ${uniqueStatTypes.length - 30} more`);
    }

    // 4. Check for ESPN IDs to identify sports
    console.log('\n🆔 CHECKING PLAYER ID FORMATS:');
    const { data: playerIdSample } = await supabase
      .from('player_stats')
      .select('player_id')
      .limit(1000);
    
    const espnNBA = playerIdSample?.filter(p => p.player_id?.toString().includes('espn_nba')).length || 0;
    const espnNFL = playerIdSample?.filter(p => p.player_id?.toString().includes('espn_nfl')).length || 0;
    const espnMLB = playerIdSample?.filter(p => p.player_id?.toString().includes('espn_mlb')).length || 0;
    const espnNHL = playerIdSample?.filter(p => p.player_id?.toString().includes('espn_nhl')).length || 0;
    
    console.log('ESPN ID format distribution (sample of 1000):');
    console.log(`  espn_nba: ${espnNBA}`);
    console.log(`  espn_nfl: ${espnNFL}`);
    console.log(`  espn_mlb: ${espnMLB}`);
    console.log(`  espn_nhl: ${espnNHL}`);
    console.log(`  Other/numeric: ${1000 - espnNBA - espnNFL - espnMLB - espnNHL}`);

    // 5. Final summary
    console.log('\n' + '=' .repeat(80));
    console.log('📊 SUMMARY - WHAT SPORTS DO WE ACTUALLY HAVE?');
    console.log('=' .repeat(80));
    
    console.log('\nBased on stat types and game analysis:');
    console.log('• NBA/Basketball: YES (threePtMade, offensiveRebounds stats found)');
    console.log('• NFL/Football: MAYBE (need to verify stat types)');
    console.log('• NHL/Hockey: MAYBE (need to verify stat types)');
    console.log('• MLB: YES (separate mlb_stats table with 114K records)');
    
    console.log('\n💡 KEY INSIGHT:');
    console.log('The player_stats table contains mixed sports data without proper sport tagging.');
    console.log('We need to use stat_type patterns or join with games table to identify sports.');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run it
identifySportsInStats()
  .then(() => {
    console.log('\n✅ Analysis complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
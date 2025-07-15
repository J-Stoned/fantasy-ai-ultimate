import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// The brutal truth about our database
async function brutalDatabaseAudit() {
  console.log('\n🔍 BRUTAL DATABASE AUDIT - THE REAL TRUTH\n');
  console.log('=' .repeat(80));

  try {
    // 1. MLB Stats Reality Check
    console.log('\n📊 MLB STATS TABLE:');
    const { data: mlbStats, count: mlbCount } = await supabase
      .from('mlb_stats')
      .select('*', { count: 'exact', head: true });
    
    const { data: mlbSample } = await supabase
      .from('mlb_stats')
      .select('*')
      .limit(5);
    
    console.log(`Total MLB stats records: ${mlbCount || 0}`);
    if (mlbCount && mlbCount > 0) {
      // Get unique games and players
      const { data: uniqueGames } = await supabase
        .from('mlb_stats')
        .select('game_id')
        .limit(1000);
      
      const uniqueGameIds = new Set(uniqueGames?.map(g => g.game_id) || []);
      console.log(`Unique MLB games with stats: ~${uniqueGameIds.size}`);
      
      // Check date range
      const { data: dateRange } = await supabase
        .from('mlb_stats')
        .select('created_at')
        .order('created_at', { ascending: true })
        .limit(1);
      
      const { data: latestDate } = await supabase
        .from('mlb_stats')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);
        
      console.log(`Date range: ${dateRange?.[0]?.created_at || 'N/A'} to ${latestDate?.[0]?.created_at || 'N/A'}`);
    }

    // 2. NBA Stats Reality Check  
    console.log('\n🏀 NBA PLAYER_STATS:');
    const { data: nbaStats, count: nbaCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NBA');
    
    console.log(`Total NBA player_stats records: ${nbaCount || 0}`);
    
    if (nbaCount && nbaCount > 0) {
      // Get unique NBA games
      const { data: nbaGames } = await supabase
        .from('player_stats')
        .select('game_id')
        .eq('sport', 'NBA')
        .limit(5000);
      
      const uniqueNBAGames = new Set(nbaGames?.map(g => g.game_id) || []);
      console.log(`Unique NBA games with stats: ~${uniqueNBAGames.size}`);
    }

    // 3. NFL Stats Reality Check
    console.log('\n🏈 NFL PLAYER_STATS:');
    const { data: nflStats, count: nflCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NFL');
    
    console.log(`Total NFL player_stats records: ${nflCount || 0}`);
    
    if (nflCount && nflCount > 0) {
      // Get unique NFL games
      const { data: nflGames } = await supabase
        .from('player_stats')
        .select('game_id')
        .eq('sport', 'NFL')
        .limit(5000);
      
      const uniqueNFLGames = new Set(nflGames?.map(g => g.game_id) || []);
      console.log(`Unique NFL games with stats: ~${uniqueNFLGames.size}`);
    }

    // 4. Total player_stats breakdown
    console.log('\n📊 TOTAL PLAYER_STATS BREAKDOWN:');
    const { data: totalStats, count: totalCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Total player_stats records: ${totalCount || 0}`);
    
    // Get sport breakdown
    const { data: sportBreakdown } = await supabase.rpc('get_sport_stats_count');
    console.log('\nBreakdown by sport:');
    if (sportBreakdown) {
      sportBreakdown.forEach((sport: any) => {
        console.log(`  ${sport.sport || 'Unknown'}: ${sport.count} records`);
      });
    }

    // 5. Games coverage analysis
    console.log('\n🎮 GAMES COVERAGE ANALYSIS:');
    const { data: totalGames, count: gamesCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Total games in database: ${gamesCount || 0}`);
    
    // Games with scores (completed)
    const { data: completedGames, count: completedCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);
    
    console.log(`Games with scores (completed): ${completedCount || 0}`);
    console.log(`Coverage: ${gamesCount ? ((completedCount || 0) / gamesCount * 100).toFixed(1) : 0}%`);

    // 6. Check which games have stats
    console.log('\n📈 GAMES WITH STATS COVERAGE:');
    
    // Get sample of games with stats
    const { data: gamesWithStats } = await supabase.rpc('count_games_with_stats');
    if (gamesWithStats) {
      console.log(`Games that have player stats: ${gamesWithStats}`);
      console.log(`Stats coverage: ${gamesCount ? (gamesWithStats / gamesCount * 100).toFixed(1) : 0}%`);
    }

    // 7. Data freshness check
    console.log('\n🕐 DATA FRESHNESS:');
    const { data: latestStats } = await supabase
      .from('player_stats')
      .select('created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (latestStats && latestStats.length > 0) {
      console.log(`Latest stat entry: ${latestStats[0].created_at}`);
      console.log(`Last update: ${latestStats[0].updated_at || 'Never updated'}`);
    }

    // 8. ESPN ID standardization check
    console.log('\n🆔 ESPN ID STANDARDIZATION:');
    const { data: espnStats } = await supabase
      .from('player_stats')
      .select('player_id')
      .like('player_id', 'espn_%')
      .limit(1000);
    
    const { data: legacyStats } = await supabase
      .from('player_stats')
      .select('player_id')
      .not('player_id', 'like', 'espn_%')
      .not('player_id', 'like', 'player_%')
      .limit(1000);
    
    console.log(`ESPN standardized IDs: ~${espnStats?.length || 0}+ records`);
    console.log(`Legacy format IDs: ~${legacyStats?.length || 0}+ records`);

    // 9. The brutal truth summary
    console.log('\n' + '=' .repeat(80));
    console.log('🔥 THE BRUTAL TRUTH:');
    console.log('=' .repeat(80));
    
    const hasMLBData = (mlbCount || 0) > 0;
    const hasNBAData = (nbaCount || 0) > 0;
    const hasNFLData = (nflCount || 0) > 0;
    const totalPlayerStats = totalCount || 0;
    const gamesCoverage = gamesCount ? ((completedCount || 0) / gamesCount * 100) : 0;
    
    console.log(`\n1. MLB DATA: ${hasMLBData ? `YES - ${mlbCount} records` : 'NO DATA'}`);
    console.log(`2. NBA DATA: ${hasNBAData ? `YES - ${nbaCount} records` : 'NO DATA'}`);
    console.log(`3. NFL DATA: ${hasNFLData ? `YES - ${nflCount} records` : 'NO DATA'}`);
    console.log(`4. TOTAL PLAYER STATS: ${totalPlayerStats} records`);
    console.log(`5. GAMES COVERAGE: ${gamesCoverage.toFixed(1)}% of ${gamesCount} games have scores`);
    
    if (totalPlayerStats < 50000) {
      console.log('\n⚠️  WARNING: Very limited player stats data!');
    }
    if (gamesCoverage < 50) {
      console.log('⚠️  WARNING: Less than half of games have been processed!');
    }
    
    // 10. Compare to claims
    console.log('\n📊 CLAIMS vs REALITY:');
    console.log('Claimed: 258,662 player stats');
    console.log(`Reality: ${totalPlayerStats} player stats`);
    console.log(`Difference: ${258662 - totalPlayerStats} (${((totalPlayerStats / 258662) * 100).toFixed(1)}% of claimed)`);

  } catch (error) {
    console.error('Error during audit:', error);
  }
}

// Add RPC function creation if needed
async function createRPCFunctions() {
  // Create function to count games with stats
  const createGameStatsCount = `
    CREATE OR REPLACE FUNCTION count_games_with_stats()
    RETURNS INTEGER AS $$
    BEGIN
      RETURN (
        SELECT COUNT(DISTINCT g.id)
        FROM games g
        WHERE EXISTS (
          SELECT 1 FROM player_stats ps WHERE ps.game_id = g.id
        )
      );
    END;
    $$ LANGUAGE plpgsql;
  `;

  // Create function for sport breakdown
  const createSportBreakdown = `
    CREATE OR REPLACE FUNCTION get_sport_stats_count()
    RETURNS TABLE(sport TEXT, count BIGINT) AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        ps.sport,
        COUNT(*)::BIGINT
      FROM player_stats ps
      GROUP BY ps.sport
      ORDER BY COUNT(*) DESC;
    END;
    $$ LANGUAGE plpgsql;
  `;

  console.log('Creating RPC functions if they don\'t exist...');
}

// Run the audit
brutalDatabaseAudit()
  .then(() => {
    console.log('\n✅ Audit complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
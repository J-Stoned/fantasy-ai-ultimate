import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeNFLStatsCoverage() {
  console.log('🏈 Analyzing NFL Stats Coverage...\n');

  try {
    // 1. Count total NFL games
    const { data: nflGames, error: gamesError } = await supabase
      .from('games')
      .select('id, game_date, home_team_id, away_team_id, status, home_score, away_score')
      .eq('sport', 'NFL');

    if (gamesError) throw gamesError;

    console.log(`📊 Total NFL games in database: ${nflGames?.length || 0}`);

    // 2. Count completed NFL games (with scores)
    const completedGames = nflGames?.filter(g => 
      g.status === 'Final' && 
      g.home_score !== null && 
      g.away_score !== null
    ) || [];

    console.log(`✅ Completed NFL games with scores: ${completedGames.length}`);

    // 3. Count total player_stats records
    const { count: totalStatsCount, error: totalStatsError } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });

    if (totalStatsError) throw totalStatsError;
    console.log(`\n📈 Total player_stats records (all sports): ${totalStatsCount}`);

    // 4. Count NFL player_stats records
    const { data: nflStats, count: nflStatsCount, error: nflStatsError } = await supabase
      .from('player_stats')
      .select('id, game_id, player_id', { count: 'exact' })
      .in('game_id', nflGames?.map(g => g.id) || []);

    if (nflStatsError) throw nflStatsError;
    console.log(`🏈 NFL player_stats records: ${nflStatsCount}`);

    // 5. Get unique games with stats
    const uniqueGamesWithStats = new Set(nflStats?.map(s => s.game_id) || []);
    console.log(`🎮 Unique NFL games with stats: ${uniqueGamesWithStats.size}`);

    // 6. Calculate coverage
    const coverage = completedGames.length > 0 
      ? (uniqueGamesWithStats.size / completedGames.length * 100).toFixed(2)
      : '0';
    console.log(`📊 NFL stats coverage: ${coverage}% (${uniqueGamesWithStats.size}/${completedGames.length} games)`);

    // 7. Sample some NFL stats to verify they're real
    console.log('\n🔍 Sample NFL stats (first 5):');
    const { data: sampleStats } = await supabase
      .from('player_stats')
      .select(`
        id,
        game_id,
        player_id,
        stats,
        players!inner(name, position),
        games!inner(game_date, sport)
      `)
      .in('game_id', Array.from(uniqueGamesWithStats).slice(0, 5))
      .limit(5);

    sampleStats?.forEach((stat, idx) => {
      console.log(`\n${idx + 1}. Player: ${stat.players?.name} (${stat.players?.position})`);
      console.log(`   Game: ${stat.games?.game_date} (${stat.games?.sport})`);
      console.log(`   Stats: ${JSON.stringify(stat.stats).slice(0, 100)}...`);
    });

    // 8. Check for recent stats collection
    console.log('\n📅 Checking recent NFL stats by date:');
    const { data: recentGames } = await supabase
      .from('games')
      .select('id, game_date, home_team_id, away_team_id')
      .eq('sport', 'NFL')
      .gte('game_date', '2023-09-01')
      .lte('game_date', '2024-02-28')
      .order('game_date', { ascending: false })
      .limit(10);

    for (const game of recentGames || []) {
      const { count } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);

      console.log(`   ${game.game_date}: ${count || 0} player stats`);
    }

    // 9. Check which sports the 47,257 stats belong to
    console.log('\n🏀 Analyzing stats by sport:');
    const { data: statsBySport } = await supabase
      .from('player_stats')
      .select(`
        id,
        games!inner(sport)
      `);

    const sportCounts: Record<string, number> = {};
    statsBySport?.forEach(stat => {
      const sport = stat.games?.sport || 'Unknown';
      sportCounts[sport] = (sportCounts[sport] || 0) + 1;
    });

    Object.entries(sportCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([sport, count]) => {
        console.log(`   ${sport}: ${count} stats`);
      });

    // 10. Find games without stats
    console.log('\n❌ NFL games without stats (sample):');
    const gamesWithoutStats = completedGames.filter(g => !uniqueGamesWithStats.has(g.id));
    gamesWithoutStats.slice(0, 5).forEach((game, idx) => {
      console.log(`   ${idx + 1}. Game ${game.id} on ${game.game_date}`);
    });

  } catch (error) {
    console.error('❌ Error analyzing NFL stats:', error);
  }
}

// Run the analysis
analyzeNFLStatsCoverage();
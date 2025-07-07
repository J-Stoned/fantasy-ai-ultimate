import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function investigatePlayerStats() {
  console.log('🔍 INVESTIGATING PLAYER STATS COVERAGE ISSUE\n');

  // 1. Check player_stats table structure
  console.log('1️⃣ Checking player_stats table structure...');
  const { data: statsSchema } = await supabase
    .from('player_stats')
    .select('*')
    .limit(1);
  
  if (statsSchema && statsSchema.length > 0) {
    console.log('Player stats columns:', Object.keys(statsSchema[0]));
  }

  // 2. Count total records in player_stats
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
  console.log(`\n📊 Total player_stats records: ${totalStats}`);

  // 3. Check unique games in player_stats
  const { data: uniqueGames } = await supabase
    .from('player_stats')
    .select('game_id')
    .not('game_id', 'is', null);
  
  const uniqueGameIds = new Set(uniqueGames?.map(g => g.game_id));
  console.log(`📊 Unique games with stats: ${uniqueGameIds.size}`);

  // 4. Count completed games (with scores)
  const { data: completedGames } = await supabase
    .from('games')
    .select('game_id, home_score, away_score, week, season')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);
  
  console.log(`\n📊 Total completed games: ${completedGames?.length}`);

  // 5. Check games without player stats
  const completedGameIds = new Set(completedGames?.map(g => g.game_id));
  const gamesWithoutStats = [...completedGameIds].filter(id => !uniqueGameIds.has(id));
  console.log(`📊 Games WITHOUT player stats: ${gamesWithoutStats.length}`);

  // 6. Sample some games with stats
  console.log('\n📋 Sample games WITH player stats:');
  const gamesWithStats = [...uniqueGameIds].slice(0, 5);
  for (const gameId of gamesWithStats) {
    const game = completedGames?.find(g => g.game_id === gameId);
    if (game) {
      console.log(`  - Game ${gameId}: Week ${game.week}, Season ${game.season}`);
    }
  }

  // 7. Sample some games without stats
  console.log('\n📋 Sample games WITHOUT player stats:');
  for (const gameId of gamesWithoutStats.slice(0, 5)) {
    const game = completedGames?.find(g => g.game_id === gameId);
    if (game) {
      console.log(`  - Game ${gameId}: Week ${game.week}, Season ${game.season}`);
    }
  }

  // 8. Check if there are any other stats tables
  console.log('\n🔍 Checking for other potential stats tables...');
  
  // Check box_scores table
  const { count: boxScoreCount } = await supabase
    .from('box_scores')
    .select('*', { count: 'exact', head: true });
  console.log(`📊 box_scores records: ${boxScoreCount}`);

  // Check team_stats table
  const { count: teamStatsCount } = await supabase
    .from('team_stats')
    .select('*', { count: 'exact', head: true });
  console.log(`📊 team_stats records: ${teamStatsCount}`);

  // 9. Analyze player_stats distribution by season
  console.log('\n📊 Player stats distribution by season:');
  const { data: seasonStats } = await supabase
    .from('player_stats')
    .select('game_id');
  
  if (seasonStats && completedGames) {
    const seasonCounts: Record<number, number> = {};
    for (const stat of seasonStats) {
      const game = completedGames.find(g => g.game_id === stat.game_id);
      if (game) {
        seasonCounts[game.season] = (seasonCounts[game.season] || 0) + 1;
      }
    }
    
    for (const [season, count] of Object.entries(seasonCounts)) {
      const gamesInSeason = completedGames.filter(g => g.season === parseInt(season)).length;
      const coverage = ((count / gamesInSeason) * 100).toFixed(1);
      console.log(`  Season ${season}: ${count} stats for ${gamesInSeason} games (${coverage}% coverage)`);
    }
  }

  // 10. Check data sources
  console.log('\n🔍 Checking potential data sources in player_stats...');
  const { data: sampleStats } = await supabase
    .from('player_stats')
    .select('*')
    .limit(5);
  
  if (sampleStats && sampleStats.length > 0) {
    // Check if there's a source or created_at field
    const firstStat = sampleStats[0];
    if ('source' in firstStat) {
      console.log('Data source field found:', firstStat.source);
    }
    if ('created_at' in firstStat) {
      console.log('Sample created_at:', firstStat.created_at);
    }
  }

  // 11. Check for API keys that might be used for stats
  console.log('\n🔑 Available API keys for stats collection:');
  if (process.env.BALLDONTLIE_API_KEY) console.log('  ✅ BallDontLie API key present');
  if (process.env.MYSPORTSFEEDS_API_KEY) console.log('  ✅ MySportsFeeds API key present');
  if (process.env.SPORTRADAR_API_KEY) console.log('  ✅ SportRadar API key present');
  if (process.env.THE_ODDS_API_KEY) console.log('  ✅ The Odds API key present');
  if (process.env.SPORTSDATA_IO_KEY) console.log('  ❌ SportsData.io key NOT present');
  if (process.env.API_FOOTBALL_KEY) console.log('  ❌ API-Football key NOT present');

  // 12. Summary
  console.log('\n📊 SUMMARY:');
  console.log(`  - Total player stats: ${totalStats}`);
  console.log(`  - Games with stats: ${uniqueGameIds.size}`);
  console.log(`  - Completed games: ${completedGames?.length}`);
  console.log(`  - Coverage: ${((uniqueGameIds.size / (completedGames?.length || 1)) * 100).toFixed(1)}%`);
  console.log(`  - Missing stats for: ${gamesWithoutStats.length} games`);
}

investigatePlayerStats().catch(console.error);
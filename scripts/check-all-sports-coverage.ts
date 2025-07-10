import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSportsCoverage() {
  console.log('🏆 Checking 2024 Stats Coverage for All Sports\n');
  
  const sports = ['nfl', 'nba', 'mlb', 'nhl'];
  const results: any[] = [];
  let totalGames = 0;
  let totalGamesWithStats = 0;

  for (const sport of sports) {
    console.log(`\n📊 Checking ${sport.toUpperCase()}...`);
    
    // Get all completed 2024 games for this sport
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, home_team_id, away_team_id, home_score, away_score, start_time')
      .eq('sport_id', sport)
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);

    if (gamesError) {
      console.error(`Error fetching ${sport} games:`, gamesError);
      continue;
    }

    console.log(`Found ${games?.length || 0} completed games in 2024`);

    if (!games || games.length === 0) {
      results.push({
        sport,
        totalGames: 0,
        gamesWithStats: 0,
        coverage: 0
      });
      continue;
    }

    // Check how many games have player stats
    let gamesWithStats = 0;
    
    // Batch check for efficiency
    const gameIds = games.map(g => g.id);
    const batchSize = 100;
    
    for (let i = 0; i < gameIds.length; i += batchSize) {
      const batch = gameIds.slice(i, i + batchSize);
      
      const { data: statsGames, error: statsError } = await supabase
        .from('player_game_logs')
        .select('game_id')
        .in('game_id', batch)
        .limit(1000);
      
      if (!statsError && statsGames) {
        const uniqueGameIds = new Set(statsGames.map(s => s.game_id));
        gamesWithStats += uniqueGameIds.size;
      }
    }

    const coverage = games.length > 0 ? (gamesWithStats / games.length * 100).toFixed(2) : '0.00';
    
    console.log(`Games with player stats: ${gamesWithStats}`);
    console.log(`Coverage: ${coverage}%`);

    results.push({
      sport,
      totalGames: games.length,
      gamesWithStats,
      coverage: parseFloat(coverage)
    });

    totalGames += games.length;
    totalGamesWithStats += gamesWithStats;
  }

  // Display summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 2024 STATS COVERAGE SUMMARY');
  console.log('='.repeat(60));
  
  console.log('\nBy Sport:');
  console.log('─'.repeat(50));
  console.log('Sport | Total Games | Games w/ Stats | Coverage');
  console.log('─'.repeat(50));
  
  for (const result of results) {
    console.log(
      `${result.sport.toUpperCase().padEnd(5)} | ` +
      `${result.totalGames.toString().padStart(11)} | ` +
      `${result.gamesWithStats.toString().padStart(14)} | ` +
      `${result.coverage.toFixed(2).padStart(7)}%`
    );
  }
  
  console.log('─'.repeat(50));
  const overallCoverage = totalGames > 0 ? (totalGamesWithStats / totalGames * 100).toFixed(2) : '0.00';
  console.log(
    `TOTAL | ${totalGames.toString().padStart(11)} | ` +
    `${totalGamesWithStats.toString().padStart(14)} | ` +
    `${overallCoverage.padStart(7)}%`
  );
  
  console.log('\n📈 Key Insights:');
  console.log(`- Total 2024 games analyzed: ${totalGames.toLocaleString()}`);
  console.log(`- Games with player stats: ${totalGamesWithStats.toLocaleString()}`);
  console.log(`- Overall coverage: ${overallCoverage}%`);
  console.log(`- Games missing stats: ${(totalGames - totalGamesWithStats).toLocaleString()}`);
  
  // Identify priority sports for stats collection
  const prioritySports = results
    .filter(r => r.totalGames > 0 && r.coverage < 50)
    .sort((a, b) => a.coverage - b.coverage);
  
  if (prioritySports.length > 0) {
    console.log('\n🎯 Priority sports for stats collection:');
    prioritySports.forEach(sport => {
      const missingGames = sport.totalGames - sport.gamesWithStats;
      console.log(`- ${sport.sport.toUpperCase()}: ${missingGames.toLocaleString()} games need stats (${sport.coverage}% coverage)`);
    });
  }

  // Check recent game coverage
  console.log('\n📅 Recent Games Coverage (last 30 days):');
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  for (const sport of sports) {
    const { data: recentGames, error } = await supabase
      .from('games')
      .select('id')
      .eq('sport_id', sport)
      .gte('start_time', thirtyDaysAgo.toISOString())
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);
    
    if (!error && recentGames && recentGames.length > 0) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .in('game_id', recentGames.map(g => g.id));
      
      const recentCoverage = count ? (count / recentGames.length).toFixed(2) : '0.00';
      console.log(`- ${sport.toUpperCase()}: ${recentGames.length} games, ${recentCoverage}% coverage`);
    }
  }
}

// Run the coverage check
checkSportsCoverage().catch(console.error);
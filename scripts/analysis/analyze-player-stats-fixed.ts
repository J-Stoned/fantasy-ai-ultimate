#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = 'process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function analyzePlayerStatsCoverage() {
  console.log('🔍 PLAYER STATS COVERAGE ANALYSIS\n');
  console.log('━'.repeat(50));
  
  try {
    // Get total completed games
    const { count: totalGames, error: gamesError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);
    
    if (gamesError) throw gamesError;
    
    // Get player_game_logs stats
    const { count: totalPlayerGameLogs, error: logsError } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    if (logsError) throw logsError;
    
    // Get unique games with player stats
    const { data: uniqueGames, error: uniqueError } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .not('game_id', 'is', null);
    
    if (uniqueError) throw uniqueError;
    
    const uniqueGameIds = new Set(uniqueGames?.map(g => g.game_id) || []);
    const gamesWithStats = uniqueGameIds.size;
    
    // Get player_stats count
    const { count: playerStatsCount, error: statsError } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    
    if (statsError) throw statsError;
    
    // Calculate coverage
    const coverage = totalGames ? (gamesWithStats / totalGames * 100) : 0;
    const missingGames = (totalGames || 0) - gamesWithStats;
    
    console.log('📊 DATABASE STATISTICS:');
    console.log(`├─ Total Completed Games: ${totalGames?.toLocaleString()}`);
    console.log(`├─ Games with Player Stats: ${gamesWithStats.toLocaleString()} (${coverage.toFixed(2)}%)`);
    console.log(`├─ Missing Player Stats: ${missingGames.toLocaleString()} games`);
    console.log(`├─ Player Game Logs: ${totalPlayerGameLogs?.toLocaleString()} records`);
    console.log(`└─ Player Stats: ${playerStatsCount?.toLocaleString()} records`);
    console.log('');
    
    // Get recent games to check date range
    const { data: recentGames, error: recentError } = await supabase
      .from('games')
      .select('start_time, home_team_id, away_team_id, home_score, away_score')
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(10);
    
    if (!recentError && recentGames && recentGames.length > 0) {
      const latestDate = new Date(recentGames[0].start_time).toLocaleDateString();
      const oldestDate = new Date(recentGames[recentGames.length - 1].start_time).toLocaleDateString();
      
      console.log('📅 RECENT GAMES SAMPLE:');
      console.log(`├─ Latest: ${latestDate}`);
      console.log(`└─ Sample Range: ${oldestDate} to ${latestDate}`);
      console.log('');
    }
    
    // Get sports breakdown
    const { data: sportsBreakdown, error: sportsError } = await supabase
      .from('games')
      .select('sport_id')
      .eq('status', 'completed')
      .not('home_score', 'is', null);
    
    if (!sportsError && sportsBreakdown) {
      const sportCounts: Record<string, number> = {};
      sportsBreakdown.forEach(game => {
        const sport = game.sport_id || 'unknown';
        sportCounts[sport] = (sportCounts[sport] || 0) + 1;
      });
      
      console.log('🏀 SPORTS BREAKDOWN:');
      Object.entries(sportCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([sport, count]) => {
          console.log(`├─ ${sport}: ${count.toLocaleString()} games`);
        });
      console.log('');
    }
    
    // Calculate impact
    const currentAccuracy = 65.2;
    const targetAccuracy = 76.4;
    const accuracyGain = targetAccuracy - currentAccuracy;
    const estimatedProfit = 131976;
    
    console.log('💰 POTENTIAL IMPACT:');
    console.log(`├─ Current Pattern Accuracy: ${currentAccuracy}%`);
    console.log(`├─ Target with Full Stats: ${targetAccuracy}%`);
    console.log(`├─ Accuracy Improvement: +${accuracyGain.toFixed(1)}%`);
    console.log(`├─ Annual Profit Increase: $${estimatedProfit.toLocaleString()}`);
    console.log(`└─ ROI per 1000 games: $${Math.floor(estimatedProfit / missingGames * 1000).toLocaleString()}`);
    console.log('');
    
    console.log('🎯 NEXT STEPS:');
    console.log(`1. Need to collect player stats for ${missingGames.toLocaleString()} games`);
    console.log('2. Focus on high-value games with betting patterns');
    console.log('3. Prioritize recent games for immediate impact');
    console.log('4. Build automated collection pipeline');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run analysis
analyzePlayerStatsCoverage();
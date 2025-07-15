import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDatabaseStats() {
  console.log('🔍 FANTASY AI DATABASE STATISTICS REPORT 🔍\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. Count games by sport
    console.log('\n📊 GAMES BY SPORT:');
    console.log('-'.repeat(40));
    
    const sportsToCheck = ['MLB', 'NBA', 'NFL', 'NHL'];
    let totalGames = 0;
    let totalGamesWithScores = 0;
    
    for (const sport of sportsToCheck) {
      const { count: gameCount, error: gameError } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport', sport);
      
      const { count: gamesWithScores, error: scoreError } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport', sport)
        .not('home_score', 'is', null)
        .not('away_score', 'is', null);
      
      if (!gameError && gameCount !== null) {
        console.log(`${sport}: ${gameCount.toLocaleString()} games (${gamesWithScores || 0} with scores)`);
        totalGames += gameCount;
        totalGamesWithScores += (gamesWithScores || 0);
      } else {
        console.log(`${sport}: Error counting games`);
      }
    }
    
    console.log(`\nTOTAL GAMES: ${totalGames.toLocaleString()} (${totalGamesWithScores.toLocaleString()} completed with scores)`);
    
    // 2. Count player_stats by sport
    console.log('\n📈 PLAYER STATS BY SPORT:');
    console.log('-'.repeat(40));
    
    let totalStats = 0;
    
    for (const sport of sportsToCheck) {
      const { count: statsCount, error: statsError } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('sport', sport);
      
      if (!statsError && statsCount !== null) {
        console.log(`${sport}: ${statsCount.toLocaleString()} player stats`);
        totalStats += statsCount;
      } else {
        console.log(`${sport}: Error counting stats`);
      }
    }
    
    console.log(`\nTOTAL PLAYER STATS: ${totalStats.toLocaleString()}`);
    
    // 3. Check for MLB specific tables
    console.log('\n⚾ MLB SPECIFIC TABLES:');
    console.log('-'.repeat(40));
    
    const mlbTables = ['mlb_stats', 'mlb_players', 'mlb_teams', 'mlb_games'];
    
    for (const table of mlbTables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (!error && count !== null) {
          console.log(`✅ ${table}: ${count.toLocaleString()} records`);
        } else {
          console.log(`❌ ${table}: Table not found or error`);
        }
      } catch (e) {
        console.log(`❌ ${table}: Table not found`);
      }
    }
    
    // 4. Summary of all major tables
    console.log('\n📋 ALL MAJOR TABLES SUMMARY:');
    console.log('-'.repeat(40));
    
    const tables = [
      'players',
      'teams', 
      'games',
      'player_stats',
      'player_injuries',
      'weather_data',
      'news_articles',
      'ml_predictions',
      'pattern_occurrences',
      'betting_opportunities'
    ];
    
    let grandTotal = 0;
    
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error && count !== null) {
        console.log(`${table}: ${count.toLocaleString()} records`);
        grandTotal += count;
      } else {
        console.log(`${table}: 0 records or table not found`);
      }
    }
    
    console.log(`\nGRAND TOTAL RECORDS: ${grandTotal.toLocaleString()}`);
    
    // 5. Check recent data collection activity
    console.log('\n🕐 RECENT DATA COLLECTION ACTIVITY:');
    console.log('-'.repeat(40));
    
    // Recent games
    const { data: recentGames, error: recentGamesError } = await supabase
      .from('games')
      .select('sport, game_date, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (!recentGamesError && recentGames) {
      console.log('\nLast 5 games added:');
      recentGames.forEach(game => {
        console.log(`- ${game.sport} game on ${game.game_date} (added ${new Date(game.created_at).toLocaleString()})`);
      });
    }
    
    // Recent player stats
    const { data: recentStats, error: recentStatsError } = await supabase
      .from('player_stats')
      .select('sport, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (!recentStatsError && recentStats) {
      console.log('\nLast 5 player stats added:');
      recentStats.forEach(stat => {
        console.log(`- ${stat.sport} stats (added ${new Date(stat.created_at).toLocaleString()})`);
      });
    }
    
    // Check ESPN ID standardization status
    console.log('\n🆔 ESPN ID STANDARDIZATION STATUS:');
    console.log('-'.repeat(40));
    
    const { data: espnIdSample, error: espnError } = await supabase
      .from('player_stats')
      .select('espn_id')
      .like('espn_id', 'espn_%')
      .limit(100);
    
    if (!espnError && espnIdSample) {
      const standardizedCount = espnIdSample.filter(s => 
        s.espn_id && /^espn_[a-z]+_\d+$/.test(s.espn_id)
      ).length;
      
      console.log(`Standardized ESPN IDs: ${standardizedCount}/${espnIdSample.length} in sample`);
    }
    
  } catch (error) {
    console.error('Error checking database stats:', error);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ DATABASE STATS CHECK COMPLETE\n');
}

// Run the check
checkDatabaseStats();
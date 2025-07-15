import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkGamesDirectly() {
  console.log('🎮 CHECKING GAMES TABLE DIRECTLY 🎮\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. First check total count
    const { count: totalGames, error: countError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Total games in database: ${totalGames?.toLocaleString() || 'Error'}`);
    
    // 2. Get sample of games to see structure
    const { data: sampleGames, error: sampleError } = await supabase
      .from('games')
      .select('*')
      .limit(10);
    
    if (!sampleError && sampleGames && sampleGames.length > 0) {
      console.log('\nGame table columns:', Object.keys(sampleGames[0]).join(', '));
      
      // 3. Check sports distribution
      console.log('\n📊 SPORTS DISTRIBUTION:');
      console.log('-'.repeat(40));
      
      // Get unique values in sport column
      const { data: sports, error: sportsError } = await supabase
        .from('games')
        .select('sport')
        .limit(5000);
      
      if (!sportsError && sports) {
        const sportCounts: Record<string, number> = {};
        sports.forEach(game => {
          const sport = game.sport || 'Unknown';
          sportCounts[sport] = (sportCounts[sport] || 0) + 1;
        });
        
        Object.entries(sportCounts).forEach(([sport, count]) => {
          console.log(`${sport}: ${count} games`);
        });
      }
      
      // 4. Check completed games
      const { count: completedGames, error: completedError } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .not('home_score', 'is', null)
        .not('away_score', 'is', null);
      
      console.log(`\nCompleted games (with scores): ${completedGames?.toLocaleString() || 'Error'}`);
      
      // 5. Show sample games
      console.log('\n📋 SAMPLE GAMES:');
      console.log('-'.repeat(40));
      
      sampleGames.slice(0, 5).forEach(game => {
        console.log(`\nGame ID: ${game.id}`);
        console.log(`Sport: ${game.sport || 'N/A'}`);
        console.log(`Sport ID: ${game.sport_id || 'N/A'}`);
        console.log(`Teams: ${game.home_team_id} vs ${game.away_team_id}`);
        console.log(`Date: ${game.start_time}`);
        console.log(`Score: ${game.home_score || 'N/A'} - ${game.away_score || 'N/A'}`);
        console.log(`Status: ${game.status || 'N/A'}`);
        console.log(`League: ${game.league || 'N/A'}`);
      });
    }
    
    // 6. Check for sport-specific patterns in game IDs or other fields
    console.log('\n\n🔍 ANALYZING GAME PATTERNS:');
    console.log('-'.repeat(40));
    
    // Sample games from different date ranges
    const { data: recentGames, error: recentError } = await supabase
      .from('games')
      .select('id, sport, game_date, home_team, away_team')
      .order('game_date', { ascending: false })
      .limit(100);
    
    if (!recentError && recentGames) {
      const sportDistribution: Record<string, number> = {};
      recentGames.forEach(game => {
        const sport = game.sport || 'Unknown';
        sportDistribution[sport] = (sportDistribution[sport] || 0) + 1;
      });
      
      console.log('\nRecent 100 games by sport:');
      Object.entries(sportDistribution).forEach(([sport, count]) => {
        console.log(`  ${sport}: ${count}`);
      });
    }
    
  } catch (error) {
    console.error('Error checking games:', error);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ GAMES CHECK COMPLETE\n');
}

// Run the check
checkGamesDirectly();
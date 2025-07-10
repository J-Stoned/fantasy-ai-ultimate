import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGameStatsIssue() {
  console.log('🔍 Investigating game-stats relationship issue...\n');

  try {
    // 1. Check games that have stats
    const { data: gamesWithStats, error: gwsError } = await supabase
      .from('player_stats')
      .select('game_id')
      .not('game_id', 'is', null)
      .limit(100);

    if (gwsError) throw gwsError;

    const uniqueGameIds = [...new Set(gamesWithStats.map(s => s.game_id))];
    console.log(`📊 Checking ${uniqueGameIds.length} games that have stats...`);

    // Get details for these games
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, sport, home_team, away_team, game_date, home_score, away_score, external_id')
      .in('id', uniqueGameIds);

    if (gamesError) throw gamesError;

    console.log('\n🎮 Games with stats:');
    games?.forEach(game => {
      console.log(`  ID: ${game.id}`);
      console.log(`    Sport: ${game.sport || 'NULL'}`);
      console.log(`    Teams: ${game.away_team} @ ${game.home_team}`);
      console.log(`    Date: ${new Date(game.game_date).toLocaleDateString()}`);
      console.log(`    Score: ${game.away_score ?? 'NULL'} - ${game.home_score ?? 'NULL'}`);
      console.log(`    External ID: ${game.external_id || 'NULL'}`);
      console.log('');
    });

    // 2. Check completed games without stats
    console.log('📈 Checking completed games coverage by sport...\n');
    
    const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB'];
    
    for (const sport of sports) {
      // Get completed games for this sport
      const { count: completedCount, error: completedError } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport', sport)
        .not('home_score', 'is', null)
        .not('away_score', 'is', null);

      if (completedError) continue;

      // Get games with stats for this sport
      const { data: sportGames, error: sportGamesError } = await supabase
        .from('games')
        .select('id')
        .eq('sport', sport)
        .not('home_score', 'is', null)
        .not('away_score', 'is', null);

      if (sportGamesError) continue;

      const sportGameIds = sportGames?.map(g => g.id) || [];
      
      // Count how many have stats
      let withStatsCount = 0;
      if (sportGameIds.length > 0) {
        const { count, error } = await supabase
          .from('player_stats')
          .select('game_id', { count: 'exact', head: true })
          .in('game_id', sportGameIds);
        
        if (!error && count) {
          // This gives total stats, we need unique games
          const { data: uniqueGamesData } = await supabase
            .from('player_stats')
            .select('game_id')
            .in('game_id', sportGameIds);
          
          const uniqueGamesWithStats = new Set(uniqueGamesData?.map(d => d.game_id));
          withStatsCount = uniqueGamesWithStats.size;
        }
      }

      const coverage = completedCount ? (withStatsCount / completedCount * 100).toFixed(1) : 0;
      console.log(`  ${sport}: ${withStatsCount}/${completedCount} games (${coverage}% coverage)`);
    }

    // 3. Check for games with NULL sport
    const { count: nullSportCount, error: nullError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .is('sport', null);

    if (!nullError) {
      console.log(`\n⚠️  Games with NULL sport: ${nullSportCount}`);
    }

    // 4. Check recent game insertions
    console.log('\n📅 Recent game insertions:');
    const { data: recentGames, error: recentError } = await supabase
      .from('games')
      .select('id, sport, home_team, away_team, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!recentError && recentGames) {
      recentGames.forEach(game => {
        console.log(`  ${new Date(game.created_at).toLocaleString()}: ${game.sport || 'NULL'} - ${game.away_team} @ ${game.home_team}`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking games:', error);
  }
}

// Run the check
checkGameStatsIssue();
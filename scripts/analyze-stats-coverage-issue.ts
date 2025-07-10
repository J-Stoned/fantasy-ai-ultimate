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

async function analyzeStatsCoverageIssue() {
  console.log('🔍 Analyzing stats coverage issue...\n');

  try {
    // 1. Check the games that have stats
    const gameIdsWithStats = [3563186, 3563187, 3563188, 3560530, 3563190, 3560532, 3563183, 3563189, 3560507, 3560508];
    
    console.log('📊 Checking games that have stats:');
    const { data: gamesWithStats, error: gamesError } = await supabase
      .from('games')
      .select('id, sport, home_team_id, away_team_id, home_score, away_score, start_time, external_id')
      .in('id', gameIdsWithStats);

    if (!gamesError && gamesWithStats) {
      gamesWithStats.forEach(game => {
        console.log(`\nGame ${game.id}:`);
        console.log(`  Sport: ${game.sport || 'NULL'}`);
        console.log(`  Teams: ${game.away_team_id} @ ${game.home_team_id}`);
        console.log(`  Score: ${game.away_score ?? 'NULL'} - ${game.home_score ?? 'NULL'}`);
        console.log(`  Date: ${new Date(game.start_time).toLocaleDateString()}`);
        console.log(`  External ID: ${game.external_id}`);
      });
    }

    // 2. Check the pattern of game IDs
    console.log('\n📈 Game ID patterns:');
    console.log('Games with stats: 3560507-3563190 range');
    
    // Get min and max game IDs
    const { data: minMaxGames, error: minMaxError } = await supabase
      .from('games')
      .select('id')
      .order('id', { ascending: true });

    if (!minMaxError && minMaxGames && minMaxGames.length > 0) {
      console.log(`Total game ID range: ${minMaxGames[0].id} - ${minMaxGames[minMaxGames.length - 1].id}`);
    }

    // 3. Check if these high ID games are recent insertions
    console.log('\n🕐 Checking when these games were inserted:');
    const { data: recentGames, error: recentError } = await supabase
      .from('games')
      .select('id, created_at')
      .gte('id', 3560000)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!recentError && recentGames) {
      recentGames.forEach(game => {
        console.log(`  Game ${game.id}: created at ${new Date(game.created_at).toLocaleString()}`);
      });
    }

    // 4. Check the real completed games with proper scores
    console.log('\n✅ Checking proper completed games (low ID range):');
    const { data: properGames, error: properError } = await supabase
      .from('games')
      .select('id, sport, home_score, away_score, external_id')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .not('sport', 'is', null)
      .order('id', { ascending: true })
      .limit(10);

    if (!properError && properGames) {
      properGames.forEach(game => {
        console.log(`  Game ${game.id}: ${game.sport} - Score: ${game.away_score}-${game.home_score}`);
      });
    }

    // 5. Check stats distribution by game
    console.log('\n📊 Stats count by game:');
    for (const gameId of gameIdsWithStats.slice(0, 5)) {
      const { count, error } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameId);

      if (!error) {
        console.log(`  Game ${gameId}: ${count} stats`);
      }
    }

    // 6. Sample stats to see what's being stored
    console.log('\n📋 Sample stats from these games:');
    const { data: sampleStats, error: sampleStatsError } = await supabase
      .from('player_stats')
      .select('*')
      .eq('game_id', gameIdsWithStats[0])
      .limit(5);

    if (!sampleStatsError && sampleStats) {
      sampleStats.forEach((stat, i) => {
        console.log(`\n  Stat ${i + 1}:`);
        console.log(`    Player: ${stat.player_id}`);
        console.log(`    Type: ${stat.stat_type}`);
        console.log(`    Value: ${stat.stat_value}`);
        console.log(`    Fantasy Points: ${stat.fantasy_points}`);
      });
    }

    // 7. Final summary
    console.log('\n🎯 SUMMARY:');
    console.log('- The 47,257 stats you inserted are going to game IDs in the 3.5M range');
    console.log('- These game IDs either don\'t exist or have NULL sport values');
    console.log('- The actual completed games are in the lower ID range (< 10,000)');
    console.log('- This is why coverage shows 0.7% - stats are being linked to wrong/non-existent games');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the analysis
analyzeStatsCoverageIssue();
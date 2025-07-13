import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function nbaCoverageRealityCheck() {
  console.log('🏀 NBA COVERAGE REALITY CHECK\n');
  console.log('='.repeat(80));

  // Get ALL NBA games
  console.log('📊 Fetching all NBA games...');
  
  const { data: nbaGames, error: nbaError } = await supabase
    .from('games')
    .select('id, sport, sport_id, status, home_score, away_score')
    .or('sport.eq.NBA,sport_id.eq.nba');

  if (nbaError || !nbaGames) {
    console.error('Error fetching NBA games:', nbaError);
    return;
  }

  console.log(`\n✅ Found ${nbaGames.length} NBA games total`);

  // Check different game categories
  const completed = nbaGames.filter(g => 
    g.status === 'completed' || 
    g.status === 'STATUS_FINAL' || 
    g.status === 'Final' ||
    (g.home_score !== null && g.away_score !== null)
  );
  
  console.log(`  - Completed games: ${completed.length}`);
  console.log(`  - Other status games: ${nbaGames.length - completed.length}`);

  // Check stats coverage for completed games
  console.log('\n📊 Checking stats coverage for completed games...');
  
  const completedIds = completed.map(g => g.id);
  let gamesWithStats = 0;
  let totalStatsCount = 0;
  
  // Process in batches
  for (let i = 0; i < completedIds.length; i += 500) {
    const batch = completedIds.slice(i, i + 500);
    
    const { data: stats } = await supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', batch);
    
    if (stats && stats.length > 0) {
      const uniqueGames = new Set(stats.map(s => s.game_id));
      gamesWithStats += uniqueGames.size;
      totalStatsCount += stats.length;
    }
    
    if (i % 2000 === 0) {
      console.log(`  Processed ${Math.min(i + 500, completedIds.length)}/${completedIds.length} games...`);
    }
  }

  const coverage = completed.length > 0 
    ? (gamesWithStats / completed.length * 100).toFixed(1)
    : 0;

  console.log('\n📊 NBA COVERAGE RESULTS:');
  console.log('='.repeat(50));
  console.log(`Total NBA games: ${nbaGames.length}`);
  console.log(`Completed games: ${completed.length}`);
  console.log(`Games with stats: ${gamesWithStats}`);
  console.log(`Coverage: ${coverage}%`);
  console.log(`Total player stats: ${totalStatsCount.toLocaleString()}`);
  
  // Calculate what we need
  const target95 = Math.ceil(completed.length * 0.95);
  const gamesNeeded = Math.max(0, target95 - gamesWithStats);
  
  console.log('\n🎯 TO REACH 95% COVERAGE:');
  console.log(`Target: ${target95} games with stats`);
  console.log(`Current: ${gamesWithStats} games with stats`);
  console.log(`Need: ${gamesNeeded} more games`);

  // Sample games without stats
  if (gamesNeeded > 0) {
    console.log('\n📋 Sample games without stats:');
    
    // Find games without stats
    const gamesWithoutStats = [];
    for (const game of completed.slice(0, 100)) {
      const { count } = await supabase
        .from('player_stats')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (count === 0) {
        gamesWithoutStats.push(game);
        if (gamesWithoutStats.length >= 5) break;
      }
    }
    
    gamesWithoutStats.forEach(game => {
      console.log(`  - Game ${game.id}: ${game.sport || game.sport_id}, Status: ${game.status}`);
    });
  }

  // Check why the collector might be failing
  console.log('\n\n🔍 COLLECTOR DIAGNOSIS:');
  
  // Check if we have ESPN IDs
  const { data: sampleGames } = await supabase
    .from('games')
    .select('*')
    .or('sport.eq.NBA,sport_id.eq.nba')
    .limit(5);
  
  console.log('\nSample NBA game structure:');
  if (sampleGames && sampleGames.length > 0) {
    const game = sampleGames[0];
    console.log('Game columns:', Object.keys(game).join(', '));
    console.log('\nSample game:');
    console.log(JSON.stringify(game, null, 2));
  }
}

nbaCoverageRealityCheck().catch(console.error);
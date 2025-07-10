import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRecentInsertions() {
  console.log('🔍 Checking recent insertions in detail...\n');

  // 1. Get a sample of recent insertions with all fields
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: recentStats, error } = await supabase
    .from('player_stats')
    .select('*')
    .gte('created_at', oneHourAgo)
    .limit(20);

  if (error) {
    console.error('Error fetching recent stats:', error);
    return;
  }

  console.log(`Found ${recentStats?.length || 0} recent insertions. Sample:`);
  
  if (recentStats && recentStats.length > 0) {
    // Show first record in detail
    console.log('\nFirst record (detailed):');
    console.log(JSON.stringify(recentStats[0], null, 2));
    
    // Check for sport field
    console.log('\nChecking sport field:');
    recentStats.slice(0, 5).forEach((stat, i) => {
      console.log(`Record ${i + 1}:`);
      console.log(`  - id: ${stat.id}`);
      console.log(`  - sport: ${stat.sport} (type: ${typeof stat.sport})`);
      console.log(`  - player_id: ${stat.player_id}`);
      console.log(`  - game_id: ${stat.game_id}`);
      console.log(`  - stats keys: ${Object.keys(stat.stats || {}).join(', ')}`);
    });
  }

  // 2. Check table schema
  console.log('\n\nChecking player_stats table columns...');
  const { data: columns } = await supabase.rpc('get_table_columns', {
    table_name: 'player_stats'
  }).catch(() => ({ data: null }));

  if (!columns) {
    // Try alternative approach
    const { data: sampleRow } = await supabase
      .from('player_stats')
      .select('*')
      .limit(1);
    
    if (sampleRow && sampleRow.length > 0) {
      console.log('Table columns:', Object.keys(sampleRow[0]).join(', '));
    }
  } else {
    console.log('Table columns:', columns);
  }

  // 3. Check games table for the referenced game
  if (recentStats && recentStats.length > 0) {
    const gameId = recentStats[0].game_id;
    const { data: game } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (game) {
      console.log('\n\nReferenced game details:');
      console.log(`  - id: ${game.id}`);
      console.log(`  - sport: ${game.sport}`);
      console.log(`  - home_team: ${game.home_team}`);
      console.log(`  - away_team: ${game.away_team}`);
      console.log(`  - game_date: ${game.game_date}`);
    }
  }

  // 4. Count by distinct values in sport column
  const { data: allStats } = await supabase
    .from('player_stats')
    .select('sport')
    .gte('created_at', oneHourAgo)
    .limit(1000);

  if (allStats) {
    const sportCounts: Record<string, number> = {};
    allStats.forEach(stat => {
      const sport = String(stat.sport || 'null');
      sportCounts[sport] = (sportCounts[sport] || 0) + 1;
    });
    
    console.log('\n\nSport field distribution (recent insertions):');
    Object.entries(sportCounts).forEach(([sport, count]) => {
      console.log(`  - "${sport}": ${count}`);
    });
  }

  // 5. Check if we can find NFL games with scores
  const { data: nflGames, count: nflCount } = await supabase
    .from('games')
    .select('*', { count: 'exact' })
    .eq('sport', 'NFL')
    .not('home_score', 'is', null)
    .order('game_date', { ascending: false })
    .limit(5);

  console.log(`\n\nNFL games with scores: ${nflCount || 0}`);
  if (nflGames && nflGames.length > 0) {
    nflGames.forEach(game => {
      console.log(`  - ${game.game_date}: ${game.home_team} ${game.home_score} - ${game.away_score} ${game.away_team}`);
    });
  }
}

checkRecentInsertions().catch(console.error);
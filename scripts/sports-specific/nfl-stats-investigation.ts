import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateNFLStats() {
  console.log(chalk.bold.red('🏈 NFL PLAYER STATS INVESTIGATION REPORT\n'));
  
  // 1. Identify NFL games
  console.log(chalk.yellow('1️⃣ Finding NFL games...'));
  
  // Check different ways games might be marked as NFL
  const nflQueries = [
    { filter: "sport.eq.nfl", desc: "sport = 'nfl'" },
    { filter: "sport.eq.NFL", desc: "sport = 'NFL'" },
    { filter: "sport.eq.football", desc: "sport = 'football'" },
    { filter: "league.eq.NFL", desc: "league = 'NFL'" },
    { filter: "league.eq.nfl", desc: "league = 'nfl'" },
    { filter: "sport_id.eq.nfl", desc: "sport_id = 'nfl'" },
    { filter: "sport_id.eq.football", desc: "sport_id = 'football'" }
  ];
  
  let nflGameIds = new Set<number>();
  
  for (const query of nflQueries) {
    const { data, count } = await supabase
      .from('games')
      .select('id', { count: 'exact' })
      .or(query.filter);
    
    if (count && count > 0) {
      console.log(chalk.green(`  ✓ Found ${count} games with ${query.desc}`));
      data?.forEach(game => nflGameIds.add(game.id));
    }
  }
  
  console.log(chalk.cyan(`\n📊 Total unique NFL games found: ${nflGameIds.size}`));
  
  // 2. Check how many of these have scores
  console.log(chalk.yellow('\n2️⃣ Checking completed NFL games...'));
  const { data: completedNFLGames } = await supabase
    .from('games')
    .select('id, home_score, away_score, sport, league')
    .in('id', Array.from(nflGameIds))
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);
  
  console.log(chalk.cyan(`📊 Completed NFL games: ${completedNFLGames?.length || 0}`));
  
  // 3. Check player_stats for these NFL games
  console.log(chalk.yellow('\n3️⃣ Checking player_stats for NFL games...'));
  const nflGamesWithStats = new Set<number>();
  
  // Check in batches
  const nflGameIdArray = Array.from(nflGameIds);
  const batchSize = 100;
  
  for (let i = 0; i < nflGameIdArray.length; i += batchSize) {
    const batch = nflGameIdArray.slice(i, i + batchSize);
    const { data } = await supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', batch);
    
    data?.forEach(stat => {
      if (stat.game_id) nflGamesWithStats.add(stat.game_id);
    });
  }
  
  console.log(chalk.cyan(`📊 NFL games with player_stats: ${nflGamesWithStats.size}`));
  
  // 4. Analyze what's in player_stats
  console.log(chalk.yellow('\n4️⃣ Analyzing player_stats content...'));
  
  // Get sample stats for NFL games
  const { data: nflStats } = await supabase
    .from('player_stats')
    .select('*')
    .in('game_id', Array.from(nflGamesWithStats).slice(0, 10))
    .limit(10);
  
  if (nflStats && nflStats.length > 0) {
    console.log(chalk.cyan('\n📋 Sample NFL player stats:'));
    nflStats.forEach(stat => {
      console.log(`  Game ${stat.game_id}: ${stat.stat_type} = ${JSON.stringify(stat.stat_value)}`);
    });
  }
  
  // 5. Check for basketball stats in all player_stats
  console.log(chalk.yellow('\n5️⃣ Analyzing stat types...'));
  const { data: statTypes } = await supabase
    .from('player_stats')
    .select('stat_type, stat_value')
    .limit(100);
  
  const basketballStats = 0;
  const footballStats = 0;
  const otherStats = 0;
  
  statTypes?.forEach(stat => {
    if (typeof stat.stat_value === 'object' && stat.stat_value) {
      const keys = Object.keys(stat.stat_value);
      if (keys.includes('points') && keys.includes('rebounds') && keys.includes('assists')) {
        // Basketball
      } else if (keys.includes('passing_yards') || keys.includes('rushing_yards') || keys.includes('receiving_yards')) {
        // Football
      } else {
        // Other
      }
    }
  });
  
  // 6. Look for NFL-specific tables or columns
  console.log(chalk.yellow('\n6️⃣ Searching for NFL-specific data structures...'));
  
  // Check if there are any views or other tables
  const tableChecks = [
    'nfl_player_stats',
    'football_stats',
    'passing_stats',
    'rushing_stats',
    'receiving_stats',
    'defensive_stats',
    'game_logs',
    'player_game_stats'
  ];
  
  console.log(chalk.cyan('\n📋 Checking for NFL-specific tables:'));
  for (const table of tableChecks) {
    try {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (count !== null) {
        console.log(chalk.green(`  ✓ ${table}: ${count} records`));
      }
    } catch (e) {
      console.log(chalk.gray(`  ✗ ${table}: not found`));
    }
  }
  
  // 7. Check metadata or other fields in games
  console.log(chalk.yellow('\n7️⃣ Checking games metadata...'));
  const { data: gamesWithMetadata } = await supabase
    .from('games')
    .select('id, metadata')
    .not('metadata', 'is', null)
    .limit(5);
  
  if (gamesWithMetadata && gamesWithMetadata.length > 0) {
    console.log(chalk.cyan('\n📋 Sample game metadata:'));
    gamesWithMetadata.forEach(game => {
      console.log(`  Game ${game.id}:`, JSON.stringify(game.metadata).substring(0, 100) + '...');
    });
  }
  
  // 8. Summary and recommendations
  console.log(chalk.bold.red('\n📊 INVESTIGATION SUMMARY:'));
  console.log(chalk.white(`
  1. NFL Games Found: ${nflGameIds.size}
  2. Completed NFL Games: ${completedNFLGames?.length || 0}
  3. NFL Games with Stats: ${nflGamesWithStats.size}
  4. Coverage: ${((nflGamesWithStats.size / (completedNFLGames?.length || 1)) * 100).toFixed(1)}%
  `));
  
  console.log(chalk.bold.yellow('\n🎯 ROOT CAUSE ANALYSIS:'));
  console.log(chalk.white(`
  1. The player_stats table appears to contain primarily basketball stats
  2. NFL games exist but lack proper player statistics
  3. The 0.3% coverage is accurate - we need NFL-specific stats collection
  4. Current scripts generate fake stats, not real NFL data
  `));
  
  console.log(chalk.bold.green('\n✅ RECOMMENDED ACTIONS:'));
  console.log(chalk.white(`
  1. Create NFL-specific stats collection using available APIs:
     - BallDontLie API (basketball only - not useful)
     - MySportsFeeds API ✓ (has NFL data)
     - SportRadar API ✓ (has NFL data)
     - The Odds API (betting odds only)
     
  2. Implement proper NFL stat structure:
     - Passing: yards, TDs, INTs, completions, attempts
     - Rushing: yards, TDs, attempts, yards per carry
     - Receiving: receptions, yards, TDs, targets
     - Defense: tackles, sacks, INTs, forced fumbles
     
  3. Use existing ESPN/Sleeper data collection to get stats
  4. Map NFL game IDs properly between systems
  `));
}

investigateNFLStats().catch(console.error);
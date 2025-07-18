import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const HTTP_LIMIT = pLimit(12); // Use CPU threads

async function analyze2024_2025Issue() {
  console.log(chalk.cyan('🔍 Analyzing 2024 & 2025 Low Stats Issue\n'));
  
  // Sample games from each season
  const seasons = [
    { year: 2021, start: '2021-05-01', end: '2021-05-31' },
    { year: 2024, start: '2024-05-01', end: '2024-05-31' },
    { year: 2025, start: '2025-05-01', end: '2025-05-31' }
  ];
  
  for (const season of seasons) {
    console.log(chalk.yellow(`\n📅 ${season.year} Season Analysis:`));
    
    // Get sample games
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'NCAA_BASEBALL')
      .eq('status', 'completed')
      .gte('start_time', season.start)
      .lte('start_time', season.end)
      .limit(10);
      
    if (!games || games.length === 0) {
      console.log(chalk.red('No games found!'));
      continue;
    }
    
    let totalAvailable = 0;
    let totalStored = 0;
    let gamesWithStats = 0;
    let apiErrors = 0;
    
    // Check each game
    const promises = games.map(game => 
      HTTP_LIMIT(async () => {
        const gameId = game.external_id.replace('espn_ncaa_baseball_', '');
        const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`;
        
        try {
          const response = await axios.get(url, { timeout: 5000 });
          
          let availableStats = 0;
          if (response.data.boxscore?.players) {
            for (const teamData of response.data.boxscore.players) {
              for (const category of teamData.statistics || []) {
                availableStats += category.athletes?.length || 0;
              }
            }
          }
          
          // Check stored stats
          const { count } = await supabase
            .from('player_stats')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', game.id);
            
          totalAvailable += availableStats;
          totalStored += count || 0;
          if (availableStats > 0) gamesWithStats++;
          
          return { availableStats, storedStats: count || 0 };
        } catch (error) {
          apiErrors++;
          return { availableStats: 0, storedStats: 0 };
        }
      })
    );
    
    const results = await Promise.all(promises);
    
    console.log(`Games checked: ${games.length}`);
    console.log(`Games with ESPN stats: ${gamesWithStats} (${(gamesWithStats/games.length*100).toFixed(0)}%)`);
    console.log(`Total available stats: ${totalAvailable}`);
    console.log(`Total stored stats: ${totalStored}`);
    console.log(`Average available per game: ${(totalAvailable/games.length).toFixed(1)}`);
    console.log(`Average stored per game: ${(totalStored/games.length).toFixed(1)}`);
    console.log(`Capture rate: ${totalStored > 0 ? (totalStored/totalAvailable*100).toFixed(1) : 0}%`);
    console.log(`API errors: ${apiErrors}`);
    
    // Show a specific example
    const exampleGame = results.find(r => r.availableStats > 30);
    if (exampleGame) {
      console.log(chalk.green(`\nExample high-stat game: ${exampleGame.availableStats} available, ${exampleGame.storedStats} stored`));
    }
  }
  
  // Check if we already have some stats that weren't counted
  console.log(chalk.cyan('\n🔍 Checking for orphaned stats...'));
  
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
    
  const { count: ncaaStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    .in('game_id', 
      await supabase
        .from('games')
        .select('id')
        .eq('sport', 'NCAA_BASEBALL')
        .then(res => res.data?.map(g => g.id).slice(0, 10000) || [])
    );
    
  console.log(`Total stats in DB: ${totalStats}`);
  console.log(`NCAA Baseball stats: ${ncaaStats}`);
  
  // Check recent collection timestamps
  console.log(chalk.cyan('\n🕐 Recent collection activity:'));
  
  const { data: recentStats } = await supabase
    .from('player_stats')
    .select('created_at, game_id')
    .order('created_at', { ascending: false })
    .limit(20);
    
  if (recentStats) {
    const gameIds = [...new Set(recentStats.map(s => s.game_id))];
    const { data: recentGames } = await supabase
      .from('games')
      .select('sport, start_time')
      .in('id', gameIds);
      
    const ncaaRecent = recentGames?.filter(g => g.sport === 'NCAA_BASEBALL').length || 0;
    console.log(`Recent NCAA Baseball games with new stats: ${ncaaRecent}`);
    
    if (recentGames && recentGames[0]) {
      console.log(`Most recent: ${recentGames[0].sport} - ${recentGames[0].start_time}`);
    }
  }
}

analyze2024_2025Issue()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });
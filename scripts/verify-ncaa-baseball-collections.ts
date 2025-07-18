import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyCollections() {
  console.log(chalk.cyan('📊 NCAA Baseball Collections Verification\n'));
  
  // Define seasons
  const seasons = [
    { year: 2021, start: '2021-02-19', end: '2021-06-30' },
    { year: 2022, start: '2022-02-18', end: '2022-06-27' },
    { year: 2023, start: '2023-02-17', end: '2023-06-26' },
    { year: 2024, start: '2024-02-16', end: '2024-06-25' },
    { year: 2025, start: '2025-02-14', end: '2025-07-18' }
  ];
  
  let totalStats = 0;
  
  for (const season of seasons) {
    // Get games for this season
    const { data: games, count: gameCount } = await supabase
      .from('games')
      .select('id', { count: 'exact' })
      .eq('sport', 'NCAA_BASEBALL')
      .gte('start_time', season.start)
      .lte('start_time', season.end)
      .eq('status', 'completed');
      
    if (games && games.length > 0) {
      // Get stats for these games
      const gameIds = games.map(g => g.id);
      
      // Query in batches
      let seasonStats = 0;
      for (let i = 0; i < gameIds.length; i += 500) {
        const batch = gameIds.slice(i, i + 500);
        const { count } = await supabase
          .from('player_stats')
          .select('*', { count: 'exact', head: true })
          .in('game_id', batch);
        seasonStats += count || 0;
      }
      
      console.log(chalk.yellow(`${season.year} Season:`));
      console.log(`  Games: ${gameCount}`);
      console.log(`  Stats: ${seasonStats.toLocaleString()}`);
      console.log(`  Avg stats/game: ${(seasonStats / (gameCount || 1)).toFixed(1)}\n`);
      
      totalStats += seasonStats;
    } else {
      console.log(chalk.gray(`${season.year} Season: No games found\n`));
    }
  }
  
  console.log(chalk.green('═══════════════════════════════════════════════'));
  console.log(chalk.green(`Total NCAA Baseball Stats: ${totalStats.toLocaleString()}`));
  
  // Check by stat type
  const { data: statTypes } = await supabase
    .from('player_stats')
    .select('stat_type')
    .in('game_id', 
      await supabase
        .from('games')
        .select('id')
        .eq('sport', 'NCAA_BASEBALL')
        .then(res => res.data?.map(g => g.id) || [])
        .then(ids => ids.slice(0, 1000))
    );
    
  if (statTypes) {
    const batting = statTypes.filter(s => s.stat_type === 'batting').length;
    const pitching = statTypes.filter(s => s.stat_type === 'pitching').length;
    console.log(chalk.blue(`\nStat Types (sample of 1000):`));
    console.log(`  Batting: ${batting}`);
    console.log(`  Pitching: ${pitching}`);
  }
}

verifyCollections()
  .then(() => {
    console.log(chalk.green('\n✅ Verification complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });
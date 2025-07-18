import axios from 'axios';
import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const httpLimit = pLimit(10); // Concurrent HTTP requests

async function checkGameHasStats(gameId: string): Promise<boolean> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/summary?event=${gameId}`;
  
  try {
    const response = await axios.get(url, { timeout: 5000 });
    const data = response.data;
    
    if (data.boxscore?.players) {
      // Check if there are actual athletes with stats
      for (const team of data.boxscore.players) {
        for (const stat of team.statistics || []) {
          if (stat.athletes && stat.athletes.length > 0) {
            // Found at least one athlete with stats
            return true;
          }
        }
      }
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

async function countNCAAHockeyGamesWithStats() {
  console.log(chalk.cyan('🏒 Counting NCAA Hockey Games with Stats\n'));
  
  // Get all NCAA Hockey games
  const { data: games, count } = await supabase
    .from('games')
    .select('*', { count: 'exact' })
    .eq('sport', 'NCAA_HKY')
    .order('start_time', { ascending: false });
    
  if (!games || games.length === 0) {
    console.log(chalk.red('No NCAA Hockey games found!'));
    return;
  }
  
  console.log(chalk.yellow(`Total NCAA Hockey games in database: ${count}`));
  console.log(chalk.yellow(`Checking ${games.length} games for stats...\n`));
  
  let gamesWithStats = 0;
  let gamesChecked = 0;
  const gamesWithStatsData: any[] = [];
  
  // Process in batches
  const checkPromises = games.map(game => 
    httpLimit(async () => {
      const gameId = game.external_id.replace('espn_ncaahockey_', '');
      const hasStats = await checkGameHasStats(gameId);
      
      gamesChecked++;
      
      if (hasStats) {
        gamesWithStats++;
        gamesWithStatsData.push({
          game_id: game.id,
          external_id: game.external_id,
          date: game.start_time,
          home_team: game.home_team_id,
          away_team: game.away_team_id,
          score: `${game.home_score}-${game.away_score}`
        });
        console.log(chalk.green(`✅ Found stats for game ${gameId} (${gamesWithStats} total)`));
      }
      
      if (gamesChecked % 50 === 0) {
        console.log(chalk.gray(`Progress: ${gamesChecked}/${games.length} games checked...`));
      }
    })
  );
  
  await Promise.all(checkPromises);
  
  // Show results
  console.log(chalk.cyan('\n\n📊 Final Results:'));
  console.log(chalk.yellow(`Total games checked: ${games.length}`));
  console.log(chalk.green(`Games with stats: ${gamesWithStats}`));
  console.log(chalk.red(`Games without stats: ${games.length - gamesWithStats}`));
  console.log(chalk.blue(`Coverage percentage: ${((gamesWithStats / games.length) * 100).toFixed(1)}%`));
  
  // Group by season
  const seasonBreakdown: Record<string, number> = {};
  gamesWithStatsData.forEach(game => {
    const year = new Date(game.date).getFullYear();
    const month = new Date(game.date).getMonth();
    const season = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
    seasonBreakdown[season] = (seasonBreakdown[season] || 0) + 1;
  });
  
  console.log(chalk.yellow('\nBreakdown by season:'));
  Object.entries(seasonBreakdown)
    .sort(([a], [b]) => b.localeCompare(a))
    .forEach(([season, count]) => {
      console.log(`  ${season}: ${count} games with stats`);
    });
    
  // Save games with stats
  if (gamesWithStats > 0) {
    const fs = await import('fs');
    await fs.promises.writeFile(
      'ncaa-hockey-games-with-stats.json',
      JSON.stringify(gamesWithStatsData, null, 2)
    );
    console.log(chalk.green(`\n✅ List of games with stats saved to ncaa-hockey-games-with-stats.json`));
  }
}

countNCAAHockeyGamesWithStats()
  .then(() => {
    console.log(chalk.cyan('\n✅ Count complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
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

// 🚀 TURBO SETTINGS - Ryzen 5 7600X + 32GB RAM
const HTTP_CONCURRENCY = 48; // Aggressive HTTP concurrency
const DB_BATCH_SIZE = 1000; // DB query limit per batch - DOUBLED!
const httpLimit = pLimit(HTTP_CONCURRENCY);

// In-memory cache for results
const resultsCache = new Map<string, boolean>();

async function checkGameHasStats(gameId: string): Promise<boolean> {
  // Check cache first
  if (resultsCache.has(gameId)) {
    return resultsCache.get(gameId)!;
  }
  
  const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/summary?event=${gameId}`;
  
  try {
    const response = await axios.get(url, { timeout: 5000 });
    const data = response.data;
    
    let hasStats = false;
    
    if (data.boxscore?.players) {
      // Check if there are actual athletes with stats
      for (const team of data.boxscore.players) {
        for (const stat of team.statistics || []) {
          if (stat.athletes && stat.athletes.length > 0) {
            // Found at least one athlete with stats
            hasStats = true;
            break;
          }
        }
        if (hasStats) break;
      }
    }
    
    // Cache result
    resultsCache.set(gameId, hasStats);
    return hasStats;
  } catch (error) {
    resultsCache.set(gameId, false);
    return false;
  }
}

async function countNCAAHockeyGamesWithStats() {
  console.log(chalk.cyan('🏒 NCAA Hockey Stats Coverage Analysis - TURBO MODE\n'));
  console.log(chalk.yellow(`⚡ CPU: Ryzen 5 7600X | RAM: 32GB | HTTP Threads: ${HTTP_CONCURRENCY}\n`));
  
  // First, get total count
  const { count: totalCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_HKY');
    
  console.log(chalk.yellow(`Total NCAA Hockey games in database: ${totalCount}`));
  
  let gamesWithStats = 0;
  let gamesChecked = 0;
  const gamesWithStatsData: any[] = [];
  const startTime = Date.now();
  
  // Process in batches with pagination
  let offset = 0;
  
  while (offset < totalCount!) {
    console.log(chalk.gray(`\nFetching batch: ${offset}-${Math.min(offset + DB_BATCH_SIZE, totalCount!)} of ${totalCount}`));
    
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'NCAA_HKY')
      .order('start_time', { ascending: false })
      .range(offset, offset + DB_BATCH_SIZE - 1);
      
    if (!games || games.length === 0) break;
    
    // Process batch with high concurrency
    const batchPromises = games.map(game => 
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
            score: `${game.home_score}-${game.away_score}`,
            season: game.season
          });
          console.log(chalk.green(`✅ Found stats for game ${gameId} (${gamesWithStats} total)`));
        }
        
        // Progress update every 100 games
        if (gamesChecked % 100 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = gamesChecked / elapsed;
          const eta = (totalCount! - gamesChecked) / rate;
          console.log(chalk.blue(
            `Progress: ${gamesChecked}/${totalCount} | ` +
            `Rate: ${rate.toFixed(1)} games/sec | ` +
            `ETA: ${Math.ceil(eta / 60)} min`
          ));
        }
      })
    );
    
    await Promise.all(batchPromises);
    
    // Move to next batch
    offset += DB_BATCH_SIZE;
    
    // Quick stats update
    const elapsed = (Date.now() - startTime) / 1000;
    console.log(chalk.gray(
      `Batch complete. Coverage so far: ${((gamesWithStats / gamesChecked) * 100).toFixed(1)}% | ` +
      `Time: ${elapsed.toFixed(1)}s`
    ));
  }
  
  // Final results
  const totalTime = (Date.now() - startTime) / 1000;
  
  console.log(chalk.cyan('\n\n📊 FINAL RESULTS:'));
  console.log(chalk.yellow(`Total games checked: ${gamesChecked}`));
  console.log(chalk.green(`Games with stats: ${gamesWithStats}`));
  console.log(chalk.red(`Games without stats: ${gamesChecked - gamesWithStats}`));
  console.log(chalk.blue(`Coverage percentage: ${((gamesWithStats / gamesChecked) * 100).toFixed(1)}%`));
  console.log(chalk.magenta(`\n⚡ Performance: ${(gamesChecked / totalTime).toFixed(1)} games/sec`));
  console.log(chalk.magenta(`Total time: ${Math.ceil(totalTime / 60)} minutes`));
  
  // Season breakdown
  const seasonBreakdown: Record<string, { total: number, withStats: number }> = {};
  
  // Count all games by season first
  console.log(chalk.yellow('\n🏒 Analyzing season coverage...'));
  
  // Get all games grouped by season
  offset = 0;
  while (offset < totalCount!) {
    const { data: allGames } = await supabase
      .from('games')
      .select('season, start_time')
      .eq('sport', 'NCAA_HKY')
      .range(offset, offset + 1000 - 1);
      
    if (!allGames) break;
    
    allGames.forEach(game => {
      const season = game.season || 'Unknown';
      if (!seasonBreakdown[season]) {
        seasonBreakdown[season] = { total: 0, withStats: 0 };
      }
      seasonBreakdown[season].total++;
    });
    
    offset += 1000;
  }
  
  // Count games with stats by season
  gamesWithStatsData.forEach(game => {
    const season = game.season || 'Unknown';
    if (seasonBreakdown[season]) {
      seasonBreakdown[season].withStats++;
    }
  });
  
  console.log(chalk.yellow('\n📅 Season Breakdown:'));
  Object.entries(seasonBreakdown)
    .sort(([a], [b]) => b.localeCompare(a))
    .forEach(([season, data]) => {
      const coverage = (data.withStats / data.total * 100).toFixed(1);
      console.log(
        `  ${season}: ${data.withStats}/${data.total} games ` +
        `(${coverage}% coverage)`
      );
    });
    
  // Save results
  if (gamesWithStats > 0) {
    const fs = await import('fs');
    await fs.promises.writeFile(
      'ncaa-hockey-games-with-stats-full.json',
      JSON.stringify({
        summary: {
          totalGames: totalCount,
          gamesChecked,
          gamesWithStats,
          coveragePercentage: ((gamesWithStats / gamesChecked) * 100).toFixed(1),
          processingTime: `${Math.ceil(totalTime)} seconds`,
          checkDate: new Date().toISOString()
        },
        seasonBreakdown,
        games: gamesWithStatsData
      }, null, 2)
    );
    console.log(chalk.green(`\n✅ Full analysis saved to ncaa-hockey-games-with-stats-full.json`));
  }
  
  // Memory usage
  console.log(chalk.gray(`\n💾 Cache size: ${resultsCache.size} entries`));
  console.log(chalk.gray(`Memory used: ~${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`));
}

countNCAAHockeyGamesWithStats()
  .then(() => {
    console.log(chalk.cyan('\n✅ Analysis complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
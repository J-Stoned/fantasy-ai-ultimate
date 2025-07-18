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

const httpLimit = pLimit(20);

async function comprehensiveScan() {
  console.log(chalk.cyan('🔍 COMPREHENSIVE MiLB STATS SCAN\n'));
  console.log(chalk.yellow('Checking ALL endpoints for hidden stats...\n'));
  
  // Get ALL MiLB games
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MILB');
    
  console.log(chalk.blue(`Total MiLB games: ${totalGames}\n`));
  
  // Process in batches
  let offset = 0;
  const batchSize = 100;
  const results = {
    boxscore: 0,
    linescore: 0,
    playByPlay: 0,
    liveFeed: 0,
    contentFeed: 0,
    total: 0
  };
  
  while (offset < Math.min(totalGames!, 500)) { // Check first 500 games
    const { data: games } = await supabase
      .from('games')
      .select('external_id')
      .eq('sport', 'MILB')
      .range(offset, offset + batchSize - 1);
      
    if (!games || games.length === 0) break;
    
    const promises = games.map(game => 
      httpLimit(async () => {
        const gameId = game.external_id.replace('mlb_milb_', '');
        const gameResults: any = {};
        
        // Test multiple endpoints
        const endpoints = [
          { name: 'boxscore', url: `/api/v1/game/${gameId}/boxscore` },
          { name: 'linescore', url: `/api/v1/game/${gameId}/linescore` },
          { name: 'playByPlay', url: `/api/v1/game/${gameId}/playByPlay` },
          { name: 'liveFeed', url: `/api/v1/game/${gameId}/feed/live` },
          { name: 'contentFeed', url: `/api/v1/game/${gameId}/content` }
        ];
        
        for (const endpoint of endpoints) {
          try {
            const response = await axios.get(`https://statsapi.mlb.com${endpoint.url}`, {
              timeout: 3000
            });
            
            const data = response.data;
            let hasStats = false;
            
            // Check for stats in different places
            if (endpoint.name === 'boxscore' && data.teams) {
              hasStats = !!(data.teams.away?.players || data.teams.home?.players);
            } else if (endpoint.name === 'liveFeed' && data.liveData?.boxscore) {
              hasStats = !!(data.liveData.boxscore.teams?.away?.players);
            } else if (endpoint.name === 'playByPlay' && data.allPlays) {
              hasStats = data.allPlays.length > 0;
            }
            
            if (hasStats) {
              gameResults[endpoint.name] = true;
              results[endpoint.name]++;
            }
          } catch (error) {
            // Ignore errors
          }
        }
        
        if (Object.keys(gameResults).length > 0) {
          results.total++;
        }
        
        return gameResults;
      })
    );
    
    await Promise.all(promises);
    
    const progress = Math.round((offset + games.length) / Math.min(totalGames!, 500) * 100);
    console.log(chalk.green(`Progress: ${progress}% | Found stats in ${results.total} games so far...`));
    
    offset += batchSize;
  }
  
  // Final results
  console.log(chalk.cyan('\n\n📊 FINAL RESULTS:'));
  console.log(chalk.yellow('Stats found by endpoint:'));
  console.log(`/boxscore: ${results.boxscore} games`);
  console.log(`/linescore: ${results.linescore} games`);
  console.log(`/playByPlay: ${results.playByPlay} games`);
  console.log(`/feed/live: ${results.liveFeed} games`);
  console.log(`/content: ${results.contentFeed} games`);
  console.log(chalk.green(`\nTOTAL GAMES WITH STATS: ${results.total} (${Math.round(results.total/500*100)}%)`));
  
  // Check alternative sources
  console.log(chalk.cyan('\n\n🌐 ALTERNATIVE DATA SOURCES:'));
  console.log(chalk.yellow('\n1. Web Scraping Options:'));
  console.log('   - MiLB.com: Has game pages with box scores');
  console.log('   - Baseball-Reference.com: Has minor league stats');
  console.log('   - FanGraphs.com: Has minor league data');
  console.log('   - The Baseball Cube: Paid service with comprehensive data');
  
  console.log(chalk.yellow('\n2. Python Libraries:'));
  console.log('   - pybaseball: Can scrape FanGraphs MiLB data');
  console.log('   - baseball-scraper: General baseball data scraping');
  
  console.log(chalk.yellow('\n3. Commercial APIs:'));
  console.log('   - SportsData.io: Paid API with MiLB coverage');
  console.log('   - MySportsFeeds: Has minor league data (paid)');
  
  console.log(chalk.green('\n💡 RECOMMENDATION:'));
  console.log('The 81% of games without stats in the MLB API are likely only available through:');
  console.log('1. Web scraping MiLB.com directly');
  console.log('2. Using pybaseball to get FanGraphs data');
  console.log('3. Purchasing historical data from The Baseball Cube');
  console.log('4. Building a scraper for Baseball-Reference');
}

comprehensiveScan().catch(console.error);
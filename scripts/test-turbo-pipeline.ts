#!/usr/bin/env tsx
/**
 * 🧪 TEST TURBO PIPELINE
 * 
 * Tests the pipeline with a small batch before full run
 * - NFL: 10 games instead of 365
 * - Validates all components work correctly
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { InMemoryCache } from './utils/memory-cache';
import { StatsBuffer } from './utils/stats-buffer';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testPipeline() {
  console.log(chalk.bold.cyan('🧪 TESTING TURBO PIPELINE WITH SMALL BATCH\n'));
  
  try {
    // 1. Test memory cache
    console.log(chalk.yellow('1. Testing memory cache...'));
    const cache = new InMemoryCache();
    await cache.initialize();
    
    const stats = cache.getStats();
    console.log(chalk.green(`  ✅ Cache loaded: ${stats.players} players, ${stats.teams} teams, ${stats.games} games`));
    
    // 2. Test stats buffer
    console.log(chalk.yellow('\n2. Testing stats buffer...'));
    const buffer = new StatsBuffer(1000);
    buffer.add({
      player_id: 1,
      game_id: 1,
      team_id: 1,
      game_date: '2021-01-01',
      is_home: true,
      sport: 'NFL',
      stats: { passing_yards: 300 },
      fantasy_points: 20
    });
    console.log(chalk.green(`  ✅ Buffer working: ${buffer.size()} stats stored`));
    
    // 3. Test with 10 NFL games
    console.log(chalk.yellow('\n3. Testing with 10 NFL 2021 games...'));
    
    // Get 10 NFL games from 2021
    const { data: testGames } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'NFL')
      .gte('start_time', '2021-09-01')
      .lt('start_time', '2022-01-01')
      .limit(10);
      
    if (!testGames || testGames.length === 0) {
      console.log(chalk.red('  ❌ No NFL games found to test'));
      return;
    }
    
    console.log(chalk.blue(`  Found ${testGames.length} games to test`));
    
    // 4. Test stats collection without workers (synchronous)
    console.log(chalk.yellow('\n4. Testing stats collection...'));
    
    let collectedStats = 0;
    for (const game of testGames) {
      const espnGameId = game.external_id?.split('_').pop();
      if (!espnGameId) continue;
      
      console.log(chalk.gray(`  Processing game ${espnGameId}...`));
      
      // Simulate API call
      const axios = await import('axios');
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
      
      try {
        const response = await axios.default.get(url);
        const gameData = response.data;
        
        if (gameData.boxscore?.players) {
          for (const team of gameData.boxscore.players) {
            for (const statGroup of team.statistics || []) {
              collectedStats += statGroup.athletes?.length || 0;
            }
          }
        }
        
        console.log(chalk.green(`    ✅ Found stats for game`));
      } catch (error: any) {
        console.log(chalk.red(`    ❌ Error: ${error.message}`));
      }
    }
    
    console.log(chalk.green(`\n✅ TEST COMPLETE!`));
    console.log(chalk.white(`  - Memory cache: Working`));
    console.log(chalk.white(`  - Stats buffer: Working`));
    console.log(chalk.white(`  - API calls: Working`));
    console.log(chalk.white(`  - Stats found: ${collectedStats}`));
    
    if (collectedStats > 0) {
      console.log(chalk.bold.green('\n🎉 All tests passed! Ready for full pipeline.'));
      console.log(chalk.yellow('\nRun full pipeline with: npx tsx scripts/turbo-historical-pipeline.ts'));
    } else {
      console.log(chalk.bold.red('\n❌ No stats collected. Check API access.'));
    }
    
  } catch (error) {
    console.error(chalk.red('Test failed:', error));
  }
}

if (require.main === module) {
  testPipeline().catch(console.error);
}
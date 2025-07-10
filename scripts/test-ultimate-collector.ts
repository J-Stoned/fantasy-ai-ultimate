#!/usr/bin/env tsx
/**
 * Test the ultimate collector with a small batch
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testCollector() {
  console.log(chalk.bold.cyan('\n🧪 TESTING ULTIMATE COLLECTOR\n'));

  try {
    // Get 10 NFL games to test
    const { data: games, error } = await supabase
      .from('games')
      .select('id, external_id, sport, home_team_id, away_team_id')
      .eq('sport', 'nfl')
      .not('home_score', 'is', null)
      .limit(10);

    if (error) throw error;
    
    console.log(`Testing with ${games?.length || 0} NFL games...\n`);

    let successCount = 0;
    let totalStats = 0;

    for (const game of (games || [])) {
      try {
        console.log(`Processing game ${game.external_id}...`);
        
        // Fetch game data
        const response = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary`,
          {
            params: { event: game.external_id },
            timeout: 10000
          }
        );

        if (response.status === 200 && response.data) {
          // Count available stats
          const teams = response.data.boxscore?.players || [];
          let gameStats = 0;
          
          for (const team of teams) {
            for (const category of (team.statistics || [])) {
              gameStats += (category.athletes || []).length;
            }
          }
          
          console.log(chalk.green(`  ✓ Found ${gameStats} player stats`));
          totalStats += gameStats;
          successCount++;
        }
      } catch (error: any) {
        console.log(chalk.red(`  ✗ Failed: ${error.message}`));
      }
    }

    console.log(chalk.bold.green(`\n✅ Test Results:`));
    console.log(`  Success Rate: ${(successCount / (games?.length || 1) * 100).toFixed(0)}%`);
    console.log(`  Total Stats Found: ${totalStats}`);
    console.log(`  Average Stats/Game: ${Math.round(totalStats / successCount)}`);

    if (successCount === games?.length) {
      console.log(chalk.bold.green('\n🎉 All tests passed! Ready for full collection.'));
    } else {
      console.log(chalk.yellow('\n⚠️  Some games failed. Check the errors above.'));
    }

  } catch (error) {
    console.error(chalk.red('Test failed:'), error);
  }
}

testCollector();
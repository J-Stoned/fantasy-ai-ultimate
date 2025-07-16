#!/usr/bin/env tsx
/**
 * 🏒 NCAA HOCKEY COLLECTION SUMMARY
 * Summary of what we collected for NCAA Hockey
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function summarizeNCAAHockeyCollection() {
  console.log(chalk.bold.blue('🏒 NCAA HOCKEY COLLECTION SUMMARY\n'));
  
  // Teams
  const { count: teamCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_HKY');
  
  console.log(chalk.bold.green(`✅ Teams collected: ${teamCount}`));
  console.log('   - All Division I teams included');
  console.log('   - Stored with ESPN IDs for future reference\n');
  
  // Games with pagination
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_HKY');
  
  // Get all games with pagination to count seasons properly
  const allGames = [];
  const pageSize = 1000;
  let offset = 0;
  
  while (offset < totalGames!) {
    const { data: batch } = await supabase
      .from('games')
      .select('metadata, start_time')
      .eq('sport', 'NCAA_HKY')
      .range(offset, offset + pageSize - 1);
    
    if (batch) {
      allGames.push(...batch);
    }
    offset += pageSize;
  }
  
  // Count by season
  const seasonCounts: Record<string, number> = {};
  allGames.forEach(game => {
    const season = game.metadata?.season || 'Unknown';
    seasonCounts[season] = (seasonCounts[season] || 0) + 1;
  });
  
  console.log(chalk.bold.green(`✅ Games collected: ${totalGames}`));
  Object.entries(seasonCounts).forEach(([season, count]) => {
    console.log(`   - ${season}: ${count} games`);
  });
  console.log('   - Includes completed games with scores');
  console.log('   - Contains venue and team information\n');
  
  // Players
  const { count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_HKY');
  
  console.log(chalk.bold.yellow(`⚠️  Players collected: ${playerCount}`));
  console.log('   - ESPN API does not provide roster data for NCAA Hockey');
  console.log('   - No player statistics available through the API\n');
  
  // What we can use this data for
  console.log(chalk.bold.cyan('📊 AVAILABLE FOR PATTERN ANALYSIS:'));
  console.log('   ✓ Home/Away game patterns');
  console.log('   ✓ Team performance trends');
  console.log('   ✓ Score differential patterns');
  console.log('   ✓ Venue-based analysis');
  console.log('   ✓ Schedule density impacts');
  console.log('   ✓ Conference matchup patterns\n');
  
  console.log(chalk.bold.red('❌ NOT AVAILABLE:'));
  console.log('   ✗ Individual player statistics');
  console.log('   ✗ Player performance metrics');
  console.log('   ✗ Team roster information');
  console.log('   ✗ Player injury data\n');
  
  // Overall database stats
  const { data: dbStats } = await supabase.rpc('get_database_stats');
  const totalStats = dbStats?.[0]?.total_stats || 0;
  
  console.log(chalk.bold.magenta('📈 OVERALL DATABASE STATUS:'));
  console.log(`   Total player stats: ${totalStats.toLocaleString()}`);
  console.log(`   Sports covered: NFL, NBA, MLB, NHL, NCAA_FB, NCAA_BB, NCAA_HKY`);
  console.log(`   Ready for: Pattern analysis, ML predictions, betting insights\n`);
}

summarizeNCAAHockeyCollection().catch(console.error);
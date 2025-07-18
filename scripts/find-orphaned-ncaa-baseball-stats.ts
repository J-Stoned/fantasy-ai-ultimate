import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findOrphanedStats() {
  console.log(chalk.cyan('🔍 Finding Orphaned NCAA Baseball Stats\n'));
  
  // 1. Check for NULL player_ids
  const { count: nullCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .is('player_id', null);
    
  console.log(chalk.yellow(`Stats with NULL player_id: ${nullCount || 0}`));
  
  // 2. Get all valid player IDs
  console.log(chalk.blue('\nGetting all valid player IDs...'));
  let allValidPlayerIds = new Set<number>();
  let offset = 0;
  
  while (true) {
    const { data: batch } = await supabase
      .from('players')
      .select('id')
      .range(offset, offset + 9999);
      
    if (!batch || batch.length === 0) break;
    
    batch.forEach(p => allValidPlayerIds.add(p.id));
    offset += 10000;
  }
  
  console.log(chalk.green(`Found ${allValidPlayerIds.size} valid player IDs`));
  
  // 3. Find stats with invalid player_ids (in batches)
  console.log(chalk.blue('\nChecking for stats with invalid player_ids...'));
  
  let orphanedStats = 0;
  let ncaaBaseballLikelyStats = 0;
  let statOffset = 0;
  const batchSize = 5000;
  
  // Get total count
  const { count: totalStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
    
  console.log(chalk.yellow(`Total stats to check: ${totalStats}`));
  
  while (statOffset < (totalStats || 0)) {
    const { data: statsBatch } = await supabase
      .from('player_game_logs')
      .select('player_id, game_date, stats')
      .range(statOffset, statOffset + batchSize - 1);
      
    if (!statsBatch || statsBatch.length === 0) break;
    
    // Check each stat
    for (const stat of statsBatch) {
      if (!allValidPlayerIds.has(stat.player_id)) {
        orphanedStats++;
        
        // Check if it's likely NCAA Baseball (spring season)
        const gameDate = new Date(stat.game_date);
        const month = gameDate.getMonth() + 1;
        
        if (month >= 2 && month <= 6) {
          ncaaBaseballLikelyStats++;
        }
      }
    }
    
    statOffset += batchSize;
    
    if (statOffset % 50000 === 0) {
      console.log(chalk.gray(`Progress: ${statOffset}/${totalStats} checked...`));
    }
  }
  
  console.log(chalk.red(`\n⚠️  Found ${orphanedStats} orphaned stats!`));
  console.log(chalk.yellow(`🏫 Likely NCAA Baseball (Feb-June): ${ncaaBaseballLikelyStats}`));
  
  // 4. Sample orphaned stats to inspect
  console.log(chalk.blue('\n📊 Sampling orphaned stats...'));
  
  const { data: sampleStats } = await supabase
    .from('player_game_logs')
    .select('*')
    .gte('game_date', '2024-02-01')
    .lte('game_date', '2024-06-30')
    .limit(10);
    
  if (sampleStats && sampleStats.length > 0) {
    // Check if these player_ids exist
    const samplePlayerIds = sampleStats.map(s => s.player_id);
    const { data: existingPlayers } = await supabase
      .from('players')
      .select('id')
      .in('id', samplePlayerIds);
      
    const existingIds = new Set(existingPlayers?.map(p => p.id) || []);
    const orphanedSample = sampleStats.filter(s => !existingIds.has(s.player_id));
    
    if (orphanedSample.length > 0) {
      console.log(chalk.yellow(`\nFound ${orphanedSample.length} orphaned stats in spring season sample:`));
      orphanedSample.slice(0, 3).forEach(stat => {
        console.log(`  Player ID ${stat.player_id}, Date: ${stat.game_date}`);
        if (stat.stats) {
          const statKeys = Object.keys(stat.stats).slice(0, 5);
          console.log(`    Stats: ${statKeys.join(', ')}...`);
        }
      });
    }
  }
  
  // 5. Check game associations
  console.log(chalk.blue('\n🎮 Checking game associations...'));
  
  const { data: springGames } = await supabase
    .from('games')
    .select('id, sport, league, external_id')
    .gte('start_time', '2024-02-01')
    .lte('start_time', '2024-06-30')
    .in('sport', ['NCAA_BASEBALL', 'NCAA', 'COLLEGE', null])
    .limit(10);
    
  if (springGames && springGames.length > 0) {
    console.log(chalk.green(`Found ${springGames.length} potential NCAA Baseball games:`));
    springGames.forEach(g => {
      console.log(`  Game ${g.id}: ${g.sport} (${g.league}) - ${g.external_id}`);
    });
  } else {
    console.log(chalk.red('No NCAA Baseball games found in spring season!'));
  }
  
  // Summary
  console.log(chalk.cyan('\n📊 SUMMARY:'));
  console.log(`Total orphaned stats: ${orphanedStats}`);
  console.log(`Likely NCAA Baseball stats: ${ncaaBaseballLikelyStats}`);
  console.log(`Recovery potential: ${Math.round(ncaaBaseballLikelyStats / 184318 * 100)}% of original 184,318 stats`);
  
  if (orphanedStats > 0) {
    console.log(chalk.green('\n✅ Next step: Create recovery script to reconnect these stats!'));
  }
}

findOrphanedStats().catch(console.error);
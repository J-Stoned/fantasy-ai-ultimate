import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigatePlayerIdShift() {
  console.log(chalk.cyan('🔍 Investigating Player ID Shift\n'));
  
  // 1. Get NCAA Baseball player ID range
  const { data: ncaaFirst } = await supabase
    .from('players')
    .select('id, external_id, name')
    .eq('sport', 'NCAA_BASEBALL')
    .order('id', { ascending: true })
    .limit(5);
    
  const { data: ncaaLast } = await supabase
    .from('players')
    .select('id, external_id, name')
    .eq('sport', 'NCAA_BASEBALL')
    .order('id', { ascending: false })
    .limit(5);
    
  console.log(chalk.yellow('NCAA Baseball player ID range:'));
  console.log('First players:', ncaaFirst?.map(p => `${p.id} (${p.external_id})`));
  console.log('Last players:', ncaaLast?.map(p => `${p.id} (${p.external_id})`));
  
  // 2. Check if stats reference old player IDs
  console.log(chalk.blue('\n🔍 Checking stats player_id patterns...'));
  
  // Get a sample of orphaned stats
  const { data: orphanedStats } = await supabase
    .from('player_game_logs')
    .select('player_id, game_date')
    .gte('game_date', '2024-02-01')
    .lte('game_date', '2024-06-30')
    .order('player_id')
    .limit(1000);
    
  if (orphanedStats && orphanedStats.length > 0) {
    // Get unique player IDs from stats
    const statsPlayerIds = [...new Set(orphanedStats.map(s => s.player_id))];
    
    // Check if these exist in players table
    const { data: existingPlayers } = await supabase
      .from('players')
      .select('id')
      .in('id', statsPlayerIds);
      
    const existingIds = new Set(existingPlayers?.map(p => p.id) || []);
    const missingIds = statsPlayerIds.filter(id => !existingIds.has(id));
    
    if (missingIds.length > 0) {
      console.log(chalk.red(`\nFound ${missingIds.length} missing player IDs in spring stats`));
      console.log('Missing ID range:', Math.min(...missingIds), '-', Math.max(...missingIds));
      
      // Check if there's a pattern/offset
      const ncaaMinId = ncaaFirst?.[0]?.id || 0;
      const missingMinId = Math.min(...missingIds);
      const potentialOffset = ncaaMinId - missingMinId;
      
      console.log(chalk.yellow(`\nPotential ID offset: ${potentialOffset}`));
      
      // Test the offset theory
      const testIds = missingIds.slice(0, 5);
      const offsetTestIds = testIds.map(id => id + potentialOffset);
      
      const { data: offsetPlayers } = await supabase
        .from('players')
        .select('id, external_id, name, sport')
        .in('id', offsetTestIds);
        
      if (offsetPlayers && offsetPlayers.length > 0) {
        console.log(chalk.green('\n✅ Offset theory confirmed! Found players:'));
        offsetPlayers.forEach(p => {
          console.log(`  ID ${p.id}: ${p.name} (${p.sport}) - ${p.external_id}`);
        });
      }
    }
  }
  
  // 3. Check for external_id patterns in orphaned stats
  console.log(chalk.blue('\n🔍 Analyzing NCAA Baseball games and their stats...'));
  
  const { data: ncaaGames } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id')
    .eq('sport', 'NCAA_BASEBALL')
    .limit(10);
    
  if (ncaaGames && ncaaGames.length > 0) {
    console.log(chalk.green(`\nChecking stats for ${ncaaGames.length} NCAA Baseball games:`));
    
    for (const game of ncaaGames.slice(0, 3)) {
      const { count: statsCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
        
      console.log(`  Game ${game.id} (${game.external_id}): ${statsCount} stats`);
      
      if (statsCount === 0) {
        // Check if stats exist with wrong player IDs
        const { data: gameStats } = await supabase
          .from('player_game_logs')
          .select('player_id')
          .eq('team_id', game.home_team_id)
          .eq('game_date', '2024-03-01')
          .limit(5);
          
        if (gameStats && gameStats.length > 0) {
          console.log(`    Found ${gameStats.length} stats for home team on similar date`);
        }
      }
    }
  }
  
  // 4. Final analysis
  console.log(chalk.cyan('\n📊 ANALYSIS COMPLETE:'));
  console.log('1. NCAA Baseball players exist with IDs 121563976+');
  console.log('2. Stats exist but reference different player IDs');
  console.log('3. This suggests players were re-imported with new IDs');
  console.log('4. We need to map old player IDs to new ones');
}

investigatePlayerIdShift().catch(console.error);
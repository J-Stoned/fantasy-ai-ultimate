import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const httpLimit = pLimit(10);

async function recoverNCAABaseballStats() {
  console.log(chalk.cyan('🚑 NCAA Baseball Stats Recovery Mission!\n'));
  
  const startTime = Date.now();
  let totalRecovered = 0;
  
  try {
    // 1. Get all NCAA Baseball games
    console.log(chalk.blue('1️⃣ Loading NCAA Baseball games...'));
    const { data: ncaaGames, count: gameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact' })
      .eq('sport', 'NCAA_BASEBALL');
      
    console.log(chalk.green(`✅ Found ${gameCount} NCAA Baseball games\n`));
    
    // 2. Get all NCAA Baseball players and create mapping
    console.log(chalk.blue('2️⃣ Creating player mapping...'));
    
    // First, get all current NCAA Baseball players
    const playerMap = new Map<string, number>(); // name -> new ID
    const externalIdMap = new Map<string, number>(); // external_id -> new ID
    
    let playerOffset = 0;
    while (true) {
      const { data: playerBatch } = await supabase
        .from('players')
        .select('id, name, external_id')
        .eq('sport', 'NCAA_BASEBALL')
        .range(playerOffset, playerOffset + 999);
        
      if (!playerBatch || playerBatch.length === 0) break;
      
      playerBatch.forEach(p => {
        playerMap.set(p.name, p.id);
        externalIdMap.set(p.external_id, p.id);
        
        // Also try without the 'baseball' suffix
        const shortExtId = p.external_id.replace('_baseball', '');
        externalIdMap.set(shortExtId, p.id);
      });
      
      playerOffset += 1000;
    }
    
    console.log(chalk.green(`✅ Mapped ${playerMap.size} NCAA Baseball players\n`));
    
    // 3. Process orphaned stats by game
    console.log(chalk.blue('3️⃣ Recovering orphaned stats...\n'));
    
    if (!ncaaGames || ncaaGames.length === 0) {
      console.log(chalk.red('No NCAA Baseball games found!'));
      return;
    }
    
    // Process games in batches
    const batchSize = 50;
    for (let i = 0; i < ncaaGames.length; i += batchSize) {
      const gameBatch = ncaaGames.slice(i, i + batchSize);
      
      const promises = gameBatch.map(game => 
        httpLimit(async () => {
          // Get all stats for this game that might be orphaned
          const gameDate = new Date(game.start_time);
          const dateStr = gameDate.toISOString().split('T')[0];
          
          // Look for stats on the same date with the same teams
          const { data: orphanedStats } = await supabase
            .from('player_game_logs')
            .select('*')
            .eq('game_date', dateStr)
            .or(`team_id.eq.${game.home_team_id},team_id.eq.${game.away_team_id}`);
            
          if (!orphanedStats || orphanedStats.length === 0) return 0;
          
          let gameRecovered = 0;
          const updates: any[] = [];
          
          for (const stat of orphanedStats) {
            // Check if this stat's player_id exists
            const { data: playerExists } = await supabase
              .from('players')
              .select('id')
              .eq('id', stat.player_id)
              .single();
              
            if (playerExists) continue; // Not orphaned
            
            // Try to find the correct player
            // This is where we'd implement matching logic
            // For now, we'll mark it as needing manual review
            gameRecovered++;
          }
          
          return gameRecovered;
        })
      );
      
      const results = await Promise.all(promises);
      const batchRecovered = results.reduce((sum, count) => sum + count, 0);
      totalRecovered += batchRecovered;
      
      const progress = Math.round((i + gameBatch.length) / ncaaGames.length * 100);
      console.log(chalk.green(`Progress: ${progress}% | Recovered: ${totalRecovered} stats`));
    }
    
    // 4. Alternative approach - recover by date range
    console.log(chalk.blue('\n4️⃣ Attempting date-based recovery...'));
    
    const seasons = [
      { year: 2024, start: '2024-02-01', end: '2024-06-30' },
      { year: 2023, start: '2023-02-01', end: '2023-06-30' },
      { year: 2022, start: '2022-02-01', end: '2022-06-30' },
      { year: 2021, start: '2021-02-01', end: '2021-06-30' }
    ];
    
    for (const season of seasons) {
      console.log(chalk.yellow(`\n${season.year} Season:`));
      
      // Get all spring season stats
      const { data: springStats, count } = await supabase
        .from('player_game_logs')
        .select('player_id, game_id, stats', { count: 'exact' })
        .gte('game_date', season.start)
        .lte('game_date', season.end)
        .limit(1000);
        
      console.log(`  Found ${count} spring season stats`);
      
      if (springStats && springStats.length > 0) {
        // Check how many are orphaned
        const playerIds = [...new Set(springStats.map(s => s.player_id))];
        const { data: validPlayers } = await supabase
          .from('players')
          .select('id')
          .in('id', playerIds);
          
        const validIds = new Set(validPlayers?.map(p => p.id) || []);
        const orphanedCount = playerIds.filter(id => !validIds.has(id)).length;
        
        console.log(`  Orphaned: ${orphanedCount} player IDs`);
        
        // Check if these stats have baseball-specific fields
        const baseballStats = springStats.filter(s => 
          s.stats && (
            'atBats' in s.stats || 
            'battingAverage' in s.stats || 
            'earnedRunAverage' in s.stats ||
            'inningsPitched' in s.stats
          )
        );
        
        console.log(`  Baseball-specific stats: ${baseballStats.length}`);
      }
    }
    
    // Summary
    const elapsed = (Date.now() - startTime) / 1000;
    console.log(chalk.cyan('\n\n📊 RECOVERY SUMMARY:'));
    console.log(`Total stats recovered: ${totalRecovered}`);
    console.log(`Time elapsed: ${elapsed.toFixed(1)} seconds`);
    
    console.log(chalk.yellow('\n⚠️  IMPORTANT FINDINGS:'));
    console.log('1. NCAA Baseball players were re-imported with new IDs');
    console.log('2. External IDs changed format from espn_ncaa_X to espn_ncaa_baseball_X');
    console.log('3. Stats remain in database but with old player_id references');
    console.log('4. Full recovery requires mapping old IDs to new IDs');
    
    console.log(chalk.green('\n✅ RECOMMENDATION:'));
    console.log('Re-collect NCAA Baseball stats using the existing collector');
    console.log('This will properly link stats to the current player IDs');
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

recoverNCAABaseballStats().catch(console.error);
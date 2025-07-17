#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAllSportsStatus() {
  console.log(chalk.bold.cyan('📊 COMPLETE SPORTS DATA STATUS CHECK\n'));
  
  const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
  
  for (const sport of sports) {
    console.log(chalk.bold.yellow(`\n${sport} STATUS:`));
    console.log(chalk.gray('='.repeat(50)));
    
    // 1. TEAMS
    const { count: totalTeams } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
      
    const { count: teamsWithExternal } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .not('external_id', 'is', null);
      
    // Check for duplicate teams manually
    const { data: allTeams } = await supabase
      .from('teams')
      .select('name')
      .eq('sport', sport);
      
    const nameCounts: Record<string, number> = {};
    allTeams?.forEach(team => {
      nameCounts[team.name] = (nameCounts[team.name] || 0) + 1;
    });
    const duplicateTeams = Object.entries(nameCounts).filter(([_, count]) => count > 1);
    
    console.log(chalk.cyan('TEAMS:'));
    console.log(chalk.white(`  Total: ${totalTeams}`));
    console.log(chalk.white(`  With ESPN IDs: ${teamsWithExternal}`));
    console.log(chalk.white(`  Duplicates: ${duplicateTeams?.length || 0}`));
    
    // 2. GAMES
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
      
    const { count: games2021 } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .gte('start_time', '2021-01-01')
      .lt('start_time', '2022-01-01');
      
    const { count: games2022 } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .gte('start_time', '2022-01-01')
      .lt('start_time', '2023-01-01');
      
    console.log(chalk.cyan('\nGAMES:'));
    console.log(chalk.white(`  Total: ${totalGames}`));
    console.log(chalk.white(`  2021: ${games2021}`));
    console.log(chalk.white(`  2022: ${games2022}`));
    
    // 3. PLAYERS
    const { count: totalPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
      
    const { count: playersWithExternal } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .not('external_id', 'is', null);
      
    console.log(chalk.cyan('\nPLAYERS:'));
    console.log(chalk.white(`  Total: ${totalPlayers}`));
    console.log(chalk.white(`  With ESPN IDs: ${playersWithExternal}`));
    
    // 4. STATS
    let statsCount = 0;
    if (sport === 'NFL') {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('stats->>sport', sport);
      statsCount = count || 0;
    }
    
    console.log(chalk.cyan('\nSTATS:'));
    console.log(chalk.white(`  Total: ${statsCount}`));
    
    // 5. READINESS
    const isReady = teamsWithExternal === totalTeams && 
                   teamsWithExternal > 0 && 
                   totalGames > 0;
    
    console.log(chalk.cyan('\nREADINESS:'));
    if (isReady) {
      console.log(chalk.green(`  ✅ Ready for data collection`));
    } else {
      console.log(chalk.red(`  ❌ Needs team consolidation first`));
      if (teamsWithExternal !== totalTeams) {
        console.log(chalk.yellow(`     - ${totalTeams - teamsWithExternal} teams without ESPN IDs`));
      }
    }
  }
  
  // SUMMARY
  console.log(chalk.bold.cyan('\n\nSUMMARY:'));
  console.log(chalk.gray('='.repeat(50)));
  
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
    
  const { count: totalStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
    
  console.log(chalk.white(`Total games in database: ${totalGames}`));
  console.log(chalk.white(`Total player stats: ${totalStats}`));
  
  // Check for sports ready for historical collection
  console.log(chalk.cyan('\nREADY FOR HISTORICAL COLLECTION:'));
  for (const sport of sports) {
    const { count: teams } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .not('external_id', 'is', null);
      
    const { count: duplicates } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .is('external_id', null);
      
    if (teams && teams > 0 && duplicates === 0) {
      console.log(chalk.green(`  ✅ ${sport}`));
    } else {
      console.log(chalk.red(`  ❌ ${sport} (${duplicates} teams without ESPN IDs)`));
    }
  }
}

checkAllSportsStatus().catch(console.error);
#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check2021Status() {
  console.log(chalk.cyan('\n🏆 2021 SEASON COLLECTION FINAL STATUS\n'));
  
  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB', 'NCAA_BASEBALL'];
  let totalGames = 0;
  let totalStats = 0;
  
  for (const sport of sports) {
    const { count: gameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .or(`metadata->>season.eq.2021,metadata->>season.eq."2021-22"`)
      .order('id');
      
    totalGames += gameCount || 0;
    
    console.log(chalk.yellow(`${sport}:`));
    console.log(chalk.green(`  Games: ${gameCount || 0}`));
  }
  
  // Check total stats in database
  const { count: allStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
    
  // Check stats by checking games from 2021
  const { data: sample2021Games } = await supabase
    .from('games')
    .select('id')
    .or(`metadata->>season.eq.2021,metadata->>season.eq."2021-22"`)
    .limit(100);
    
  const gameIds = sample2021Games?.map(g => g.id) || [];
  
  const { count: stats2021Sample } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('game_id', gameIds);
    
  console.log(chalk.blue('\n📊 Overall Stats:'));
  console.log(chalk.blue(`  Total 2021 games collected: ${totalGames}`));
  console.log(chalk.blue(`  Total stats in database: ${allStats || 0}`));
  console.log(chalk.blue(`  Stats in 100 sample 2021 games: ${stats2021Sample || 0}`));
  
  // Show recent additions
  const { data: recentGames } = await supabase
    .from('games')
    .select('sport, start_time, home_score, away_score')
    .or(`metadata->>season.eq.2021,metadata->>season.eq."2021-22"`)
    .order('id', { ascending: false })
    .limit(5);
    
  console.log(chalk.gray('\nRecent 2021 games added:'));
  recentGames?.forEach(g => {
    console.log(chalk.gray(`  ${g.sport}: ${g.start_time?.split('T')[0]} (${g.home_score}-${g.away_score})`));
  });
}

check2021Status().catch(console.error);
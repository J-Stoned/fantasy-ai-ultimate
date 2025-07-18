import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMiLBData() {
  console.log(chalk.cyan('🔍 Checking MiLB Data\n'));
  
  // Check games
  const { count: gameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MILB');
    
  console.log(chalk.yellow(`MiLB games: ${gameCount || 0}`));
  
  // Check teams
  const { count: teamCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MILB');
    
  console.log(chalk.yellow(`MiLB teams: ${teamCount || 0}`));
  
  // Check players
  const { count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MILB');
    
  console.log(chalk.yellow(`MiLB players: ${playerCount || 0}`));
  
  // Check stats
  const { data: players } = await supabase
    .from('players')
    .select('id')
    .eq('sport', 'MILB')
    .limit(1000);
    
  if (players && players.length > 0) {
    const playerIds = players.map(p => p.id);
    
    const { count: statsCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('player_id', playerIds);
      
    console.log(chalk.yellow(`MiLB stats (sample): ${statsCount || 0}`));
    
    // Get a sample stat to see what fields we're collecting
    const { data: sampleStat } = await supabase
      .from('player_game_logs')
      .select('stats')
      .in('player_id', playerIds)
      .limit(1);
      
    if (sampleStat && sampleStat[0]) {
      console.log(chalk.green('\nSample stat fields:'));
      console.log(Object.keys(sampleStat[0].stats));
    }
  }
}

checkMiLBData().catch(console.error);
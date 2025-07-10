#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkData() {
  console.log(chalk.cyan('🔍 Checking available data...'));
  
  // Check sports available
  const { data: players } = await supabase
    .from('players')
    .select('sport')
    .limit(100);
    
  const sports = [...new Set(players?.map(p => p.sport).filter(Boolean))];
  console.log(chalk.white('Available sports:'), sports);
  
  // Check player counts by sport
  for (const sport of sports) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
    console.log(chalk.white(`${sport}: ${count} players`));
  }
  
  // Check some actual players with stats
  const { data: samplePlayers } = await supabase
    .from('players')
    .select(`
      id, 
      name, 
      position, 
      team, 
      sport,
      player_stats(fantasy_points, stat_type)
    `)
    .limit(10);
    
  console.log(chalk.cyan('\nSample players:'));
  samplePlayers?.forEach(p => {
    const hasStats = p.player_stats && p.player_stats.length > 0;
    const statCount = p.player_stats?.length || 0;
    console.log(chalk.white(`- ${p.name} (${p.position}) - ${p.sport} - ${statCount} stats`));
  });
  
  // Check what positions we have
  const { data: allPlayers } = await supabase
    .from('players')
    .select('position')
    .limit(200);
    
  const positions = [...new Set(allPlayers?.map(p => p.position).flat().filter(Boolean))];
  console.log(chalk.cyan('\nAvailable positions:'), positions);
}

checkData().catch(console.error);
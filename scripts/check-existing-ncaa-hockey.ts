#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkExistingNCAAHockey() {
  console.log(chalk.cyan('\n🏒 Checking existing NCAA Hockey data...\n'));
  
  // Check teams
  const { data: teams, count: teamCount } = await supabase
    .from('teams')
    .select('external_id, name', { count: 'exact' })
    .eq('sport', 'NCAA_HKY')
    .limit(5);
    
  console.log(chalk.yellow('NCAA Hockey Teams:'), teamCount || 0);
  teams?.forEach(t => console.log('  ', t.external_id, '-', t.name));
  
  // Check games and their seasons
  const { data: games } = await supabase
    .from('games')
    .select('external_id, start_time, metadata, home_score, away_score')
    .eq('sport', 'NCAA_HKY')
    .order('start_time', { ascending: false })
    .limit(10);
    
  console.log(chalk.yellow('\nRecent NCAA Hockey games:'));
  games?.forEach(g => {
    const date = g.start_time?.split('T')[0];
    const season = g.metadata?.season || 'unknown';
    console.log('  ', date, `(${season})`, g.external_id, `Score: ${g.home_score}-${g.away_score}`);
  });
  
  // Check season distribution
  const { data: allGames } = await supabase
    .from('games')
    .select('metadata')
    .eq('sport', 'NCAA_HKY');
    
  const seasonCounts: any = {};
  allGames?.forEach(g => {
    const season = g.metadata?.season || 'unknown';
    seasonCounts[season] = (seasonCounts[season] || 0) + 1;
  });
  
  console.log(chalk.yellow('\nGames by season:'));
  Object.entries(seasonCounts).forEach(([season, count]) => {
    console.log('  ', season + ':', count);
  });
  
  // Check total
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_HKY');
    
  console.log(chalk.blue('\nTotal NCAA Hockey games:'), totalGames || 0);
  
  // Check sample external IDs to understand format
  const { data: sampleIds } = await supabase
    .from('games')
    .select('external_id')
    .eq('sport', 'NCAA_HKY')
    .limit(5);
    
  console.log(chalk.gray('\nSample game external IDs:'));
  sampleIds?.forEach(g => console.log('  ', g.external_id));
}

checkExistingNCAAHockey().catch(console.error);
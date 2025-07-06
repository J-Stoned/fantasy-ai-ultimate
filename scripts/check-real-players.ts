#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRealPlayers() {
  // Search for some key players
  const keyPlayers = ['Mahomes', 'McCaffrey', 'Kelce', 'Jefferson', 'Allen'];
  
  console.log(chalk.cyan('🔍 Searching for real NFL players...'));
  
  for (const player of keyPlayers) {
    const { data, count } = await supabase
      .from('players')
      .select('*', { count: 'exact' })
      .ilike('name', `%${player}%`)
      .limit(5);
      
    console.log(chalk.yellow(`\n${player}:`));
    if (data && data.length > 0) {
      data.forEach(p => {
        console.log(`  - ${p.name} (${p.position}) - ${p.team} - ${p.sport}`);
      });
    } else {
      console.log(chalk.red('  No players found'));
    }
  }
  
  // Check total NFL players
  const { count: nflCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'nfl');
    
  const { count: footballCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'football');
    
  console.log(chalk.cyan('\n📊 Total counts:'));
  console.log(`NFL players: ${nflCount || 0}`);
  console.log(`Football players: ${footballCount || 0}`);
}

checkRealPlayers().catch(console.error);
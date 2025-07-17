#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigatePanthers() {
  // Check which team has espn_nhl_4
  const { data: espn4Team } = await supabase
    .from('teams')
    .select('id, name, sport, external_id')
    .eq('external_id', 'espn_nhl_4')
    .single();
    
  console.log(chalk.yellow('Team with espn_nhl_4:'));
  console.log(espn4Team);
  
  // Check the "NFL Florida Panthers" team
  const { data: nflPanthers } = await supabase
    .from('teams')
    .select('*')
    .eq('id', 145)
    .single();
    
  console.log(chalk.yellow('\nNFL Florida Panthers (ID 145):'));
  console.log(nflPanthers);
  
  // Check games referencing team 145
  console.log(chalk.yellow('\nChecking games with team 145:'));
  const { data: games } = await supabase
    .from('games')
    .select('id, sport, home_team_id, away_team_id, external_id')
    .or('home_team_id.eq.145,away_team_id.eq.145')
    .limit(5);
    
  console.log(`Found ${games?.length} games (showing first 5):`);
  games?.forEach(g => {
    console.log(`  Game ${g.id}: ${g.sport} sport, home=${g.home_team_id}, away=${g.away_team_id}, external=${g.external_id}`);
  });
  
  // Find the correct ESPN ID for Florida Panthers
  console.log(chalk.yellow('\nFinding correct ESPN ID for Florida Panthers...'));
  console.log('Florida Panthers should have ESPN ID 13 (based on NHL.com team IDs)');
  
  // Check who has espn_nhl_13
  const { data: espn13Team } = await supabase
    .from('teams')
    .select('id, name, sport, external_id')
    .eq('external_id', 'espn_nhl_13')
    .single();
    
  console.log(chalk.yellow('\nTeam with espn_nhl_13:'));
  console.log(espn13Team);
}

investigatePanthers().catch(console.error);
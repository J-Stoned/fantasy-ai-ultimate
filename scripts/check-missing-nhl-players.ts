#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNHLPlayers() {
  const missingPlayers = [
    'Nico Hischier',
    'Jesper Bratt', 
    'Jared McCann',
    'Torey Krug',
    'Alex Pietrangelo',
    'Mark Stone'
  ];
  
  console.log('Checking supposedly missing NHL players...\n');
  
  for (const player of missingPlayers) {
    // Search for variations
    const { data } = await supabase
      .from('players')
      .select('id, name, sport_id')
      .ilike('name', `%${player.split(' ')[1]}%`)
      .in('sport_id', ['NHL', 'nhl'])
      .limit(5);
      
    console.log(`${player}:`);
    if (data && data.length > 0) {
      data.forEach(p => console.log(`  - Found: "${p.name}" (sport_id: ${p.sport_id})`));
    } else {
      console.log('  - Not found in database');
    }
  }
  
  // Check total NHL players
  console.log('\n\nChecking NHL player totals:');
  const { count: nhlUpper } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'NHL');
    
  const { count: nhlLower } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nhl');
    
  console.log(`NHL (uppercase): ${nhlUpper}`);
  console.log(`nhl (lowercase): ${nhlLower}`);
  
  // Check if these are star players missing
  console.log('\n\nThese missing players are likely:');
  console.log('1. Recently traded/signed players not in our database');
  console.log('2. Players on injured reserve who were recently called up');
  console.log('3. AHL players getting NHL time due to injuries');
}

checkNHLPlayers().catch(console.error);
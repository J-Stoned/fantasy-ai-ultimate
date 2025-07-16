#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMLBPlayers() {
  // Check MLB player count
  const { count: mlbCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'mlb');
    
  console.log(`MLB players in database: ${mlbCount}`);
  
  // Get sample MLB players
  const { data: samplePlayers } = await supabase
    .from('players')
    .select('id, name, sport_id, team_id')
    .eq('sport_id', 'mlb')
    .limit(10);
    
  console.log('\nSample MLB players:');
  samplePlayers?.forEach(p => console.log(`- ${p.name} (Team: ${p.team_id})`));
  
  // Check total player count by sport
  console.log('\nTotal players by sport:');
  for (const sport of ['nba', 'NFL', 'NHL', 'mlb']) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', sport);
    console.log(`${sport}: ${count}`);
  }
  
  // Check if there are more MLB players with different formats
  const { data: allPlayers, count: totalCount } = await supabase
    .from('players')
    .select('sport_id', { count: 'exact' })
    .ilike('sport_id', '%mlb%');
    
  console.log(`\nTotal players with 'mlb' in sport_id: ${totalCount}`);
  
  // Check unique sport_id values
  const { data: sports } = await supabase
    .from('players')
    .select('sport_id')
    .limit(1000);
    
  const uniqueSports = new Set(sports?.map(s => s.sport_id));
  console.log('\nUnique sport_id values found:');
  Array.from(uniqueSports).forEach(sport => console.log(`- "${sport}"`));
}

checkMLBPlayers().catch(console.error);
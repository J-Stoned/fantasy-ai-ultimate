#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTeams() {
  // Get MLB teams
  const { data: mlbTeams } = await supabase
    .from('teams')
    .select('id, name, abbreviation')
    .eq('sport', 'MLB')
    .order('name');
    
  console.log('MLB Teams:');
  mlbTeams?.forEach(t => console.log(`  ${t.id}: ${t.name} (${t.abbreviation || 'N/A'})`));
  
  // Get NHL teams
  const { data: nhlTeams } = await supabase
    .from('teams')
    .select('id, name, abbreviation')
    .eq('sport', 'NHL')
    .order('name');
    
  console.log('\n\nNHL Teams:');
  nhlTeams?.forEach(t => console.log(`  ${t.id}: ${t.name} (${t.abbreviation || 'N/A'})`));
}

checkTeams().catch(console.error);
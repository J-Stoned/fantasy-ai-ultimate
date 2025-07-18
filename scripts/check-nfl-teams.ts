#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNFLTeams() {
  const { data: nflTeams } = await supabase
    .from('teams')
    .select('*')
    .eq('sport', 'NFL')
    .order('name');
    
  console.log('NFL Teams in database:');
  console.log('Count:', nflTeams?.length || 0);
  console.log('');
  
  if (nflTeams) {
    nflTeams.forEach((team, i) => {
      console.log(`${i+1}. ${team.name} - ID: ${team.id} - External: ${team.external_id}`);
    });
  }
  
  // Check if any are missing external_ids
  const withoutExternalId = nflTeams?.filter(t => !t.external_id) || [];
  const withExternalId = nflTeams?.filter(t => t.external_id) || [];
  
  console.log('\nSummary:');
  console.log(`Teams with external_id: ${withExternalId.length}`);
  console.log(`Teams without external_id: ${withoutExternalId.length}`);
  
  if (withoutExternalId.length > 0) {
    console.log('\nTeams missing external_id:');
    withoutExternalId.forEach(team => {
      console.log(`  ${team.name} (ID: ${team.id})`);
    });
  }
}

checkNFLTeams().catch(console.error);
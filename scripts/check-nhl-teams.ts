#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNHLTeams() {
  const { data: teams, count } = await supabase
    .from('teams')
    .select('name, external_id', { count: 'exact' })
    .or('sport_id.eq.nhl,sport_id.eq.NHL');
  
  console.log('🏒 NHL Teams Check:');
  console.log('Total NHL teams:', count);
  
  if (!teams || teams.length === 0) {
    console.log('\n❌ No NHL teams found! Need to collect them first.');
    console.log('Expected: 32 NHL teams');
  } else {
    console.log('\n✅ NHL teams found!');
    console.log('Sample teams:');
    teams.slice(0, 5).forEach(t => console.log(' -', t.name, `(${t.external_id})`));
  }
}

checkNHLTeams().catch(console.error);
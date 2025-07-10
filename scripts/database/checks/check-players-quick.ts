#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Check player count
  const { count } = await supabase.from('players').select('*', { count: 'exact', head: true });
  console.log('Total players:', count);
  
  // Get sample player IDs
  const { data: players } = await supabase.from('players').select('id, external_id, name').limit(10);
  console.log('\nSample players:');
  players?.forEach(p => console.log(`ID: ${p.id}, External: ${p.external_id}, Name: ${p.name}`));
  
  // Check if any auto-generated players exist
  const { data: autoPlayers } = await supabase
    .from('players')
    .select('id, external_id')
    .like('external_id', 'auto_%')
    .limit(5);
  console.log('\nAuto-generated players:', autoPlayers?.length || 0);
  
  // Check max player ID
  const { data: maxPlayer } = await supabase
    .from('players')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);
  console.log('\nMax player ID:', maxPlayer?.[0]?.id);
}

check().catch(console.error);
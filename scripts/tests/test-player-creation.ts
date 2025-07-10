#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  // Check if external_id column exists
  const { data: columns, error: schemaError } = await supabase
    .rpc('get_table_columns', { table_name: 'players' });
    
  console.log('Players table columns:', columns);
  
  // Try to create a player without external_id
  const { data, error } = await supabase
    .from('players')
    .insert({
      name: 'Test Player Auto',
      team: 'Test Team',
      position: 'PG'
    })
    .select()
    .single();

  console.log('Created player:', data);
  console.log('Error:', error);
  
  // Try with external_id if it exists
  if (columns?.some((c: any) => c.column_name === 'external_id')) {
    const { data: data2, error: error2 } = await supabase
      .from('players')
      .upsert({
        external_id: 'test_external_123',
        name: 'Test Player External',
        team: 'Test Team',
        position: 'PG'
      }, { 
        onConflict: 'external_id'
      })
      .select()
      .single();

    console.log('Created with external_id:', data2);
    console.log('Error2:', error2);
  }
}

test().catch(console.error);
#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
  // Try to select all columns
  const { data, error } = await supabase
    .from('ml_predictions')
    .select('*')
    .limit(1);
  
  if (error) {
    console.log('Select error:', error);
    
    // Try minimal insert to see required fields
    const { error: insertError } = await supabase
      .from('ml_predictions')
      .insert({ game_id: 1 });
    
    console.log('\nInsert error (shows required fields):', insertError);
  } else {
    console.log('Table exists, sample row:', data);
  }
}

checkSchema().catch(console.error);
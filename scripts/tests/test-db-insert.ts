#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testInsert() {
  // First, let's see what's in the table
  const { data: existing, error: fetchError } = await supabase
    .from('ml_predictions')
    .select('*')
    .limit(1);
    
  console.log('Existing record:', existing?.[0]);
  
  // Try a simple insert
  const { data, error } = await supabase
    .from('ml_predictions')
    .insert({
      game_id: 99999,
      prediction: 'home',
      confidence: 75.5,
      created_at: new Date().toISOString()
    })
    .select();
    
  if (error) {
    console.error('Insert error:', error);
  } else {
    console.log('Success! Inserted:', data);
  }
}

testInsert();
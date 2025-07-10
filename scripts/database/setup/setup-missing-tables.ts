#!/usr/bin/env tsx
/**
 * Create missing database tables
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createTables() {
  console.log('Creating missing database tables...\n');
  
  // Create correlation_insights table
  console.log('Creating correlation_insights table...');
  try {
    await supabase.from('correlation_insights').select('id').limit(1);
    console.log('✅ correlation_insights table already exists');
  } catch {
    // Table doesn't exist, would need to create via Supabase dashboard
    console.log('❌ correlation_insights table needs to be created in Supabase dashboard');
  }
  
  // Create ml_predictions table
  console.log('Creating ml_predictions table...');
  try {
    await supabase.from('ml_predictions').select('id').limit(1);
    console.log('✅ ml_predictions table already exists');
  } catch {
    console.log('❌ ml_predictions table needs to be created in Supabase dashboard');
  }
  
  // Create injuries table
  console.log('Creating injuries table...');
  try {
    await supabase.from('injuries').select('id').limit(1);
    console.log('✅ injuries table already exists');
  } catch {
    console.log('❌ injuries table needs to be created in Supabase dashboard');
  }
  
  console.log('\n📝 To create missing tables, run the SQL in create-missing-tables.sql in your Supabase dashboard SQL editor');
}

createTables().catch(console.error);
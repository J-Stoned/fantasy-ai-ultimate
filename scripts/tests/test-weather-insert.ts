#!/usr/bin/env tsx
/**
 * Test weather data insertion
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testWeatherInsert() {
  console.log('Testing weather_data insert...\n');
  
  // Try to insert test data
  const { data, error } = await supabase.from('weather_data').insert({
    location: 'Test City',
    temperature: 75,
    conditions: 'Clear',
    wind_speed: 10,
    humidity: 50,
    created_at: new Date().toISOString()
  });
  
  if (error) {
    console.error('❌ Insert failed:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
  } else {
    console.log('✅ Insert successful:', data);
  }
  
  // Check table structure
  const { data: tableInfo, error: infoError } = await supabase
    .from('weather_data')
    .select('*')
    .limit(1);
  
  if (infoError) {
    console.error('\n❌ Table query error:', infoError);
  } else {
    console.log('\n✅ Table exists and is queryable');
  }
}

testWeatherInsert();
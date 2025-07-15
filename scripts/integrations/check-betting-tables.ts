#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTables() {
  console.log('🔍 Checking betting tables...\n');
  
  // Test insert into betting_opportunities
  const { data, error } = await supabase
    .from('betting_opportunities')
    .insert({
      source: 'test',
      pattern_type: 'altitude_advantage',
      confidence: 0.683,
      expected_value: 0.304,
      bet_type: 'total',
      selection: 'over',
      odds: -110,
      suggested_wager: 84
    })
    .select();
  
  if (error) {
    console.log('❌ Table might not exist:', error.message);
    console.log('\n📝 To create the tables, run this SQL in Supabase dashboard:\n');
    console.log(`
CREATE TABLE IF NOT EXISTS betting_opportunities (
  id SERIAL PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  event_name VARCHAR(255),
  pattern_type VARCHAR(100),
  confidence DECIMAL(5,4),
  expected_value DECIMAL(10,4),
  bet_type VARCHAR(20),
  selection VARCHAR(100),
  market_type VARCHAR(50),
  odds INTEGER,
  kelly_size DECIMAL(5,2),
  suggested_wager DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`);
  } else {
    console.log('✅ Table exists! Test record:', data);
    
    // Clean up test data
    await supabase
      .from('betting_opportunities')
      .delete()
      .eq('source', 'test');
  }
}

checkTables().catch(console.error);
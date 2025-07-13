import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  console.log('Checking games table schema...\n');
  
  // Get a sample game to see the schema
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('Games table columns:', Object.keys(data[0]));
    console.log('\nSample game:', JSON.stringify(data[0], null, 2));
  } else {
    console.log('No games found in the database');
  }

  // Also check player_game_logs schema
  const { data: logs, error: logsError } = await supabase
    .from('player_game_logs')
    .select('*')
    .limit(1);
  
  if (!logsError && logs && logs.length > 0) {
    console.log('\nPlayer game logs columns:', Object.keys(logs[0]));
  }
}

checkSchema().catch(console.error);
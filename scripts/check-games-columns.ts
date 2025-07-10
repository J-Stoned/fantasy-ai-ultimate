import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function checkGamesTableSchema() {
  // Get table schema information
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('Games table columns:');
    console.log('==================');
    const sample = data[0];
    Object.keys(sample).forEach(column => {
      const value = sample[column];
      const type = typeof value;
      const sampleValue = JSON.stringify(value);
      console.log(`- ${column}: ${type} (sample: ${sampleValue.substring(0, 50)}${sampleValue.length > 50 ? '...' : ''})`);
    });
    
    console.log('\n\nFull sample record:');
    console.log(JSON.stringify(data[0], null, 2));
  }
}

checkGamesTableSchema().catch(console.error);
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Read environment
console.log('SUPABASE_URL exists:', \!\!process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('SUPABASE_KEY exists:', \!\!process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function quickCheck() {
  // Test basic query
  const { data, error, count } = await supabase
    .from('games')
    .select('sport', { count: 'exact' })
    .eq('sport', 'MLB')
    .limit(1);
    
  console.log('Query result:', { data, error, count });
  
  // Get all sports counts
  const sports = ['MLB', 'NBA', 'NFL', 'NHL'];
  for (const sport of sports) {
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
    console.log(`${sport} games:`, count);
  }
}

quickCheck().catch(console.error);

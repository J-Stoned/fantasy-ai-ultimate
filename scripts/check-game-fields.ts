import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function checkGameFields() {
  const { data: game } = await supabase
    .from('games')
    .select('*')
    .limit(1);
  
  if (game && game[0]) {
    console.log('Game fields:', Object.keys(game[0]));
    console.log('\nSample game:');
    console.log(JSON.stringify(game[0], null, 2));
  }
}

checkGameFields();
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function inspect() {
  // Get column info by trying to insert an empty object
  const { data, error } = await supabase
    .from('ml_predictions')
    .insert({})
    .select();
  
  if (error) {
    console.log('Error message:', error.message);
    console.log('Error details:', error.details);
    console.log('Error hint:', error.hint);
    
    // The error message usually tells us what columns are required
    // Let's try with just the game_id
    const { error: error2 } = await supabase
      .from('ml_predictions')
      .insert({ game_id: 1 })
      .select();
    
    if (error2) {
      console.log('\nError with game_id only:', error2.message);
    }
  }
  
  // Try to get table structure from information schema
  const { data: columns } = await supabase
    .rpc('get_table_info', { table_name: 'ml_predictions' })
    .single();
  
  if (columns) {
    console.log('\nTable columns:', columns);
  }
}

inspect().catch(console.error);
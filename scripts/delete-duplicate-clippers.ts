import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deleteDuplicate() {
  console.log('Deleting LA Clippers duplicate...');
  
  const { error } = await supabase
    .from('teams')
    .delete()
    .eq('name', 'LA Clippers')
    .eq('sport', 'NBA');
    
  if (!error) {
    console.log('✓ Deleted LA Clippers duplicate');
  } else {
    console.error('Error:', error);
  }
  
  // Verify final count
  const { count } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA');
    
  console.log('\nFinal NBA team count:', count);
  
  process.exit(0);
}

deleteDuplicate();
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixClippers() {
  console.log('🏀 Fixing LA Clippers...\n');
  
  // 1. Fix the Chargers back to NFL
  console.log('1. Fixing Los Angeles Chargers back to NFL...');
  const { error: chargersError } = await supabase
    .from('teams')
    .update({ sport: 'nfl' })
    .eq('name', 'Los Angeles Chargers');
    
  if (!chargersError) {
    console.log('  ✓ Fixed Chargers to NFL');
  }
  
  // 2. Delete duplicate Clippers entries and keep only one
  console.log('\n2. Cleaning up Clippers duplicates...');
  
  // Delete the short name version
  const { error: deleteError1 } = await supabase
    .from('teams')
    .delete()
    .eq('name', 'Clippers')
    .eq('sport', 'NBA');
    
  if (!deleteError1) {
    console.log('  ✓ Deleted "Clippers" entry');
  }
  
  // Delete the "LA Clippers" version
  const { error: deleteError2 } = await supabase
    .from('teams')
    .delete()
    .eq('name', 'LA Clippers')
    .eq('sport', 'NBA');
    
  if (!deleteError2) {
    console.log('  ✓ Deleted "LA Clippers" entry');
  }
  
  // 3. Create the proper Los Angeles Clippers entry
  console.log('\n3. Creating proper Los Angeles Clippers entry...');
  const { error: insertError } = await supabase
    .from('teams')
    .insert({
      external_id: 'espn_nba_12',
      name: 'Los Angeles Clippers',
      abbreviation: 'LAC',
      sport: 'NBA',
      city: 'Los Angeles'
    });
    
  if (!insertError) {
    console.log('  ✓ Created Los Angeles Clippers');
  } else if (insertError.code === '23505') {
    console.log('  Los Angeles Clippers already exists');
  } else {
    console.error('  Error:', insertError);
  }
  
  // 4. Final verification
  console.log('\n4. Final NBA team count:');
  const { data: nbaTeams, count } = await supabase
    .from('teams')
    .select('name, abbreviation', { count: 'exact' })
    .eq('sport', 'NBA')
    .order('name');
    
  console.log(`\nTotal NBA teams: ${count}`);
  if (count === 30) {
    console.log('✅ All 30 NBA teams present!');
  }
  
  // Show all LA teams to verify
  console.log('\nLA Teams verification:');
  const { data: laTeams } = await supabase
    .from('teams')
    .select('name, abbreviation, sport')
    .ilike('name', '%los angeles%')
    .order('sport');
    
  laTeams?.forEach(team => {
    console.log(`  - ${team.name} (${team.abbreviation}) - ${team.sport}`);
  });
  
  process.exit(0);
}

fixClippers();
#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNBATeams() {
  // Get all NBA teams
  const { data: nbaTeams } = await supabase
    .from('teams')
    .select('id, external_id, name')
    .eq('sport', 'NBA');
    
  console.log(`Total NBA teams: ${nbaTeams?.length}`);
  console.log('\nNon-compliant teams:');
  
  nbaTeams?.forEach(t => {
    if (!t.external_id?.startsWith('espn_nba_')) {
      console.log(`  ${t.name}: '${t.external_id}'`);
    }
  });
  
  // Let's manually fix these
  const nonCompliant = nbaTeams?.filter(t => !t.external_id?.startsWith('espn_nba_')) || [];
  
  if (nonCompliant.length > 0) {
    console.log(`\nFixing ${nonCompliant.length} teams...`);
    
    for (const team of nonCompliant) {
      if (team.external_id) {
        let newId = team.external_id;
        
        if (team.external_id.startsWith('nba_')) {
          // Change 'nba_19' to 'espn_nba_19'
          newId = team.external_id.replace('nba_', 'espn_nba_');
        }
        
        const { error } = await supabase
          .from('teams')
          .update({ external_id: newId })
          .eq('id', team.id);
          
        if (!error) {
          console.log(`  ✓ Fixed ${team.name}: ${team.external_id} → ${newId}`);
        } else {
          console.log(`  ✗ Error fixing ${team.name}:`, error);
        }
      }
    }
  }
}

checkNBATeams().catch(console.error);
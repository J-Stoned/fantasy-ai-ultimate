import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findClippers() {
  // Find any team with LAC or Clippers
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, abbreviation, sport, external_id')
    .or('name.ilike.%clippers%,abbreviation.eq.LAC,external_id.eq.espn_nba_12');
    
  console.log('Teams matching Clippers:');
  teams?.forEach(team => {
    console.log(` - ${team.name} (${team.abbreviation}) sport: ${team.sport} external_id: ${team.external_id}`);
  });
  
  // Update the team to have NBA sport if it exists but has wrong sport
  if (teams && teams.length > 0) {
    for (const team of teams) {
      if (team.sport !== 'NBA') {
        console.log(`\nUpdating ${team.name} to NBA sport...`);
        const { error } = await supabase
          .from('teams')
          .update({ sport: 'NBA' })
          .eq('id', team.id);
          
        if (!error) {
          console.log('✓ Updated successfully');
        }
      }
    }
  }
  
  process.exit(0);
}

findClippers();
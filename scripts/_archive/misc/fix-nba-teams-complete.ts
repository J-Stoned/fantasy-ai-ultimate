import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixNBATeams() {
  console.log('🏀 Fixing NBA Teams Complete...\n');
  
  // 1. First delete any duplicate or incorrect NBA teams
  console.log('1. Cleaning up NBA teams...');
  
  // Delete teams that were created without full names
  const shortNames = ['Celtics', 'Nets', 'Knicks', '76ers', 'Raptors', 'Bulls', 'Cavaliers', 
                      'Pistons', 'Pacers', 'Bucks', 'Hawks', 'Hornets', 'Heat', 'Magic', 
                      'Wizards', 'Nuggets', 'Timberwolves', 'Thunder', 'Trail Blazers', 
                      'Jazz', 'Warriors', 'Clippers', 'Lakers', 'Suns', 'Kings', 
                      'Mavericks', 'Rockets', 'Grizzlies', 'Pelicans', 'Spurs'];
  
  for (const name of shortNames) {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('name', name)
      .eq('sport', 'NBA');
      
    if (!error) {
      console.log(`  Deleted duplicate: ${name}`);
    }
  }
  
  // 2. Check if we're missing the Clippers
  console.log('\n2. Checking for Los Angeles Clippers...');
  const { data: clippers } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'Los Angeles Clippers')
    .eq('sport', 'NBA')
    .single();
    
  if (!clippers) {
    console.log('  Adding Los Angeles Clippers...');
    const { error } = await supabase
      .from('teams')
      .insert({
        external_id: 'espn_nba_12',
        name: 'Los Angeles Clippers',
        abbreviation: 'LAC',
        sport: 'NBA',
        city: 'Los Angeles'
      });
      
    if (!error) {
      console.log('  ✓ Added Los Angeles Clippers');
    } else {
      console.error('  Error adding Clippers:', error);
    }
  }
  
  // 3. Verify we have exactly 30 NBA teams
  console.log('\n3. Verifying NBA teams...');
  const { data: nbaTeams, count } = await supabase
    .from('teams')
    .select('id, name, abbreviation', { count: 'exact' })
    .eq('sport', 'NBA')
    .order('name');
    
  console.log(`\nTotal NBA teams: ${count}`);
  if (count === 30) {
    console.log('✅ All 30 NBA teams present!');
  } else {
    console.log(`⚠️  Expected 30 teams, found ${count}`);
  }
  
  if (nbaTeams) {
    console.log('\nNBA Teams:');
    nbaTeams.forEach(team => {
      console.log(`  ${team.name} (${team.abbreviation})`);
    });
  }
  
  process.exit(0);
}

fixNBATeams();
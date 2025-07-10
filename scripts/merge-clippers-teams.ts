import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function mergeClippersTeams() {
  console.log('🏀 Merging Clippers teams...\n');
  
  // 1. Get both Clippers teams
  const { data: clippersTeams } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .eq('abbreviation', 'LAC')
    .eq('sport', 'NBA');
    
  if (!clippersTeams || clippersTeams.length !== 2) {
    console.log('Expected 2 Clippers teams, found:', clippersTeams?.length);
    return;
  }
  
  console.log('Found Clippers teams:');
  clippersTeams.forEach(team => {
    console.log(` - ${team.name} (ID: ${team.id}, External: ${team.external_id})`);
  });
  
  // Find the correct one (Los Angeles Clippers with espn_nba_12)
  const correctTeam = clippersTeams.find(t => t.external_id === 'espn_nba_12');
  const duplicateTeam = clippersTeams.find(t => t.external_id !== 'espn_nba_12');
  
  if (!correctTeam || !duplicateTeam) {
    console.log('Could not identify correct/duplicate teams');
    return;
  }
  
  console.log(`\nKeeping: ${correctTeam.name} (ID: ${correctTeam.id})`);
  console.log(`Removing: ${duplicateTeam.name} (ID: ${duplicateTeam.id})`);
  
  // 2. Update all players from duplicate team to correct team
  console.log('\n2. Updating players...');
  const { data: players, error: playersError } = await supabase
    .from('players')
    .update({ team_id: correctTeam.id })
    .eq('team_id', duplicateTeam.id)
    .select();
    
  if (!playersError) {
    console.log(`  ✓ Updated ${players?.length || 0} players`);
  } else {
    console.error('  Error updating players:', playersError);
  }
  
  // 3. Update any games
  console.log('\n3. Updating games...');
  const { data: homeGames } = await supabase
    .from('games')
    .update({ home_team_id: correctTeam.id })
    .eq('home_team_id', duplicateTeam.id)
    .select();
    
  const { data: awayGames } = await supabase
    .from('games')
    .update({ away_team_id: correctTeam.id })
    .eq('away_team_id', duplicateTeam.id)
    .select();
    
  console.log(`  ✓ Updated ${(homeGames?.length || 0) + (awayGames?.length || 0)} games`);
  
  // 4. Now delete the duplicate team
  console.log('\n4. Deleting duplicate team...');
  const { error: deleteError } = await supabase
    .from('teams')
    .delete()
    .eq('id', duplicateTeam.id);
    
  if (!deleteError) {
    console.log('  ✓ Deleted duplicate team');
  } else {
    console.error('  Error deleting team:', deleteError);
  }
  
  // 5. Final verification
  console.log('\n5. Final verification:');
  const { count } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA');
    
  console.log(`\nFinal NBA team count: ${count}`);
  if (count === 30) {
    console.log('✅ All 30 NBA teams present!');
  }
  
  process.exit(0);
}

mergeClippersTeams();
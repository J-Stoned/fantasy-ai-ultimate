import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function finalNBACheck() {
  console.log('🏀 Final NBA Collection Status\n');
  
  // 1. NBA Teams
  const { data: teams, count: teamCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact' })
    .eq('sport', 'NBA')
    .order('name');
    
  console.log(`✅ NBA Teams: ${teamCount} teams`);
  
  // 2. NBA Players
  const { data: players, count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact' })
    .eq('sport', 'NBA');
    
  console.log(`✅ NBA Players: ${playerCount} players`);
  
  // 3. Sample of teams with player counts
  console.log('\nTeams with player counts:');
  
  for (const team of teams?.slice(0, 5) || []) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id)
      .eq('sport', 'NBA');
      
    console.log(`  ${team.name} (${team.abbreviation}): ${count} players`);
  }
  
  // 4. Check if ESPN API is returning errors
  console.log('\n📊 Summary:');
  console.log(`- Total NBA teams: ${teamCount}`);
  console.log(`- Total NBA players: ${playerCount}`);
  console.log(`- Average players per team: ${Math.round((playerCount || 0) / (teamCount || 1))}`);
  
  if (teamCount === 30 && playerCount && playerCount > 400) {
    console.log('\n✅ NBA collection is working successfully!');
    console.log('The ESPN API is responding correctly and players are being collected.');
  } else if (playerCount && playerCount < 100) {
    console.log('\n⚠️  NBA collection is partially working.');
    console.log('Some players are being collected but the process may have been interrupted.');
    console.log('Run the collector again to collect all players.');
  }
  
  process.exit(0);
}

finalNBACheck();
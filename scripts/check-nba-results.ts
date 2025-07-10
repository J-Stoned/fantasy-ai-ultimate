import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNBAData() {
  console.log('🏀 Checking NBA Collection Results...\n');
  
  // Check NBA teams
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, abbreviation, sport')
    .eq('sport', 'NBA')
    .order('name');
    
  console.log(`NBA Teams: ${teams?.length || 0}`);
  if (teams && teams.length > 0) {
    console.log('First 5 teams:', teams.slice(0, 5).map(t => `${t.name} (${t.abbreviation})`).join(', '));
  }
  
  // Check NBA players
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, name, team_id, sport')
    .eq('sport', 'NBA')
    .limit(10);
    
  console.log(`\nNBA Players: ${players?.length || 0}`);
  
  if (players && players.length > 0) {
    console.log('Sample players:', players.slice(0, 5).map(p => p.name).join(', '));
  }
  
  // Check recently created players (any sport)
  const { data: recentPlayers, error: recentError } = await supabase
    .from('players')
    .select('id, name, sport, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
    
  console.log('\nRecently created players (any sport):');
  recentPlayers?.forEach(p => {
    const date = new Date(p.created_at);
    console.log(` - ${p.name} (${p.sport}) at ${date.toLocaleString()}`);
  });
  
  // Count players by sport
  const { data: sportCounts, error: countError } = await supabase
    .from('players')
    .select('sport')
    .order('sport');
    
  if (sportCounts) {
    const counts: Record<string, number> = {};
    sportCounts.forEach(p => {
      counts[p.sport || 'null'] = (counts[p.sport || 'null'] || 0) + 1;
    });
    
    console.log('\nPlayer counts by sport:');
    Object.entries(counts).forEach(([sport, count]) => {
      console.log(` - ${sport}: ${count}`);
    });
  }
  
  process.exit(0);
}

checkNBAData();
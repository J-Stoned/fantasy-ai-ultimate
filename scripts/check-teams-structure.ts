import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

async function checkTeamsTable() {
  // First, let's get the table structure by querying a single row
  const { data: sampleTeam, error: sampleError } = await supabase
    .from('teams')
    .select('*')
    .limit(1)
    .single();
  
  if (sampleError && sampleError.code !== 'PGRST116') {
    console.error('Error fetching sample team:', sampleError);
  } else if (sampleTeam) {
    console.log('\nTEAMS TABLE COLUMNS:');
    console.log('===================');
    Object.keys(sampleTeam).forEach(col => {
      console.log(`- ${col}: ${typeof sampleTeam[col]}`);
    });
  }
  
  // Now get some sample teams to see the data
  const { data: teams, error } = await supabase
    .from('teams')
    .select('*')
    .order('id')
    .limit(10);
  
  if (error) {
    console.error('Error fetching teams:', error);
    return;
  }
  
  console.log('\n\nSAMPLE TEAMS DATA:');
  console.log('==================');
  teams?.forEach((team, index) => {
    console.log(`\nTeam ${index + 1}:`);
    console.log(`  id: ${team.id}`);
    console.log(`  name: ${team.name}`);
    console.log(`  sport: ${team.sport}`);
    console.log(`  external_id: ${team.external_id}`);
    console.log(`  espn_id: ${team.espn_id || 'N/A'}`);
    console.log(`  created_at: ${team.created_at}`);
    console.log(`  Other fields: ${Object.keys(team).filter(k => !['id', 'name', 'sport', 'external_id', 'espn_id', 'created_at'].includes(k)).join(', ') || 'None'}`);
  });
  
  // Check if espn_id column exists
  console.log('\n\nCOLUMN CHECK:');
  console.log('=============');
  const hasEspnId = teams && teams.length > 0 && 'espn_id' in teams[0];
  console.log(`espn_id column exists: ${hasEspnId}`);
  
  // Get count by sport
  const { data: sportCounts, error: countError } = await supabase
    .from('teams')
    .select('sport');
  
  if (!countError && sportCounts) {
    const counts: Record<string, number> = {};
    sportCounts.forEach(t => {
      counts[t.sport] = (counts[t.sport] || 0) + 1;
    });
    
    console.log('\n\nTEAMS BY SPORT:');
    console.log('===============');
    Object.entries(counts).forEach(([sport, count]) => {
      console.log(`${sport}: ${count} teams`);
    });
  }
}

checkTeamsTable().then(() => process.exit(0));
#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deepTeamCheck() {
  console.log('🔍 Deep team database analysis...\n');
  
  // Count all teams by sport
  const { data: allTeams } = await supabase
    .from('teams')
    .select('sport');
    
  const sportCounts: Record<string, number> = {};
  allTeams?.forEach(team => {
    if (team.sport) {
      sportCounts[team.sport] = (sportCounts[team.sport] || 0) + 1;
    }
  });
  
  console.log('Teams by sport:');
  Object.entries(sportCounts).forEach(([sport, count]) => {
    console.log(`  ${sport}: ${count}`);
  });
  
  console.log(`\nTotal teams: ${allTeams?.length || 0}`);
  
  // Check NFL teams specifically with different queries
  console.log('\n🏈 NFL Team Analysis:');
  
  const { data: nflEq } = await supabase
    .from('teams')
    .select('*')
    .eq('sport', 'NFL');
    
  console.log(`eq('sport', 'NFL'): ${nflEq?.length || 0} teams`);
  
  const { data: nflIlike } = await supabase
    .from('teams')
    .select('*')
    .ilike('sport', 'nfl');
    
  console.log(`ilike('sport', 'nfl'): ${nflIlike?.length || 0} teams`);
  
  if (nflEq && nflEq.length > 0) {
    console.log('\nFirst 5 NFL teams found:');
    nflEq.slice(0, 5).forEach(team => {
      console.log(`  ${team.name} - Sport: "${team.sport}" - External: ${team.external_id}`);
    });
  }
}

deepTeamCheck().catch(console.error);
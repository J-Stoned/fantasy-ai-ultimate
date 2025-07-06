#!/usr/bin/env tsx
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkTeamSports() {
  // Get all teams
  const { data: teams } = await supabase
    .from('teams')
    .select('sport')
    .limit(500);

  const sportCounts: Record<string, number> = {};
  
  teams?.forEach(team => {
    if (team.sport) {
      sportCounts[team.sport] = (sportCounts[team.sport] || 0) + 1;
    }
  });

  console.log('Team sports in database:');
  console.log('========================');
  Object.entries(sportCounts).forEach(([sport, count]) => {
    console.log(`${sport}: ${count} teams`);
  });

  // Also check a few team names
  const { data: sampleTeams } = await supabase
    .from('teams')
    .select('name, sport')
    .limit(10);

  console.log('\nSample teams:');
  sampleTeams?.forEach(team => {
    console.log(`- ${team.name} (${team.sport})`);
  });
}

checkTeamSports();
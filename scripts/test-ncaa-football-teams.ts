#!/usr/bin/env tsx
/**
 * Test NCAA Football Teams Collection
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testTeams() {
  console.log(chalk.bold.blue('🧪 TESTING NCAA FOOTBALL TEAMS COLLECTION\n'));
  
  // Test 1: Count teams
  const { count, error: countError } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_FB');
  
  if (countError) {
    console.error('❌ Error counting teams:', countError);
    return;
  }
  
  console.log(`✅ Teams count: ${count}`);
  
  // Test 2: Sample team data
  const { data: sampleTeams, error: sampleError } = await supabase
    .from('teams')
    .select('*')
    .eq('sport', 'NCAA_FB')
    .limit(5);
  
  if (sampleError) {
    console.error('❌ Error fetching sample teams:', sampleError);
    return;
  }
  
  console.log('\n📊 Sample teams:');
  sampleTeams?.forEach((team, i) => {
    console.log(`${i + 1}. ${team.name} (${team.external_id})`);
    console.log(`   - Location: ${team.location}`);
    console.log(`   - Metadata: ${JSON.stringify(team.metadata)}`);
  });
  
  // Test 3: Check for duplicates (simplified)
  const { data: allTeams, error: dupError } = await supabase
    .from('teams')
    .select('external_id')
    .eq('sport', 'NCAA_FB');
  
  if (dupError) {
    console.error('❌ Error checking duplicates:', dupError);
    return;
  }
  
  const externalIds = allTeams?.map(t => t.external_id) || [];
  const duplicates = externalIds.filter((id, index) => externalIds.indexOf(id) !== index);
  
  console.log(`\n✅ Duplicate check: ${duplicates.length} duplicates found`);
  
  // Test 4: Verify external_id format
  const { data: badIds, error: idError } = await supabase
    .from('teams')
    .select('external_id')
    .eq('sport', 'NCAA_FB')
    .not('external_id', 'like', 'espn_ncaaf_%');
  
  if (idError) {
    console.error('❌ Error checking ID format:', idError);
    return;
  }
  
  console.log(`✅ ID format check: ${badIds?.length || 0} teams with bad format`);
  
  console.log(chalk.green('\n🎉 Teams collection test complete!'));
}

testTeams().catch(console.error);
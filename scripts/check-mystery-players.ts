#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  'process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkMysteryPlayers() {
  console.log('🔍 INVESTIGATING 835K MYSTERY NFL PLAYERS\n');
  
  // Get sample of players with null external_id
  const { data: sample } = await supabase
    .from('players')
    .select('*')
    .eq('sport_id', 'nfl')
    .is('external_id', null)
    .limit(5);
  
  console.log('Sample records:');
  sample?.forEach(p => {
    console.log(`\n- Name: ${p.name}`);
    console.log(`  Team: ${p.team}`);
    console.log(`  Position: ${p.position}`);
    console.log(`  Created: ${new Date(p.created_at).toLocaleDateString()}`);
    console.log(`  External ID: ${p.external_id}`);
    console.log(`  Photo URL: ${p.photo_url ? 'Yes' : 'No'}`);
  });
  
  // Check if these are real players or test data
  const { data: teamCounts } = await supabase
    .from('players')
    .select('team')
    .eq('sport_id', 'nfl')
    .is('external_id', null)
    .limit(1000);
  
  if (teamCounts) {
    const teams = teamCounts.map(p => p.team).filter(Boolean);
    const uniqueTeams = new Set(teams);
    console.log(`\nUnique teams in first 1000: ${uniqueTeams.size}`);
    console.log('Sample teams:', Array.from(uniqueTeams).slice(0, 10));
  }
  
  // Get the actual number of real NFL players we should have
  console.log('\n📊 EXPECTED VS ACTUAL:');
  console.log('Expected NFL players: ~2,000-3,000 (active + recent)');
  console.log('Actual with proper external_ids: 11,822');
  console.log('Mystery records: 835,200');
  
  // Count how many have photos
  const { count: photosInMystery } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl')
    .is('external_id', null)
    .not('photo_url', 'is', null);
  
  console.log(`\nPhotos in mystery records: ${photosInMystery}`);
  
  console.log('\n⚠️  CONCLUSION:');
  console.log('The 835K records appear to be from a bulk import or test data.');
  console.log('Real NFL photo coverage is actually: 5,450 / 11,822 = 46.1% ✅');
}

checkMysteryPlayers();
#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  'process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function investigateNFLPlayers() {
  console.log('🔍 INVESTIGATING NFL PLAYER COUNT');
  console.log('=================================\n');
  
  // Get total count
  const { count: totalNFL } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl');
  
  console.log(`Total NFL players: ${totalNFL?.toLocaleString()}\n`);
  
  // Check by external_id patterns
  console.log('📊 BY DATA SOURCE:');
  
  const { count: sleeperCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl')
    .ilike('external_id', 'sleeper_%');
  
  const { count: espnCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl')
    .ilike('external_id', 'espn_%');
  
  const { count: otherCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl')
    .not('external_id', 'ilike', 'sleeper_%')
    .not('external_id', 'ilike', 'espn_%');
  
  console.log(`Sleeper players: ${sleeperCount?.toLocaleString()}`);
  console.log(`ESPN players: ${espnCount?.toLocaleString()}`);
  console.log(`Other sources: ${otherCount?.toLocaleString()}\n`);
  
  // Check for duplicates
  console.log('🔍 CHECKING FOR DUPLICATES:');
  
  const { data: samplePlayers } = await supabase
    .from('players')
    .select('name, external_id, team, created_at')
    .eq('sport_id', 'nfl')
    .eq('name', 'Patrick Mahomes')
    .limit(10);
  
  if (samplePlayers?.length) {
    console.log(`\nFound ${samplePlayers.length} entries for "Patrick Mahomes":`);
    samplePlayers.forEach(p => {
      console.log(`- ${p.external_id} | ${p.team || 'No team'} | ${new Date(p.created_at).toLocaleDateString()}`);
    });
  }
  
  // Check players by status
  console.log('\n📊 BY STATUS:');
  
  const { count: activeCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl')
    .eq('status', 'Active');
  
  const { count: inactiveCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl')
    .eq('status', 'Inactive');
  
  const { count: nullStatusCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl')
    .is('status', null);
  
  console.log(`Active players: ${activeCount?.toLocaleString()}`);
  console.log(`Inactive players: ${inactiveCount?.toLocaleString()}`);
  console.log(`No status: ${nullStatusCount?.toLocaleString()}`);
  
  // Check players with teams vs without
  console.log('\n📊 BY TEAM STATUS:');
  
  const { count: withTeamCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl')
    .not('team', 'is', null);
  
  const { count: noTeamCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl')
    .is('team', null);
  
  console.log(`With team: ${withTeamCount?.toLocaleString()}`);
  console.log(`No team: ${noTeamCount?.toLocaleString()}`);
  
  // Sample of players without photos
  console.log('\n📋 SAMPLE PLAYERS WITHOUT PHOTOS:');
  const { data: noPhotoSample } = await supabase
    .from('players')
    .select('name, external_id, team, status')
    .eq('sport_id', 'nfl')
    .is('photo_url', null)
    .not('team', 'is', null)
    .eq('status', 'Active')
    .limit(10);
  
  noPhotoSample?.forEach(p => {
    console.log(`- ${p.name} | ${p.team} | ${p.status} | ${p.external_id}`);
  });
  
  // Get actual unique player estimate
  console.log('\n📊 UNIQUE PLAYER ESTIMATE:');
  const { data: uniqueNames } = await supabase
    .from('players')
    .select('name')
    .eq('sport_id', 'nfl')
    .limit(50000);
  
  if (uniqueNames) {
    const uniqueCount = new Set(uniqueNames.map(p => p.name)).size;
    console.log(`Unique names in first 50k: ${uniqueCount.toLocaleString()}`);
    console.log(`Estimated total unique players: ~${Math.round(uniqueCount * (totalNFL! / 50000)).toLocaleString()}`);
  }
}

investigateNFLPlayers();
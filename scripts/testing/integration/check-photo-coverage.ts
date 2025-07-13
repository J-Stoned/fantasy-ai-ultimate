#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  'process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkPhotoCoverage() {
  console.log('📸 PHOTO COVERAGE ANALYSIS');
  console.log('========================\n');
  
  // Overall stats
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
  
  const { count: withPhotos } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .not('photo_url', 'is', null);
  
  const { count: withoutPhotos } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .is('photo_url', null);
  
  console.log('📊 OVERALL STATS:');
  console.log(`Total players: ${totalPlayers?.toLocaleString()}`);
  console.log(`With photos: ${withPhotos?.toLocaleString()} (${((withPhotos || 0) / (totalPlayers || 1) * 100).toFixed(2)}%)`);
  console.log(`Without photos: ${withoutPhotos?.toLocaleString()}`);
  
  // By sport breakdown
  console.log('\n📊 BY SPORT:');
  console.log('Sport      | Total    | With Photo | Coverage');
  console.log('-----------|----------|------------|----------');
  
  const sports = [
    { id: 'nfl', name: 'NFL' },
    { id: 'nba', name: 'NBA' },
    { id: 'mlb', name: 'MLB' },
    { id: 'nhl', name: 'NHL' },
    { id: 'soccer', name: 'Soccer' },
    { id: null, name: 'Unknown' }
  ];
  
  for (const sport of sports) {
    const query = supabase.from('players').select('*', { count: 'exact', head: true });
    
    if (sport.id) {
      query.eq('sport_id', sport.id);
    } else {
      query.is('sport_id', null);
    }
    
    const { count: sportTotal } = await query;
    
    const photoQuery = supabase.from('players').select('*', { count: 'exact', head: true });
    
    if (sport.id) {
      photoQuery.eq('sport_id', sport.id);
    } else {
      photoQuery.is('sport_id', null);
    }
    
    const { count: sportWithPhotos } = await photoQuery.not('photo_url', 'is', null);
    
    const coverage = sportTotal ? ((sportWithPhotos || 0) / sportTotal * 100).toFixed(1) : '0.0';
    
    console.log(
      `${sport.name.padEnd(10)} | ${(sportTotal || 0).toString().padStart(8)} | ${(sportWithPhotos || 0).toString().padStart(10)} | ${coverage.padStart(8)}%`
    );
  }
  
  // Sample players without photos
  console.log('\n📋 SAMPLE PLAYERS WITHOUT PHOTOS:');
  const { data: samplePlayers } = await supabase
    .from('players')
    .select('name, sport_id, team, external_id')
    .is('photo_url', null)
    .limit(10);
  
  samplePlayers?.forEach(player => {
    console.log(`- ${player.name} (${player.sport_id || 'unknown'}) - ${player.team || 'No team'}`);
  });
  
  // Players with ESPN IDs but no photos
  console.log('\n🔍 PLAYERS WITH ESPN IDs BUT NO PHOTOS:');
  const { count: espnNoPhoto } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .not('metadata->espn_id', 'is', null)
    .is('photo_url', null);
  
  console.log(`Found: ${espnNoPhoto?.toLocaleString()} players`);
  
  // Recent players added
  console.log('\n⏰ RECENT ACTIVITY:');
  const { data: recentPlayers } = await supabase
    .from('players')
    .select('name, sport_id, photo_url, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  recentPlayers?.forEach(player => {
    const hasPhoto = player.photo_url ? '✅' : '❌';
    console.log(`${hasPhoto} ${player.name} (${player.sport_id}) - ${new Date(player.created_at).toLocaleString()}`);
  });
}

checkPhotoCoverage();
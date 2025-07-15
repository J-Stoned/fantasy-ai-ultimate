#!/usr/bin/env node
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

const mlbApi = axios.create({
  baseURL: 'https://statsapi.mlb.com/api/v1'
});

async function fixMissingTeams() {
  console.log('🔧 Fixing Missing MLB Teams (Final Version)\n');
  
  // Get all MLB teams from the API
  const response = await mlbApi.get('/teams', {
    params: { sportId: 1, season: 2024 }
  });
  
  const allTeams = response.data.teams;
  
  // Critical missing teams
  const criticalIds = [108, 118];
  const criticalTeams = allTeams.filter((t: any) => criticalIds.includes(t.id));
  
  console.log('Critical teams to add:');
  criticalTeams.forEach((team: any) => {
    console.log(`- ${team.id}: ${team.name} (${team.abbreviation})`);
  });
  
  // Prepare teams with correct schema
  const teamsToInsert = criticalTeams.map((team: any) => ({
    id: team.id,
    name: team.name,
    city: team.locationName || team.name.split(' ').slice(0, -1).join(' '),
    abbreviation: team.abbreviation || team.teamCode || 'UNK',
    sport_id: 1, // MLB
    sport: 'MLB',
    external_id: `mlb_${team.id}`,
    metadata: {
      mlb_team_id: team.id,
      full_name: team.name,
      team_code: team.teamCode,
      league: team.league?.name || 'MLB',
      division: team.division?.name || 'Unknown',
      venue: team.venue?.name || 'Unknown'
    }
  }));
  
  // Insert teams
  for (const team of teamsToInsert) {
    console.log(`\nInserting team ${team.id}: ${team.name}...`);
    
    const { data, error } = await supabase
      .from('teams')
      .insert(team)
      .select();
      
    if (error) {
      console.error(`❌ Error: ${error.message}`);
      
      // Try without optional fields
      const minimalTeam = {
        id: team.id,
        name: team.name,
        abbreviation: team.abbreviation,
        sport: team.sport
      };
      
      console.log('Trying with minimal fields...');
      const { data: retry, error: retryError } = await supabase
        .from('teams')
        .insert(minimalTeam)
        .select();
        
      if (retryError) {
        console.error(`❌ Still failed: ${retryError.message}`);
      } else {
        console.log(`✅ Success with minimal fields!`);
      }
    } else {
      console.log(`✅ Successfully inserted!`);
    }
  }
  
  // Verify
  const { data: verifyTeams } = await supabase
    .from('teams')
    .select('id, name')
    .in('id', criticalIds);
    
  console.log('\n📋 Final verification:');
  if (verifyTeams && verifyTeams.length > 0) {
    verifyTeams.forEach(team => {
      console.log(`✅ ${team.id}: ${team.name}`);
    });
  } else {
    console.log('❌ Teams still not found in database');
  }
  
  // Check if games can now be inserted
  const { count } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB')
    .or('home_team_id.eq.108,home_team_id.eq.118,away_team_id.eq.108,away_team_id.eq.118');
    
  console.log(`\n📊 Games involving teams 108/118: ${count || 0}`);
}

fixMissingTeams().catch(console.error);
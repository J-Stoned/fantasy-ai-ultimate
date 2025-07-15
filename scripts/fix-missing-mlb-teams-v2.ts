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
  console.log('🔧 Fixing Missing MLB Teams (v2)\n');
  
  // First check the teams table structure
  const { data: sampleTeam } = await supabase
    .from('teams')
    .select('*')
    .limit(1);
    
  console.log('Teams table structure:', Object.keys(sampleTeam?.[0] || {}));
  
  // Get all MLB teams from the API
  const response = await mlbApi.get('/teams', {
    params: { sportId: 1 }
  });
  
  // Find teams 108 and 118 specifically
  const allTeams = response.data.teams;
  const team108 = allTeams.find((t: any) => t.id === 108);
  const team118 = allTeams.find((t: any) => t.id === 118);
  
  console.log('\nMissing teams found:');
  if (team108) console.log(`- Team 108: ${team108.name}`);
  if (team118) console.log(`- Team 118: ${team118.name}`);
  
  // Get all existing team IDs
  const { data: existingTeams } = await supabase
    .from('teams')
    .select('id')
    .order('id');
    
  const existingIds = new Set(existingTeams?.map(t => t.id) || []);
  
  // Find all MLB teams that are missing
  const missingTeams = allTeams.filter((team: any) => !existingIds.has(team.id));
  
  console.log(`\nFound ${missingTeams.length} missing MLB teams total`);
  
  // Prepare teams for insertion - using minimal fields that exist
  const teamsToInsert = missingTeams.map((team: any) => ({
    id: team.id,
    name: team.name,
    abbreviation: team.abbreviation || team.teamCode || 'UNK',
    sport: 'MLB',
    venue: team.venue?.name || 'Unknown',
    metadata: {
      mlb_team_id: team.id,
      full_name: team.name,
      team_code: team.teamCode,
      league: team.league?.name || 'MLB'
    }
  }));
  
  console.log('\nTeams to insert:');
  teamsToInsert.forEach((team: any) => {
    console.log(`- ${team.id}: ${team.name} (${team.abbreviation})`);
  });
  
  // Insert the missing teams one by one to better handle errors
  let successCount = 0;
  for (const team of teamsToInsert) {
    const { data, error } = await supabase
      .from('teams')
      .insert(team)
      .select();
      
    if (error) {
      console.error(`❌ Error inserting team ${team.id}:`, error.message);
    } else {
      console.log(`✅ Inserted team ${team.id}: ${team.name}`);
      successCount++;
    }
  }
  
  console.log(`\n📊 Summary: Inserted ${successCount}/${teamsToInsert.length} teams`);
  
  // Verify the fix
  const { data: verifyTeams } = await supabase
    .from('teams')
    .select('id, name')
    .in('id', [108, 118]);
    
  console.log('\n📋 Verification - Critical teams now in database:');
  verifyTeams?.forEach(team => {
    console.log(`- ${team.id}: ${team.name}`);
  });
}

fixMissingTeams().catch(console.error);
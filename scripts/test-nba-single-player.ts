#!/usr/bin/env tsx
/**
 * Test NBA player collection with a single team
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testSingleTeam() {
  console.log('🧪 Testing NBA player collection with Atlanta Hawks...\n');
  
  try {
    // Get Atlanta Hawks from our DB
    const { data: hawks } = await supabase
      .from('teams')
      .select('id, name, external_id')
      .eq('name', 'Atlanta Hawks')
      .single();
    
    if (!hawks) {
      console.log('❌ Atlanta Hawks not found in database');
      return;
    }
    
    console.log('✅ Found team:', hawks.name, 'ID:', hawks.id);
    
    // Fetch roster from ESPN
    const rosterUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/1/roster';
    const response = await axios.get(rosterUrl);
    
    if (!response.data.athletes || response.data.athletes.length === 0) {
      console.log('❌ No athletes found');
      return;
    }
    
    console.log(`\n📊 Found ${response.data.athletes.length} players\n`);
    
    // Test with first player
    const athlete = response.data.athletes[0];
    console.log('First player raw data:');
    console.log('- Name:', athlete.fullName);
    console.log('- Height:', athlete.height, 'inches');
    console.log('- Weight:', athlete.weight, 'lbs');
    console.log('- Position:', athlete.position?.abbreviation);
    console.log('- Jersey:', athlete.jersey);
    
    // Create player object matching our schema
    const player = {
      name: athlete.fullName,
      firstname: athlete.firstName || athlete.fullName.split(' ')[0],
      lastname: athlete.lastName || athlete.fullName.split(' ').slice(1).join(' '),
      external_id: `espn_nba_${athlete.id}`,
      sport_id: 'nba',
      team_id: hawks.id,
      position: athlete.position?.abbreviation ? [athlete.position.abbreviation] : null,
      jersey_number: athlete.jersey ? parseInt(athlete.jersey) : null,
      heightinches: athlete.height || null,  // Already in inches!
      weightlbs: athlete.weight || null,     // Already in lbs!
      birthdate: athlete.dateOfBirth || null,
      college: athlete.college?.name || null,
      status: athlete.status?.type?.name || 'active',
      photo_url: athlete.headshot?.href || null,
      metadata: {
        espn_id: athlete.id,
        display_name: athlete.displayName,
        slug: athlete.slug,
        age: athlete.age,
        debut_year: athlete.debutYear,
        birth_place: {
          city: athlete.birthPlace?.city,
          state: athlete.birthPlace?.state,
          country: athlete.birthPlace?.country
        },
        experience_years: athlete.experience?.years
      }
    };
    
    console.log('\nPlayer object to insert:');
    console.log(JSON.stringify(player, null, 2));
    
    // Try inserting just this one player
    console.log('\n💾 Testing insert...');
    const { data, error } = await supabase
      .from('players')
      .insert([player])
      .select();
    
    if (error) {
      console.error('❌ Insert error:', error.message);
    } else {
      console.log('✅ Successfully inserted:', data[0].name);
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

testSingleTeam();
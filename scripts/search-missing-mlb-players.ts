#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Players we couldn't find
const missingPlayers = [
  "Eugenio Suarez",
  "Ken Waldichuk", 
  "Gunnar Hoglund",
  "Joe Jimenez",
  "Reynaldo Lopez",
  "Maverick Handley",
  "Gary Sanchez"
];

async function searchMissingPlayers() {
  console.log('🔍 Searching for missing MLB players...\n');
  
  // First, let's check if these are real current MLB players by fetching ESPN data
  try {
    const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/injuries');
    const injuries = [];
    
    if (response.data?.injuries) {
      response.data.injuries.forEach((team: any) => {
        if (team.injuries) {
          injuries.push(...team.injuries);
        }
      });
    }
    
    console.log(`ESPN has ${injuries.length} total MLB injuries\n`);
    
    // Find our missing players in ESPN data
    for (const playerName of missingPlayers) {
      const espnPlayer = injuries.find((inj: any) => 
        inj.athlete?.displayName === playerName
      );
      
      if (espnPlayer) {
        console.log(`✅ "${playerName}" found in ESPN data:`);
        console.log(`   Team: ${espnPlayer.athlete?.team?.displayName || 'Unknown'}`);
        console.log(`   Status: ${espnPlayer.status}`);
        console.log(`   ESPN ID: ${espnPlayer.athlete?.id || 'N/A'}`);
      } else {
        console.log(`❌ "${playerName}" not found in current ESPN injuries`);
      }
    }
    
  } catch (error) {
    console.error('Error fetching ESPN data:', error);
  }
  
  // Check our database for similar names
  console.log('\n\n📊 Checking database for variations...');
  
  for (const playerName of missingPlayers) {
    const [firstName, ...lastNameParts] = playerName.split(' ');
    const lastName = lastNameParts.join(' ');
    
    // Try various search strategies
    const { data: variations } = await supabase
      .from('players')
      .select('id, name, sport_id, team_id')
      .or(`name.ilike.%${lastName}%,firstname.ilike.%${firstName}%,lastname.ilike.%${lastName}%`)
      .in('sport_id', ['mlb', 'MLB'])
      .limit(5);
      
    if (variations && variations.length > 0) {
      console.log(`\n🔍 Possible matches for "${playerName}":`);
      variations.forEach(p => console.log(`   - ${p.name} (ID: ${p.id}, Team: ${p.team_id})`));
    }
  }
}

searchMissingPlayers().catch(console.error);
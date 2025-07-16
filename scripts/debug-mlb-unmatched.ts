#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Unmatched players from the run
const unmatchedPlayers = [
  "Eugenio Suarez",
  "Christian Montes De Oca",
  "Ken Waldichuk",
  "Gunnar Hoglund",
  "Jose Devers",
  "Joe Jimenez",
  "Reynaldo Lopez",
  "Maverick Handley",
  "Gary Sanchez",
  "Albert Suarez"
];

function normalizePlayerName(name: string): string {
  return name.toLowerCase()
    .replace(/['']/g, '')
    .replace(/\./g, '')
    .replace(/jr$/i, '')
    .replace(/sr$/i, '')
    .replace(/iii$/i, '')
    .replace(/ii$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function debugUnmatched() {
  console.log('🔍 Debugging unmatched MLB players...\n');
  
  for (const playerName of unmatchedPlayers) {
    console.log(`\n📍 Searching for: "${playerName}"`);
    const normalized = normalizePlayerName(playerName);
    console.log(`   Normalized: "${normalized}"`);
    
    // Try exact match first
    const { data: exactMatch } = await supabase
      .from('players')
      .select('id, name, sport_id, team_id')
      .eq('name', playerName)
      .in('sport_id', ['mlb', 'MLB']);
      
    if (exactMatch && exactMatch.length > 0) {
      console.log(`   ✅ Found exact match:`, exactMatch[0]);
      continue;
    }
    
    // Try case-insensitive match
    const { data: iMatch } = await supabase
      .from('players')
      .select('id, name, sport_id, team_id')
      .ilike('name', playerName)
      .in('sport_id', ['mlb', 'MLB']);
      
    if (iMatch && iMatch.length > 0) {
      console.log(`   ✅ Found case-insensitive match:`, iMatch[0]);
      continue;
    }
    
    // Try partial match
    const { data: partialMatch } = await supabase
      .from('players')
      .select('id, name, sport_id, team_id')
      .ilike('name', `%${playerName.split(' ').pop()}%`)
      .in('sport_id', ['mlb', 'MLB'])
      .limit(5);
      
    if (partialMatch && partialMatch.length > 0) {
      console.log(`   🔍 Found partial matches:`);
      partialMatch.forEach(p => console.log(`      - ${p.name} (${p.sport_id})`));
    } else {
      console.log(`   ❌ No matches found`);
    }
  }
  
  // Check if these might be newer players
  console.log('\n\n📊 Checking for similar names in database...');
  
  // Get all MLB player names
  const { data: allMLB } = await supabase
    .from('players')
    .select('name')
    .in('sport_id', ['mlb', 'MLB']);
    
  console.log(`Total MLB players in database: ${allMLB?.length}`);
  
  // Check for names with special characters
  const specialNames = allMLB?.filter(p => 
    p.name.includes("'") || 
    p.name.includes(".") || 
    p.name.includes("Jr") ||
    p.name.includes("De ") ||
    p.name.includes("Oca")
  );
  
  console.log(`\nPlayers with special characters: ${specialNames?.length}`);
  console.log('Sample special names:');
  specialNames?.slice(0, 10).forEach(p => console.log(`  - ${p.name}`));
}

debugUnmatched().catch(console.error);
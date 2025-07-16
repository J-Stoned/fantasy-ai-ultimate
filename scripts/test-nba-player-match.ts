#!/usr/bin/env tsx
/**
 * Test NBA player matching
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testPlayerMatching() {
  console.log('🔍 Testing NBA player matching...\n');
  
  // Get one NBA game
  const { data: game } = await supabase
    .from('games')
    .select('id, external_id')
    .or('sport_id.eq.nba,sport_id.eq.NBA')
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .limit(1)
    .single();
    
  if (!game || !game.external_id?.startsWith('espn_nba_')) return;
  
  const gameId = game.external_id.replace('espn_nba_', '');
  const response = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`);
  
  if (response.data.boxscore?.teams?.[0]?.statistics?.[0]?.athletes) {
    const athletes = response.data.boxscore.teams[0].statistics[0].athletes.slice(0, 3);
    
    console.log('First 3 ESPN players:');
    const espnIds: string[] = [];
    
    for (const athlete of athletes) {
      const espnId = athlete.athlete.id;
      const playerKey = `espn_nba_${espnId}`;
      console.log(`  ESPN ID: ${espnId} | Key: ${playerKey} | Name: ${athlete.athlete.displayName}`);
      espnIds.push(playerKey);
    }
    
    // Check if we have these players
    const { data: ourPlayers } = await supabase
      .from('players')
      .select('id, name, external_id')
      .in('external_id', espnIds);
      
    console.log('\nMatching players in our DB:');
    if (ourPlayers && ourPlayers.length > 0) {
      ourPlayers.forEach(p => console.log(`  ✅ Found: ${p.name} | external_id: ${p.external_id}`));
    } else {
      console.log('  ❌ No matches found!');
      
      // Check what external_ids our NBA players have
      const { data: samplePlayers } = await supabase
        .from('players')
        .select('name, external_id')
        .or('sport_id.eq.nba,sport_id.eq.NBA')
        .not('external_id', 'is', null)
        .limit(5);
        
      console.log('\nSample of our NBA player external_ids:');
      samplePlayers?.forEach(p => console.log(`  ${p.name}: ${p.external_id}`));
    }
  }
}

testPlayerMatching().catch(console.error);
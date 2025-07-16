#!/usr/bin/env tsx
/**
 * 🔍 Debug Player Matching Issue
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugPlayerMatching() {
  console.log('🔍 DEBUGGING PLAYER MATCHING ISSUE\n');
  
  // Get sample MLB game
  const { data: game } = await supabase
    .from('games')
    .select('id, external_id')
    .eq('sport_id', 'mlb')
    .eq('status', 'completed')
    .limit(1);
    
  if (game && game[0] && game[0].external_id) {
    const gameId = game[0].external_id.replace('espn_mlb_', '');
    console.log('Testing game:', game[0].id, '| ESPN ID:', gameId);
    
    try {
      const response = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${gameId}`);
      
      console.log('ESPN Response status:', response.status);
      
      if (response.data.boxscore && response.data.boxscore.teams) {
        console.log('Teams found:', response.data.boxscore.teams.length);
        
        const team = response.data.boxscore.teams[0];
        console.log('Team name:', team.team?.displayName);
        
        if (team.statistics && team.statistics[0] && team.statistics[0].athletes) {
          console.log('Batters in team:', team.statistics[0].athletes.length);
          
          // Show first few players
          console.log('\nFirst 3 ESPN players:');
          const espnPlayerIds: string[] = [];
          team.statistics[0].athletes.slice(0, 3).forEach(athlete => {
            console.log(`  - ESPN ID: ${athlete.athlete.id} | Name: ${athlete.athlete.displayName}`);
            espnPlayerIds.push(`mlb_${athlete.athlete.id}`);
          });
          
          // Check if any of our players match
          const { data: ourPlayers } = await supabase
            .from('players')
            .select('external_id, name')
            .in('external_id', espnPlayerIds);
            
          console.log('\nMatching players in our DB:');
          if (ourPlayers && ourPlayers.length > 0) {
            ourPlayers.forEach(p => console.log(`  - Our player: ${p.name} | ID: ${p.external_id}`));
          } else {
            console.log('❌ NO MATCHES FOUND - This is why we got 0 stats!');
            
            // Check what external_ids we actually have
            const { data: sampleOurPlayers } = await supabase
              .from('players')
              .select('external_id, name')
              .or('sport_id.eq.mlb,sport_id.eq.MLB')
              .limit(10);
              
            console.log('\nSample of our player external_ids:');
            sampleOurPlayers?.forEach(p => console.log(`  - ${p.name} | ${p.external_id}`));
            
            console.log('\n💡 Issue: Our players have different external_ids than current ESPN data');
            console.log('🎯 Solution: Either update player external_ids or use name matching');
          }
        }
      }
      
    } catch (error: any) {
      console.log('Error:', error.message);
    }
  }
}

debugPlayerMatching().catch(console.error);
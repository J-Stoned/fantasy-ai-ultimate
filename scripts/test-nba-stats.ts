#!/usr/bin/env tsx
/**
 * Quick test of NBA stats collection
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testNBAStats() {
  console.log('🔍 Testing NBA stats collection...\n');
  
  // Get one NBA game
  const { data: game, error } = await supabase
    .from('games')
    .select('id, external_id')
    .or('sport_id.eq.nba,sport_id.eq.NBA')
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .limit(1)
    .single();
    
  if (error || !game) {
    console.error('Error loading game:', error);
    return;
  }
  
  console.log('Testing with game:', game);
  
  if (!game.external_id?.startsWith('espn_nba_')) {
    console.log('Invalid external_id format');
    return;
  }
  
  const gameId = game.external_id.replace('espn_nba_', '');
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`;
  
  console.log('Fetching:', url);
  
  try {
    const response = await axios.get(url, { timeout: 10000 });
    console.log('Response status:', response.status);
    
    if (response.data.boxscore?.teams) {
      console.log('Teams found:', response.data.boxscore.teams.length);
      
      const team = response.data.boxscore.teams[0];
      if (team.statistics?.[0]?.athletes) {
        console.log('Athletes in first team:', team.statistics[0].athletes.length);
        
        // Show first athlete
        const athlete = team.statistics[0].athletes[0];
        console.log('\nFirst athlete:');
        console.log('  Name:', athlete.athlete.displayName);
        console.log('  ID:', athlete.athlete.id);
        console.log('  Stats array length:', athlete.stats?.length || 0);
      }
    }
  } catch (error: any) {
    console.error('API Error:', error.message);
  }
}

testNBAStats().catch(console.error);
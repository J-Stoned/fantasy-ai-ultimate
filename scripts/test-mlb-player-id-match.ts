#!/usr/bin/env tsx
/**
 * Test MLB player ID matching between API and database
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testMLBPlayerIdMatch() {
  console.log(chalk.blue('🔍 TEST MLB PLAYER ID MATCHING\n'));

  // Get a sample game
  const gameId = '401228507';
  const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${gameId}`;
  
  console.log(chalk.yellow('Fetching game data...'));
  const response = await axios.get(url);
  const data = response.data;
  
  if (!data.boxscore?.players?.[0]?.statistics?.[0]?.athletes) {
    console.log(chalk.red('No players found in API response'));
    return;
  }
  
  // Get first 5 players from API
  const apiPlayers = data.boxscore.players[0].statistics[0].athletes.slice(0, 5);
  console.log(chalk.cyan('\nChecking player ID matches:\n'));
  
  let matches = 0;
  let mismatches = 0;
  
  for (const apiPlayer of apiPlayers) {
    const apiId = apiPlayer.athlete?.id;
    const apiName = apiPlayer.athlete?.displayName;
    
    if (!apiId) continue;
    
    // Check if we have this player with the expected external_id
    const expectedExternalId = `espn_mlb_${apiId}`;
    const { data: dbPlayer } = await supabase
      .from('players')
      .select('id, external_id, name')
      .eq('external_id', expectedExternalId)
      .single();
      
    if (dbPlayer) {
      console.log(chalk.green(`✅ MATCH: ${apiName} (API: ${apiId} = DB: ${dbPlayer.external_id})`));
      matches++;
    } else {
      // Try to find by name
      const { data: nameMatch } = await supabase
        .from('players')
        .select('id, external_id, name')
        .eq('sport', 'MLB')
        .ilike('name', `%${apiName}%`)
        .limit(1)
        .single();
        
      if (nameMatch) {
        console.log(chalk.red(`❌ MISMATCH: ${apiName}`));
        console.log(chalk.gray(`   API ID: ${apiId} (expected: espn_mlb_${apiId})`));
        console.log(chalk.gray(`   DB ID: ${nameMatch.external_id}`));
        mismatches++;
      } else {
        console.log(chalk.yellow(`⚠️ NOT FOUND: ${apiName} (API ID: ${apiId})`));
        mismatches++;
      }
    }
  }
  
  console.log(chalk.blue(`\nSummary: ${matches} matches, ${mismatches} mismatches`));
  
  // Check what external_id format we're using
  const { data: samplePlayers } = await supabase
    .from('players')
    .select('external_id')
    .eq('sport', 'MLB')
    .limit(20);
    
  if (samplePlayers) {
    const formats = new Set<string>();
    samplePlayers.forEach(p => {
      const parts = p.external_id.split('_');
      if (parts.length >= 3) {
        formats.add(`${parts[0]}_${parts[1]}_[ID]`);
      }
    });
    
    console.log(chalk.yellow('\nExternal ID formats found:'));
    formats.forEach(f => console.log(`  ${f}`));
  }
}

testMLBPlayerIdMatch().catch(console.error);
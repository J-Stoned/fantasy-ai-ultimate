#!/usr/bin/env tsx
/**
 * Check MLB player mapping
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMLBPlayerMapping() {
  console.log(chalk.blue('🔍 CHECK MLB PLAYER MAPPING\n'));

  // Check for a specific player we know exists (Brandon Lowe - ESPN ID 39961)
  const espnId = '39961';
  const expectedExternalId = `espn_mlb_${espnId}`;
  
  console.log(chalk.yellow(`Looking for player with ESPN ID ${espnId}...`));
  console.log(chalk.gray(`Expected external_id: ${expectedExternalId}`));
  
  const { data: player, error } = await supabase
    .from('players')
    .select('id, external_id, name, sport')
    .eq('external_id', expectedExternalId)
    .single();
    
  if (error || !player) {
    console.log(chalk.red('❌ Player not found with expected external_id'));
    
    // Try to find any similar players
    const { data: similarPlayers } = await supabase
      .from('players')
      .select('id, external_id, name, sport')
      .or(`external_id.ilike.%${espnId}%,name.ilike.%Brandon Lowe%`)
      .limit(5);
      
    if (similarPlayers && similarPlayers.length > 0) {
      console.log(chalk.yellow('\nSimilar players found:'));
      similarPlayers.forEach(p => {
        console.log(`  ID: ${p.id}, External: ${p.external_id}, Name: ${p.name}, Sport: ${p.sport}`);
      });
    }
  } else {
    console.log(chalk.green('✅ Player found!'));
    console.log(`  DB ID: ${player.id}`);
    console.log(`  External ID: ${player.external_id}`);
    console.log(`  Name: ${player.name}`);
    console.log(`  Sport: ${player.sport}`);
  }
  
  // Check total MLB players
  const { count } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB');
    
  console.log(chalk.cyan(`\nTotal MLB players: ${count}`));
  
  // Sample some MLB player external IDs
  const { data: samplePlayers } = await supabase
    .from('players')
    .select('external_id, name')
    .eq('sport', 'MLB')
    .limit(10);
    
  if (samplePlayers) {
    console.log(chalk.yellow('\nSample MLB player external_ids:'));
    samplePlayers.forEach(p => {
      console.log(`  ${p.external_id} - ${p.name}`);
    });
  }
}

checkMLBPlayerMapping().catch(console.error);
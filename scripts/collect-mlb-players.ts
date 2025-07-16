#!/usr/bin/env tsx
/**
 * ⚾ MLB PLAYERS COLLECTOR - Get all active MLB players
 * Using ESPN Roster API for comprehensive player data
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pLimit from 'p-limit';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.bold.red('⚾ MLB PLAYERS COLLECTOR\n'));

// Tracking
let totalPlayers = 0;
let newPlayers = 0;
let existingPlayers = 0;

async function getMLBTeams() {
  console.log('🏟️  Loading MLB teams...');
  
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .eq('sport_id', 'mlb');
  
  if (!teams || teams.length === 0) {
    throw new Error('No MLB teams found! Run team collector first.');
  }
  
  console.log(`✅ Loaded ${teams.length} MLB teams\n`);
  return teams;
}

// MLB team ID mapping for MLB.com API
const MLB_TEAM_IDS: { [key: string]: number } = {
  'Los Angeles Angels': 108,
  'Arizona Diamondbacks': 109,
  'Baltimore Orioles': 110,
  'Boston Red Sox': 111,
  'Chicago Cubs': 112,
  'Cincinnati Reds': 113,
  'Cleveland Guardians': 114,
  'Colorado Rockies': 115,
  'Detroit Tigers': 116,
  'Houston Astros': 117,
  'Kansas City Royals': 118,
  'Los Angeles Dodgers': 119,
  'Washington Nationals': 120,
  'New York Mets': 121,
  'Oakland Athletics': 133,
  'Pittsburgh Pirates': 134,
  'San Diego Padres': 135,
  'Seattle Mariners': 136,
  'San Francisco Giants': 137,
  'St. Louis Cardinals': 138,
  'Tampa Bay Rays': 139,
  'Texas Rangers': 140,
  'Toronto Blue Jays': 141,
  'Minnesota Twins': 142,
  'Philadelphia Phillies': 143,
  'Atlanta Braves': 144,
  'Chicago White Sox': 145,
  'Miami Marlins': 146,
  'New York Yankees': 147,
  'Milwaukee Brewers': 158
};

async function collectTeamRoster(team: any) {
  try {
    // Use MLB.com official API
    const mlbTeamId = MLB_TEAM_IDS[team.name];
    if (!mlbTeamId) {
      console.log(`❌ No MLB team ID for ${team.name}`);
      return [];
    }
    
    const url = `https://statsapi.mlb.com/api/v1/teams/${mlbTeamId}/roster`;
    const response = await axios.get(url, { timeout: 10000 });
    
    if (!response.data.roster) {
      console.log(`❌ No roster data for ${team.name}`);
      return [];
    }

    const players = [];
    
    for (const player of response.data.roster) {
      const person = player.person;
      
      players.push({
        external_id: `mlb_${person.id}`,
        sport_id: 'mlb',
        team_id: team.id,
        name: person.fullName,
        firstname: person.firstName || null,
        lastname: person.lastName || null,
        position: player.position?.abbreviation ? [player.position.abbreviation] : null,
        jersey_number: parseInt(player.jerseyNumber) || null,
        heightinches: person.height ? parseInt(person.height.replace(/[^0-9]/g, '')) : null,
        weightlbs: parseInt(person.weight) || null,
        birthdate: person.birthDate || null,
        status: player.status?.description || 'active',
        photo_url: null, // MLB API doesn't provide photos
        metadata: {
          mlb_id: person.id,
          current_age: person.currentAge,
          position_code: player.position?.code,
          position_name: player.position?.name,
          position_type: player.position?.type,
          birth_city: person.birthCity,
          birth_state: person.birthStateProvince,
          birth_country: person.birthCountry,
          nationality: person.nationality,
          bat_side: person.batSide?.description,
          pitch_hand: person.pitchHand?.description
        }
      });
    }
    
    console.log(`✅ ${team.name}: ${players.length} players`);
    return players;
    
  } catch (error: any) {
    console.log(`❌ Error fetching ${team.name} roster:`, error.message);
    return [];
  }
}

async function collectMLBPlayers() {
  const startTime = Date.now();
  
  // Get teams
  const teams = await getMLBTeams();
  
  // Collect rosters with concurrency limit
  const limit = pLimit(10); // 10 concurrent API calls
  
  console.log('📊 Collecting player rosters...\n');
  
  const allPlayers: any[] = [];
  
  const promises = teams.map(team => 
    limit(async () => {
      const players = await collectTeamRoster(team);
      allPlayers.push(...players);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    })
  );
  
  await Promise.all(promises);
  
  console.log(`\n📊 Found ${allPlayers.length} total players`);
  
  // Check existing players
  const externalIds = allPlayers.map(p => p.external_id);
  const { data: existing } = await supabase
    .from('players')
    .select('external_id')
    .in('external_id', externalIds);
    
  const existingSet = new Set(existing?.map(p => p.external_id) || []);
  const newPlayersToInsert = allPlayers.filter(p => !existingSet.has(p.external_id));
  
  console.log(`✅ Already have: ${existing?.length || 0} players`);
  console.log(`🆕 New players to add: ${newPlayersToInsert.length}`);
  
  // Insert new players in batches
  if (newPlayersToInsert.length > 0) {
    console.log('\n💾 Inserting new players...');
    
    const batchSize = 100;
    for (let i = 0; i < newPlayersToInsert.length; i += batchSize) {
      const batch = newPlayersToInsert.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('players')
        .insert(batch)
        .select();
        
      if (error) {
        console.error('Insert error:', error.message);
      } else if (data) {
        newPlayers += data.length;
      }
      
      // Progress
      process.stdout.write(`\r💾 Inserted ${newPlayers} / ${newPlayersToInsert.length} players`);
    }
  }
  
  // Summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\n\n✅ MLB PLAYERS COLLECTION COMPLETE!\n');
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`👥 Total players found: ${allPlayers.length}`);
  console.log(`🆕 New players added: ${newPlayers}`);
  console.log(`📊 Already existed: ${allPlayers.length - newPlayers}`);
  
  // Check total MLB players
  const { count } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'mlb');
    
  console.log(`\n📈 Total MLB players in database: ${count}`);
  
  if (newPlayers > 0) {
    console.log('\n🎯 Next step: Collect MLB 2025 games, then run MLB stats collector!');
  }
}

// Check dependencies and run
async function main() {
  try {
    require('p-limit');
  } catch {
    console.log('📦 Installing required packages...');
    const { execSync } = require('child_process');
    execSync('npm install p-limit', { stdio: 'inherit' });
  }
  
  await collectMLBPlayers();
}

main().catch(console.error);
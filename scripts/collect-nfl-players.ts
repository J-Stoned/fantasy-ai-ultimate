#!/usr/bin/env tsx
/**
 * 🏈 NFL PLAYERS COLLECTOR - Get all active players
 * Target: 2,000+ players (already have ~2,900 but let's ensure we have all)
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.bold.green('🏈 NFL PLAYERS COLLECTOR\n'));

// Tracking
let totalPlayers = 0;
let newPlayers = 0;

async function getNFLTeams() {
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .or('sport_id.eq.nfl,sport_id.eq.NFL');
  
  return teams || [];
}

async function fetchNFLPlayers() {
  console.log('📊 Fetching NFL players from ESPN API...\n');
  
  const allPlayers: any[] = [];
  
  try {
    // Get all NFL teams from ESPN
    const teamsResponse = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams');
    
    if (!teamsResponse.data.sports?.[0]?.leagues?.[0]?.teams) {
      console.log('❌ No teams data found');
      return [];
    }
    
    const espnTeams = teamsResponse.data.sports[0].leagues[0].teams;
    console.log(`Found ${espnTeams.length} ESPN teams\n`);
    
    // Get our teams for mapping
    const ourTeams = await getNFLTeams();
    const teamLookup = new Map();
    ourTeams.forEach(team => {
      const espnId = team.external_id?.match(/\d+$/)?.[0];
      if (espnId) {
        teamLookup.set(espnId, team.id);
      }
    });
    
    // Fetch roster for each team
    for (const espnTeam of espnTeams) {
      const teamId = espnTeam.team.id;
      const teamName = espnTeam.team.displayName;
      
      console.log(`🏈 Fetching ${teamName} roster...`);
      
      try {
        const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/roster`;
        const rosterResponse = await axios.get(rosterUrl);
        
        if (!rosterResponse.data.athletes) {
          console.log(`   ❌ No roster data for ${teamName}`);
          continue;
        }
        
        const athletes = rosterResponse.data.athletes;
        const ourTeamId = teamLookup.get(teamId.toString());
        
        if (!ourTeamId) {
          console.log(`   ⚠️  No team mapping for ${teamName}`);
          continue;
        }
        
        // NFL API has a different structure - athletes are grouped by position
        if (Array.isArray(athletes)) {
          // Process each position group
          for (const group of athletes) {
            if (group.items && Array.isArray(group.items)) {
              // Process each athlete in the position group
              for (const athlete of group.items) {
                if (!athlete.id || !athlete.fullName) continue;
                
                const player = {
                  name: athlete.fullName,
                  firstname: athlete.firstName || athlete.fullName.split(' ')[0],
                  lastname: athlete.lastName || athlete.fullName.split(' ').slice(1).join(' '),
                  external_id: `espn_nfl_${athlete.id}`,
                  sport_id: 'nfl',
                  team_id: ourTeamId,
                  position: athlete.position?.abbreviation ? [athlete.position.abbreviation] : null,
                  jersey_number: athlete.jersey ? parseInt(athlete.jersey) : null,
                  heightinches: athlete.height || null,  // ESPN API already provides inches
                  weightlbs: athlete.weight || null,     // ESPN API already provides lbs
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
                    draft_year: athlete.draft?.year,
                    draft_round: athlete.draft?.round,
                    draft_pick: athlete.draft?.selection,
                    birth_place: {
                      city: athlete.birthPlace?.city,
                      state: athlete.birthPlace?.state,
                      country: athlete.birthPlace?.country
                    },
                    experience_years: athlete.experience?.years
                  }
                };
                
                allPlayers.push(player);
              }
            }
          }
        }
        
        const playerCount = athletes.reduce((count, group) => count + (group.items?.length || 0), 0);
        console.log(`   ✅ Found ${playerCount} players`);
        
      } catch (error: any) {
        console.log(`   ❌ Error fetching ${teamName} roster:`, error.message);
      }
      
      // Small delay between teams
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
  } catch (error: any) {
    console.error('Error fetching NFL data:', error.message);
  }
  
  return allPlayers;
}

async function collectNFLPlayers() {
  const startTime = Date.now();
  
  // Check existing NFL players
  const { count: existingCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .or('sport_id.eq.nfl,sport_id.eq.NFL');
  
  console.log(`📊 Currently have ${existingCount} NFL players in database`);
  console.log(`🎯 Collecting all current rosters...\n`);
  
  // Fetch all players
  const players = await fetchNFLPlayers();
  totalPlayers = players.length;
  
  console.log(`\n📊 Found ${totalPlayers} NFL players total`);
  
  if (players.length === 0) {
    console.log('❌ No players found');
    return;
  }
  
  // Check for existing players
  const externalIds = players.map(p => p.external_id);
  const { data: existing } = await supabase
    .from('players')
    .select('external_id')
    .in('external_id', externalIds);
  
  const existingSet = new Set(existing?.map(p => p.external_id) || []);
  const newPlayersToInsert = players.filter(p => !existingSet.has(p.external_id));
  
  console.log(`✅ Already have: ${existing?.length || 0} players`);
  console.log(`🆕 New players to add: ${newPlayersToInsert.length}`);
  
  // Insert new players in batches
  if (newPlayersToInsert.length > 0) {
    console.log('\n💾 Inserting new players...');
    
    const batchSize = 50;
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
      
      process.stdout.write(`\r💾 Inserted ${newPlayers} / ${newPlayersToInsert.length} players`);
    }
  }
  
  // Summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\n\n✅ NFL PLAYER COLLECTION COMPLETE!\n');
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`🏈 Total players found: ${totalPlayers}`);
  console.log(`🆕 New players added: ${newPlayers}`);
  
  // Final count
  const { count: finalCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .or('sport_id.eq.nfl,sport_id.eq.NFL');
    
  console.log(`\n📈 Total NFL players in database: ${finalCount}`);
}

collectNFLPlayers().catch(console.error);
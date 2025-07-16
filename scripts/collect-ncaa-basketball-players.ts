#!/usr/bin/env tsx
/**
 * 🏀 NCAA BASKETBALL PLAYERS COLLECTOR
 * Applies ALL lessons learned from NCAA Football collection
 * - Proper pagination from the start
 * - Uses espn_ncaabb_ external ID prefix
 * - Memory-first approach with 900-record batches
 * - Concurrent requests with proper error handling
 * - Comprehensive verification system
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

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  displayName: string;
  height?: number;
  displayHeight?: string;
  jersey?: string;
  position?: {
    name: string;
    abbreviation: string;
  };
  experience?: {
    years: number;
    displayValue: string;
  };
  birthPlace?: {
    city: string;
    state: string;
    country: string;
  };
  headshot?: {
    href: string;
  };
}

async function fetchTeamRoster(teamId: string): Promise<Player[]> {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}/roster`;
    const response = await axios.get(url);
    
    if (response.data?.athletes && Array.isArray(response.data.athletes)) {
      return response.data.athletes;
    }
    
    return [];
  } catch (error) {
    console.error(`Error fetching roster for team ${teamId}:`, error.message);
    return [];
  }
}

async function collectNCAABasketballPlayers() {
  console.log(chalk.bold.blue('🏀 NCAA BASKETBALL PLAYERS COLLECTOR'));
  console.log(chalk.blue('=====================================\n'));
  
  // Get all NCAA Basketball teams with proper pagination (lesson learned!)
  console.log('📊 Loading ALL NCAA Basketball teams with pagination...');
  const allTeams = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('teams')
      .select('id, name, external_id, metadata')
      .eq('sport', 'NCAA_BB')
      .range(from, from + batchSize - 1);
    
    if (error) {
      console.error('Error fetching teams:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    allTeams.push(...data);
    console.log(`Loaded ${allTeams.length} teams...`);
    
    from += batchSize;
    if (data.length < batchSize) break;
  }
  
  console.log(`\n✅ Found ${allTeams.length} NCAA Basketball teams`);
  
  // Check existing players with proper pagination
  console.log('📊 Loading existing NCAA Basketball players...');
  const existingPlayers = [];
  let existingFrom = 0;
  
  while (true) {
    const { data } = await supabase
      .from('players')
      .select('external_id')
      .eq('sport_id', 'NCAA_BB')
      .range(existingFrom, existingFrom + 999);
    
    if (!data || data.length === 0) break;
    
    existingPlayers.push(...data);
    existingFrom += 1000;
    
    if (data.length < 1000) break;
  }
  
  const existingIds = new Set(existingPlayers.map(p => p.external_id));
  console.log(`Found ${existingPlayers.length} existing NCAA Basketball players\n`);
  
  // Collect players with concurrent requests (learned from NCAA Football)
  console.log('🔍 Collecting players from all teams...');
  const playersToInsert = [];
  const concurrentBatch = 30; // Optimized for system
  let processedTeams = 0;
  let totalPlayersFound = 0;
  
  for (let i = 0; i < allTeams.length; i += concurrentBatch) {
    const teamBatch = allTeams.slice(i, i + concurrentBatch);
    
    const playerFetches = teamBatch.map(async (team) => {
      const espnId = team.external_id.replace('espn_ncaabb_', '');
      const roster = await fetchTeamRoster(espnId);
      
      const teamPlayers = roster
        .filter((player: Player) => {
          const externalId = `espn_ncaabb_${player.id}`;
          return !existingIds.has(externalId); // Only include new players
        })
        .map((player: Player) => ({
          external_id: `espn_ncaabb_${player.id}`,
          name: player.displayName || player.fullName,
          sport_id: 'NCAA_BB',
          team_id: team.id,
          metadata: {
            first_name: player.firstName,
            last_name: player.lastName,
            full_name: player.fullName,
            height: player.height || 0,
            display_height: player.displayHeight || '',
            jersey: player.jersey || '',
            position: player.position?.name || 'Unknown',
            position_abbr: player.position?.abbreviation || '',
            experience: player.experience?.displayValue || 'Unknown',
            birth_place: player.birthPlace ? 
              `${player.birthPlace.city}, ${player.birthPlace.state}` : '',
            headshot: player.headshot?.href || ''
          }
        }));
      
      return {
        team: team.name,
        playerCount: teamPlayers.length,
        players: teamPlayers
      };
    });
    
    const batchResults = await Promise.all(playerFetches);
    
    // Accumulate players in memory (lesson learned)
    batchResults.forEach(result => {
      if (result.players.length > 0) {
        playersToInsert.push(...result.players);
        totalPlayersFound += result.players.length;
      }
    });
    
    processedTeams += teamBatch.length;
    console.log(`Processed ${processedTeams}/${allTeams.length} teams: ${totalPlayersFound} players found`);
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n✅ Found ${totalPlayersFound} total players from ${allTeams.length} teams`);
  
  // Deduplicate players within collected data (lesson learned)
  const deduplicatedPlayers = [];
  const seenIds = new Set();
  
  for (const player of playersToInsert) {
    if (!seenIds.has(player.external_id)) {
      seenIds.add(player.external_id);
      deduplicatedPlayers.push(player);
    }
  }
  
  console.log(`After deduplication: ${deduplicatedPlayers.length} unique players`);
  
  if (deduplicatedPlayers.length > 0) {
    // Insert in batches of 900 (lesson learned from NCAA Football)
    console.log('\n🚀 Inserting players in 900-record batches...');
    const insertBatchSize = 900;
    let insertedCount = 0;
    
    for (let i = 0; i < deduplicatedPlayers.length; i += insertBatchSize) {
      const batch = deduplicatedPlayers.slice(i, i + insertBatchSize);
      
      const { error: insertError } = await supabase
        .from('players')
        .insert(batch);
      
      if (insertError) {
        console.error(`❌ Error inserting batch: ${insertError.message}`);
        // Continue with next batch (resilient error handling)
      } else {
        insertedCount += batch.length;
        console.log(`✅ Inserted batch ${Math.floor(i / insertBatchSize) + 1}/${Math.ceil(deduplicatedPlayers.length / insertBatchSize)} (${insertedCount}/${deduplicatedPlayers.length})`);
      }
    }
    
    console.log(`\n🎉 Successfully added ${insertedCount} NCAA Basketball players!`);
  } else {
    console.log('\n✅ All NCAA Basketball players already in database!');
  }
  
  // Final verification with pagination (lesson learned!)
  console.log('\n📊 Final verification with pagination...');
  const finalPlayers = [];
  let finalFrom = 0;
  
  while (true) {
    const { data } = await supabase
      .from('players')
      .select('id, name, team_id')
      .eq('sport_id', 'NCAA_BB')
      .range(finalFrom, finalFrom + 999);
    
    if (!data || data.length === 0) break;
    
    finalPlayers.push(...data);
    finalFrom += 1000;
    
    if (data.length < 1000) break;
  }
  
  console.log(`Final count: ${finalPlayers.length} NCAA Basketball players in database`);
  
  // Team coverage analysis
  const teamCoverage = new Map();
  finalPlayers.forEach(player => {
    const count = teamCoverage.get(player.team_id) || 0;
    teamCoverage.set(player.team_id, count + 1);
  });
  
  console.log(`Teams with players: ${teamCoverage.size}/${allTeams.length}`);
  
  // Sample players for verification
  const samplePlayers = finalPlayers.slice(0, 5);
  console.log('\n🏀 Sample players:');
  samplePlayers.forEach((player, i) => {
    console.log(`${i + 1}. ${player.name} (Team ID: ${player.team_id})`);
  });
  
  console.log('\n' + chalk.bold.green('✅ NCAA Basketball players collection complete!'));
  console.log(chalk.green(`📊 ${finalPlayers.length} players from ${teamCoverage.size} teams`));
  console.log(chalk.green('🎯 Ready for stats collection with comprehensive player data!'));
  
  return {
    totalPlayers: finalPlayers.length,
    teamsWithPlayers: teamCoverage.size,
    totalTeams: allTeams.length
  };
}

// Run the collection
collectNCAABasketballPlayers().catch(console.error);
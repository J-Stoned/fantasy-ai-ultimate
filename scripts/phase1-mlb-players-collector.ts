#!/usr/bin/env tsx
/**
 * ⚾ PHASE 1: MLB PLAYERS COLLECTOR
 * 
 * Collects all MLB players for 2023-2025 seasons with standardized data
 * Uses free MLB Stats API - no authentication required
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';

interface MLBPlayer {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  primaryNumber?: string;
  currentTeam?: {
    id: number;
    name: string;
  };
  primaryPosition?: {
    code: string;
    name: string;
    type: string;
  };
  birthDate?: string;
  height?: string;
  weight?: number;
  active?: boolean;
}

async function getMLBTeamId(mlbTeamId: number): Promise<number | null> {
  // Map MLB team IDs to our database team IDs
  const teamMapping: { [key: number]: string } = {
    133: 'OAK', 134: 'PIT', 135: 'SD', 136: 'SEA', 137: 'SF',
    138: 'STL', 139: 'TB', 140: 'TEX', 141: 'TOR', 142: 'MIN',
    143: 'PHI', 144: 'ATL', 145: 'CWS', 146: 'MIA', 147: 'NYY',
    108: 'LAA', 109: 'ARI', 110: 'BAL', 111: 'BOS', 112: 'CHC',
    113: 'CIN', 114: 'CLE', 115: 'COL', 116: 'DET', 117: 'HOU',
    118: 'KC', 119: 'LAD', 120: 'WSH', 121: 'NYM', 158: 'MIL'
  };
  
  const abbreviation = teamMapping[mlbTeamId];
  if (!abbreviation) return null;
  
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('abbreviation', abbreviation)
    .eq('sport', 'MLB')
    .single();
  
  return team?.id || null;
}

async function collectMLBPlayers(season: number) {
  console.log(chalk.blue.bold(`\n⚾ COLLECTING MLB PLAYERS FOR ${season} SEASON\n`));
  
  try {
    let totalPlayers = 0;
    let newPlayers = 0;
    let updatedPlayers = 0;
    let errors = 0;
    
    // Get all MLB teams
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
      .eq('sport', 'MLB')
      .order('name');
    
    if (!teams || teams.length === 0) {
      throw new Error('No MLB teams found in database');
    }
    
    console.log(chalk.white(`Found ${teams.length} MLB teams`));
    
    // Process each team
    for (const team of teams) {
      console.log(chalk.yellow(`\n📋 Processing ${team.name} (${team.abbreviation})...`));
      
      try {
        // Get team roster from MLB API
        // First, we need to find the MLB team ID for this team
        const mlbTeamIds: { [key: string]: number } = {
          'ARI': 109, 'ATL': 144, 'BAL': 110, 'BOS': 111, 'CHC': 112,
          'CHW': 145, 'CIN': 113, 'CLE': 114, 'COL': 115, 'DET': 116,
          'HOU': 117, 'KC': 118, 'LAA': 108, 'LAD': 119, 'MIA': 146,
          'MIL': 158, 'MIN': 142, 'NYM': 121, 'NYY': 147, 'OAK': 133,
          'PHI': 143, 'PIT': 134, 'SD': 135, 'SF': 137, 'SEA': 136,
          'STL': 138, 'TB': 139, 'TEX': 140, 'TOR': 141, 'WSH': 120
        };
        
        const mlbTeamId = mlbTeamIds[team.abbreviation];
        if (!mlbTeamId) {
          console.log(chalk.red(`   No MLB team ID mapping for ${team.abbreviation}`));
          continue;
        }
        
        // Get roster for this team and season
        const rosterUrl = `${MLB_API_BASE}/teams/${mlbTeamId}/roster?season=${season}`;
        const response = await axios.get(rosterUrl);
        
        if (!response.data.roster || response.data.roster.length === 0) {
          console.log(chalk.yellow(`   No roster data for ${season}`));
          continue;
        }
        
        console.log(chalk.white(`   Found ${response.data.roster.length} players on roster`));
        
        // Process each player
        for (const rosterEntry of response.data.roster) {
          const player = rosterEntry.person;
          totalPlayers++;
          
          try {
            // Get detailed player info
            const playerUrl = `${MLB_API_BASE}/people/${player.id}`;
            const playerResponse = await axios.get(playerUrl);
            const playerDetails: MLBPlayer = playerResponse.data.people[0];
            
            // Prepare player data
            const playerData = {
              firstname: playerDetails.firstName || playerDetails.fullName.split(' ')[0],
              lastname: playerDetails.lastName || playerDetails.fullName.split(' ').slice(1).join(' '),
              name: playerDetails.fullName,
              team_id: team.id,
              team: team.abbreviation,
              position: [playerDetails.primaryPosition?.code || 'Unknown'],
              jersey_number: playerDetails.primaryNumber ? parseInt(playerDetails.primaryNumber) : null,
              birthdate: playerDetails.birthDate || null,
              heightinches: playerDetails.height ? parseInt(playerDetails.height.replace(/[^0-9]/g, '')) : null,
              weightlbs: playerDetails.weight || null,
              sport: 'MLB',
              sport_id: 'MLB',
              status: playerDetails.active ? 'active' : 'inactive',
              external_id: `mlb_${playerDetails.id}`,
              metadata: {
                mlb_id: playerDetails.id,
                position_name: playerDetails.primaryPosition?.name,
                position_type: playerDetails.primaryPosition?.type,
                collected_season: season,
                collected_at: new Date().toISOString()
              }
            };
            
            // Check if player exists
            const { data: existingPlayer } = await supabase
              .from('players')
              .select('id')
              .eq('external_id', playerData.external_id)
              .single();
            
            if (existingPlayer) {
              // Update existing player
              const { error: updateError } = await supabase
                .from('players')
                .update({
                  ...playerData,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingPlayer.id);
              
              if (updateError) {
                console.error(chalk.red(`   Error updating player ${playerDetails.fullName}:`, updateError.message));
                errors++;
              } else {
                updatedPlayers++;
              }
            } else {
              // Insert new player
              const { error: insertError } = await supabase
                .from('players')
                .insert({
                  ...playerData,
                  created_at: new Date().toISOString()
                });
              
              if (insertError) {
                console.error(chalk.red(`   Error inserting player ${playerDetails.fullName}:`, insertError.message));
                errors++;
              } else {
                newPlayers++;
              }
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (playerError: any) {
            console.error(chalk.red(`   Error processing player ${player.fullName}:`, playerError.message));
            errors++;
          }
        }
        
        console.log(chalk.green(`   ✓ Processed ${response.data.roster.length} players`));
        
      } catch (teamError: any) {
        console.error(chalk.red(`   Error processing team ${team.name}:`, teamError.message));
        errors++;
      }
      
      // Rate limiting between teams
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Summary
    console.log(chalk.yellow('\n📊 COLLECTION SUMMARY'));
    console.log(chalk.gray('═'.repeat(50)));
    console.log(chalk.white(`Total players processed: ${totalPlayers}`));
    console.log(chalk.green(`New players added: ${newPlayers}`));
    console.log(chalk.blue(`Existing players updated: ${updatedPlayers}`));
    console.log(chalk.red(`Errors encountered: ${errors}`));
    
    return {
      season,
      totalPlayers,
      newPlayers,
      updatedPlayers,
      errors
    };
    
  } catch (error) {
    console.error(chalk.red('❌ Error collecting MLB players:'), error);
    throw error;
  }
}

async function collectAllSeasons() {
  console.log(chalk.cyan.bold('\n⚾ MLB PLAYERS COLLECTION - PHASE 1\n'));
  
  const seasons = [2023, 2024, 2025];
  const results = [];
  
  for (const season of seasons) {
    try {
      const result = await collectMLBPlayers(season);
      results.push(result);
    } catch (error) {
      console.error(chalk.red(`Failed to collect ${season} season`));
    }
  }
  
  // Final summary
  console.log(chalk.cyan.bold('\n🏆 FINAL COLLECTION SUMMARY'));
  console.log(chalk.gray('═'.repeat(50)));
  
  const totals = results.reduce((acc, r) => ({
    totalPlayers: acc.totalPlayers + r.totalPlayers,
    newPlayers: acc.newPlayers + r.newPlayers,
    updatedPlayers: acc.updatedPlayers + r.updatedPlayers,
    errors: acc.errors + r.errors
  }), { totalPlayers: 0, newPlayers: 0, updatedPlayers: 0, errors: 0 });
  
  console.log(chalk.white(`Total players processed: ${totals.totalPlayers}`));
  console.log(chalk.green(`Total new players: ${totals.newPlayers}`));
  console.log(chalk.blue(`Total updates: ${totals.updatedPlayers}`));
  console.log(chalk.red(`Total errors: ${totals.errors}`));
  
  // Verify final database state
  const { count } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB');
  
  console.log(chalk.green(`\n✅ Total MLB players in database: ${count || 0}`));
  console.log(chalk.green('✅ Phase 1 MLB collection complete!'));
}

// Run the collector
if (require.main === module) {
  collectAllSeasons()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export default collectAllSeasons;
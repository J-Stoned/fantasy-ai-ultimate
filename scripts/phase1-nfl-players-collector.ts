#!/usr/bin/env tsx
/**
 * 🏈 PHASE 1: NFL PLAYERS COLLECTOR
 * 
 * Collects all NFL players for 2023-2025 seasons with standardized data
 * Uses ESPN API - free access for roster data
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

const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

interface ESPNPlayer {
  id: string;
  uid: string;
  displayName: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  jersey?: string;
  position?: {
    name: string;
    abbreviation: string;
  };
  age?: number;
  height?: string;
  weight?: number;
  birthPlace?: {
    city?: string;
    state?: string;
    country?: string;
  };
  college?: {
    name?: string;
  };
  experience?: {
    years?: number;
  };
  status?: {
    name?: string;
    type?: string;
  };
}

async function getNFLTeamId(espnTeamId: string): Promise<number | null> {
  // Map ESPN team IDs to our database team IDs
  const teamMapping: { [key: string]: string } = {
    '1': 'ATL', '2': 'BUF', '3': 'CHI', '4': 'CIN', '5': 'CLE',
    '6': 'DAL', '7': 'DEN', '8': 'DET', '9': 'GB', '10': 'TEN',
    '11': 'IND', '12': 'KC', '13': 'LV', '14': 'LAR', '15': 'MIA',
    '16': 'MIN', '17': 'NE', '18': 'NO', '19': 'NYG', '20': 'NYJ',
    '21': 'PHI', '22': 'ARI', '23': 'PIT', '24': 'LAC', '25': 'SF',
    '26': 'SEA', '27': 'TB', '28': 'WAS', '29': 'CAR', '30': 'JAX',
    '33': 'BAL', '34': 'HOU'
  };
  
  const abbreviation = teamMapping[espnTeamId];
  if (!abbreviation) return null;
  
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('abbreviation', abbreviation)
    .eq('sport', 'NFL')
    .single();
  
  return team?.id || null;
}

async function collectNFLPlayers(season: number) {
  console.log(chalk.blue.bold(`\n🏈 COLLECTING NFL PLAYERS FOR ${season} SEASON\n`));
  
  try {
    let totalPlayers = 0;
    let newPlayers = 0;
    let updatedPlayers = 0;
    let errors = 0;
    
    // Get all NFL teams from database
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
      .eq('sport', 'NFL')
      .order('name');
    
    if (!teams || teams.length === 0) {
      throw new Error('No NFL teams found in database');
    }
    
    console.log(chalk.white(`Found ${teams.length} NFL teams`));
    
    // ESPN team ID mapping (reverse lookup)
    const espnTeamIds: { [key: string]: string } = {
      'ATL': '1', 'BUF': '2', 'CHI': '3', 'CIN': '4', 'CLE': '5',
      'DAL': '6', 'DEN': '7', 'DET': '8', 'GB': '9', 'TEN': '10',
      'IND': '11', 'KC': '12', 'LV': '13', 'LAR': '14', 'MIA': '15',
      'MIN': '16', 'NE': '17', 'NO': '18', 'NYG': '19', 'NYJ': '20',
      'PHI': '21', 'ARI': '22', 'PIT': '23', 'LAC': '24', 'SF': '25',
      'SEA': '26', 'TB': '27', 'WAS': '28', 'WSH': '28', 'CAR': '29', 'JAX': '30',
      'BAL': '33', 'HOU': '34'
    };
    
    // Process each team
    for (const team of teams) {
      console.log(chalk.yellow(`\n📋 Processing ${team.name} (${team.abbreviation})...`));
      
      try {
        const espnTeamId = espnTeamIds[team.abbreviation];
        if (!espnTeamId) {
          console.log(chalk.red(`   No ESPN team ID mapping for ${team.abbreviation}`));
          continue;
        }
        
        // Get team roster from ESPN API (full roster endpoint)
        const rosterUrl = `${ESPN_API_BASE}/teams/${espnTeamId}/roster?enable=roster`;
        const response = await axios.get(rosterUrl);
        
        if (!response.data.athletes || response.data.athletes.length === 0) {
          console.log(chalk.yellow(`   No roster data available`));
          continue;
        }
        
        // Count total players across all position groups
        let totalPlayersOnRoster = 0;
        for (const posGroup of response.data.athletes) {
          totalPlayersOnRoster += posGroup.items?.length || 0;
        }
        console.log(chalk.white(`   Found ${totalPlayersOnRoster} players on roster`));
        
        // Process each position group
        for (const positionGroup of response.data.athletes) {
          if (!positionGroup.items) continue;
          
          for (const athlete of positionGroup.items) {
            totalPlayers++;
            
            try {
              const player: ESPNPlayer = athlete;
              
              // Prepare player data
              const playerData = {
                firstname: player.firstName || player.displayName.split(' ')[0],
                lastname: player.lastName || player.displayName.split(' ').slice(1).join(' '),
                name: player.displayName,
                team_id: team.id,
                team: team.abbreviation,
                position: [player.position?.abbreviation || 'Unknown'],
                jersey_number: player.jersey ? parseInt(player.jersey) : null,
                birthdate: null, // ESPN doesn't provide birthdate in roster API
                heightinches: typeof player.height === 'number' ? player.height : null,
                weightlbs: player.weight || null,
                sport: 'NFL',
                sport_id: 'NFL',
                status: player.status?.name === 'Active' ? 'active' : 'inactive',
                external_id: `espn_nfl_${player.id}`,
                metadata: {
                  espn_id: player.id,
                  espn_uid: player.uid,
                  position_name: player.position?.name,
                  age: player.age,
                  college: player.college?.name,
                  experience_years: player.experience?.years,
                  birth_place: player.birthPlace,
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
                  console.error(chalk.red(`   Error updating player ${player.displayName}:`, updateError.message));
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
                  console.error(chalk.red(`   Error inserting player ${player.displayName}:`, insertError.message));
                  errors++;
                } else {
                  newPlayers++;
                }
              }
              
              // Rate limiting
              await new Promise(resolve => setTimeout(resolve, 50));
              
            } catch (playerError: any) {
              console.error(chalk.red(`   Error processing player:`, playerError.message));
              errors++;
            }
          }
        }
        
        console.log(chalk.green(`   ✓ Processed team roster`));
        
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
    console.error(chalk.red('❌ Error collecting NFL players:'), error);
    throw error;
  }
}

async function collectAllSeasons() {
  console.log(chalk.cyan.bold('\n🏈 NFL PLAYERS COLLECTION - PHASE 1\n'));
  
  const seasons = [2023, 2024, 2025];
  const results = [];
  
  for (const season of seasons) {
    try {
      // Note: ESPN roster API returns current roster, so we collect once
      // and mark it for all seasons (players move between seasons)
      if (season === 2024) { // Only collect current roster once
        const result = await collectNFLPlayers(season);
        results.push(result);
      } else {
        console.log(chalk.yellow(`\n🏈 SKIPPING ${season} SEASON (using current roster data)\n`));
        results.push({
          season,
          totalPlayers: 0,
          newPlayers: 0,
          updatedPlayers: 0,
          errors: 0
        });
      }
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
    .eq('sport', 'NFL');
  
  console.log(chalk.green(`\n✅ Total NFL players in database: ${count || 0}`));
  console.log(chalk.green('✅ Phase 1 NFL collection complete!'));
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
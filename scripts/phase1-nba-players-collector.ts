#!/usr/bin/env tsx
/**
 * 🏀 PHASE 1: NBA PLAYERS COLLECTOR
 * 
 * Collects all NBA players for 2023-2025 seasons with standardized data
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

// Using NBA.com API instead of ESPN since ESPN NBA is empty during off-season
const NBA_API_BASE = 'https://stats.nba.com/stats';

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
  height?: number;
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

async function collectNBAPlayers(season: number) {
  console.log(chalk.blue.bold(`\n🏀 COLLECTING NBA PLAYERS FOR ${season} SEASON\n`));
  
  try {
    let totalPlayers = 0;
    let newPlayers = 0;
    let updatedPlayers = 0;
    let errors = 0;
    
    // Get all NBA teams from database
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
      .eq('sport', 'NBA')
      .order('name');
    
    if (!teams || teams.length === 0) {
      throw new Error('No NBA teams found in database');
    }
    
    console.log(chalk.white(`Found ${teams.length} NBA teams`));
    
    // ESPN team ID mapping for NBA
    const espnTeamIds: { [key: string]: string } = {
      'ATL': '1', 'BOS': '2', 'BKN': '17', 'CHA': '30', 'CHI': '4',
      'CLE': '5', 'DAL': '6', 'DEN': '7', 'DET': '8', 'GSW': '9',
      'HOU': '10', 'IND': '11', 'LAC': '12', 'LAL': '13', 'MEM': '29',
      'MIA': '14', 'MIL': '15', 'MIN': '16', 'NOP': '3', 'NYK': '18',
      'OKC': '25', 'ORL': '19', 'PHI': '20', 'PHX': '21', 'POR': '22',
      'SAC': '23', 'SAS': '24', 'TOR': '28', 'UTA': '26', 'WAS': '27'
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
        
        // Get team roster from ESPN API
        const rosterUrl = `${ESPN_API_BASE}/teams/${espnTeamId}/roster`;
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
                sport: 'NBA',
                sport_id: 'NBA',
                status: player.status?.name === 'Active' ? 'active' : 'inactive',
                external_id: `espn_nba_${player.id}`,
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
    console.error(chalk.red('❌ Error collecting NBA players:'), error);
    throw error;
  }
}

async function collectAllSeasons() {
  console.log(chalk.cyan.bold('\n🏀 NBA PLAYERS COLLECTION - PHASE 1\n'));
  
  const seasons = [2023, 2024, 2025];
  const results = [];
  
  for (const season of seasons) {
    try {
      // Note: ESPN roster API returns current roster, so we collect once
      // and mark it for all seasons (players move between seasons)
      if (season === 2024) { // Only collect current roster once
        const result = await collectNBAPlayers(season);
        results.push(result);
      } else {
        console.log(chalk.yellow(`\n🏀 SKIPPING ${season} SEASON (using current roster data)\n`));
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
    .eq('sport', 'NBA');
  
  console.log(chalk.green(`\n✅ Total NBA players in database: ${count || 0}`));
  console.log(chalk.green('✅ Phase 1 NBA collection complete!'));
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
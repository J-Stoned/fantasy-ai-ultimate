#!/usr/bin/env tsx
/**
 * 🏈 FINISH NFL TEAMS - TARGETED COLLECTION
 * 
 * Complete collection for specific NFL teams that were missed or incomplete
 * Target teams: GB, SEA, TB, TEN, WSH, SF (incomplete)
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

const NFL_ESPN_TEAM_IDS: { [key: string]: string } = {
  'GB': '9', 'SEA': '26', 'TB': '27', 'TEN': '10', 'WSH': '28', 'SF': '25'
};

const TARGET_TEAMS = ['GB', 'SEA', 'TB', 'TEN', 'WSH', 'SF'];

interface ESPNNFLPlayer {
  id: string;
  uid: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  jersey?: string;
  position?: {
    abbreviation: string;
    name: string;
  };
  height?: number;
  weight?: number;
  age?: number;
  college?: {
    name: string;
  };
  birthPlace?: {
    city?: string;
    state?: string;
    country?: string;
  };
  experience?: {
    years: number;
  };
  status?: {
    name: string;
  };
}

async function finishNFLTeams() {
  console.log(chalk.cyan.bold('🏈 FINISHING NFL TEAMS - TARGETED COLLECTION\n'));
  console.log(chalk.blue(`🎯 Target teams: ${TARGET_TEAMS.join(', ')}`));
  console.log(chalk.blue('📡 API: ESPN NFL API\n'));
  
  let totalNewPlayers = 0;
  let totalUpdatedPlayers = 0;
  let totalErrors = 0;
  let teamsProcessed = 0;
  
  // Get target teams from database
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, abbreviation')
    .eq('sport', 'NFL')
    .in('abbreviation', TARGET_TEAMS)
    .order('name');
  
  if (!teams || teams.length === 0) {
    throw new Error('No target NFL teams found in database');
  }
  
  console.log(chalk.blue(`📊 Found ${teams.length} target teams in database\n`));
  
  for (const team of teams) {
    console.log(chalk.yellow(`🏟️ Processing ${team.name} (${team.abbreviation})...`));
    
    const espnTeamId = NFL_ESPN_TEAM_IDS[team.abbreviation];
    if (!espnTeamId) {
      console.error(chalk.red(`   ❌ No ESPN team ID for ${team.abbreviation}`));
      continue;
    }
    
    try {
      const url = `${ESPN_API_BASE}/teams/${espnTeamId}/roster`;
      console.log(chalk.gray(`   API: ${url}`));
      
      const response = await axios.get(url);
      
      if (!response.data.athletes || response.data.athletes.length === 0) {
        console.log(chalk.yellow(`   ⚠️ No roster data available`));
        continue;
      }
      
      // Count total players
      let totalPlayersOnRoster = 0;
      for (const posGroup of response.data.athletes) {
        totalPlayersOnRoster += posGroup.items?.length || 0;
      }
      
      console.log(chalk.white(`   📋 Found ${totalPlayersOnRoster} players on roster`));
      
      let teamNewPlayers = 0;
      let teamUpdatedPlayers = 0;
      let teamErrors = 0;
      
      // Process each position group
      for (const positionGroup of response.data.athletes) {
        if (!positionGroup.items) continue;
        
        for (const athlete of positionGroup.items) {
          try {
            const player: ESPNNFLPlayer = athlete;
            
            const playerData = {
              firstname: player.firstName || player.displayName.split(' ')[0],
              lastname: player.lastName || player.displayName.split(' ').slice(1).join(' '),
              name: player.displayName,
              team_id: team.id,
              team: team.abbreviation,
              position: [player.position?.abbreviation || 'Unknown'],
              jersey_number: player.jersey ? parseInt(player.jersey) : null,
              birthdate: null,
              heightinches: typeof player.height === 'number' ? player.height : null,
              weightlbs: player.weight || null,
              sport: 'NFL',
              sport_id: 'NFL',
              status: player.status?.name === 'Active' ? 'active' : 'inactive',
              external_id: `espn_nfl_${player.id}`,
              metadata: {
                api_source: 'ESPN NFL API',
                espn_id: player.id,
                espn_uid: player.uid,
                position_name: player.position?.name,
                age: player.age,
                college: player.college?.name,
                experience_years: player.experience?.years,
                birth_place: player.birthPlace,
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
                console.error(chalk.red(`     ❌ Update error for ${player.displayName}: ${updateError.message}`));
                teamErrors++;
              } else {
                teamUpdatedPlayers++;
              }
            } else {
              // Insert new player
              const { error: insertError } = await supabase
                .from('players')
                .insert({
                  ...playerData,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
              
              if (insertError) {
                console.error(chalk.red(`     ❌ Insert error for ${player.displayName}: ${insertError.message}`));
                teamErrors++;
              } else {
                teamNewPlayers++;
              }
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 50));
            
          } catch (playerError: any) {
            console.error(chalk.red(`     ❌ Player processing error: ${playerError.message}`));
            teamErrors++;
          }
        }
      }
      
      totalNewPlayers += teamNewPlayers;
      totalUpdatedPlayers += teamUpdatedPlayers;
      totalErrors += teamErrors;
      teamsProcessed++;
      
      console.log(chalk.green(`   ✅ Team complete: ${teamNewPlayers} new, ${teamUpdatedPlayers} updated, ${teamErrors} errors`));
      
    } catch (teamError: any) {
      console.error(chalk.red(`   ❌ Team ${team.name} failed: ${teamError.message}`));
      totalErrors++;
    }
    
    // Rate limiting between teams
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Final report
  console.log(chalk.cyan.bold('\n📊 FINISHING NFL TEAMS REPORT'));
  console.log(chalk.gray('═'.repeat(60)));
  console.log(chalk.white(`📈 Teams Processed: ${teamsProcessed}/${TARGET_TEAMS.length}`));
  console.log(chalk.green(`✨ New Players: ${totalNewPlayers}`));
  console.log(chalk.blue(`🔄 Updated Players: ${totalUpdatedPlayers}`));
  console.log(chalk.red(`❌ Errors: ${totalErrors}`));
  
  // Check final NFL count
  const { count: finalNFLCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL');
  
  console.log(chalk.cyan(`\n🗄️ Total NFL players in database: ${finalNFLCount || 0}`));
  
  if (totalErrors === 0) {
    console.log(chalk.green.bold('\n🎉 NFL TEAMS COMPLETION SUCCESS! 🎉'));
  } else {
    console.log(chalk.yellow.bold('\n⚠️ NFL TEAMS COMPLETION WITH ERRORS'));
  }
}

finishNFLTeams()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('💥 NFL completion failed:'), error);
    process.exit(1);
  });
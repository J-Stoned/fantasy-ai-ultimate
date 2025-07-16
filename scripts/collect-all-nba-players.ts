#!/usr/bin/env tsx
/**
 * 🏀 COLLECT ALL NBA PLAYERS
 * 
 * Ensures we have every NBA player from all teams before collecting stats
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ESPN API base
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

// Rate limiting
const limit = pLimit(3);
const API_DELAY = 1000;

// Progress tracking
let totalPlayers = 0;
let newPlayers = 0;
let updatedPlayers = 0;
let errors = 0;

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchTeamRoster(teamId: number, teamName: string) {
  try {
    await delay(API_DELAY);
    
    const url = `${ESPN_BASE}/teams/${teamId}/roster`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const players: any[] = [];
    
    // ESPN groups players by position
    if (response.data.athletes) {
      response.data.athletes.forEach((group: any) => {
        if (group.items) {
          group.items.forEach((player: any) => {
            players.push({
              ...player,
              teamId: teamId,
              teamName: teamName
            });
          });
        }
      });
    }
    
    return players;
  } catch (error: any) {
    console.error(chalk.red(`Error fetching ${teamName} roster:`), error.message);
    errors++;
    return [];
  }
}

async function upsertPlayer(playerData: any, teamId: number) {
  try {
    // Check if player exists by external_id
    const { data: existing } = await supabase
      .from('players')
      .select('id')
      .eq('external_id', `espn_nba_${playerData.id}`)
      .single();
    
    const player = {
      name: playerData.displayName,
      firstname: playerData.firstName || playerData.displayName.split(' ')[0],
      lastname: playerData.lastName || playerData.displayName.split(' ').slice(1).join(' '),
      position: playerData.position ? [playerData.position.abbreviation] : [],
      team_id: teamId,
      jersey_number: parseInt(playerData.jersey) || null,
      heightinches: playerData.height || null,
      weightlbs: playerData.weight || null,
      birthdate: playerData.dateOfBirth || null,
      status: playerData.status?.type?.name || 'active',
      sport: 'NBA',
      sport_id: 'nba',
      external_id: `espn_nba_${playerData.id}`,
      photo_url: playerData.headshot?.href || null,
      college: playerData.college?.name || null,
      metadata: {
        espn_id: playerData.id,
        espn_uid: playerData.uid,
        experience: playerData.experience?.years || 0,
        draft: playerData.draft || null,
        birthPlace: playerData.birthPlace || null,
        age: playerData.age || null
      }
    };
    
    if (existing) {
      // Update existing player
      const { error } = await supabase
        .from('players')
        .update(player)
        .eq('id', existing.id);
      
      if (!error) {
        updatedPlayers++;
      }
    } else {
      // Insert new player
      const { error } = await supabase
        .from('players')
        .insert(player);
      
      if (!error) {
        newPlayers++;
      }
    }
    
    totalPlayers++;
    
  } catch (error: any) {
    console.error(chalk.red(`Error saving player ${playerData.displayName}:`), error.message);
    errors++;
  }
}

async function main() {
  console.log(chalk.bold.blue('\n🏀 COLLECT ALL NBA PLAYERS\n'));
  
  try {
    // Get all NBA teams
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name, external_id')
      .eq('sport', 'NBA')
      .order('name');
    
    if (error) throw error;
    
    console.log(chalk.cyan(`Found ${teams?.length || 0} NBA teams\n`));
    
    // Process each team
    for (const team of teams || []) {
      console.log(chalk.yellow(`\n📋 Processing ${team.name}...`));
      
      // Check if team already has players
      const { count: existingPlayerCount } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', team.id)
        .eq('sport', 'NBA');
      
      if (existingPlayerCount && existingPlayerCount >= 12) { // NBA teams have 12-15 active players
        console.log(chalk.gray(`  ✓ Already has ${existingPlayerCount} players - skipping`));
        continue;
      }
      
      // Extract ESPN team ID from external_id
      const espnTeamId = team.external_id?.replace('espn_nba_', '');
      if (!espnTeamId) {
        console.log(chalk.red(`  ❌ No ESPN ID for ${team.name}`));
        continue;
      }
      
      // Fetch roster
      const players = await fetchTeamRoster(parseInt(espnTeamId), team.name);
      console.log(chalk.gray(`  Found ${players.length} players on ESPN`));
      
      // Process each player
      await Promise.all(
        players.map(player => 
          limit(async () => {
            await upsertPlayer(player, team.id);
          })
        )
      );
      
      console.log(chalk.green(`  ✅ Processed ${team.name}`));
    }
    
    // Final summary
    console.log(chalk.green('\n✅ Player Collection Complete!\n'));
    console.log(chalk.white(`📊 Summary:`));
    console.log(chalk.white(`   Total players processed: ${totalPlayers}`));
    console.log(chalk.white(`   New players added: ${newPlayers}`));
    console.log(chalk.white(`   Players updated: ${updatedPlayers}`));
    console.log(chalk.white(`   Errors: ${errors}`));
    
    // Verify total in database
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .or('sport.eq.NBA,sport.eq.nba');
    
    console.log(chalk.cyan(`\n🗄️  Total NBA players in database: ${count}`));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Fatal error:'), error);
    process.exit(1);
  }
}

// Run the collector
main().catch(console.error);
#!/usr/bin/env tsx
/**
 * 🏈 FINISH WASHINGTON COMMANDERS
 * Quick targeted collection for the last team
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

async function finishWashington() {
  console.log(chalk.cyan.bold('🏈 FINISHING WASHINGTON COMMANDERS\n'));
  
  // Get Washington team
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, abbreviation')
    .eq('sport', 'NFL')
    .eq('abbreviation', 'WSH')
    .single();
  
  if (!team) {
    throw new Error('Washington team not found');
  }
  
  console.log(chalk.blue(`Processing ${team.name} (${team.abbreviation})...`));
  
  const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/28/roster';
  const response = await axios.get(url);
  
  let totalPlayersOnRoster = 0;
  for (const posGroup of response.data.athletes) {
    totalPlayersOnRoster += posGroup.items?.length || 0;
  }
  
  console.log(chalk.white(`Found ${totalPlayersOnRoster} players on roster`));
  
  let newPlayers = 0;
  let updatedPlayers = 0;
  let errors = 0;
  
  for (const positionGroup of response.data.athletes) {
    if (!positionGroup.items) continue;
    
    for (const athlete of positionGroup.items) {
      try {
        const player = athlete;
        
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
        
        const { data: existingPlayer } = await supabase
          .from('players')
          .select('id')
          .eq('external_id', playerData.external_id)
          .single();
        
        if (existingPlayer) {
          const { error: updateError } = await supabase
            .from('players')
            .update({
              ...playerData,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingPlayer.id);
          
          if (updateError) {
            console.error(`Update error: ${updateError.message}`);
            errors++;
          } else {
            updatedPlayers++;
          }
        } else {
          const { error: insertError } = await supabase
            .from('players')
            .insert({
              ...playerData,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (insertError) {
            console.error(`Insert error: ${insertError.message}`);
            errors++;
          } else {
            newPlayers++;
          }
        }
        
      } catch (error) {
        errors++;
      }
    }
  }
  
  console.log(chalk.green(`✅ Washington complete: ${newPlayers} new, ${updatedPlayers} updated, ${errors} errors`));
  
  // Final count
  const { count: finalNFLCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL');
  
  console.log(chalk.cyan(`\nFinal NFL player count: ${finalNFLCount || 0}`));
}

finishWashington().then(() => process.exit(0)).catch(console.error);
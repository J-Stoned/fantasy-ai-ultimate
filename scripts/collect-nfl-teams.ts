#!/usr/bin/env tsx
/**
 * 🏈 COLLECT NFL TEAMS
 * 
 * Ensures all 32 NFL teams have proper ESPN external IDs
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function collectNFLTeams() {
  console.log(chalk.bold.cyan('🏈 COLLECTING NFL TEAMS'));
  
  try {
    // Get ESPN NFL teams
    const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams');
    
    if (response.data.sports?.[0]?.leagues?.[0]?.teams) {
      const espnTeams = response.data.sports[0].leagues[0].teams;
      console.log(chalk.blue(`Found ${espnTeams.length} NFL teams from ESPN`));
      
      const teams = [];
      
      for (const espnTeam of espnTeams) {
        const team = {
          external_id: `espn_nfl_${espnTeam.team.id}`,
          name: espnTeam.team.displayName,
          abbreviation: espnTeam.team.abbreviation,
          sport: 'NFL',
          metadata: {
            location: espnTeam.team.location,
            color: espnTeam.team.color,
            alternateColor: espnTeam.team.alternateColor,
            logo: espnTeam.team.logos?.[0]?.href,
            conference: espnTeam.team.groups?.id,
            division: espnTeam.team.groups?.parent?.id
          }
        };
        
        teams.push(team);
      }
      
      // Upsert teams
      console.log(chalk.blue(`Upserting ${teams.length} NFL teams...`));
      
      const { data, error } = await supabase
        .from('teams')
        .upsert(teams, { onConflict: 'external_id' })
        .select();
        
      if (error) {
        console.error(chalk.red('Error upserting teams:'));
        console.error(error);
      } else {
        console.log(chalk.green(`✅ Successfully upserted ${data?.length || 0} NFL teams`));
        
        // Show team names
        data?.forEach(team => {
          console.log(chalk.gray(`  - ${team.name} (${team.abbreviation})`));
        });
      }
      
      // Verify final count
      const { count } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('sport', 'NFL')
        .not('external_id', 'is', null);
        
      console.log(chalk.green(`\n✅ Total NFL teams with external IDs: ${count}`));
      
    } else {
      console.error(chalk.red('No teams found in ESPN response'));
    }
    
  } catch (error) {
    console.error(chalk.red('Error collecting NFL teams:'), error);
  }
}

collectNFLTeams().catch(console.error);
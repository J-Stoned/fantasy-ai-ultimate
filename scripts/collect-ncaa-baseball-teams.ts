#!/usr/bin/env tsx
/**
 * 🏟️ NCAA BASEBALL TEAM COLLECTOR
 * 
 * Collects all 430 NCAA Baseball teams from ESPN API
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

async function collectNCAABaseballTeams() {
  console.log(chalk.cyan('\n⚾ NCAA BASEBALL TEAM COLLECTION\n'));
  
  try {
    // Fetch all NCAA Baseball teams
    const url = 'https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams?limit=500';
    const response = await axios.get(url);
    
    const teams = response.data.sports[0].leagues[0].teams;
    console.log(chalk.green(`Found ${teams.length} NCAA Baseball teams\n`));
    
    // Transform teams
    const transformedTeams = teams.map((item: any) => {
      const team = item.team;
      return {
        external_id: `espn_ncaa_baseball_${team.id}`,
        name: team.displayName,
        city: team.location || team.displayName.split(' ')[0],
        abbreviation: team.abbreviation,
        sport: 'NCAA_BASEBALL',
        league_id: 'NCAA',
        logo_url: team.logos?.[0]?.href,
        metadata: {
          espn_id: team.id,
          color: team.color,
          alternateColor: team.alternateColor,
          isActive: team.isActive,
          conference: team.groups?.id,
          venue: team.venue?.id
        }
      };
    });
    
    // Insert teams
    console.log(chalk.yellow('Inserting teams into database...'));
    
    const { error } = await supabase
      .from('teams')
      .upsert(transformedTeams, {
        onConflict: 'external_id',
        ignoreDuplicates: false
      });
      
    if (error) {
      console.error(chalk.red('Error inserting teams:'), error);
      return;
    }
    
    console.log(chalk.green(`\n✅ Successfully collected ${transformedTeams.length} NCAA Baseball teams!`));
    
    // Show sample teams
    console.log(chalk.yellow('\nSample teams:'));
    transformedTeams.slice(0, 5).forEach((team: any) => {
      console.log(`  ${team.abbreviation} - ${team.name}`);
    });
    
  } catch (error) {
    console.error(chalk.red('Error collecting teams:'), error);
  }
}

collectNCAABaseballTeams().catch(console.error);
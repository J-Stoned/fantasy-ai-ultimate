#!/usr/bin/env tsx
/**
 * 🏈 NCAA FOOTBALL TEAM COLLECTOR
 * 
 * Collects all NCAA Football teams from ESPN API
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

async function collectNCAAFootballTeams() {
  console.log(chalk.cyan('\n🏈 NCAA FOOTBALL TEAM COLLECTION\n'));
  
  try {
    // Fetch all NCAA Football teams
    const url = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams?limit=500';
    const response = await axios.get(url);
    
    const teams = response.data.sports[0].leagues[0].teams;
    console.log(chalk.green(`Found ${teams.length} NCAA Football teams\n`));
    
    // Transform teams
    const transformedTeams = teams.map((item: any) => {
      const team = item.team;
      return {
        external_id: `espn_ncaa_fb_${team.id}`,
        name: team.displayName,
        city: team.location || team.displayName.split(' ')[0],
        abbreviation: team.abbreviation,
        sport: 'NCAA_FB',
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
    
    // Insert teams using 10X approach with batches
    console.log(chalk.yellow('Inserting teams with 10X batch processing...'));
    
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < transformedTeams.length; i += batchSize) {
      const batch = transformedTeams.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('teams')
        .upsert(batch, {
          onConflict: 'external_id',
          ignoreDuplicates: false
        });
        
      if (error) {
        console.error(chalk.red(`Batch error:`), error);
      } else {
        inserted += batch.length;
        process.stdout.write(`\r${chalk.green('Progress:')} ${inserted}/${transformedTeams.length} teams`);
      }
    }
    
    console.log(chalk.green(`\n\n✅ Successfully collected ${inserted} NCAA Football teams!`));
    
    // Show sample teams
    console.log(chalk.yellow('\nSample teams:'));
    transformedTeams.slice(0, 5).forEach((team: any) => {
      console.log(`  ${team.abbreviation} - ${team.name}`);
    });
    
  } catch (error) {
    console.error(chalk.red('Error collecting teams:'), error);
  }
}

collectNCAAFootballTeams().catch(console.error);
#!/usr/bin/env tsx
/**
 * 🏒 NHL PLAYERS 2022 COLLECTOR
 * 
 * Collect all NHL players for 2021-22 season
 */

import chalk from 'chalk';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const limit = pLimit(10);

async function collectNHLPlayers() {
  console.log(chalk.cyan('🏒 COLLECTING NHL PLAYERS FOR 2021-22\n'));
  
  // Get all NHL teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id, name')
    .eq('sport', 'NHL');
  
  if (!teams || teams.length === 0) {
    console.log(chalk.red('No NHL teams found!'));
    return;
  }
  
  console.log(chalk.blue(`Found ${teams.length} NHL teams`));
  
  const allPlayers = [];
  let teamCount = 0;
  
  // Collect roster for each team
  for (const team of teams) {
    const espnTeamId = team.external_id.split('_').pop();
    
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/${espnTeamId}/roster`;
      const response = await limit(() => axios.get(url, { timeout: 10000 }));
      
      let teamPlayers = 0;
      
      if (response.data.athletes) {
        for (const athlete of response.data.athletes) {
          allPlayers.push({
            external_id: `espn_nhl_${athlete.id}`,
            name: athlete.displayName || athlete.fullName,
            position: athlete.position?.abbreviation,
            team_id: team.id,
            sport: 'NHL',
            jersey_number: athlete.jersey,
            metadata: {
              height: athlete.height,
              weight: athlete.weight,
              age: athlete.age,
              experience: athlete.experience?.years,
              birthPlace: athlete.birthPlace?.city + ', ' + athlete.birthPlace?.country,
              status: athlete.status?.type
            }
          });
          teamPlayers++;
        }
      }
      
      teamCount++;
      console.log(chalk.gray(`  ${team.name}: ${teamPlayers} players`));
      
    } catch (error: any) {
      console.error(chalk.red(`Error collecting ${team.name}:`), error.message);
    }
  }
  
  console.log(chalk.blue(`\nTotal players found: ${allPlayers.length}`));
  
  // Clear existing NHL players to avoid conflicts
  console.log(chalk.yellow('Clearing existing NHL players...'));
  const { error: deleteError } = await supabase
    .from('players')
    .delete()
    .eq('sport', 'NHL');
  
  if (deleteError) {
    console.error(chalk.red('Error clearing players:'), deleteError);
  }
  
  // Insert all players in batches
  if (allPlayers.length > 0) {
    console.log(chalk.blue('Inserting players...'));
    
    const batchSize = 500;
    let inserted = 0;
    
    for (let i = 0; i < allPlayers.length; i += batchSize) {
      const batch = allPlayers.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('players')
        .insert(batch)
        .select();
      
      if (error) {
        console.error(chalk.red('Insert error:'), error);
      } else {
        inserted += data?.length || 0;
      }
    }
    
    console.log(chalk.green(`\n✅ Inserted ${inserted} NHL players`));
  }
  
  // Verify
  const { data: finalCount } = await supabase
    .from('players')
    .select('id')
    .eq('sport', 'NHL');
  
  console.log(chalk.cyan(`\n📊 Final NHL player count: ${finalCount?.length || 0}`));
}

collectNHLPlayers()
  .then(() => {
    console.log(chalk.green('\n🎯 NHL player collection complete!'));
    console.log(chalk.yellow('Now run the stats collector again to get NHL stats.'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
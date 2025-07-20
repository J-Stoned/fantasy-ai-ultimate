#!/usr/bin/env tsx
/**
 * 🏒 COLLECT MISSING NHL PLAYERS
 * 
 * Collects all NHL players from rosters to fix missing player issue
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const limit = pLimit(50); // 50 concurrent requests

async function collectMissingNHLPlayers() {
  console.log(chalk.bold.cyan('🏒 COLLECTING MISSING NHL PLAYERS\n'));
  
  // Get all NHL teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id, name')
    .eq('sport', 'NHL');
  
  if (!teams || teams.length === 0) {
    console.error(chalk.red('No NHL teams found!'));
    return;
  }
  
  console.log(chalk.green(`Found ${teams.length} NHL teams\n`));
  
  // Get existing players to avoid duplicates
  const { data: existingPlayers } = await supabase
    .from('players')
    .select('external_id')
    .eq('sport', 'NHL');
  
  const existingPlayerIds = new Set(existingPlayers?.map(p => p.external_id) || []);
  console.log(chalk.gray(`${existingPlayerIds.size} NHL players already in database\n`));
  
  const allPlayers = [];
  let teamsProcessed = 0;
  
  // Process each team's roster
  await Promise.all(
    teams.map(team => 
      limit(async () => {
        try {
          const espnTeamId = team.external_id.split('_').pop();
          
          // Try multiple seasons to get comprehensive rosters
          const seasons = [2022, 2021, 2023];
          const foundPlayers = new Set<string>();
          
          for (const season of seasons) {
            const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/${espnTeamId}/roster?season=${season}`;
            
            try {
              const response = await axios.get(url, {
                timeout: 10000,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
              });
              
              if (response.data.athletes) {
                for (const athlete of response.data.athletes) {
                  const playerExternalId = `espn_nhl_${athlete.id}`;
                  
                  // Skip if already exists or already found
                  if (existingPlayerIds.has(playerExternalId) || foundPlayers.has(playerExternalId)) {
                    continue;
                  }
                  
                  foundPlayers.add(playerExternalId);
                  
                  allPlayers.push({
                    external_id: playerExternalId,
                    name: athlete.displayName || athlete.fullName || 'Unknown',
                    position: athlete.position?.abbreviation ? [athlete.position.abbreviation] : 
                             athlete.position?.displayName ? [athlete.position.displayName] : null,
                    team_id: team.id,
                    sport: 'NHL',
                    jersey_number: athlete.jersey,
                    metadata: {
                      height: athlete.height,
                      weight: athlete.weight,
                      age: athlete.age,
                      birthPlace: athlete.birthPlace,
                      status: athlete.status?.type?.name,
                      experience: athlete.experience?.years,
                      draft: athlete.draft,
                      collection_season: season
                    }
                  });
                }
              }
            } catch (error) {
              // Silently skip if season doesn't exist
            }
          }
          
          teamsProcessed++;
          console.log(chalk.gray(`${teamsProcessed}/${teams.length} - ${team.name}: ${foundPlayers.size} new players found`));
          
        } catch (error: any) {
          console.error(chalk.red(`Error processing ${team.name}:`, error.message));
        }
      })
    )
  );
  
  console.log(chalk.blue(`\nTotal new players found: ${allPlayers.length}`));
  
  // Insert players in batches
  if (allPlayers.length > 0) {
    console.log(chalk.yellow('\nInserting players...'));
    
    const batchSize = 1000;
    let inserted = 0;
    
    for (let i = 0; i < allPlayers.length; i += batchSize) {
      const batch = allPlayers.slice(i, i + batchSize);
      
      const { error, data } = await supabase
        .from('players')
        .insert(batch);
      
      if (error) {
        console.error(chalk.red('Insert error:'), error.message);
      } else {
        inserted += data?.length || batch.length;
      }
    }
    
    console.log(chalk.green(`\n✅ Inserted ${inserted} new NHL players!`));
  } else {
    console.log(chalk.yellow('\nNo new players to insert'));
  }
  
  // Final count
  const { count } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NHL');
  
  console.log(chalk.cyan(`\nTotal NHL players in database: ${count}`));
}

collectMissingNHLPlayers()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
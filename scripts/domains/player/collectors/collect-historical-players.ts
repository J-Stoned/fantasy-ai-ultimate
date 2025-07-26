#!/usr/bin/env tsx
/**
 * 👥 HISTORICAL PLAYER COLLECTOR
 * 
 * Collects ALL players from specific seasons by going through each team's roster
 * This ensures we have every player who played in that season
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const limit = pLimit(5); // 5 concurrent requests to not overwhelm ESPN

interface Player {
  external_id: string;
  name: string;
  position: string;
  team_id: number;
  sport: string;
  metadata: any;
}

async function collectHistoricalPlayers(sport: string, year: number) {
  console.log(chalk.bold.cyan(`👥 COLLECTING ${sport} ${year} HISTORICAL PLAYERS\n`));
  
  // Get all teams for this sport
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .eq('sport', sport);
    
  if (!teams) {
    console.log(chalk.red('No teams found'));
    return;
  }
  
  console.log(chalk.yellow(`Found ${teams.length} teams to process\n`));
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} teams | Players: {players}',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  }, cliProgress.Presets.shades_classic);
  
  progressBar.start(teams.length, 0, { players: 0 });
  
  const allPlayers: Player[] = [];
  let processedTeams = 0;
  
  // Process teams with concurrency
  const teamPromises = teams.map(team => 
    limit(async () => {
      try {
        const espnTeamId = team.external_id?.split('_').pop();
        if (!espnTeamId) return;
        
        // Get team roster for specific year
        const url = `https://site.api.espn.com/apis/site/v2/sports/${getSportPath(sport)}/teams/${espnTeamId}/roster?season=${year}`;
        const response = await axios.get(url, { timeout: 10000 });
        const roster = response.data;
        
        const teamPlayers: Player[] = [];
        
        if (roster.athletes) {
          for (const athlete of roster.athletes) {
            // Check if player already exists
            const { data: existingPlayer } = await supabase
              .from('players')
              .select('id')
              .eq('external_id', `espn_${sport.toLowerCase()}_${athlete.id}`)
              .single();
              
            if (!existingPlayer) {
              const player: Player = {
                external_id: `espn_${sport.toLowerCase()}_${athlete.id}`,
                name: athlete.displayName || `${athlete.firstName} ${athlete.lastName}`,
                position: athlete.position?.abbreviation || 'N/A',
                team_id: team.id,
                sport: sport,
                metadata: {
                  height: athlete.height,
                  weight: athlete.weight,
                  age: athlete.age,
                  experience: athlete.experience?.years,
                  jersey: athlete.jersey,
                  headshot: athlete.headshot?.href,
                  college: athlete.college?.name,
                  historical_season: year,
                  collection_source: 'historical-player-collector'
                }
              };
              
              teamPlayers.push(player);
              allPlayers.push(player);
            }
          }
        }
        
        processedTeams++;
        progressBar.update(processedTeams, { players: allPlayers.length });
        
        console.log(chalk.gray(`\n  ${team.name}: ${teamPlayers.length} new players`));
        
      } catch (error: any) {
        console.error(chalk.red(`\nError processing ${team.name}: ${error.message}`));
      }
    })
  );
  
  await Promise.all(teamPromises);
  progressBar.stop();
  
  // Insert players to database
  if (allPlayers.length > 0) {
    console.log(chalk.blue(`\n📤 Inserting ${allPlayers.length} new players to database...`));
    
    const batchSize = 1000;
    for (let i = 0; i < allPlayers.length; i += batchSize) {
      const batch = allPlayers.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('players')
        .upsert(batch, { 
          onConflict: 'external_id',
          ignoreDuplicates: true 
        });
        
      if (error) {
        console.error(chalk.red('Error inserting batch:', error));
      } else {
        console.log(chalk.green(`  ✅ Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allPlayers.length/batchSize)}`));
      }
    }
  }
  
  console.log(chalk.bold.green(`\n✅ ${sport} ${year} PLAYER COLLECTION COMPLETE!`));
  console.log(chalk.white(`Teams processed: ${processedTeams}`));
  console.log(chalk.white(`New players found: ${allPlayers.length}`));
  
  return allPlayers.length;
}

function getSportPath(sport: string): string {
  const mapping: Record<string, string> = {
    'NFL': 'football/nfl',
    'NBA': 'basketball/nba',
    'MLB': 'baseball/mlb',
    'NHL': 'hockey/nhl'
  };
  return mapping[sport] || sport.toLowerCase();
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(chalk.bold.green('👥 HISTORICAL PLAYER COLLECTOR\n'));
    console.log(chalk.green('Usage:'));
    console.log(chalk.white('  npx tsx collect-historical-players.ts NFL 2021'));
    console.log(chalk.white('  npx tsx collect-historical-players.ts NBA 2022'));
    return;
  }
  
  const [sport, yearStr] = args;
  const year = parseInt(yearStr);
  
  if (!['NFL', 'NBA', 'MLB', 'NHL'].includes(sport)) {
    console.error(chalk.red('Invalid sport. Use: NFL, NBA, MLB, NHL'));
    return;
  }
  
  if (year < 2020 || year > 2025) {
    console.error(chalk.red('Invalid year. Use: 2020-2025'));
    return;
  }
  
  await collectHistoricalPlayers(sport, year);
}

if (require.main === module) {
  main().catch(console.error);
}
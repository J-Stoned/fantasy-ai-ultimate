#!/usr/bin/env tsx
/**
 * 🏀 COLLECT ALL NBA PLAYERS
 * Fetches all NBA players from BallDontLie API
 * Skips existing players to avoid duplicates
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import cliProgress from 'cli-progress';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Team mapping
const NBA_TEAMS = new Map([
  // Atlantic Division
  [2, { espnId: '2', name: 'Boston Celtics', abbreviation: 'BOS' }],
  [3, { espnId: '17', name: 'Brooklyn Nets', abbreviation: 'BKN' }],
  [20, { espnId: '18', name: 'New York Knicks', abbreviation: 'NYK' }],
  [23, { espnId: '20', name: 'Philadelphia 76ers', abbreviation: 'PHI' }],
  [28, { espnId: '28', name: 'Toronto Raptors', abbreviation: 'TOR' }],
  
  // Central Division
  [5, { espnId: '4', name: 'Chicago Bulls', abbreviation: 'CHI' }],
  [6, { espnId: '5', name: 'Cleveland Cavaliers', abbreviation: 'CLE' }],
  [9, { espnId: '8', name: 'Detroit Pistons', abbreviation: 'DET' }],
  [12, { espnId: '11', name: 'Indiana Pacers', abbreviation: 'IND' }],
  [17, { espnId: '15', name: 'Milwaukee Bucks', abbreviation: 'MIL' }],
  
  // Southeast Division
  [1, { espnId: '1', name: 'Atlanta Hawks', abbreviation: 'ATL' }],
  [4, { espnId: '30', name: 'Charlotte Hornets', abbreviation: 'CHA' }],
  [16, { espnId: '14', name: 'Miami Heat', abbreviation: 'MIA' }],
  [22, { espnId: '19', name: 'Orlando Magic', abbreviation: 'ORL' }],
  [30, { espnId: '27', name: 'Washington Wizards', abbreviation: 'WAS' }],
  
  // Northwest Division
  [8, { espnId: '7', name: 'Denver Nuggets', abbreviation: 'DEN' }],
  [18, { espnId: '16', name: 'Minnesota Timberwolves', abbreviation: 'MIN' }],
  [21, { espnId: '25', name: 'Oklahoma City Thunder', abbreviation: 'OKC' }],
  [25, { espnId: '22', name: 'Portland Trail Blazers', abbreviation: 'POR' }],
  [29, { espnId: '26', name: 'Utah Jazz', abbreviation: 'UTA' }],
  
  // Pacific Division
  [10, { espnId: '9', name: 'Golden State Warriors', abbreviation: 'GSW' }],
  [13, { espnId: '12', name: 'Los Angeles Clippers', abbreviation: 'LAC' }],
  [14, { espnId: '13', name: 'Los Angeles Lakers', abbreviation: 'LAL' }],
  [24, { espnId: '21', name: 'Phoenix Suns', abbreviation: 'PHX' }],
  [26, { espnId: '23', name: 'Sacramento Kings', abbreviation: 'SAC' }],
  
  // Southwest Division
  [7, { espnId: '6', name: 'Dallas Mavericks', abbreviation: 'DAL' }],
  [11, { espnId: '10', name: 'Houston Rockets', abbreviation: 'HOU' }],
  [15, { espnId: '3', name: 'Memphis Grizzlies', abbreviation: 'MEM' }],
  [19, { espnId: '29', name: 'New Orleans Pelicans', abbreviation: 'NOP' }],
  [27, { espnId: '24', name: 'San Antonio Spurs', abbreviation: 'SAS' }]
]);

// Cache for team IDs
const teamCache = new Map<string, number>();
const existingPlayers = new Set<string>();

async function loadExistingPlayers() {
  console.log(chalk.yellow('Loading existing players...'));
  
  let offset = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data: players } = await supabase
      .from('players')
      .select('external_id')
      .not('external_id', 'is', null)
      .range(offset, offset + pageSize - 1);
    
    if (players && players.length > 0) {
      players.forEach(p => existingPlayers.add(p.external_id));
    }
    
    hasMore = players && players.length === pageSize;
    offset += pageSize;
  }
  
  console.log(chalk.green(`✅ Loaded ${existingPlayers.size} existing player IDs\n`));
}

async function getTeamId(ballDontLieTeamId: number): Promise<number | null> {
  const team = NBA_TEAMS.get(ballDontLieTeamId);
  if (!team) return null;
  
  const cacheKey = `team_${team.name}`;
  if (teamCache.has(cacheKey)) {
    return teamCache.get(cacheKey)!;
  }
  
  // Look up team by ESPN ID
  const { data } = await supabase
    .from('teams')
    .select('id')
    .eq('external_id', `espn_nba_${team.espnId}`)
    .single();
  
  if (data) {
    teamCache.set(cacheKey, data.id);
    return data.id;
  }
  
  return null;
}

async function collectPlayers() {
  console.log(chalk.bold.blue('\n🏀 COLLECTING ALL NBA PLAYERS\n'));
  
  const progressBar = new cliProgress.SingleBar({
    format: 'Progress |{bar}| {percentage}% | {value}/{total} players | New: {new}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  
  let page = 1;
  let hasMore = true;
  let totalPlayers = 0;
  let newPlayers = 0;
  let skippedPlayers = 0;
  const playersToInsert: any[] = [];
  
  // First, get total count
  const firstResponse = await axios.get('https://api.balldontlie.io/v1/players', {
    params: { per_page: 1 }
  });
  const totalCount = firstResponse.data.meta.total_count;
  
  progressBar.start(totalCount, 0, { new: 0 });
  
  while (hasMore) {
    try {
      const response = await axios.get('https://api.balldontlie.io/v1/players', {
        params: {
          per_page: 100,
          page: page
        }
      });
      
      const players = response.data.data;
      const meta = response.data.meta;
      
      for (const player of players) {
        totalPlayers++;
        
        // Skip if we already have this player
        const externalId = `balldontlie_nba_${player.id}`;
        if (existingPlayers.has(externalId)) {
          skippedPlayers++;
          progressBar.update(totalPlayers, { new: newPlayers });
          continue;
        }
        
        // Only process players with a team
        if (!player.team) {
          progressBar.update(totalPlayers, { new: newPlayers });
          continue;
        }
        
        const teamId = await getTeamId(player.team.id);
        if (!teamId) {
          progressBar.update(totalPlayers, { new: newPlayers });
          continue;
        }
        
        // Calculate height in inches
        let heightInches = null;
        if (player.height_feet && player.height_inches !== null) {
          heightInches = (player.height_feet * 12) + player.height_inches;
        }
        
        const playerData = {
          external_id: externalId,
          firstname: player.first_name || '',
          lastname: player.last_name || '',
          name: `${player.first_name} ${player.last_name}`,
          sport: 'NBA', // Correct sport field
          sport_id: 'nba',
          position: player.position ? [player.position] : [],
          team_id: teamId,
          jersey_number: player.jersey_number ? parseInt(player.jersey_number) : null,
          heightinches: heightInches,
          weightlbs: player.weight_pounds ? parseInt(player.weight_pounds) : null,
          status: 'active',
          team: NBA_TEAMS.get(player.team.id)?.name,
          team_abbreviation: NBA_TEAMS.get(player.team.id)?.abbreviation,
          metadata: {
            balldontlie_id: player.id,
            espn_team_id: NBA_TEAMS.get(player.team.id)?.espnId,
            team_full_name: player.team.full_name,
            team_city: player.team.city
          }
        };
        
        playersToInsert.push(playerData);
        newPlayers++;
        
        // Insert in batches of 50
        if (playersToInsert.length >= 50) {
          const { error } = await supabase
            .from('players')
            .insert(playersToInsert);
          
          if (error) {
            console.error(chalk.red('\nError inserting batch:'), error);
          }
          
          playersToInsert.length = 0;
        }
        
        progressBar.update(totalPlayers, { new: newPlayers });
      }
      
      // Check if there are more pages
      hasMore = meta.next_page !== null;
      page++;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error: any) {
      console.error(chalk.red(`\nError fetching page ${page}:`), error.message);
      if (error.response?.status === 429) {
        console.log(chalk.yellow('Rate limited, waiting 60 seconds...'));
        await new Promise(resolve => setTimeout(resolve, 60000));
      } else {
        hasMore = false;
      }
    }
  }
  
  // Insert any remaining players
  if (playersToInsert.length > 0) {
    const { error } = await supabase
      .from('players')
      .insert(playersToInsert);
    
    if (error) {
      console.error(chalk.red('\nError inserting final batch:'), error);
    }
  }
  
  progressBar.stop();
  
  console.log(chalk.green(`\n✅ Collection Complete!`));
  console.log(chalk.white(`   Total processed: ${totalPlayers}`));
  console.log(chalk.white(`   New players added: ${newPlayers}`));
  console.log(chalk.white(`   Skipped (existing): ${skippedPlayers}`));
  
  // Final count
  const { count } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA');
  
  console.log(chalk.cyan(`\n🗄️  Total NBA players in database: ${count}`));
}

async function main() {
  try {
    await loadExistingPlayers();
    await collectPlayers();
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  }
}

main();
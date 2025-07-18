#!/usr/bin/env tsx
/**
 * 🏈 CHECK 2021 NFL ROSTERS vs DATABASE
 * Compare actual 2021 team rosters with our player database
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

const limit = pLimit(12);

// NFL team IDs for ESPN API
const NFL_TEAMS = [
  { id: '1', name: 'Atlanta Falcons', abbr: 'ATL' },
  { id: '2', name: 'Buffalo Bills', abbr: 'BUF' },
  { id: '3', name: 'Chicago Bears', abbr: 'CHI' },
  { id: '4', name: 'Cincinnati Bengals', abbr: 'CIN' },
  { id: '5', name: 'Cleveland Browns', abbr: 'CLE' },
  { id: '6', name: 'Dallas Cowboys', abbr: 'DAL' },
  { id: '7', name: 'Denver Broncos', abbr: 'DEN' },
  { id: '8', name: 'Detroit Lions', abbr: 'DET' },
  { id: '9', name: 'Green Bay Packers', abbr: 'GB' },
  { id: '10', name: 'Tennessee Titans', abbr: 'TEN' },
  { id: '11', name: 'Indianapolis Colts', abbr: 'IND' },
  { id: '12', name: 'Kansas City Chiefs', abbr: 'KC' },
  { id: '13', name: 'Las Vegas Raiders', abbr: 'LV' },
  { id: '14', name: 'Los Angeles Rams', abbr: 'LAR' },
  { id: '15', name: 'Miami Dolphins', abbr: 'MIA' },
  { id: '16', name: 'Minnesota Vikings', abbr: 'MIN' },
  { id: '17', name: 'New England Patriots', abbr: 'NE' },
  { id: '18', name: 'New Orleans Saints', abbr: 'NO' },
  { id: '19', name: 'New York Giants', abbr: 'NYG' },
  { id: '20', name: 'New York Jets', abbr: 'NYJ' },
  { id: '21', name: 'Philadelphia Eagles', abbr: 'PHI' },
  { id: '22', name: 'Arizona Cardinals', abbr: 'ARI' },
  { id: '23', name: 'Pittsburgh Steelers', abbr: 'PIT' },
  { id: '24', name: 'Los Angeles Chargers', abbr: 'LAC' },
  { id: '25', name: 'San Francisco 49ers', abbr: 'SF' },
  { id: '26', name: 'Seattle Seahawks', abbr: 'SEA' },
  { id: '27', name: 'Tampa Bay Buccaneers', abbr: 'TB' },
  { id: '28', name: 'Washington Commanders', abbr: 'WAS' },
  { id: '29', name: 'Carolina Panthers', abbr: 'CAR' },
  { id: '30', name: 'Jacksonville Jaguars', abbr: 'JAX' },
  { id: '33', name: 'Baltimore Ravens', abbr: 'BAL' },
  { id: '34', name: 'Houston Texans', abbr: 'HOU' }
];

async function check2021Rosters() {
  console.log(chalk.bold.cyan('🏈 CHECKING 2021 NFL ROSTERS vs DATABASE\n'));

  // Load existing NFL players from DB
  const { data: dbPlayers } = await supabase
    .from('players')
    .select('external_id, name')
    .eq('sport', 'NFL');

  const dbPlayerSet = new Set(dbPlayers?.map(p => p.external_id) || []);
  console.log(chalk.yellow(`Current NFL players in database: ${dbPlayerSet.size}\n`));

  let totalRosterPlayers = 0;
  let totalMissingPlayers = 0;
  const missingByPosition: Record<string, number> = {};
  const allMissingPlayers: Array<{id: string, name: string, team: string, position: string}> = [];

  // Check each team's 2021 roster
  const teamPromises = NFL_TEAMS.map(team => 
    limit(async () => {
      try {
        // Get 2021 roster
        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${team.id}/roster?season=2021`;
        const response = await axios.get(url, { timeout: 10000 });
        const roster = response.data;

        let teamTotal = 0;
        let teamMissing = 0;

        // Check each position group
        if (roster.athletes) {
          for (const group of roster.athletes) {
            const position = group.position;
            
            for (const player of group.items || []) {
              teamTotal++;
              totalRosterPlayers++;
              
              const playerId = player.id;
              const playerName = player.displayName || player.fullName;
              const playerExternalId = `espn_nfl_${playerId}`;
              
              if (!dbPlayerSet.has(playerExternalId)) {
                teamMissing++;
                totalMissingPlayers++;
                missingByPosition[position] = (missingByPosition[position] || 0) + 1;
                
                allMissingPlayers.push({
                  id: playerId,
                  name: playerName,
                  team: team.abbr,
                  position: position
                });
              }
            }
          }
        }

        console.log(chalk.gray(`${team.abbr}: ${teamTotal} players (${teamMissing} missing)`));

      } catch (error: any) {
        console.error(chalk.red(`Error fetching ${team.name} roster: ${error.message}`));
      }
    })
  );

  await Promise.all(teamPromises);

  // Show results
  console.log(chalk.bold.green(`\n📊 2021 ROSTER ANALYSIS:\n`));
  console.log(chalk.cyan(`Total players on 2021 rosters: ${totalRosterPlayers}`));
  console.log(chalk.yellow(`Players in our database: ${dbPlayerSet.size}`));
  console.log(chalk.red(`Missing players: ${totalMissingPlayers}`));
  console.log(chalk.green(`Coverage: ${Math.round((dbPlayerSet.size / (dbPlayerSet.size + totalMissingPlayers)) * 100)}%`));

  // Show missing by position
  console.log(chalk.bold.cyan('\nMissing players by position:'));
  Object.entries(missingByPosition)
    .sort((a, b) => b[1] - a[1])
    .forEach(([pos, count]) => {
      console.log(`  ${pos}: ${count} players`);
    });

  // Calculate expected stats per game
  const avgPlayersPerTeam = totalRosterPlayers / 32;
  const expectedStatsPerGame = avgPlayersPerTeam * 2; // 2 teams per game
  
  console.log(chalk.bold.yellow(`\nExpected stats per game with full rosters: ~${Math.round(expectedStatsPerGame)}`));
  console.log(chalk.yellow(`Current average: 43 stats per game`));
  console.log(chalk.red(`Missing: ~${Math.round(expectedStatsPerGame - 43)} stats per game`));

  // Save missing players to file for batch addition
  if (allMissingPlayers.length > 0) {
    const fs = require('fs');
    fs.writeFileSync(
      'missing-2021-players.json', 
      JSON.stringify(allMissingPlayers, null, 2)
    );
    console.log(chalk.green(`\n✅ Saved ${allMissingPlayers.length} missing players to missing-2021-players.json`));
  }

  return allMissingPlayers;
}

check2021Rosters().catch(console.error);
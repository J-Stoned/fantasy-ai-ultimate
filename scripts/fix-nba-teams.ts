#!/usr/bin/env node

/**
 * 🏀 Fix NBA Teams
 * Ensures all NBA teams are properly created in the database
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NBA_TEAMS = [
  // Atlantic Division
  { espnId: '2', tricode: 'BOS', name: 'Celtics', fullName: 'Boston Celtics', city: 'Boston' },
  { espnId: '17', tricode: 'BKN', name: 'Nets', fullName: 'Brooklyn Nets', city: 'Brooklyn' },
  { espnId: '18', tricode: 'NYK', name: 'Knicks', fullName: 'New York Knicks', city: 'New York' },
  { espnId: '20', tricode: 'PHI', name: '76ers', fullName: 'Philadelphia 76ers', city: 'Philadelphia' },
  { espnId: '28', tricode: 'TOR', name: 'Raptors', fullName: 'Toronto Raptors', city: 'Toronto' },
  
  // Central Division
  { espnId: '4', tricode: 'CHI', name: 'Bulls', fullName: 'Chicago Bulls', city: 'Chicago' },
  { espnId: '5', tricode: 'CLE', name: 'Cavaliers', fullName: 'Cleveland Cavaliers', city: 'Cleveland' },
  { espnId: '8', tricode: 'DET', name: 'Pistons', fullName: 'Detroit Pistons', city: 'Detroit' },
  { espnId: '11', tricode: 'IND', name: 'Pacers', fullName: 'Indiana Pacers', city: 'Indiana' },
  { espnId: '15', tricode: 'MIL', name: 'Bucks', fullName: 'Milwaukee Bucks', city: 'Milwaukee' },
  
  // Southeast Division
  { espnId: '1', tricode: 'ATL', name: 'Hawks', fullName: 'Atlanta Hawks', city: 'Atlanta' },
  { espnId: '30', tricode: 'CHA', name: 'Hornets', fullName: 'Charlotte Hornets', city: 'Charlotte' },
  { espnId: '14', tricode: 'MIA', name: 'Heat', fullName: 'Miami Heat', city: 'Miami' },
  { espnId: '19', tricode: 'ORL', name: 'Magic', fullName: 'Orlando Magic', city: 'Orlando' },
  { espnId: '27', tricode: 'WAS', name: 'Wizards', fullName: 'Washington Wizards', city: 'Washington' },
  
  // Northwest Division
  { espnId: '7', tricode: 'DEN', name: 'Nuggets', fullName: 'Denver Nuggets', city: 'Denver' },
  { espnId: '16', tricode: 'MIN', name: 'Timberwolves', fullName: 'Minnesota Timberwolves', city: 'Minnesota' },
  { espnId: '25', tricode: 'OKC', name: 'Thunder', fullName: 'Oklahoma City Thunder', city: 'Oklahoma City' },
  { espnId: '22', tricode: 'POR', name: 'Trail Blazers', fullName: 'Portland Trail Blazers', city: 'Portland' },
  { espnId: '26', tricode: 'UTA', name: 'Jazz', fullName: 'Utah Jazz', city: 'Utah' },
  
  // Pacific Division
  { espnId: '9', tricode: 'GSW', name: 'Warriors', fullName: 'Golden State Warriors', city: 'Golden State' },
  { espnId: '12', tricode: 'LAC', name: 'Clippers', fullName: 'Los Angeles Clippers', city: 'Los Angeles' },
  { espnId: '13', tricode: 'LAL', name: 'Lakers', fullName: 'Los Angeles Lakers', city: 'Los Angeles' },
  { espnId: '21', tricode: 'PHX', name: 'Suns', fullName: 'Phoenix Suns', city: 'Phoenix' },
  { espnId: '23', tricode: 'SAC', name: 'Kings', fullName: 'Sacramento Kings', city: 'Sacramento' },
  
  // Southwest Division
  { espnId: '6', tricode: 'DAL', name: 'Mavericks', fullName: 'Dallas Mavericks', city: 'Dallas' },
  { espnId: '10', tricode: 'HOU', name: 'Rockets', fullName: 'Houston Rockets', city: 'Houston' },
  { espnId: '29', tricode: 'MEM', name: 'Grizzlies', fullName: 'Memphis Grizzlies', city: 'Memphis' },
  { espnId: '3', tricode: 'NOP', name: 'Pelicans', fullName: 'New Orleans Pelicans', city: 'New Orleans' },
  { espnId: '24', tricode: 'SAS', name: 'Spurs', fullName: 'San Antonio Spurs', city: 'San Antonio' }
];

async function fixNBATeams() {
  console.log(chalk.bold.blue('\n🏀 Fixing NBA Teams...\n'));
  
  let created = 0;
  let existing = 0;
  let errors = 0;
  
  for (const team of NBA_TEAMS) {
    try {
      // Check if team exists
      const { data: existingTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('external_id', `espn_nba_${team.espnId}`)
        .single();
      
      if (existingTeam) {
        existing++;
        console.log(chalk.gray(`✓ ${team.fullName} already exists`));
        continue;
      }
      
      // Create team with minimal required fields
      const teamData = {
        external_id: `espn_nba_${team.espnId}`,
        name: team.fullName,
        city: team.city,
        abbreviation: team.tricode,
        sport: 'basketball',
        sport_id: 'nba',
        league_id: 'nba',
        logo_url: `https://a.espncdn.com/i/teamlogos/nba/500/${team.tricode.toLowerCase()}.png`,
        metadata: {
          espn_id: team.espnId,
          league: 'NBA',
          conference: getConference(team.tricode),
          division: getDivision(team.tricode)
        }
      };
      
      const { error } = await supabase
        .from('teams')
        .insert(teamData);
      
      if (error) {
        errors++;
        console.error(chalk.red(`✗ Error creating ${team.fullName}:`), error.message);
      } else {
        created++;
        console.log(chalk.green(`✓ Created ${team.fullName}`));
      }
      
    } catch (error: any) {
      errors++;
      console.error(chalk.red(`✗ Error with ${team.fullName}:`), error.message);
    }
  }
  
  console.log(chalk.bold.cyan('\n📊 Summary:'));
  console.log(chalk.green(`  ✓ Created: ${created} teams`));
  console.log(chalk.gray(`  - Existing: ${existing} teams`));
  if (errors > 0) {
    console.log(chalk.red(`  ✗ Errors: ${errors} teams`));
  }
  console.log(chalk.cyan(`  Total: ${NBA_TEAMS.length} teams\n`));
}

function getConference(tricode: string): string {
  const eastTeams = ['BOS', 'BKN', 'NYK', 'PHI', 'TOR', 'CHI', 'CLE', 'DET', 'IND', 'MIL', 
                     'ATL', 'CHA', 'MIA', 'ORL', 'WAS'];
  return eastTeams.includes(tricode) ? 'Eastern' : 'Western';
}

function getDivision(tricode: string): string {
  const divisions: { [key: string]: string[] } = {
    'Atlantic': ['BOS', 'BKN', 'NYK', 'PHI', 'TOR'],
    'Central': ['CHI', 'CLE', 'DET', 'IND', 'MIL'],
    'Southeast': ['ATL', 'CHA', 'MIA', 'ORL', 'WAS'],
    'Northwest': ['DEN', 'MIN', 'OKC', 'POR', 'UTA'],
    'Pacific': ['GSW', 'LAC', 'LAL', 'PHX', 'SAC'],
    'Southwest': ['DAL', 'HOU', 'MEM', 'NOP', 'SAS']
  };
  
  for (const [division, teams] of Object.entries(divisions)) {
    if (teams.includes(tricode)) return division;
  }
  
  return 'Unknown';
}

fixNBATeams().catch(console.error);
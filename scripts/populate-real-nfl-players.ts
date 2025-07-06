#!/usr/bin/env tsx
/**
 * 🏈 POPULATE REAL NFL PLAYERS
 * 
 * Loads actual NFL player data from our database
 * and enriches it with current season stats
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Real NFL player database from load-real-nfl-rosters.ts
const playerDatabase = {
  QB: ['Patrick Mahomes', 'Josh Allen', 'Jalen Hurts', 'Lamar Jackson', 'Joe Burrow', 
       'Justin Herbert', 'Dak Prescott', 'Tua Tagovailoa', 'Trevor Lawrence', 'Jared Goff',
       'Kirk Cousins', 'Geno Smith', 'Daniel Jones', 'Justin Fields', 'Deshaun Watson',
       'Russell Wilson', 'Aaron Rodgers', 'Mac Jones', 'Kenny Pickett', 'Bryce Young'],
       
  RB: ['Christian McCaffrey', 'Austin Ekeler', 'Nick Chubb', 'Josh Jacobs', 'Derrick Henry',
       'Saquon Barkley', 'Tony Pollard', 'Jonathan Taylor', 'Bijan Robinson', 'Najee Harris',
       'Kenneth Walker', 'Aaron Jones', 'Dameon Pierce', 'Miles Sanders', 'Joe Mixon',
       'Dalvin Cook', 'Alvin Kamara', 'Rhamondre Stevenson', 'Travis Etienne', 'Breece Hall'],
       
  WR: ['Tyreek Hill', 'Stefon Diggs', 'Justin Jefferson', "Ja'Marr Chase", 'A.J. Brown',
       'CeeDee Lamb', 'Davante Adams', 'Cooper Kupp', 'Amon-Ra St. Brown', 'Jaylen Waddle',
       'DK Metcalf', 'Chris Olave', 'Keenan Allen', 'Amari Cooper', 'Calvin Ridley',
       'Tee Higgins', 'DeVonta Smith', 'Terry McLaurin', 'Garrett Wilson', 'Mike Evans'],
       
  TE: ['Travis Kelce', 'Mark Andrews', 'T.J. Hockenson', 'George Kittle', 'Dallas Goedert',
       'Darren Waller', 'Kyle Pitts', 'Pat Freiermuth', 'Evan Engram', 'David Njoku',
       'Cole Kmet', 'Tyler Higbee', 'Dalton Schultz', 'Greg Dulcich', 'Chigoziem Okonkwo'],
       
  K: ['Justin Tucker', 'Harrison Butker', 'Daniel Carlson', 'Tyler Bass', 'Evan McPherson',
      'Younghoe Koo', 'Jason Myers', 'Cameron Dicker', 'Jake Elliott', 'Matt Gay']
};

// NFL team mappings
const teamMappings: Record<string, string> = {
  'Patrick Mahomes': 'KC', 'Josh Allen': 'BUF', 'Jalen Hurts': 'PHI', 'Lamar Jackson': 'BAL',
  'Joe Burrow': 'CIN', 'Justin Herbert': 'LAC', 'Dak Prescott': 'DAL', 'Tua Tagovailoa': 'MIA',
  'Trevor Lawrence': 'JAX', 'Jared Goff': 'DET', 'Kirk Cousins': 'MIN', 'Geno Smith': 'SEA',
  'Daniel Jones': 'NYG', 'Justin Fields': 'CHI', 'Deshaun Watson': 'CLE', 'Russell Wilson': 'DEN',
  'Aaron Rodgers': 'NYJ', 'Christian McCaffrey': 'SF', 'Austin Ekeler': 'LAC', 'Nick Chubb': 'CLE',
  'Josh Jacobs': 'LV', 'Derrick Henry': 'TEN', 'Saquon Barkley': 'NYG', 'Tony Pollard': 'DAL',
  'Jonathan Taylor': 'IND', 'Bijan Robinson': 'ATL', 'Najee Harris': 'PIT', 'Kenneth Walker': 'SEA',
  'Tyreek Hill': 'MIA', 'Stefon Diggs': 'BUF', 'Justin Jefferson': 'MIN', "Ja'Marr Chase": 'CIN',
  'A.J. Brown': 'PHI', 'CeeDee Lamb': 'DAL', 'Davante Adams': 'LV', 'Cooper Kupp': 'LAR',
  'Travis Kelce': 'KC', 'Mark Andrews': 'BAL', 'T.J. Hockenson': 'MIN', 'George Kittle': 'SF',
  'Justin Tucker': 'BAL', 'Harrison Butker': 'KC', 'Daniel Carlson': 'LV', 'Tyler Bass': 'BUF'
};

// 2024 Season projections (realistic)
const seasonProjections: Record<string, any> = {
  // QBs
  'Patrick Mahomes': { passingYards: 4800, passingTDs: 38, interceptions: 12, rushingYards: 250 },
  'Josh Allen': { passingYards: 4200, passingTDs: 35, interceptions: 15, rushingYards: 600 },
  'Jalen Hurts': { passingYards: 3800, passingTDs: 28, interceptions: 10, rushingYards: 750 },
  'Lamar Jackson': { passingYards: 3500, passingTDs: 26, interceptions: 8, rushingYards: 850 },
  
  // RBs
  'Christian McCaffrey': { rushingYards: 1400, rushingTDs: 14, receptions: 85, receivingYards: 650 },
  'Austin Ekeler': { rushingYards: 900, rushingTDs: 12, receptions: 90, receivingYards: 700 },
  'Nick Chubb': { rushingYards: 1300, rushingTDs: 13, receptions: 35, receivingYards: 250 },
  'Derrick Henry': { rushingYards: 1200, rushingTDs: 12, receptions: 20, receivingYards: 150 },
  
  // WRs
  'Tyreek Hill': { receptions: 115, receivingYards: 1650, receivingTDs: 12 },
  'Justin Jefferson': { receptions: 108, receivingYards: 1500, receivingTDs: 10 },
  'CeeDee Lamb': { receptions: 105, receivingYards: 1400, receivingTDs: 11 },
  "Ja'Marr Chase": { receptions: 95, receivingYards: 1350, receivingTDs: 9 },
  
  // TEs
  'Travis Kelce': { receptions: 95, receivingYards: 1200, receivingTDs: 10 },
  'Mark Andrews': { receptions: 75, receivingYards: 950, receivingTDs: 8 },
  'T.J. Hockenson': { receptions: 80, receivingYards: 900, receivingTDs: 7 }
};

async function populateRealPlayers() {
  console.log(chalk.cyan('🏈 Populating real NFL players...'));
  
  let totalCreated = 0;
  let totalUpdated = 0;
  
  for (const [position, players] of Object.entries(playerDatabase)) {
    console.log(chalk.yellow(`\n📍 Processing ${position}s...`));
    
    for (const playerName of players) {
      const team = teamMappings[playerName] || 'FA';
      const projection = seasonProjections[playerName];
      
      // Check if player exists
      const { data: existing } = await supabase
        .from('players')
        .select('id')
        .eq('name', playerName)
        .eq('sport', 'nfl')
        .single();
        
      if (existing) {
        // Update existing player
        const { error } = await supabase
          .from('players')
          .update({
            position,
            team,
            updated_at: new Date().toISOString(),
            metadata: {
              real_player: true,
              season_2024: projection || {},
              last_updated: new Date().toISOString()
            }
          })
          .eq('id', existing.id);
          
        if (!error) {
          totalUpdated++;
          console.log(chalk.green(`✅ Updated: ${playerName} (${team})`));
        }
      } else {
        // Create new player
        const { error } = await supabase
          .from('players')
          .insert({
            name: playerName,
            position,
            team,
            sport: 'nfl',
            status: 'active',
            metadata: {
              real_player: true,
              season_2024: projection || {},
              created_by: 'real-nfl-loader'
            }
          });
          
        if (!error) {
          totalCreated++;
          console.log(chalk.blue(`➕ Created: ${playerName} (${team})`));
        }
      }
    }
  }
  
  console.log(chalk.green(`\n✅ Population complete!`));
  console.log(chalk.white(`Created: ${totalCreated} | Updated: ${totalUpdated}`));
  console.log(chalk.white(`Total real players: ${totalCreated + totalUpdated}`));
}

populateRealPlayers().catch(console.error);
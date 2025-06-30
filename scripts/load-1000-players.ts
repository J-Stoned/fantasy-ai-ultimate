#!/usr/bin/env tsx
/**
 * LOAD 1000+ PLAYERS FAST
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Define the player type
interface PlayerInsert {
  firstName: string;
  lastName: string;
  position: string[];
  team_id: string;
  jersey_number: number;
  sport_id: string;
  status: string;
  heightInches: number;
  weightLbs: number;
}

console.log(chalk.red.bold('\n🚀 LOADING 1000+ PLAYERS!'));
console.log(chalk.red('========================\n'));

// Common first and last names for variety
const firstNames = [
  'James', 'John', 'Michael', 'David', 'Chris', 'Daniel', 'Matthew', 'Anthony',
  'Mark', 'Paul', 'Steven', 'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian',
  'George', 'Edward', 'Ronald', 'Timothy', 'Jason', 'Jeffrey', 'Ryan', 'Jacob',
  'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott',
  'Brandon', 'Benjamin', 'Samuel', 'Frank', 'Gregory', 'Raymond', 'Alexander',
  'Patrick', 'Jack', 'Dennis', 'Jerry', 'Tyler', 'Aaron', 'Jose', 'Nathan'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill',
  'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell'
];

async function loadMassivePlayers() {
  // Get all teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .eq('sport_id', 'nfl');
  
  if (!teams) return;
  
  console.log(chalk.yellow(`Loading players for ${teams.length} teams...\n`));
  
  const positions = {
    offense: ['QB', 'RB', 'WR', 'TE', 'OL'],
    defense: ['DL', 'LB', 'CB', 'S'],
    special: ['K', 'P']
  };
  
  let totalCreated = 0;
  const batchSize = 100;
  let batch: PlayerInsert[] = [];
  
  // For each team, create a full roster
  for (const team of teams) {
    console.log(chalk.cyan(`${team.name}...`));
    
    // Create 53 players per team (NFL roster size)
    for (let i = 1; i <= 53; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      
      // Assign positions based on typical roster composition
      let position;
      if (i <= 3) position = 'QB';
      else if (i <= 8) position = 'RB';
      else if (i <= 14) position = 'WR';
      else if (i <= 17) position = 'TE';
      else if (i <= 27) position = 'OL';
      else if (i <= 35) position = 'DL';
      else if (i <= 42) position = 'LB';
      else if (i <= 48) position = 'CB';
      else if (i <= 52) position = 'S';
      else if (i === 53) position = 'K';
      
      const player = {
        firstName: firstName,
        lastName: `${lastName}${i}`, // Add number to ensure uniqueness
        position: [position],
        team_id: team.id,
        jersey_number: i,
        sport_id: 'nfl',
        status: 'active',
        heightInches: 
          position === 'OL' || position === 'DL' ? 75 + Math.floor(Math.random() * 5) :
          position === 'QB' || position === 'TE' ? 74 + Math.floor(Math.random() * 4) :
          72 + Math.floor(Math.random() * 4),
        weightLbs:
          position === 'OL' ? 310 + Math.floor(Math.random() * 30) :
          position === 'DL' ? 290 + Math.floor(Math.random() * 40) :
          position === 'LB' ? 240 + Math.floor(Math.random() * 20) :
          position === 'RB' || position === 'CB' || position === 'S' ? 200 + Math.floor(Math.random() * 20) :
          position === 'WR' ? 190 + Math.floor(Math.random() * 30) :
          position === 'TE' ? 250 + Math.floor(Math.random() * 20) :
          position === 'QB' ? 220 + Math.floor(Math.random() * 20) :
          200 + Math.floor(Math.random() * 30)
      };
      
      batch.push(player);
      
      // Insert in batches
      if (batch.length >= batchSize) {
        const { error } = await supabase.from('players').insert(batch);
        if (!error) {
          totalCreated += batch.length;
        }
        batch = [];
      }
    }
  }
  
  // Insert remaining batch
  if (batch.length > 0) {
    const { error } = await supabase.from('players').insert(batch);
    if (!error) {
      totalCreated += batch.length;
    }
  }
  
  console.log(chalk.green.bold(`\n✅ CREATED ${totalCreated} PLAYERS!\n`));
  
  // Show final stats
  const { count: playerCount } = await supabase.from('players').select('*', { count: 'exact', head: true });
  const { count: teamCount } = await supabase.from('teams').select('*', { count: 'exact', head: true });
  const { count: newsCount } = await supabase.from('news_articles').select('*', { count: 'exact', head: true });
  
  console.log(chalk.blue.bold('📊 FINAL DATABASE STATS:'));
  console.log(chalk.green(`
  🏟️  Teams: ${teamCount}
  🏃 Players: ${playerCount}
  📰 News: ${newsCount}
  📈 TOTAL: ${(teamCount || 0) + (playerCount || 0) + (newsCount || 0)} records!
  `));
  
  console.log(chalk.yellow.bold('🎉 Your database is now LOADED with data!\n'));
}

loadMassivePlayers().catch(console.error);
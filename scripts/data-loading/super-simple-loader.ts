#!/usr/bin/env tsx
/**
 * SUPER SIMPLE DATA LOADER
 * Just loads teams without external_id
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

console.log(chalk.blue.bold('\n💾 SUPER SIMPLE DATA LOADER'));
console.log(chalk.blue('===========================\n'));

async function loadAllTeams() {
  console.log(chalk.yellow('Loading all NFL teams...'));
  
  try {
    const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams');
    const teams = response.data.sports[0].leagues[0].teams;
    let count = 0;
    
    for (const teamData of teams) {
      const team = teamData.team;
      
      const { error } = await supabase.from('teams').insert({
        name: team.displayName,
        city: team.location,
        abbreviation: team.abbreviation,
        sport_id: 'nfl',
        league_id: 'NFL',
        logo_url: team.logos?.[0]?.href
      });
      
      if (!error) count++;
    }
    
    console.log(chalk.green(`✅ Loaded ${count} NFL teams!\n`));
    
    // Now create sample players for each team
    console.log(chalk.yellow('Creating sample players...'));
    
    const { data: allTeams } = await supabase
      .from('teams')
      .select('id, name')
      .eq('sport_id', 'nfl');
    
    if (allTeams) {
      let playerCount = 0;
      
      for (const team of allTeams) {
        // Create 10 sample players per team
        for (let i = 1; i <= 10; i++) {
          const positions = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S'];
          const position = positions[i % positions.length];
          
          const { error } = await supabase.from('players').insert({
            firstName: `Player${i}`,
            lastName: team.name.replace(/\s+/g, ''),
            position: [position],
            team_id: team.id,
            jersey_number: i,
            sport_id: 'nfl',
            status: 'active'
          });
          
          if (!error) playerCount++;
        }
      }
      
      console.log(chalk.green(`✅ Created ${playerCount} players!\n`));
    }
    
  } catch (error) {
    console.error(chalk.red('Error:', error.message));
  }
  
  // Show final counts
  console.log(chalk.blue('\n📊 FINAL DATABASE COUNTS:'));
  
  const { count: teamCount } = await supabase.from('teams').select('*', { count: 'exact', head: true });
  const { count: playerCount } = await supabase.from('players').select('*', { count: 'exact', head: true });
  const { count: newsCount } = await supabase.from('news_articles').select('*', { count: 'exact', head: true });
  
  console.log(`Teams: ${teamCount}`);
  console.log(`Players: ${playerCount}`);
  console.log(`News: ${newsCount}`);
  console.log(chalk.green.bold(`\nTOTAL: ${(teamCount || 0) + (playerCount || 0) + (newsCount || 0)} records!\n`));
}

loadAllTeams().catch(console.error);
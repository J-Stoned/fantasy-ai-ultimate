#!/usr/bin/env tsx
/**
 * 🔍 CHECK NBA DATA INTEGRITY
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNBADataIntegrity() {
  console.log(chalk.bold.cyan('\n🔍 CHECKING NBA DATA INTEGRITY\n'));
  
  // 1. Check NBA teams
  console.log(chalk.yellow('NBA Teams:'));
  const { data: nbaTeams } = await supabase
    .from('teams')
    .select('id, name, sport_id, external_id')
    .eq('sport_id', 2)
    .order('name');
  
  if (nbaTeams && nbaTeams.length > 0) {
    console.log(`Found ${nbaTeams.length} NBA teams`);
    nbaTeams.slice(0, 5).forEach(team => {
      console.log(`  ${team.id}: ${team.name} (${team.external_id})`);
    });
  } else {
    console.log(chalk.red('No NBA teams found with sport_id=2'));
  }
  
  // 2. Check a sample NBA game
  console.log(chalk.yellow('\nSample NBA Game:'));
  const { data: sampleGame } = await supabase
    .from('games')
    .select('*')
    .eq('sport_id', 'nba')
    .not('home_score', 'is', null)
    .limit(1)
    .single();
  
  if (sampleGame) {
    console.log(`Game ID: ${sampleGame.id}`);
    console.log(`External ID: ${sampleGame.external_id}`);
    console.log(`Home Team ID: ${sampleGame.home_team_id}`);
    console.log(`Away Team ID: ${sampleGame.away_team_id}`);
    
    // Get team names
    const { data: homeTeam } = await supabase
      .from('teams')
      .select('name, sport_id')
      .eq('id', sampleGame.home_team_id)
      .single();
    
    const { data: awayTeam } = await supabase
      .from('teams')
      .select('name, sport_id')
      .eq('id', sampleGame.away_team_id)
      .single();
    
    console.log(`Home Team: ${homeTeam?.name} (sport_id: ${homeTeam?.sport_id})`);
    console.log(`Away Team: ${awayTeam?.name} (sport_id: ${awayTeam?.sport_id})`);
  }
  
  // 3. Check sport mapping
  console.log(chalk.yellow('\nSport Mapping:'));
  const { data: sports } = await supabase
    .from('sports')
    .select('*');
  
  if (sports) {
    sports.forEach(sport => {
      console.log(`  ${sport.id}: ${sport.name}`);
    });
  }
  
  // 4. Check team sport distribution
  console.log(chalk.yellow('\nTeam Distribution by Sport:'));
  const { data: teamCounts } = await supabase
    .from('teams')
    .select('sport_id');
  
  if (teamCounts) {
    const counts = teamCounts.reduce((acc, team) => {
      acc[team.sport_id] = (acc[team.sport_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(counts).forEach(([sportId, count]) => {
      console.log(`  Sport ${sportId}: ${count} teams`);
    });
  }
}

checkNBADataIntegrity();
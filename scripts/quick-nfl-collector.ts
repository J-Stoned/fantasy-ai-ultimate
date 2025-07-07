#!/usr/bin/env tsx
/**
 * Quick NFL collector - Gets REAL NFL data fast
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function collectNFL() {
  console.log(chalk.blue.bold('🏈 COLLECTING REAL NFL DATA\n'));
  
  try {
    // 1. Get NFL teams
    console.log(chalk.yellow('1. Getting NFL teams...'));
    const teamsResponse = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams');
    
    let teamCount = 0;
    const teams = teamsResponse.data.sports[0].leagues[0].teams;
    
    for (const team of teams) {
      const teamData = {
        id: `nfl_${team.team.id}`,
        name: team.team.displayName,
        abbreviation: team.team.abbreviation,
        sport: 'nfl',
        location: team.team.location,
        nickname: team.team.nickname,
        logo_url: team.team.logos?.[0]?.href || null,
        primary_color: team.team.color || null,
        conference: team.team.groups?.[0]?.name || null,
        division: team.team.groups?.[1]?.name || null
      };
      
      const { error } = await supabase
        .from('teams')
        .upsert(teamData, { onConflict: 'id' });
        
      if (!error) teamCount++;
    }
    
    console.log(chalk.green(`   ✓ Added ${teamCount} NFL teams`));
    
    // 2. Get recent games (2024 season)
    console.log(chalk.yellow('\n2. Getting 2024 NFL games...'));
    
    let gameCount = 0;
    // Get games from weeks 1-18 of 2024 season
    for (let week = 1; week <= 18; week++) {
      console.log(chalk.gray(`   Week ${week}...`));
      
      const gamesResponse = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=2024`
      );
      
      for (const event of gamesResponse.data.events || []) {
        const competition = event.competitions[0];
        const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home');
        const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away');
        
        const gameData = {
          id: `nfl_${event.id}`,
          sport: 'nfl',
          season: 2024,
          season_type: 2, // Regular season
          week: week,
          start_time: event.date,
          status: event.status.type.name,
          home_team_id: `nfl_${homeTeam.team.id}`,
          away_team_id: `nfl_${awayTeam.team.id}`,
          home_score: event.status.type.completed ? parseInt(homeTeam.score) : null,
          away_score: event.status.type.completed ? parseInt(awayTeam.score) : null,
          venue: competition.venue?.fullName || null,
          attendance: competition.attendance || null,
          broadcast: competition.broadcasts?.[0]?.names?.[0] || null
        };
        
        const { error } = await supabase
          .from('games')
          .upsert(gameData, { onConflict: 'id' });
          
        if (!error) gameCount++;
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(chalk.green(`   ✓ Added ${gameCount} NFL games`));
    
    // 3. Summary
    console.log(chalk.green.bold('\n✅ COLLECTION COMPLETE!\n'));
    console.log('Summary:');
    console.log(`  • ${teamCount} NFL teams`);
    console.log(`  • ${gameCount} games from 2024 season`);
    console.log(chalk.cyan('\nNow you have REAL NFL data to work with!'));
    
  } catch (error: any) {
    console.error(chalk.red('Error:'), error.message);
  }
}

collectNFL().catch(console.error);